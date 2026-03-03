const ShoppingRepository = require("../database/repository/shopping-repository");
const { OrderModel, CartModel } = require("../database/models");

jest.mock("../database/models", () => {
    const mockSave = jest.fn();
    const mockCartModel = {
        findOne: jest.fn(),
        create: jest.fn(),
    };
    const mockOrderModel = jest.fn().mockImplementation(() => ({
        save: mockSave
    }));
    mockOrderModel.find = jest.fn();

    return {
        OrderModel: mockOrderModel,
        CartModel: mockCartModel
    };
});

let repo;

beforeEach(() => {
    jest.clearAllMocks();
    repo = new ShoppingRepository();
});

describe("ShoppingRepository", () => {
    describe("Orders", () => {
        it("should get orders by customer id", async () => {
            OrderModel.find.mockResolvedValue([{ _id: "order-1" }]);
            const result = await repo.Orders("cust-1");
            expect(OrderModel.find).toHaveBeenCalledWith({ customerId: "cust-1" });
            expect(result).toHaveLength(1);
        });
    });

    describe("Cart", () => {
        it("should return existing cart", async () => {
            CartModel.findOne.mockResolvedValue({ _id: "cart-1" });
            const result = await repo.Cart("cust-1");
            expect(result._id).toBe("cart-1");
        });

        it("should auto-create empty cart if none exists", async () => {
            CartModel.findOne.mockResolvedValue(null);
            CartModel.create.mockResolvedValue({ _id: "cart-new", items: [] });
            const result = await repo.Cart("cust-1");
            expect(CartModel.create).toHaveBeenCalled();
            expect(result._id).toBe("cart-new");
        });
    });

    describe("AddCartItem", () => {
        it("should add item to cart", async () => {
            const mockSave = jest.fn().mockResolvedValue({});
            CartModel.findOne.mockResolvedValue({ items: [], save: mockSave });

            await repo.AddCartItem("cust-1", { _id: "p1" }, 1, false);

            expect(mockSave).toHaveBeenCalled();
        });

        it("should remove item from cart", async () => {
            const mockSave = jest.fn().mockResolvedValue({});
            const existingItem = { product: { _id: "p1" }, unit: 1 };
            const cart = { items: [existingItem], save: mockSave };
            CartModel.findOne.mockResolvedValue(cart);

            await repo.AddCartItem("cust-1", { _id: "p1" }, 1, true);

            expect(cart.items.length).toBe(0);
            expect(mockSave).toHaveBeenCalled();
        });
    });

    describe("CreateNewOrder", () => {
        it("should create order and clear cart", async () => {
            const mockCartSave = jest.fn().mockResolvedValue({});
            const cart = { items: [{ product: { price: 10 }, unit: 2 }], save: mockCartSave };
            CartModel.findOne.mockResolvedValue(cart);

            const mockOrderInstance = new OrderModel();
            mockOrderInstance.save.mockResolvedValue({ _id: "order-1" });

            const result = await repo.CreateNewOrder("cust-1", "txn-1");

            expect(mockOrderInstance.save).toHaveBeenCalled();
            expect(cart.items.length).toBe(0);
            expect(mockCartSave).toHaveBeenCalled();
        });

        it("should return null if cart empty", async () => {
            CartModel.findOne.mockResolvedValue({ items: [] });
            const result = await repo.CreateNewOrder("cust-1", "txn-1");
            expect(result).toBeNull();
        });
    });
});
