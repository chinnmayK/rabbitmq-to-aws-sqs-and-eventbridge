const ShoppingService = require('./shopping-service');

jest.mock('../database/repository/shopping-repository', () => {
  return jest.fn().mockImplementation(() => {
    return {
      Orders: jest.fn(),
      Cart: jest.fn(),
      AddCartItem: jest.fn(),
      CreateNewOrder: jest.fn(),
      CreateCart: jest.fn(),
    };
  })
});

jest.mock('../utils', () => ({
  FormateData: jest.fn((data) => data),
  PublishMessage: jest.fn(),
}));

jest.mock('../../../shared/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("ShoppingService", () => {
  let service;
  let repo;
  let utils;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ShoppingService();
    repo = service.repository;
    utils = require('../utils');
  });

  describe("GetCart", () => {
    it("should return cart data", async () => {
      const mockCart = { items: [] };
      repo.Cart.mockResolvedValue(mockCart);
      const result = await service.GetCart({ _id: "user123" });
      expect(result).toEqual(mockCart);
      expect(repo.Cart).toHaveBeenCalledWith("user123");
    });
  });

  describe("ManageCart", () => {
    it("should update cart and log info", async () => {
      const mockResult = { items: [{ _id: "prod1" }] };
      repo.AddCartItem.mockResolvedValue(mockResult);
      const result = await service.ManageCart("user123", { _id: "prod1" }, 1, false);
      expect(result).toEqual(mockResult);
      expect(repo.AddCartItem).toHaveBeenCalledWith("user123", { _id: "prod1" }, 1, false);
    });
  });

  describe("PlaceOrder", () => {
    it("should create order and publish event", async () => {
      const mockOrder = { _id: "order123" };
      repo.CreateNewOrder.mockResolvedValue(mockOrder);

      const result = await service.PlaceOrder({ _id: "user123", txnNumber: "TXN1" });

      expect(result).toEqual(mockOrder);
      expect(repo.CreateNewOrder).toHaveBeenCalledWith("user123", "TXN1");
      expect(utils.PublishMessage).toHaveBeenCalledWith("OrderCreated", expect.any(Object));
    });

    it("should throw error if order creation fails", async () => {
      repo.CreateNewOrder.mockResolvedValue(null);
      await expect(service.PlaceOrder({ _id: "user123" })).rejects.toThrow("Order creation failed");
    });
  });

  describe("SubscribeEvents", () => {
    it("should handle ADD_TO_CART event", async () => {
      repo.AddCartItem.mockResolvedValue({});
      const payload = JSON.stringify({ event: "ADD_TO_CART", data: { userId: "user1", product: { _id: "p1" }, qty: 1 } });
      await service.SubscribeEvents(payload, "cid");
      expect(repo.AddCartItem).toHaveBeenCalledWith("user1", { _id: "p1" }, 1, false);
    });

    it("should handle CustomerCreated event", async () => {
      repo.CreateCart.mockResolvedValue({ isNew: true, items: [] });
      const payload = JSON.stringify({ event: "CustomerCreated", data: { userId: "user1" } });
      await service.SubscribeEvents(payload, "cid");
      expect(repo.CreateCart).toHaveBeenCalledWith("user1");
    });
  });
});
