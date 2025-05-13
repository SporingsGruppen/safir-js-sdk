import { DynamoDBClient } from "./dynamo-db";
import { KinesisClient } from "./kinesis";
import { StreamConsumerConfig } from "./types";

export class StreamConsumer {
    private readonly kinesisClient: KinesisClient;
    private readonly dynamoDbClient: DynamoDBClient;

    constructor(config?: StreamConsumerConfig) {
        this.kinesisClient = new KinesisClient();
        this.dynamoDbClient = new DynamoDBClient(config?.leaseDuration ?? 300000);
    }
}