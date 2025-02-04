export type Telemetry = TelemetryV1 | TelemetryPacket;

export type TelemetryV1 = {
    record_count: number;
    avl_data: {
        priority: number;
        timestamp: number;
        gps: {
            longitude: number;
            latitude: number;
            altitude: number;
            angle: number;
            satellites: number;
            speed: number;
        };
        io?: {
            elements: {
                id: number;
                value: string;
            }[];
            event_id: number;
            elements_count: number;
        };
    }[];
};

// Represents a collection of telemetry records from various tracking devices in a standardized format.
export type TelemetryPacket = {
    // Version of the telemetry format specification.
    // Allows for future format changes while maintaining backwards compatibility.
    version: number;

    // Number of telemetry records contained in this packet.
    // This can be used for validation and processing optimization.
    record_count: number;

    // Collection of individual telemetry records.
    records: TelemetryRecord[];
}

// Priority level for telemetry records, used for processing and filtering
export enum Priority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical",
}

export type GeoData = {
    // Latitude in decimal degrees
    latitude: number;

    // Longitude in decimal degrees
    longitude: number;

    // Altitude in meters above sea level
    altitude?: number;

    // Ground speed in km/h
    speed?: number;

    // Direction of travel in degrees (0-359)
    angle?: number;

    // Number of satellites used in the position fix
    satellites?: number;
}

// Possible types of telemetry values
export type ValueType =
    | { type: "Boolean"; value: boolean }
    | { type: "Integer"; value: number }
    | { type: "Float"; value: number }
    | { type: "Text"; value: string }
    | { type: "Bytes"; value: Uint8Array }

// Single telemetry measurement with identifier and value
export type TelemetryValue = {
    identifier: string;
    value: ValueType;
}

// Single telemetry record containing timestamp, location and measurement values
export type TelemetryRecord = {
    // Priority level of the record, using an enum for type safety
    priority: Priority;

    // Unix timestamp in milliseconds when the data was recorded
    timestamp: number;

    // Optional geographic data from the device
    geo?: GeoData;

    // Container for all telemetry values
    values: TelemetryValue[];
}
