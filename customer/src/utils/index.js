const { APP_SECRET, EVENT_BUS_NAME, AWS_REGION } = require("../config");
const {
  GenerateSalt,
  GeneratePassword,
  ValidatePassword,
  GenerateSignature,
  ValidateSignature,
  FormateData
} = require("../../../shared/utils");
const { CreateMessageBroker } = require("../../../shared/msg-broker");

const broker = CreateMessageBroker({
  region: AWS_REGION,
  busName: EVENT_BUS_NAME,
  queueUrl: process.env.SQS_QUEUE_URL,
  source: "customer.service"
});

module.exports = {
  GenerateSalt,
  GeneratePassword,
  ValidatePassword,
  GenerateSignature: (payload) => GenerateSignature(payload, APP_SECRET),
  ValidateSignature: (req) => ValidateSignature(req, APP_SECRET),
  FormateData,
  PublishMessage: broker.PublishMessage,
  StartSQSConsumer: broker.StartSQSConsumer
};