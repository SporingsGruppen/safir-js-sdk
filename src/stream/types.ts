import { Telemetry } from "../types";

export type StreamTelemetryPacket = {
    device_id: number;
    telemetry: Telemetry;
}

export interface StreamProducerConfig {
    // The number of retries on error (default: 3)
    maxRetries?: number;
    // Set the size of maximum packets to write in a single request (default: 500)
    batchSize?: number;
}

export interface StreamConsumerConfig {
    // The duration of the lease in milliseconds (default: 30000)
    leaseDuration?: number;
    // Maximum number of records to fetch in each GetRecords call (default: 1000)
    maxRecordsPerFetch?: number;
    // A unique name for the group of the consumer instances that should share the same shards
    groupName: string;
    // The number of allowed shards handled by a single instance (default: 5)
    maxShardsPerInstance?: number;
}

export interface ShardLease {
    // Unique identifier for the shard
    shardId: string;
    // Instance currently owning this shard
    leaseOwner?: string;
    // Timestamp when the lease expires (milliseconds since epoch)
    leaseTimeout?: number;
    // Last processed position in the shard
    checkpoint?: string;
    // Timestamp of the last checkpoint update (milliseconds since epoch)
    lastUpdated?: number;
}

/**
 * Internal state for shard processors
 * @internal
 */
export interface ShardState {
    // The shard ID being processed
    shardId: string;
    // Current shard iterator for the GetRecords calls
    iterator?: string;
    // Last successfully processed sequence number
    lastSequenceNumber?: string;
    // Last successfully processed timestamp
    lastProcessedTime?: number;
}
