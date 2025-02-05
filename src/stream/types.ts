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
