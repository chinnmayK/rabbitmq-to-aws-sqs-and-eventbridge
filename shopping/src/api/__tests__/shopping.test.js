const request = require("supertest");
const express = require("express");

// Mock the ShoppingService
jest.mock("../../services/shopping-service");
const ShoppingService = require("../../services/shopping-service");

// Mock the Auth middleware
jest.mock("../middlewares/auth", () => jest.fn((req, res, next) => {
    req.user = { _id: "user-123" };
    next();
}));

const shoppingAPI = require("../shopping");

jest.mock("../../config", () => ({
    CUSTOMER_SERVICE: "customer_service",
    SHOPPING_SERVICE: "shopping_service",
    PRODUCT_SERVICE: "product_service"
}));

describe("Shopping API", () => {
    let app;
    let mockService;

    beforeEach(async () => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());

        // Initialize actual API with mocked service
        await shoppingAPI(app);

        // Get the instance of the mocked service
        mockService = ShoppingService.mock.instances[0];
    });

    it("should return healthy on /health", async () => {
        const res = await request(app).get("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("Shopping service healthy");
    });

    it("should place an order on POST /order", async () => {
        mockService.PlaceOrder.mockResolvedValue({ data: { _id: "order-1" } });

        const res = await request(app)
            .post("/order")
            .send({ txnNumber: "txn-123" });

        if (res.statusCode !== 200) console.log(res.statusCode, res.text);

        expect(res.statusCode).toBe(200);
        expect(res.body._id).toBe("order-1");
        expect(mockService.PlaceOrder).toHaveBeenCalledWith({ _id: "user-123", txnNumber: "txn-123" });
    });

    it("should handle error on POST /order", async () => {
        mockService.PlaceOrder.mockRejectedValue(new Error("Failed"));

        const res = await request(app).post("/order").send({ txnNumber: "txn-123" });
        expect(res.statusCode).toBe(500);
    });

    it("should get orders on GET /orders", async () => {
        mockService.GetOrders.mockResolvedValue({ data: [{ _id: "order-1" }] });

        const res = await request(app).get("/orders");

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(mockService.GetOrders).toHaveBeenCalledWith("user-123");
    });


    it("should handle error on GET /orders", async () => {
        mockService.GetOrders.mockRejectedValue(new Error("Failed"));

        const res = await request(app).get("/orders");
        expect(res.statusCode).toBe(500);
    });

    it("should add to cart on PUT /cart", async () => {
        mockService.ManageCart.mockResolvedValue({ data: { _id: "cart-1" } });

        const res = await request(app)
            .put("/cart")
            .send({ product: { _id: "prod-1" }, qty: 1 });

        expect(res.statusCode).toBe(200);
        expect(mockService.ManageCart).toHaveBeenCalledWith("user-123", { _id: "prod-1" }, 1, false);
    });

    it("should handle error on PUT /cart", async () => {
        mockService.ManageCart.mockRejectedValue(new Error("Failed"));

        const res = await request(app).put("/cart").send({ product: { _id: "prod-1" }, qty: 1 });
        expect(res.statusCode).toBe(500);
    });

    it("should remove from cart on DELETE /cart", async () => {
        mockService.ManageCart.mockResolvedValue({ data: { _id: "cart-1" } });

        const res = await request(app)
            .delete("/cart")
            .send({ product: { _id: "prod-1" }, qty: 1 });

        expect(res.statusCode).toBe(200);
        expect(mockService.ManageCart).toHaveBeenCalledWith("user-123", { _id: "prod-1" }, 1, true);
    });

    it("should handle error on DELETE /cart", async () => {
        mockService.ManageCart.mockRejectedValue(new Error("Failed"));

        const res = await request(app).delete("/cart").send({ product: { _id: "prod-1" }, qty: 1 });
        expect(res.statusCode).toBe(500);
    });



    it("should get cart on GET /cart", async () => {
        mockService.GetCart.mockResolvedValue({ data: { items: [] } });

        const res = await request(app).get("/cart");

        expect(res.statusCode).toBe(200);
        expect(mockService.GetCart).toHaveBeenCalledWith({ _id: "user-123" });
    });

    it("should handle error on GET /cart", async () => {
        mockService.GetCart.mockRejectedValue(new Error("Failed"));

        const res = await request(app).get("/cart");
        expect(res.statusCode).toBe(500);
    });

    it("should return whoami message on /whoami", async () => {
        const res = await request(app).get("/whoami");
        expect(res.statusCode).toBe(200);
        expect(res.body.msg).toContain("I am Shopping Service");
    });
});
