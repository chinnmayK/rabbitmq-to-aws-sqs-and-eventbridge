const { v4: uuidv4 } = require("uuid");
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");
const logger = require("./logger");

module.exports.CreateMessageBroker = ({ region, busName, queueUrl, source }) => {
    const eventBridge = new EventBridgeClient({ region });
    const sqs = new SQSClient({ region });

    const PublishMessage = async (service, msg, correlationId) => {
        if (!busName) {
            logger.warn("EVENT_BUS_NAME is not set. Skipping EventBridge publish.");
            return;
        }

        const cid = correlationId || uuidv4();
        logger.info("Publishing Event", { service, event: msg.event, correlationId: cid });

        try {
            const command = new PutEventsCommand({
                Entries: [
                    {
                        Source: source,
                        DetailType: service,
                        Detail: JSON.stringify({ ...msg, correlationId: cid }),
                        EventBusName: busName,
                    },
                ],
            });

            await eventBridge.send(command);
            logger.info("EventBridge ACK received", { service, correlationId: cid });
        } catch (err) {
            logger.error("EventBridge publish failed", { service, error: err.message });
        }
    };

    const StartSQSConsumer = async (service) => {
        if (!queueUrl) {
            logger.warn("SQS_QUEUE_URL not defined. Skipping SQS consumer.");
            return;
        }

        logger.info("Starting SQS Consumer", { queueUrl });

        const poll = async () => {
            try {
                const command = new ReceiveMessageCommand({
                    QueueUrl: queueUrl,
                    MaxNumberOfMessages: 5,
                    WaitTimeSeconds: 20,
                });

                const response = await sqs.send(command);

                if (response.Messages) {
                    for (const message of response.Messages) {
                        const correlationId = uuidv4();
                        logger.info("SQS Message Received", { messageId: message.MessageId, correlationId });
                        const event = JSON.parse(message.Body);
                        const payload = JSON.stringify(event.detail);

                        await service.SubscribeEvents(payload, correlationId);

                        await sqs.send(
                            new DeleteMessageCommand({
                                QueueUrl: queueUrl,
                                ReceiptHandle: message.ReceiptHandle,
                            })
                        );
                        logger.info("SQS Message Deleted", { messageId: message.MessageId, correlationId });
                    }
                }
            } catch (err) {
                logger.error("SQS polling error", { error: err.message });
            }
            setImmediate(poll);
        };

        poll();
    };

    return { PublishMessage, StartSQSConsumer };
};
