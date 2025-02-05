import { KinesisClient as AWSKinesisClient, } from "@aws-sdk/client-kinesis";

export class KinesisClient {
    private readonly client: AWSKinesisClient;
    private readonly streamArn: string;

    constructor() {
        this.validateEnvironmentVariables();

        this.client = new AWSKinesisClient({
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
            region: process.env.AWS_REGION || 'eu-north-1'
        });

        this.streamArn = process.env.AWS_KINESIS_STREAM_ARN!;
    }

    /**
     * Returns the initialized AWS Kinesis client
     * @internal
     */
    public getClient(): AWSKinesisClient {
        return this.client;
    }

    /**
     * Returns the configured stream ARN
     * @internal
     */
    public getStreamArn(): string {
        return this.streamArn;
    }

    private validateEnvironmentVariables(): void {
        const requiredEnvVars = {
            AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
            AWS_KINESIS_STREAM_ARN: process.env.AWS_KINESIS_STREAM_ARN
        };

        const missingVars = Object.entries(requiredEnvVars)
            .filter(([_, value]) => !value)
            .map(([key]) => key);

        if (missingVars.length > 0) {
            throw new Error(
                `Missing required environment variables: ${missingVars.join(', ')}`
            );
        }

        // Validate ARN format
        const arnRegex = /^arn:aws:kinesis:[a-z0-9-]+:\d{12}:stream\/[\w.-]+$/;
        if (!arnRegex.test(process.env.AWS_KINESIS_STREAM_ARN!)) {
            throw new Error('Invalid Kinesis stream ARN format');
        }
    }
}