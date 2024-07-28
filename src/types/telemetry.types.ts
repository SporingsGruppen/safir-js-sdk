export type Telemetry = TelemetryV1;

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
