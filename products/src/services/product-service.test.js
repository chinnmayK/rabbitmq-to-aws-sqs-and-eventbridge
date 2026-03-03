jest.mock("../database", () => ({
  ProductRepository: jest.fn(),
}));
jest.mock("../utils", () => ({
  FormateData: jest.fn((data) => ({ data })),
  PublishMessage: jest.fn(() => Promise.resolve()),
}));
jest.mock("../utils/redis-client", () => ({
  client: {
    get: jest.fn(),
    set: jest.fn(),
  },
  connectRedis: jest.fn(),
  closeRedis: jest.fn(),
}));
jest.mock("../config", () => ({
  CUSTOMER_SERVICE: "customer",
  SHOPPING_SERVICE: "shopping",
}));
jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const ProductService = require("../services/product-service");
const { ProductRepository } = require("../database");
const { FormateData, PublishMessage } = require("../utils");
const redisClient = require("../utils/redis-client");

let service;

beforeEach(() => {
  jest.clearAllMocks();
  ProductRepository.prototype.CreateProduct = jest.fn();
  ProductRepository.prototype.UpdateProduct = jest.fn();
  ProductRepository.prototype.UpdateInventory = jest.fn();
  ProductRepository.prototype.Products = jest.fn();
  ProductRepository.prototype.FindById = jest.fn();
  ProductRepository.prototype.FindByCategory = jest.fn();
  ProductRepository.prototype.FindSelectedProducts = jest.fn();
  service = new ProductService();
});

// ===================== CREATE PRODUCT =====================
describe("ProductService - CreateProduct", () => {
  it("should create product and publish event", async () => {
    const mockProduct = { _id: "prod-1", name: "Widget" };
    ProductRepository.prototype.CreateProduct.mockResolvedValue(mockProduct);

    const result = await service.CreateProduct({ name: "Widget", price: 10 });

    expect(ProductRepository.prototype.CreateProduct).toHaveBeenCalled();
    expect(PublishMessage).toHaveBeenCalledWith("ProductCreated", expect.any(Object));
    expect(result.data._id).toBe("prod-1");
  });

  it("should not publish event if product is null", async () => {
    ProductRepository.prototype.CreateProduct.mockResolvedValue(null);

    const result = await service.CreateProduct({});

    expect(PublishMessage).not.toHaveBeenCalled();
    expect(result.data).toBeNull();
  });
});

// ===================== UPDATE PRODUCT =====================
describe("ProductService - UpdateProduct", () => {
  it("should update product", async () => {
    ProductRepository.prototype.UpdateProduct.mockResolvedValue({ _id: "prod-1", name: "Updated" });

    const result = await service.UpdateProduct("prod-1", { name: "Updated" });

    expect(ProductRepository.prototype.UpdateProduct).toHaveBeenCalledWith("prod-1", { name: "Updated" });
  });
});

// ===================== MANAGE INVENTORY =====================
describe("ProductService - ManageInventory", () => {
  it("should update inventory", async () => {
    ProductRepository.prototype.UpdateInventory.mockResolvedValue({ _id: "prod-1", unit: 50 });

    const result = await service.ManageInventory("prod-1", 10);

    expect(ProductRepository.prototype.UpdateInventory).toHaveBeenCalledWith("prod-1", 10);
  });
});

// ===================== GET PRODUCTS (Redis Cache) =====================
describe("ProductService - GetProducts", () => {
  it("should return cached products on cache hit", async () => {
    const cachedData = JSON.stringify({ products: [{ _id: "prod-1" }], categories: ["electronics"] });
    redisClient.client.get.mockResolvedValue(cachedData);

    const result = await service.GetProducts();

    expect(redisClient.client.get).toHaveBeenCalledWith("products:all");
    expect(ProductRepository.prototype.Products).not.toHaveBeenCalled();
  });

  it("should query DB and cache on cache miss", async () => {
    redisClient.client.get.mockResolvedValue(null);
    ProductRepository.prototype.Products.mockResolvedValue([
      { _id: "prod-1", type: "electronics" },
      { _id: "prod-2", type: "clothing" },
    ]);
    redisClient.client.set.mockResolvedValue("OK");

    const result = await service.GetProducts();

    expect(ProductRepository.prototype.Products).toHaveBeenCalled();
    expect(redisClient.client.set).toHaveBeenCalled();
    expect(result.data.categories).toContain("electronics");
    expect(result.data.categories).toContain("clothing");
  });
});

// ===================== GET PRODUCT DESCRIPTION =====================
describe("ProductService - GetProductDescription", () => {
  it("should return product details", async () => {
    ProductRepository.prototype.FindById.mockResolvedValue({ _id: "prod-1", name: "Widget" });

    const result = await service.GetProductDescription("prod-1");

    expect(result.data.name).toBe("Widget");
  });

  it("should throw error if product not found", async () => {
    ProductRepository.prototype.FindById.mockResolvedValue(null);

    await expect(service.GetProductDescription("bad-id")).rejects.toThrow("Product not found");
  });
});

