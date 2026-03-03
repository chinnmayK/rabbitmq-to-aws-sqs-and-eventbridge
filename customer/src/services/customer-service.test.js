const CustomerService = require('./customer-service');

jest.mock('../database/repository/customer-repository', () => {
  return {
    CustomerRepository: jest.fn().mockImplementation(() => {
      return {
        FindCustomer: jest.fn(),
        CreateCustomer: jest.fn(),
        FindCustomerById: jest.fn(),
        CreateAddress: jest.fn(),
        Wishlist: jest.fn(),
        AddWishlistItem: jest.fn(),
        AddOrderToProfile: jest.fn(),
      };
    })
  };
});

jest.mock('../utils', () => ({
  FormateData: jest.fn((data) => data),
  GeneratePassword: jest.fn(),
  GenerateSalt: jest.fn(),
  GenerateSignature: jest.fn(),
  ValidatePassword: jest.fn(),
  PublishMessage: jest.fn(),
}));

jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("CustomerService", () => {
  let service;
  let repo;
  let utils;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CustomerService();
    repo = service.repository;
    utils = require('../utils');
  });

  describe("SignUp", () => {
    it("should create customer and return token", async () => {
      const mockCustomer = { _id: "123", email: "test@test.com", phone: "12345" };
      repo.FindCustomer.mockResolvedValue(null);
      utils.GenerateSalt.mockResolvedValue("salt");
      utils.GeneratePassword.mockResolvedValue("hashed");
      repo.CreateCustomer.mockResolvedValue(mockCustomer);
      utils.GenerateSignature.mockResolvedValue("token123");

      const result = await service.SignUp({ email: "test@test.com", password: "pass", phone: "12345" });

      expect(result).toEqual({ id: "123", token: "token123" });
      expect(repo.CreateCustomer).toHaveBeenCalledWith(expect.objectContaining({ email: "test@test.com" }));
      expect(utils.PublishMessage).toHaveBeenCalledWith("CustomerCreated", expect.any(Object));
    });

    it("should throw if customer already exists", async () => {
      repo.FindCustomer.mockResolvedValue({ _id: "123" });

      await expect(service.SignUp({ email: "test@test.com" })).rejects.toThrow("Customer already exists");
    });

    it("should throw if repository fails", async () => {
      repo.FindCustomer.mockResolvedValue(null);
      repo.CreateCustomer.mockRejectedValue(new Error("DB Error"));

      await expect(service.SignUp({ email: "test@test.com" })).rejects.toThrow("DB Error");
    });
  });

  describe("SignIn", () => {
    it("should sign in customer and return token", async () => {
      repo.FindCustomer.mockResolvedValue({ _id: "123", email: "test@test.com", password: "hashed", salt: "salt" });
      utils.ValidatePassword.mockResolvedValue(true);
      utils.GenerateSignature.mockResolvedValue("token123");

      const result = await service.SignIn({ email: "test@test.com", password: "pass" });

      expect(result).toEqual({ id: "123", token: "token123" });
    });

    it("should throw if customer not found", async () => {
      repo.FindCustomer.mockResolvedValue(null);
      await expect(service.SignIn({ email: "test@test.com" })).rejects.toThrow("Customer not found");
    });

    it("should throw if credentials invalid", async () => {
      repo.FindCustomer.mockResolvedValue({ _id: "123", email: "test@test.com", password: "hashed", salt: "salt" });
      utils.ValidatePassword.mockResolvedValue(false);
      await expect(service.SignIn({ email: "test@test.com" })).rejects.toThrow("Invalid credentials");
    });
  });

  describe("GetProfile", () => {
    it("should get customer profile", async () => {
      repo.FindCustomerById.mockResolvedValue({ _id: "123", email: "test@test.com" });
      const result = await service.GetProfile({ _id: "123" });
      expect(result).toEqual({ _id: "123", email: "test@test.com" });
    });

    it("should throw if customer not found", async () => {
      repo.FindCustomerById.mockResolvedValue(null);
      await expect(service.GetProfile({ _id: "123" })).rejects.toThrow("Customer not found");
    });
  });

  describe("GetShopingDetails", () => {
    it("should get shopping details", async () => {
      repo.FindCustomerById.mockResolvedValue({ _id: "123", cart: [] });
      const result = await service.GetShopingDetails("123");
      expect(result).toEqual({ _id: "123", cart: [] });
    });

    it("should throw if customer not found", async () => {
      repo.FindCustomerById.mockResolvedValue(null);
      await expect(service.GetShopingDetails("123")).rejects.toThrow("Customer not found");
    });
  });

  describe("AddNewAddress", () => {
    it("should add new address and publish event", async () => {
      const mockAddress = { street: "123 Main" };
      repo.CreateAddress.mockResolvedValue(mockAddress);

      const result = await service.AddNewAddress("123", mockAddress);

      expect(result).toEqual(mockAddress);
      expect(repo.CreateAddress).toHaveBeenCalledWith(expect.objectContaining({ _id: "123", street: "123 Main" }));
      expect(utils.PublishMessage).toHaveBeenCalledWith("CustomerAddressAdded", expect.any(Object));
    });
  });

  describe("GetWishList", () => {
    it("should get wishlist", async () => {
      repo.Wishlist.mockResolvedValue([{ _id: "prod1" }]);
      const result = await service.GetWishList("123");
      expect(result).toEqual([{ _id: "prod1" }]);
    });
  });

  describe("AddToWishlist", () => {
    it("should add to wishlist", async () => {
      repo.AddWishlistItem.mockResolvedValue({ _id: "123" });
      const result = await service.AddToWishlist("123", { _id: "prod1" });
      expect(result).toEqual({ _id: "123" });
    });
  });

  describe("ManageOrder", () => {
    it("should link order to profile", async () => {
      repo.FindCustomerById.mockResolvedValue({ _id: "123", orders: [] });
      repo.AddOrderToProfile.mockResolvedValue({ _id: "123", orders: [{ _id: "order1" }] });

      const result = await service.ManageOrder("123", { _id: "order1" });

      expect(result).toEqual({ _id: "123", orders: [{ _id: "order1" }] });
      expect(utils.PublishMessage).toHaveBeenCalledWith("CustomerOrderLinked", expect.any(Object));
    });

    it("should skip if order already exists", async () => {
      repo.FindCustomerById.mockResolvedValue({ _id: "123", orders: [{ _id: "order1" }] });

      const result = await service.ManageOrder("123", { _id: "order1" });
      expect(repo.AddOrderToProfile).not.toHaveBeenCalled();
      expect(result).toEqual({ _id: "123", orders: [{ _id: "order1" }] });
    });

    it("should throw if customer not found", async () => {
      repo.FindCustomerById.mockResolvedValue(null);
      await expect(service.ManageOrder("123", { _id: "order1" })).rejects.toThrow("Customer not found");
    });
  });

  describe("SubscribeEvents", () => {
    it("should handle ADD_TO_WISHLIST event", async () => {
      repo.AddWishlistItem.mockResolvedValue({});
      const payload = JSON.stringify({ event: "ADD_TO_WISHLIST", data: { userId: "123", product: { _id: "prod1" } } });
      await service.SubscribeEvents(payload);
      expect(repo.AddWishlistItem).toHaveBeenCalledWith("123", { _id: "prod1" });
    });

    it("should handle CREATE_ORDER event", async () => {
      repo.FindCustomerById.mockResolvedValue({ _id: "123", orders: [] });
      const payload = JSON.stringify({ event: "CREATE_ORDER", data: { userId: "123", order: { _id: "order1" } } });
      await service.SubscribeEvents(payload);
      expect(repo.AddOrderToProfile).toHaveBeenCalledWith("123", { _id: "order1" });
    });

    it("should log warning for unknown event", async () => {
      const payload = JSON.stringify({ event: "UNKNOWN", data: {} });
      await service.SubscribeEvents(payload);
      const logger = require('../../../shared/logger');
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
