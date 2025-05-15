# SAFIR JavaScript SDK

## Overview

This SDK provides functionality for interacting with the SAFIR system.

## Installation

```bash
npm install @sporings-gruppen/safir-js-sdk
```

## Key Components

### Types

| Type                    | Description                                                                      |
|-------------------------|----------------------------------------------------------------------------------|
| `StreamTelemetryPacket` | Represents a telemetry packet from a device in the supported stream format       |
| `StreamProducerConfig`  | The supported configuration for the stream producer class                        |
| `Telemetry`             | A combined utility type for the supported variants of a telemetry representation |
| `TelemetryV1`           | The original telemetry format, heavily inspired by Teltonika's format            |
| `TelemetryPacket`       | The new telemetry format, that has more generic names and can support versions   |
| `TelemetryRecord`       | A single record used inside a `TelemetryPacket`                                  |
| `TelemetryValue`        | A single value used inside a `TelemetryRecord`                                   |
| `Priority`              | Utility enum for setting telemetry priority used in `TelemetryRecord`            |
| `GeoData`               | Unified format for representing geo locations used in `TelemetryRecord`          |
| `ValueType`             | Type that contains value type and the actual value used in `TelemetryValue`      |

### StreamProducer

The `StreamProducer` class handles sending telemetry data to the stream.

```typescript
import { StreamProducer } from '@sporings-gruppen/safir-js-sdk';

const producer = new StreamProducer({
    maxRetries: 3,            // Optional: Number of retry attempts
    batchSize: 500            // Optional: Maximum batch size
});
```

#### Configuration Options

| Option       | Type   | Required | Default | Description                                            |
|--------------|--------|----------|---------|--------------------------------------------------------|
| `maxRetries` | number | No       | 3       | Maximum number of retry attempts for failed operations |
| `batchSize`  | number | No       | 500     | Maximum number of records in a batch operation         |

#### Environment Variables

The following environment variables must be set to use the functionality:

- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `AWS_KINESIS_STREAM_ARN`: ARN of the Kinesis stream
- `AWS_REGION`: AWS region (optional)

#### Methods

##### `writeTelemetry(packets: StreamTelemetryPacket[]): Promise<void>`

Write telemetry packets to the stream.

```typescript
await producer.writeTelemetry([
    {
        version: 2,
        record_count: 10,
        records: [
            // TelemetryRecords
        ],
    }
]);
```

### StreamConsumer

The `StreamConsumer` class handles reading telemetry data from the stream.

```typescript
import { StreamConsumer } from '@sporings-gruppen/safir-js-sdk';

const producer = new StreamConsumer({
    groupName: "telemetry-processor",
    leaseDuration: 30000,
    maxRecordsPerFetch: 1000,
    maxShardsPerInstance: 5,
});
```

#### Configuration Options

| Option                 | Type   | Required | Default | Description                                                           |
|------------------------|--------|----------|---------|-----------------------------------------------------------------------|
| `groupName`            | string | Yes      | -       | The name of the group of instances that should share available shards |
| `leaseDuration`        | number | No       | 30000   | Lifetime of a lease in milliseconds                                   |
| `maxRecordsPerFetch`   | number | No       | 1000    | Total number of records for a single execution                        |
| `maxShardsPerInstance` | number | No       | 5       | Number of shards a single instance is allowed to own from a stream    |

#### Environment Variables

The following environment variables must be set to use the functionality:

- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `AWS_KINESIS_STREAM_ARN`: ARN of the Kinesis stream
- `AWS_DYNAMO_DB_TABLE_NAME`: Name of the lease table in DynamoDB
- `AWS_REGION`: AWS region (optional)

#### Methods

##### `readTelemetry(): Promise<Record[]>`

Read telemetry packets from the stream.

```typescript
const records = await consumer.readTelemetry();
```

## Error Handling

The SDK implements automatic retries with exponential backoff for failed operations.
If an operation fails after all retry attempts, it will throw an error with details about the failure.

```typescript
try {
    await producer.writeTelemetry(packet);
} catch (error) {
    console.error('Failed to write telemetry:', error);
}
```

## Best Practices

1. **Environment Variables**: When using environment variables, ensure they are properly set before initializing the
   StreamProducer.

2. **Error Handling**: Always implement error handling around SDK calls to handle potential network issues or service
   disruptions.

3. **Metrics Structure**: Keep metric names consistent across your application to ensure data consistency in your
   analytics.