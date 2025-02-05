import { PutRecordsCommand, PutRecordsCommandInput } from "@aws-sdk/client-kinesis";
import { KinesisClient } from "./kinesis";
import { StreamProducerConfig, StreamTelemetryPacket } from "./types";

export class StreamProducer {
    private readonly client: KinesisClient;
    private readonly maxRetries: number;
    private readonly batchSize: number;

    constructor(config?: StreamProducerConfig) {
        this.client = new KinesisClient();

        this.maxRetries = config?.maxRetries ?? 3;
        // Kinesis max batch size is 500
        this.batchSize = Math.min(500, config?.batchSize ?? 500);
    }

    /**
     * Writes a single telemetry packet to the stream
     */
    async writeTelemetry(packets: StreamTelemetryPacket[]): Promise<void> {
        const records = packets.map(packet => ({
            Data: this.serializePacketTelemetry(packet),
            PartitionKey: this.generatePartitionKey(packet)
        }));

        // Split into chunks of batchSize
        for (let i = 0; i < records.length; i += this.batchSize) {
            const batch = records.slice(i, i + this.batchSize);
            await this.putRecords(batch);
        }
    }

    private serializePacketTelemetry(packet: StreamTelemetryPacket): Buffer {
        return Buffer.from(JSON.stringify(packet.telemetry));
    }

    private generatePartitionKey(packet: StreamTelemetryPacket): string {
        // Using device id as the partition key to ensure related data stays together
        return packet.device_id.toString();
    }

    private async putRecords(records: { Data: Buffer; PartitionKey: string }[]): Promise<void> {
        const kinesisClient = this.client.getClient();
        const streamArn = this.client.getStreamArn();

        let attempts = 0;
        while (attempts < this.maxRetries) {
            try {
                const input: PutRecordsCommandInput = {
                    Records: records,
                    StreamARN: streamArn,
                };
                const command = new PutRecordsCommand(input);
                await kinesisClient.send(command);
                return;
            } catch (error) {
                attempts++;
                if (attempts === this.maxRetries) {
                    throw new Error(`Failed to write batch to stream after ${this.maxRetries} attempts: ${error}`);
                }
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
            }
        }
    }
}