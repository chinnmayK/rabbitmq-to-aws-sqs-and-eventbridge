jest.mock("@aws-sdk/client-eventbridge", () => ({
    EventBridgeClient: jest.fn(() => ({ send: jest.fn() })),
    PutEventsCommand: jest.fn(),
}));

jest.mock("@aws-sdk/client-sqs", () => ({
    SQSClient: jest.fn(() => ({ send: jest.fn() })),
    ReceiveMessageCommand: jest.fn(),
    DeleteMessageCommand: jest.fn(),
}));

jest.mock("../config", () => ({
    APP_SECRET: "test-secret",
    EVENT_BUS_NAME: "test-bus",
    AWS_REGION: "us-east-1",
}));

process.env.SQS_QUEUE_URL = "test-url";

const utils = require("../utils");

describe("Utils index exports", () => {
    it("should export all utility functions", () => {
        expect(utils).toHaveProperty("GenerateSalt");
        expect(utils).toHaveProperty("GeneratePassword");
        expect(utils).toHaveProperty("ValidatePassword");
        expect(utils).toHaveProperty("GenerateSignature");
        expect(utils).toHaveProperty("ValidateSignature");
        expect(utils).toHaveProperty("FormateData");
        expect(utils).toHaveProperty("PublishMessage");
        expect(utils).toHaveProperty("StartSQSConsumer");
    });

    it("should have all exports as functions", () => {
        expect(typeof utils.GenerateSalt).toBe("function");
        expect(typeof utils.GeneratePassword).toBe("function");
        expect(typeof utils.ValidatePassword).toBe("function");
        expect(typeof utils.GenerateSignature).toBe("function");
        expect(typeof utils.ValidateSignature).toBe("function");
        expect(typeof utils.FormateData).toBe("function");
        expect(typeof utils.PublishMessage).toBe("function");
        expect(typeof utils.StartSQSConsumer).toBe("function");
    });

    it("should wrap GenerateSignature with APP_SECRET", async () => {
        const token = await utils.GenerateSignature({ _id: "user-1" });
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3);
    });

    it("should wrap ValidateSignature with APP_SECRET", async () => {
        const token = await utils.GenerateSignature({ _id: "user-1" });
        const req = { get: jest.fn().mockReturnValue(`Bearer ${token}`) };
        const isValid = await utils.ValidateSignature(req);
        expect(isValid).toBe(true);
    });
});
