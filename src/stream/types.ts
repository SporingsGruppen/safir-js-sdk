import { Telemetry } from "../types";

export type StreamTelemetryPacket = {
    device_id: number;
    telemetry: Telemetry;
}