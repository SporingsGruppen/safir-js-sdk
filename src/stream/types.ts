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
    // The duration of the lease in milliseconds (default: 300000)
    leaseDuration: number;
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