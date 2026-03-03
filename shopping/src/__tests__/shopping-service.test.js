jest.mock("../database/repository/shopping-repository");
jest.mock("../utils", () => ({
    FormateData: jest.fn((data) => ({ data })),
    PublishMessage: jest.fn(() => Promise.resolve()),
}));
jest.mock("../../../shared/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));
jest.mock("../config", () => ({
    CUSTOMER_SERVICE: "customer_service",
}));

const ShoppingService = require("../services/shopping-service");
const ShoppingRepository = require("../database/repository/shopping-repository");
const { FormateData, PublishMessage } = require("../utils");

let service;

beforeEach(() => {
    jest.clearAllMocks();
    ShoppingRepository.prototype.Cart = jest.fn();
    ShoppingRepository.prototype.AddCartItem = jest.fn();
    ShoppingRepository.prototype.CreateNewOrder = jest.fn();
    ShoppingRepository.prototype.Orders = jest.fn();
    ShoppingRepository.prototype.OrderDetails = jest.fn();
    ShoppingRepository.prototype.CreateCart = jest.fn();
    service = new ShoppingService();
});

// ===================== CART =====================
describe("ShoppingService - GetCart", () => {
    it("should get cart by customer id", async () => {
        ShoppingRepository.prototype.Cart.mockResolvedValue({ _id: "cart-1", items: [] });

        await service.GetCart({ _id: "cust-1" });

        expect(ShoppingRepository.prototype.Cart).toHaveBeenCalledWith("cust-1");
    });
});

describe("ShoppingService - ManageCart", () => {
    it("should add item to cart", async () => {
        ShoppingRepository.prototype.AddCartItem.mockResolvedValue({ _id: "cart-1" });

        const result = await service.ManageCart("cust-1", { _id: "prod-1" }, 2, false);

        expect(ShoppingRepository.prototype.AddCartItem).toHaveBeenCalledWith("cust-1", { _id: "prod-1" }, 2, false);
        expect(result.data._id).toBe("cart-1");
    });
});

// ===================== ORDER =====================
describe("ShoppingService - PlaceOrder", () => {
    it("should place order and publish event", async () => {
        ShoppingRepository.prototype.CreateNewOrder.mockResolvedValue({ _id: "order-1", amount: 100 });

        const result = await service.PlaceOrder({ _id: "cust-1", txnNumber: "txn-1" });

        expect(ShoppingRepository.prototype.CreateNewOrder).toHaveBeenCalledWith("cust-1", "txn-1");
        expect(PublishMessage).toHaveBeenCalledWith("OrderCreated", expect.any(Object));
        expect(result.data._id).toBe("order-1");
    });

    it("should throw error if order creation fails", async () => {
        ShoppingRepository.prototype.CreateNewOrder.mockResolvedValue(null);

        await expect(service.PlaceOrder({ _id: "cust-1", txnNumber: "txn-1" })).rejects.toThrow("Order creation failed");
    });
});

describe("ShoppingService - GetOrders", () => {
    it("should return customer orders", async () => {
        ShoppingRepository.prototype.Orders.mockResolvedValue([{ _id: "order-1" }]);

        const result = await service.GetOrders("cust-1");

        expect(ShoppingRepository.prototype.Orders).toHaveBeenCalledWith("cust-1");
    });
});

describe("ShoppingService - GetOrderDetails", () => {
    it("should return order details", async () => {
        ShoppingRepository.prototype.OrderDetails.mockResolvedValue({ _id: "order-1" });

        const result = await service.GetOrderDetails("cust-1", "order-1");

        expect(ShoppingRepository.prototype.OrderDetails).toHaveBeenCalledWith("cust-1", "order-1");
    });

    it("should throw error if order not found", async () => {
        ShoppingRepository.prototype.OrderDetails.mockResolvedValue(null);

        await expect(service.GetOrderDetails("cust-1", "bad-id")).rejects.toThrow("Order not found");
    });
});

// ===================== EVENT HANDLERS =====================
describe("ShoppingService - SubscribeEvents", () => {
    it("should handle ADD_TO_CART event", async () => {
        ShoppingRepository.prototype.AddCartItem.mockResolvedValue({});

        const payload = JSON.stringify({
            event: "ADD_TO_CART",
            data: { userId: "cust-1", product: { _id: "prod-1" }, qty: 1 },
        });

        await service.SubscribeEvents(payload, "corr-1");

        expect(ShoppingRepository.prototype.AddCartItem).toHaveBeenCalledWith("cust-1", { _id: "prod-1" }, 1, false);
    });

    it("should handle REMOVE_FROM_CART event", async () => {
        ShoppingRepository.prototype.AddCartItem.mockResolvedValue({});

        const payload = JSON.stringify({
            event: "REMOVE_FROM_CART",
            data: { userId: "cust-1", product: { _id: "prod-1" }, qty: 1 },
        });

        await service.SubscribeEvents(payload, "corr-2");

        expect(ShoppingRepository.prototype.AddCartItem).toHaveBeenCalledWith("cust-1", { _id: "prod-1" }, 1, true);
    });

    it("should handle CustomerCreated event", async () => {
        ShoppingRepository.prototype.CreateCart.mockResolvedValue({ isNew: true });

        const payload = JSON.stringify({
            event: "CustomerCreated",
            data: { userId: "cust-1" },
        });

        await service.SubscribeEvents(payload, "corr-3");

        expect(ShoppingRepository.prototype.CreateCart).toHaveBeenCalledWith("cust-1");
    });

    it("should handle CustomerCreated event when cart exists", async () => {
        ShoppingRepository.prototype.CreateCart.mockResolvedValue({ isNew: false, items: [{}] });

        const payload = JSON.stringify({
            event: "CustomerCreated",
            data: { userId: "cust-1" },
        });

        await service.SubscribeEvents(payload, "corr-4");

        expect(ShoppingRepository.prototype.CreateCart).toHaveBeenCalledWith("cust-1");
    });

    it("should gracefully handle unknown events", async () => {
        const payload = JSON.stringify({
            event: "UNKNOWN",
            data: {},
        });

        await service.SubscribeEvents(payload, "corr-5");
    });
});

// ===================== ORDER EVENT PAYLOAD =====================
describe("ShoppingService - GetOrderPayload", () => {
    it("should generate event payload", async () => {
        const result = await service.GetOrderPayload("cust-1", { _id: "order-1" }, "OrderCreated");

        expect(result.event).toBe("OrderCreated");
        expect(result.data.order._id).toBe("order-1");
    });

    it("should return error payload if order is null", async () => {
        const result = await service.GetOrderPayload("cust-1", null, "OrderCreated");

        expect(result.data.error).toBe("No Order Available");
    });
});
