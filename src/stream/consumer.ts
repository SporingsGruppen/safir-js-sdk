import { ShardIteratorType } from "@aws-sdk/client-kinesis";
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from "./dynamo-db";
import { KinesisClient } from "./kinesis";
import {
    ReadStreamTelemetryMetadata,
    ReadStreamTelemetryResponse,
    ShardLease,
    ShardResponse,
    ShardState,
    StreamConsumerConfig,
    StreamTelemetryRecord
} from "./types";

export class StreamConsumer {
    private readonly kinesisClient: KinesisClient;
    private readonly dynamoDbClient: DynamoDBClient;
    private readonly instanceId: string;
    private readonly config: Required<StreamConsumerConfig>;
    private shardState: Map<string, ShardState> = new Map();
    private lastCoordinationTime: number = 0;

    constructor(config: StreamConsumerConfig) {
        // Set configuration values
        this.config = {
            groupName: config.groupName,
            leaseDuration: config?.leaseDuration ?? 30_000,
            maxRecordsPerFetch: config?.maxRecordsPerFetch ?? 1000,
            maxShardsPerInstance: config?.maxShardsPerInstance ?? 5,
        }
        // Create a unique instance ID combining the group name and a random suffix
        this.instanceId = uuidv4();
        // Initialize clients
        this.kinesisClient = new KinesisClient();
        this.dynamoDbClient = new DynamoDBClient(this.config.leaseDuration);
    }

    /**
     * Gets the instance ID of this consumer instance
     *
     * This is a unique identifier for the consumer instance.
     * It is used to identify the instance when reading from the stream.
     */
    public getInstanceId(): string {
        return this.instanceId;
    }

    /**
     * Read telemetry data from the stream
     */
    public async readTelemetry(): Promise<ReadStreamTelemetryResponse> {
        // Find the shard iterators owned by this instance
        const shardIterators = await this.getOwnedShardIterators();

        // No shards owned by this instance
        if (shardIterators.size === 0) {
            return {
                metadata: [],
                records: [],
            };
        }

        // Fetch records from each shard
        const recordsPerShard = Math.ceil(this.config.maxRecordsPerFetch / shardIterators.size);
        const readPromises = Array.from(shardIterators.entries()).map(
            ([shardId, iterator]) => this.readFromShard(shardId, iterator, recordsPerShard)
        );

        // Wait for all read operations to complete and combine results
        const shardResults = await Promise.all(readPromises);
        const metadata: ReadStreamTelemetryMetadata[] = [];
        const records: StreamTelemetryRecord[] = [];

        for (const { records: shardRecords, ...meta } of shardResults) {
            records.push(...shardRecords.map(record => ({
                sequenceNumber: record.SequenceNumber,
                approximateArrivalTimestamp: record.ApproximateArrivalTimestamp,
                data: JSON.parse(new TextDecoder().decode(record.Data)),
                partitionKey: record.PartitionKey,
            })));
            metadata.push(meta);
        }

        // Return transformed results from all shards
        return {
            metadata,
            records,
        }
    }

    /**
     * Get information about all leases in the consumer group
     */
    public async getLeaseInformation(): Promise<ShardLease[]> {
        return this.dynamoDbClient.listAllLeases(this.config.groupName);
    }

    /**
     * Get information about leases owned by this consumer instance
     */
    public async getOwnedLeases(): Promise<ShardLease[]> {
        return this.dynamoDbClient.getLeasesByOwner(this.config.groupName, this.instanceId);
    }

    /**
     * Get information about shards handled by this instance
     */
    public getShardState(): ShardState[] {
        return Array.from(this.shardState.values());
    }

    /**
     * Reads records from a single shard and updates state
     */
    private async readFromShard(
        shardId: string,
        iterator: string,
        limit: number,
    ): Promise<ShardResponse> {
        try {
            const response = await this.kinesisClient.getRecords(iterator, limit);

            // Update state with the new iterator
            const state = this.shardState.get(shardId);

            if (state && response.NextShardIterator) {
                this.shardState.set(shardId, {
                    ...state,
                    iterator: response.NextShardIterator,
                    lastProcessedTime: Date.now(),
                });
            }

            // Process and add records
            if (response.Records && response.Records.length > 0) {
                // Update checkpoint
                const lastRecord = response.Records[response.Records.length - 1];

                const state = this.shardState.get(shardId);

                if (state) {
                    this.shardState.set(shardId, {
                        ...state,
                        lastSequenceNumber: lastRecord.SequenceNumber,
                    });
                }

                if (lastRecord.SequenceNumber) {
                    // Checkpoint in DynamoDB
                    await this.dynamoDbClient.updateCheckpoint(
                        this.config.groupName,
                        shardId,
                        lastRecord.SequenceNumber,
                        this.instanceId
                    );
                }

                return {
                    shardId,
                    records: response.Records,
                    nextIterator: response.NextShardIterator,
                    readDelay: response.MillisBehindLatest,
                    childShards: response.ChildShards,
                };
            }

            return { shardId, records: [] };
        } catch (error) {
            // Remove invalid iterator
            this.shardState.delete(shardId);

            return {
                shardId,
                error: {
                    message: `Error reading from shard ${shardId}`,
                    original: error,
                },
                records: []
            };
        }
    }

