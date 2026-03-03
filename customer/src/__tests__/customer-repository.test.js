jest.mock("../database/models", () => {
    const mockSave = jest.fn();
    const mockCustomerModel = jest.fn().mockImplementation(() => ({
        save: mockSave
    }));
    mockCustomerModel.findOne = jest.fn();
    mockCustomerModel.findById = jest.fn();

    const mockAddressModel = jest.fn().mockImplementation(() => ({
        save: mockSave
    }));
    return {
        CustomerModel: mockCustomerModel,
        AddressModel: mockAddressModel,
    };
});

const { CustomerRepository } = require("../database/repository/customer-repository");
const { CustomerModel, AddressModel } = require("../database/models");

let repo;

beforeEach(() => {
    jest.clearAllMocks();
    repo = new CustomerRepository();
});

describe("CustomerRepository - CreateCustomer", () => {
    it("should create and save a new customer", async () => {
        const mockCustomerInstance = new CustomerModel();
        mockCustomerInstance.save.mockResolvedValue({ _id: "cust-123", email: "test@mail.com" });

        const result = await repo.CreateCustomer({ email: "test@mail.com", password: "pwd", phone: "123", salt: "salt" });

        expect(CustomerModel).toHaveBeenCalledWith(expect.objectContaining({ email: "test@mail.com" }));
        expect(mockCustomerInstance.save).toHaveBeenCalled();
        expect(result.email).toBe("test@mail.com");
    });
});

describe("CustomerRepository - CreateAddress", () => {
    it("should throw if profile not found", async () => {
        CustomerModel.findById.mockResolvedValue(null);
        await expect(repo.CreateAddress({ _id: "cust-123" })).rejects.toThrow("Customer not found");
    });

    it("should create address and save profile", async () => {
        const mockProfileSave = jest.fn().mockResolvedValue({ _id: "cust-123", address: [{}] });
        CustomerModel.findById.mockResolvedValue({ _id: "cust-123", address: [], save: mockProfileSave });

        const mockAddressInstance = new AddressModel();
        mockAddressInstance.save.mockResolvedValue();

        const result = await repo.CreateAddress({ _id: "cust-123", street: "St", postalCode: "123", city: "City", country: "Country" });

        expect(CustomerModel.findById).toHaveBeenCalledWith("cust-123");
        expect(AddressModel).toHaveBeenCalledWith(expect.objectContaining({ street: "St" }));
        expect(mockAddressInstance.save).toHaveBeenCalled();
        expect(mockProfileSave).toHaveBeenCalled();
        expect(result._id).toBe("cust-123");
    });
});

describe("CustomerRepository - FindCustomer", () => {
    it("should find customer by email", async () => {
        CustomerModel.findOne.mockResolvedValue({ _id: "cust-123", email: "test@mail.com" });
        const result = await repo.FindCustomer({ email: "test@mail.com" });
        expect(CustomerModel.findOne).toHaveBeenCalledWith({ email: "test@mail.com" });
        expect(result.email).toBe("test@mail.com");
    });
});

describe("CustomerRepository - FindCustomerById", () => {
    it("should find customer by id and populate address", async () => {
        const mockPopulate = jest.fn().mockResolvedValue({ _id: "cust-123" });
        CustomerModel.findById.mockReturnValue({ populate: mockPopulate });

        const result = await repo.FindCustomerById({ id: "cust-123" });

        expect(CustomerModel.findById).toHaveBeenCalledWith("cust-123");
        expect(mockPopulate).toHaveBeenCalledWith("address");
        expect(result._id).toBe("cust-123");
    });
});

describe("CustomerRepository - Wishlist", () => {
    it("should return wishlist items", async () => {
        CustomerModel.findById.mockResolvedValue({ wishlist: [{ _id: "prod-1" }] });
        const result = await repo.Wishlist("cust-123");
        expect(result).toHaveLength(1);
    });

    it("should return empty array if profile null", async () => {
        CustomerModel.findById.mockResolvedValue(null);
        const result = await repo.Wishlist("cust-123");
        expect(result).toEqual([]);
    });

    it("should return empty array if profile has no wishlist", async () => {
        CustomerModel.findById.mockResolvedValue({});
        const result = await repo.Wishlist("cust-123");
        expect(result).toEqual([]);
    });
});

describe("CustomerRepository - AddWishlistItem", () => {
    it("should throw if customer not found", async () => {
        CustomerModel.findById.mockResolvedValue(null);
        await expect(repo.AddWishlistItem("bad", { _id: "prod" })).rejects.toThrow("Customer not found");
    });

    it("should add new item to wishlist", async () => {
        const mockSave = jest.fn().mockResolvedValue({ wishlist: [{ _id: "prod-1" }] });
        CustomerModel.findById.mockResolvedValue({ wishlist: [], save: mockSave });

        const result = await repo.AddWishlistItem("cust-123", { _id: "prod-1" });

        expect(mockSave).toHaveBeenCalled();
        expect(result.length).toBe(1);
    });

    it("should remove item if it already exists", async () => {
        const mockSave = jest.fn().mockResolvedValue({ wishlist: [] });
        CustomerModel.findById.mockResolvedValue({ wishlist: [{ _id: "prod-1" }], save: mockSave });

        const result = await repo.AddWishlistItem("cust-123", { _id: "prod-1" });

        expect(mockSave).toHaveBeenCalled();
        expect(result.length).toBe(0);
    });
});

describe("CustomerRepository - AddOrderToProfile", () => {
    it("should throw if customer not found", async () => {
        CustomerModel.findById.mockResolvedValue(null);
        await expect(repo.AddOrderToProfile("bad", { _id: "order" })).rejects.toThrow("Customer not found");
    });

    it("should add order to empty orders array", async () => {
        const mockSave = jest.fn().mockResolvedValue({ orders: [{ _id: "order-1" }] });
        CustomerModel.findById.mockResolvedValue({ save: mockSave });

        const result = await repo.AddOrderToProfile("cust-123", { _id: "order-1", amount: 100 });

        expect(mockSave).toHaveBeenCalled();
        expect(result.orders.length).toBe(1);
    });

    it("should add order to existing orders array", async () => {
        const mockSave = jest.fn().mockResolvedValue({ orders: [{ _id: "old" }, { _id: "order-1" }] });
        CustomerModel.findById.mockResolvedValue({ orders: [{ _id: "old" }], save: mockSave });

        const result = await repo.AddOrderToProfile("cust-123", { orderId: "order-1", amount: 100 });

        expect(mockSave).toHaveBeenCalled();
        expect(result.orders.length).toBe(2);
    });
});
