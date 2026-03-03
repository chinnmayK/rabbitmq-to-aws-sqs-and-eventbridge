jest.mock("redis", () => {
    const mClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        quit: jest.fn().mockResolvedValue(undefined),
        isOpen: false,
    };
    return {
        createClient: jest.fn(() => mClient),
    };
});

describe("Redis Client", () => {
    let redisModule;
    let redis;

    beforeEach(() => {
        jest.resetModules();
        // Re-mock redis after resetModules
        jest.mock("redis", () => {
            const mClient = {
                connect: jest.fn().mockResolvedValue(undefined),
                on: jest.fn(),
                get: jest.fn(),
                set: jest.fn(),
                quit: jest.fn().mockResolvedValue(undefined),
                isOpen: false,
            };
            return {
                createClient: jest.fn(() => mClient),
            };
        });
        process.env.NODE_ENV = "test";
        redisModule = require("../utils/redis-client");
        redis = require("redis");
    });

    it("should export client, connectRedis, and closeRedis", () => {
        expect(redisModule).toHaveProperty("client");
        expect(redisModule).toHaveProperty("connectRedis");
        expect(redisModule).toHaveProperty("closeRedis");
    });

    it("should create a redis client with correct URL", () => {
        expect(redis.createClient).toHaveBeenCalledWith({
            url: expect.any(String),
        });
    });

    it("should register an error handler", () => {
        const mockClient = redis.createClient();
        expect(redisModule.client.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should not log errors in test environment", () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();
        const errorHandler = redisModule.client.on.mock.calls.find(
            (call) => call[0] === "error"
        )[1];

        errorHandler(new Error("test error"));
        expect(consoleSpy).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("connectRedis should skip connection in test environment", async () => {
        await redisModule.connectRedis();
        // client.connect should NOT be called in test env
        expect(redisModule.client.connect).not.toHaveBeenCalled();
    });

    it("closeRedis should skip quit if client is not open", async () => {
        redisModule.client.isOpen = false;
        await redisModule.closeRedis();
        expect(redisModule.client.quit).not.toHaveBeenCalled();
    });

    it("closeRedis should quit if client is open", async () => {
        redisModule.client.isOpen = true;
        await redisModule.closeRedis();
        expect(redisModule.client.quit).toHaveBeenCalled();
    });

    it("should log errors in non-test environment", () => {
        jest.resetModules();
        process.env.NODE_ENV = "development";
        jest.mock("redis", () => {
            const mClient = {
                connect: jest.fn().mockResolvedValue(undefined),
                on: jest.fn(),
                get: jest.fn(),
                set: jest.fn(),
                quit: jest.fn().mockResolvedValue(undefined),
                isOpen: false,
            };
            return { createClient: jest.fn(() => mClient) };
        });

        const mod = require("../utils/redis-client");
        const consoleSpy = jest.spyOn(console, "error").mockImplementation();
        const errorHandler = mod.client.on.mock.calls.find(
            (call) => call[0] === "error"
        )[1];

        errorHandler(new Error("redis down"));
        expect(consoleSpy).toHaveBeenCalledWith("Redis Client Error", expect.any(Error));
        consoleSpy.mockRestore();
        process.env.NODE_ENV = "test";
    });

    it("connectRedis should connect when not in test env and client is closed", async () => {
        jest.resetModules();
        process.env.NODE_ENV = "development";
        jest.mock("redis", () => {
            const mClient = {
                connect: jest.fn().mockResolvedValue(undefined),
                on: jest.fn(),
                get: jest.fn(),
                set: jest.fn(),
                quit: jest.fn().mockResolvedValue(undefined),
                isOpen: false,
            };
            return { createClient: jest.fn(() => mClient) };
        });

        const mod = require("../utils/redis-client");
        await mod.connectRedis();
        expect(mod.client.connect).toHaveBeenCalled();
        process.env.NODE_ENV = "test";
    });
});