// ===================== GET BY CATEGORY =====================
describe("ProductService - GetProductsByCategory", () => {
  it("should return products by category", async () => {
    ProductRepository.prototype.FindByCategory.mockResolvedValue([{ _id: "prod-1" }]);

    const result = await service.GetProductsByCategory("electronics");

    expect(ProductRepository.prototype.FindByCategory).toHaveBeenCalledWith("electronics");
  });
});

// ===================== GET SELECTED PRODUCTS =====================
describe("ProductService - GetSelectedProducts", () => {
  it("should return selected products", async () => {
    ProductRepository.prototype.FindSelectedProducts.mockResolvedValue([{ _id: "prod-1" }]);

    const result = await service.GetSelectedProducts(["prod-1"]);

    expect(ProductRepository.prototype.FindSelectedProducts).toHaveBeenCalledWith(["prod-1"]);
  });
});

// ===================== SUBSCRIBE EVENTS =====================
describe("ProductService - SubscribeEvents", () => {
  it("should handle OrderCreated event and reduce inventory", async () => {
    redisClient.client.get.mockResolvedValue(null);
    redisClient.client.set.mockResolvedValue("OK");
    ProductRepository.prototype.UpdateInventory.mockResolvedValue({});

    const payload = JSON.stringify({
      event: "OrderCreated",
      data: {
        order: {
          _id: "order-1",
          items: [{ product: { _id: "prod-1" }, unit: 2 }],
        },
      },
    });

    await service.SubscribeEvents(payload, "corr-1");

    expect(redisClient.client.get).toHaveBeenCalledWith("processed_order:order-1");
    expect(ProductRepository.prototype.UpdateInventory).toHaveBeenCalledWith("prod-1", -2);
    expect(redisClient.client.set).toHaveBeenCalled();
  });

  it("should skip already processed order (idempotency)", async () => {
    redisClient.client.get.mockResolvedValue("true");

    const payload = JSON.stringify({
      event: "OrderCreated",
      data: { order: { _id: "order-1", items: [] } },
    });

    await service.SubscribeEvents(payload, "corr-2");

    expect(ProductRepository.prototype.UpdateInventory).not.toHaveBeenCalled();
  });

  it("should handle unknown event gracefully", async () => {
    const payload = JSON.stringify({
      event: "UNKNOWN",
      data: {},
    });

    await service.SubscribeEvents(payload, "corr-3");
  });
});

// ===================== REDUCE INVENTORY =====================
describe("ProductService - ReduceInventory", () => {
  it("should reduce inventory for each order item", async () => {
    ProductRepository.prototype.UpdateInventory.mockResolvedValue({});

    await service.ReduceInventory({
      order: {
        items: [
          { product: { _id: "prod-1" }, unit: 3 },
          { product: { _id: "prod-2" }, unit: 1 },
        ],
      },
    });

    expect(ProductRepository.prototype.UpdateInventory).toHaveBeenCalledTimes(2);
  });

  it("should handle empty order items", async () => {
    await service.ReduceInventory({ order: { items: [] } });
    expect(ProductRepository.prototype.UpdateInventory).not.toHaveBeenCalled();
  });

  it("should handle null order gracefully", async () => {
    await service.ReduceInventory({ order: null });
    expect(ProductRepository.prototype.UpdateInventory).not.toHaveBeenCalled();
  });
});

// ===================== GET PRODUCT PAYLOAD =====================
describe("ProductService - GetProductPayload", () => {
  it("should return payload with product data", async () => {
    ProductRepository.prototype.FindById.mockResolvedValue({ _id: "prod-1", name: "Widget" });

    const result = await service.GetProductPayload("user-1", { productId: "prod-1", qty: 2 }, "ADD_TO_CART");

    expect(result.event).toBe("ADD_TO_CART");
    expect(result.data.product._id).toBe("prod-1");
    expect(result.data.qty).toBe(2);
  });

  it("should throw error if product not available", async () => {
    ProductRepository.prototype.FindById.mockResolvedValue(null);

    await expect(
      service.GetProductPayload("user-1", { productId: "bad-id", qty: 1 }, "ADD_TO_CART")
    ).rejects.toThrow("No product available");
  });
});

// ===================== PUBLISH PRODUCT EVENT =====================
describe("ProductService - PublishProductEvent", () => {
  it("should get payload and publish event", async () => {
    ProductRepository.prototype.FindById.mockResolvedValue({ _id: "prod-1", name: "Widget" });

    const result = await service.PublishProductEvent("user-1", "prod-1", 2, "ADD_TO_CART");

    expect(PublishMessage).toHaveBeenCalledWith("ADD_TO_CART", expect.any(Object));
    expect(result.event).toBe("ADD_TO_CART");
  });
});
