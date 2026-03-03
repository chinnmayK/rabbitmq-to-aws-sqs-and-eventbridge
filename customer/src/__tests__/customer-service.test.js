// Mock dependencies before requiring the service
jest.mock("../database/repository/customer-repository");
jest.mock("../utils", () => ({
    FormateData: jest.fn((data) => ({ data })),
    GenerateSalt: jest.fn(() => Promise.resolve("mock-salt")),
    GeneratePassword: jest.fn(() => Promise.resolve("hashed-password")),
    GenerateSignature: jest.fn(() => Promise.resolve("mock-token")),
    ValidatePassword: jest.fn(),
    PublishMessage: jest.fn(() => Promise.resolve()),
}));
jest.mock("../logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const CustomerService = require("../services/customer-service");
const { CustomerRepository } = require("../database/repository/customer-repository");
const {
    FormateData,
    GenerateSalt,
    GeneratePassword,
    GenerateSignature,
    ValidatePassword,
    PublishMessage,
} = require("../utils");

let service;

beforeEach(() => {
    jest.clearAllMocks();
    CustomerRepository.prototype.FindCustomer = jest.fn();
    CustomerRepository.prototype.CreateCustomer = jest.fn();
    CustomerRepository.prototype.FindCustomerById = jest.fn();
    CustomerRepository.prototype.CreateAddress = jest.fn();
    CustomerRepository.prototype.Wishlist = jest.fn();
    CustomerRepository.prototype.AddWishlistItem = jest.fn();
    CustomerRepository.prototype.AddOrderToProfile = jest.fn();
    service = new CustomerService();
});

// ===================== SIGN UP =====================
describe("CustomerService - SignUp", () => {
    it("should create a customer and return id + token", async () => {
        CustomerRepository.prototype.FindCustomer.mockResolvedValue(null);
        CustomerRepository.prototype.CreateCustomer.mockResolvedValue({
            _id: "cust-123",
            email: "test@mail.com",
            phone: "12345",
        });

        const result = await service.SignUp({
            email: "test@mail.com",
            password: "pass123",
            phone: "12345",
        });

        expect(CustomerRepository.prototype.FindCustomer).toHaveBeenCalledWith({ email: "test@mail.com" });
        expect(GenerateSalt).toHaveBeenCalled();
        expect(GeneratePassword).toHaveBeenCalledWith("pass123", "mock-salt");
        expect(CustomerRepository.prototype.CreateCustomer).toHaveBeenCalled();
        expect(GenerateSignature).toHaveBeenCalled();
        expect(PublishMessage).toHaveBeenCalledWith("CustomerCreated", expect.any(Object));
        expect(result.data.id).toBe("cust-123");
        expect(result.data.token).toBe("mock-token");
    });

    it("should throw error if customer already exists", async () => {
        CustomerRepository.prototype.FindCustomer.mockResolvedValue({ _id: "existing" });

        await expect(
            service.SignUp({ email: "test@mail.com", password: "pass", phone: "123" })
        ).rejects.toThrow("Customer already exists");
    });
});

// ===================== SIGN IN =====================
describe("CustomerService - SignIn", () => {
    it("should sign in and return id + token", async () => {
        CustomerRepository.prototype.FindCustomer.mockResolvedValue({
            _id: "cust-123",
            email: "test@mail.com",
            password: "hashed",
            salt: "salt",
        });
        ValidatePassword.mockResolvedValue(true);

        const result = await service.SignIn({
            email: "test@mail.com",
            password: "pass123",
        });

        expect(ValidatePassword).toHaveBeenCalledWith("pass123", "hashed", "salt");
        expect(result.data.id).toBe("cust-123");
        expect(result.data.token).toBe("mock-token");
    });

    it("should throw error if customer not found", async () => {
        CustomerRepository.prototype.FindCustomer.mockResolvedValue(null);

        await expect(
            service.SignIn({ email: "bad@mail.com", password: "pass" })
        ).rejects.toThrow("Customer not found");
    });

    it("should throw error if password is invalid", async () => {
        CustomerRepository.prototype.FindCustomer.mockResolvedValue({
            _id: "cust-123",
            email: "test@mail.com",
            password: "hashed",
            salt: "salt",
        });
        ValidatePassword.mockResolvedValue(false);

        await expect(
            service.SignIn({ email: "test@mail.com", password: "wrong" })
        ).rejects.toThrow("Invalid credentials");
    });
});

// ===================== GET PROFILE =====================
describe("CustomerService - GetProfile", () => {
    it("should return customer profile", async () => {
        CustomerRepository.prototype.FindCustomerById.mockResolvedValue({
            _id: "cust-123",
            email: "test@mail.com",
        });

        const result = await service.GetProfile({ _id: "cust-123" });
        expect(result.data.email).toBe("test@mail.com");
    });

    it("should throw error if customer not found", async () => {
        CustomerRepository.prototype.FindCustomerById.mockResolvedValue(null);

        await expect(service.GetProfile({ _id: "bad-id" })).rejects.toThrow(
            "Customer not found"
        );
    });
});

// ===================== GET SHOPPING DETAILS =====================
describe("CustomerService - GetShopingDetails", () => {
    it("should return customer shopping details", async () => {
        CustomerRepository.prototype.FindCustomerById.mockResolvedValue({
            _id: "cust-123",
            orders: [],
        });

        const result = await service.GetShopingDetails("cust-123");
        expect(result.data._id).toBe("cust-123");
    });

    it("should throw error if customer not found", async () => {
        CustomerRepository.prototype.FindCustomerById.mockResolvedValue(null);

        await expect(service.GetShopingDetails("bad-id")).rejects.toThrow(
            "Customer not found"
        );
    });
});

// ===================== ADD NEW ADDRESS =====================
describe("CustomerService - AddNewAddress", () => {
    it("should add address and publish event", async () => {
        const mockAddress = { street: "123 Main", city: "NYC" };
        CustomerRepository.prototype.CreateAddress.mockResolvedValue(mockAddress);

        const result = await service.AddNewAddress("cust-123", {
            street: "123 Main",
            city: "NYC",
        });

        expect(CustomerRepository.prototype.CreateAddress).toHaveBeenCalled();
        expect(PublishMessage).toHaveBeenCalledWith(
            "CustomerAddressAdded",
            expect.any(Object)
        );
        expect(result.data.street).toBe("123 Main");
    });
});

// ===================== WISHLIST =====================
describe("CustomerService - Wishlist", () => {
    it("should return wishlist", async () => {
        CustomerRepository.prototype.Wishlist.mockResolvedValue([
            { _id: "prod-1", name: "Item" },
        ]);

        const result = await service.GetWishList("cust-123");
        expect(result.data).toHaveLength(1);
    });

    it("should add item to wishlist", async () => {
        CustomerRepository.prototype.AddWishlistItem.mockResolvedValue([
            { _id: "prod-1" },
        ]);

        const result = await service.AddToWishlist("cust-123", { _id: "prod-1" });
        expect(result.data).toHaveLength(1);
    });
});

// ===================== MANAGE ORDER =====================
describe("CustomerService - ManageOrder", () => {
    it("should link order to customer and publish event", async () => {
        CustomerRepository.prototype.FindCustomerById.mockResolvedValue({
            _id: "cust-123",
            orders: [],
        });
        CustomerRepository.prototype.AddOrderToProfile.mockResolvedValue({
            _id: "cust-123",
            orders: [{ _id: "order-1" }],
        });

        await service.ManageOrder("cust-123", { _id: "order-1", amount: 100 });

        expect(CustomerRepository.prototype.AddOrderToProfile).toHaveBeenCalled();
        expect(PublishMessage).toHaveBeenCalledWith(
            "CustomerOrderLinked",
            expect.any(Object)
        );
    });

    it("should throw error if customer not found", async () => {
        CustomerRepository.prototype.FindCustomerById.mockResolvedValue(null);

        await expect(
            service.ManageOrder("bad-id", { _id: "order-1" })
        ).rejects.toThrow("Customer not found");
    });

    it("should skip duplicate order (idempotency)", async () => {
        CustomerRepository.prototype.FindCustomerById.mockResolvedValue({
            _id: "cust-123",
            orders: [{ _id: "order-1" }],
        });

        await service.ManageOrder("cust-123", { _id: "order-1" });

        expect(CustomerRepository.prototype.AddOrderToProfile).not.toHaveBeenCalled();
        expect(PublishMessage).not.toHaveBeenCalled();
    });
});

// ===================== SUBSCRIBE EVENTS =====================
describe("CustomerService - SubscribeEvents", () => {
    it("should handle ADD_TO_WISHLIST event", async () => {
        CustomerRepository.prototype.AddWishlistItem.mockResolvedValue([]);

        const payload = JSON.stringify({
            event: "ADD_TO_WISHLIST",
            data: { userId: "cust-123", product: { _id: "prod-1" } },
        });

        await service.SubscribeEvents(payload, "corr-1");
        expect(CustomerRepository.prototype.AddWishlistItem).toHaveBeenCalled();
    });

    it("should handle OrderCreated event", async () => {
        CustomerRepository.prototype.FindCustomerById.mockResolvedValue({
            _id: "cust-123",
            orders: [],
        });
        CustomerRepository.prototype.AddOrderToProfile.mockResolvedValue({});

        const payload = JSON.stringify({
            event: "OrderCreated",
            data: { userId: "cust-123", order: { _id: "order-1", amount: 50 } },
        });

        await service.SubscribeEvents(payload, "corr-2");
        expect(CustomerRepository.prototype.AddOrderToProfile).toHaveBeenCalled();
    });

    it("should handle unknown event gracefully", async () => {
        const payload = JSON.stringify({
            event: "UNKNOWN_EVENT",
            data: { userId: "cust-123" },
        });

        await service.SubscribeEvents(payload, "corr-3");
        // Should not throw, just log a warning
    });
});
