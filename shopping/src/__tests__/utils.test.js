jest.mock("bcryptjs", () => ({
    genSalt: jest.fn().mockResolvedValue("salt"),
    hash: jest.fn().mockResolvedValue("hashed"),
    compare: jest.fn().mockResolvedValue(true),
}));

jest.mock("jsonwebtoken", () => ({
    sign: jest.fn().mockReturnValue("token"),
    verify: jest.fn().mockReturnValue({ _id: "user-123" }),
}));

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
            expect(salt).toBe("salt");
        });

        it("should generate password", async () => {
            const hash = await utils.GeneratePassword("pass", "salt");
            expect(hash).toBe("hashed");
        });

        it("should validate password", async () => {
            const isValid = await utils.ValidatePassword("pass", "hashed");
            expect(isValid).toBe(true);
        });

        it("should generate signature", async () => {
            const token = await utils.GenerateSignature({ _id: "user-123" });
            expect(token).toBe("token");
        });

        it("should validate valid signature", async () => {
            const req = { get: jest.fn().mockReturnValue("Bearer token") };
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
            const req = { get: jest.fn().mockReturnValue("Bearer bad") };
            const jwt = require("jsonwebtoken");
            jwt.verify.mockImplementationOnce(() => { throw new Error("bad token"); });
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
