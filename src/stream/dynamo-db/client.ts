import { DynamoDBClient as AWSDynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, } from '@aws-sdk/lib-dynamodb';
import { ShardLease } from "../types";

export class DynamoDBClient {
    private readonly client: AWSDynamoDBClient;
    private readonly documentClient: DynamoDBDocumentClient;
    private readonly tableName: string;

    constructor(private readonly leaseDuration: number) {
        this.validateEnvironmentVariables();

        this.client = new AWSDynamoDBClient({
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
            region: process.env.AWS_REGION || 'eu-north-1'
        });

        // Create a document client wrapper
        this.documentClient = DynamoDBDocumentClient.from(this.client);
        this.tableName = process.env.AWS_DYNAMO_DB_TABLE_NAME!;
    }

    /**
     * Retrieves lease information for a specific shard
     */
    async getLease(shardId: string): Promise<ShardLease | undefined> {
        const command = new GetCommand({
            TableName: this.tableName,
            Key: { shardId }
        });

        const response = await this.documentClient.send(command);
        return response.Item as ShardLease | undefined;
    }

    /**
     * Attempts to acquire a lease for a shard
     *
     * Uses a conditional update to ensure only one instance can own the lease.
     * It will succeed if the lease doesn't exist or if the existing lease has expired.
     */
    async tryAcquireLease(shardId: string, instanceId: string): Promise<boolean> {
        try {
            const now = Date.now();
            const command = new UpdateCommand({
                TableName: this.tableName,
                Key: { shardId },
                UpdateExpression: 'SET leaseOwner = :owner, leaseTimeout = :timeout, lastUpdated = :now',
                ConditionExpression: 'attribute_not_exists(leaseOwner) OR leaseTimeout < :now',
                ExpressionAttributeValues: {
                    ':owner': instanceId,
                    ':timeout': now + this.leaseDuration,
                    ':now': now
                }
            });

            await this.documentClient.send(command);
            return true;
        } catch (error: any) {
            // Check if the error is ConditionalCheckFailedException
            if (error.name === 'ConditionalCheckFailedException') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Updates the checkpoint for a shard that this instance owns
     *
     * The checkpoint represents the last successfully processed record position.
     * The update will fail if this instance no longer owns the lease.
     */
    async updateCheckpoint(shardId: string, sequenceNumber: string, instanceId: string): Promise<boolean> {
        try {
            const command = new UpdateCommand({
                TableName: this.tableName,
                Key: { shardId },
                UpdateExpression: 'SET checkpoint = :checkpoint, lastUpdated = :now',
                ConditionExpression: 'leaseOwner = :instanceId',
                ExpressionAttributeValues: {
                    ':checkpoint': sequenceNumber,
                    ':now': Date.now(),
                    ':instanceId': instanceId
                }
            });

            await this.documentClient.send(command);
            return true;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Renews a lease for a shard that this instance owns
     *
     * Extends the lease timeout to prevent other instances from claiming it.
     * Should be called periodically to maintain ownership.
     */
    async renewLease(shardId: string, instanceId: string): Promise<boolean> {
        try {
            const command = new UpdateCommand({
                TableName: this.tableName,
                Key: { shardId },
                UpdateExpression: 'SET leaseTimeout = :timeout',
                ConditionExpression: 'leaseOwner = :instanceId',
                ExpressionAttributeValues: {
                    ':timeout': Date.now() + this.leaseDuration,
                    ':instanceId': instanceId
                }
            });

            await this.documentClient.send(command);
            return true;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Releases a lease for a shard that this instance owns
     */
    async releaseLease(shardId: string, instanceId: string): Promise<boolean> {
        try {
            const command = new UpdateCommand({
                TableName: this.tableName,
                Key: { shardId },
                UpdateExpression: 'REMOVE leaseOwner SET leaseTimeout = :now',
                ConditionExpression: 'leaseOwner = :instanceId',
                ExpressionAttributeValues: {
                    ':now': Date.now(),
                    ':instanceId': instanceId
                }
            });

            await this.documentClient.send(command);
            return true;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Lists all leases in the system
     *
     * Useful for diagnostics and monitoring the distribution of shards across consumer instances.
     */
    async listAllLeases(): Promise<ShardLease[]> {
        const command = new ScanCommand({
            TableName: this.tableName
        });

        const response = await this.documentClient.send(command);
        return (response.Items as ShardLease[]) || [];
    }

    /**
     * Gets all leases owned by a specific instance
     */
    async getLeasesByOwner(instanceId: string): Promise<ShardLease[]> {
        // Note: In production, you might want to add a GSI for leaseOwner
        // For a small number of shards, a full scan with client-side filtering is fine
        const allLeases = await this.listAllLeases();
        return allLeases.filter(lease => lease.leaseOwner === instanceId);
    }

    /**
     * Creates a new shard lease entry if it doesn't exist
     */
    async createLeaseIfNotExists(shardId: string): Promise<boolean> {
        try {
            const command = new PutCommand({
                TableName: this.tableName,
                Item: {
                    shardId,
                    lastUpdated: Date.now()
                },
                ConditionExpression: 'attribute_not_exists(shardId)'
            });

            await this.documentClient.send(command);
            return true;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                return false;
            }
            throw error;
        }
    }

    private validateEnvironmentVariables(): void {
        const requiredEnvVars = {
            AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
            AWS_DYNAMO_DB_TABLE_NAME: process.env.AWS_DYNAMO_DB_TABLE_NAME,
        };

        const missingVars = Object.entries(requiredEnvVars)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingVars.length > 0) {
            throw new Error(
                `Missing required environment variables: ${missingVars.join(', ')}`
            );
        }
    }
}