import { _Record, ChildShard } from "@aws-sdk/client-kinesis";
import { Telemetry } from "../types";

export type StreamTelemetryPacket = {
    device_id: number;
    telemetry: Telemetry;
}

export type StreamTelemetryRecord = {
    sequenceNumber: string | undefined;
    approximateArrivalTimestamp: Date | undefined;
    data: Telemetry;
    partitionKey: string | undefined;
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

export interface ShardResponse {
    // The id of the shard
    shardId: string;
    // The actual records from the response
    records: _Record[];
    // The iterator for reading the next records
    nextIterator?: string;
    // Number of milliseconds between this response and the latest data in the shard
    readDelay?: number;
    // Optional list of child shards
    childShards?: ChildShard[];
    // Optional error object in case the read of the shard went wrong
    error?: {
        message: string;
        original?: unknown;
    },
}

export interface ReadStreamTelemetryMetadata extends Omit<ShardResponse, "records"> {
    shardId: string;
}

export interface ReadStreamTelemetryResponse {
    records: StreamTelemetryRecord[];
    metadata: ReadStreamTelemetryMetadata[];
}