    /**
     * Gets iterators for all owned shards, performing coordination if necessary
     */
    private async getOwnedShardIterators() {
        const now = Date.now();
        const coordinationInterval = this.config.leaseDuration * 0.75;

        // Check if we need to coordinate shards
        if (now - this.lastCoordinationTime > coordinationInterval) {
            await this.coordinateShards();
            this.lastCoordinationTime = now;
        }

        // Return valid iterators from the state
        const iterators = new Map<string, string>();
        for (const [shardId, state] of this.shardState.entries()) {
            if (state.iterator) {
                iterators.set(shardId, state.iterator);
            }
        }

        return iterators;
    }

    /**
     * Performs shard coordination - claims shards, renews leases, initializes iterators
     *
     * @private
     */
    private async coordinateShards(): Promise<void> {
        try {
            // 1. Discover all shards in the stream
            const shards = await this.kinesisClient.getAllShards();

            // 2. Ensure all shards have lease entries in DynamoDB
            for (const shardId of shards) {
                await this.dynamoDbClient.createLeaseIfNotExists(this.config.groupName, shardId);
            }

            // 3. Renew leases for shards we already own
            const currentShardIds = Array.from(this.shardState.keys());
            for (const shardId of currentShardIds) {
                const renewed = await this.dynamoDbClient.renewLease(this.config.groupName, shardId, this.instanceId);
                if (!renewed) {
                    // We lost the lease, remove from our state
                    this.shardState.delete(shardId);
                    console.log(`Lost lease for shard ${shardId}`);
                }
            }

            // 4. Try to acquire leases for unowned shards if we're under our limit
            if (!this.hasReachedShardLimit()) {
                for (const shardId of shards) {
                    // Skip if we're already processing this shard
                    if (this.shardState.has(shardId)) {
                        continue;
                    }

                    // Check if we've reached the limit
                    if (this.hasReachedShardLimit()) {
                        break;
                    }

                    // Try to acquire the lease
                    const acquired = await this.dynamoDbClient.tryAcquireLease(
                        this.config.groupName,
                        shardId,
                        this.instanceId,
                    );
                    if (acquired) {
                        // Initialize iterator for new shard
                        await this.initializeIteratorForShard(shardId);
                    }
                }
            }
        } catch (error) {
            console.error('Error during shard coordination:', error);
            throw error;
        }
    }

    /**
     * Initializes a shard iterator for a newly acquired shard
     */
    private async initializeIteratorForShard(shardId: string): Promise<void> {
        // Get the checkpoint if it exists
        const lease = await this.dynamoDbClient.getLease(this.config.groupName, shardId);

        // Get iterator
        const iteratorType = lease?.checkpoint
            ? ShardIteratorType.AFTER_SEQUENCE_NUMBER
            : ShardIteratorType.LATEST;
        const checkpoint = iteratorType === ShardIteratorType.AFTER_SEQUENCE_NUMBER ? lease?.checkpoint : undefined;

        try {
            const iteratorResponse = await this.kinesisClient.getIterator(shardId, iteratorType, checkpoint);

            if (!iteratorResponse.ShardIterator) {
                console.error(`Iterator response contained no iterator for ${shardId}`);
                return;
            }

            // Store in state
            this.shardState.set(shardId, {
                shardId,
                iterator: iteratorResponse.ShardIterator,
                lastSequenceNumber: lease?.checkpoint,
                lastProcessedTime: Date.now(),
            });
        } catch (error) {
            console.error(`Error getting shard iterator for ${shardId}:`, error);
        }
    }

    /**
     * Checks if this instance has reached its shard limit
     */
    private hasReachedShardLimit(): boolean {
        if (!this.config.maxShardsPerInstance) {
            return false; // No limit set
        }

        return this.shardState.size >= this.config.maxShardsPerInstance;
    }
}
