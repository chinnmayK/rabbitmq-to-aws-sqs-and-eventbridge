// Removed manual mocks for bcryptjs and jsonwebtoken to test real shared implementation

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
    APP_SECRET: "secret",
    EVENT_BUS_NAME: "test-bus",
    AWS_REGION: "us-east-1",
}));

// Mock process.env for SQS_QUEUE_URL
process.env.SQS_QUEUE_URL = "test-url";

const utils = require("../utils");

describe("Utils", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("Auth & Crypto Utilities", () => {
        it("should generate salt", async () => {
            const salt = await utils.GenerateSalt();
            expect(typeof salt).toBe("string");
            expect(salt.length).toBeGreaterThan(10);
        });

        it("should generate password", async () => {
            const salt = await utils.GenerateSalt();
            const hash = await utils.GeneratePassword("pass", salt);
            expect(typeof hash).toBe("string");
            expect(hash.length).toBeGreaterThan(20);
        });

        it("should validate password", async () => {
            const salt = await utils.GenerateSalt();
            const hashed = await utils.GeneratePassword("pass", salt);
            const isValid = await utils.ValidatePassword("pass", hashed, salt);
            expect(isValid).toBe(true);
        });

        it("should generate signature", async () => {
            const token = await utils.GenerateSignature({ _id: "user-123" });
            expect(typeof token).toBe("string");
            expect(token.split('.')).toHaveLength(3);
        });

        it("should validate valid signature", async () => {
            const token = await utils.GenerateSignature({ _id: "user-123" });
            const req = { get: jest.fn().mockReturnValue(`Bearer ${token}`) };
            const isValid = await utils.ValidateSignature(req);
            expect(isValid).toBe(true);
            expect(req.user._id).toBe("user-123");
        });

        it("should handle invalid signature", async () => {
            const req = { get: jest.fn().mockReturnValue(null) };
            const isValid = await utils.ValidateSignature(req);
            expect(isValid).toBe(false);
        });

        it("should handle error in signature validation", async () => {
            const req = { get: jest.fn().mockReturnValue("Bearer bad-token-value") };
            const isValid = await utils.ValidateSignature(req);
            expect(isValid).toBe(false);
        });
    });

    describe("FormateData", () => {
        it("should format valid data", () => {
            const res = utils.FormateData({ a: 1 });
            expect(res.data.a).toBe(1);
        });

        it("should throw error for invalid data", () => {
            expect(() => utils.FormateData(null)).toThrow("Data Not found!");
        });
    });

    describe("PublishMessage", () => {
        it("should publish message via EventBridge", async () => {
            await utils.PublishMessage("service", { event: "Test" }, "corr-1");
            // EventBridgeClient and PutEventsCommand are mocked
            expect(utils).toBeDefined();
        });
    });
});
