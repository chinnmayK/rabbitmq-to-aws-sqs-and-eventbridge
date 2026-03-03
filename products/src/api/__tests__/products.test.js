const request = require("supertest");
const express = require("express");

// Mock the ProductService
jest.mock("../../services/product-service");
const ProductService = require("../../services/product-service");

// Mock the Auth middleware
jest.mock("../middlewares/auth", () => jest.fn((req, res, next) => {
    req.user = { _id: "user-123" };
    next();
}));

const productsAPI = require("../products");

describe("Products API", () => {
    let app;
    let mockService;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());

        // Initialize actual API with mocked service
        productsAPI(app);

        // Get the instance of the mocked service
        mockService = ProductService.mock.instances[0];
    });

    it("should return healthy on /health", async () => {
        const res = await request(app).get("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("Products service healthy");
    });

    it("should return whoami message on /whoami", async () => {
        const res = await request(app).get("/whoami");
        expect(res.statusCode).toBe(200);
        expect(res.body.msg).toContain("I am products Service");
    });

    it("should create a product on POST /product/create", async () => {
        mockService.CreateProduct.mockResolvedValue({ data: { _id: "prod-1", name: "Test" } });

        const res = await request(app)
            .post("/product/create")
            .send({ name: "Test", price: 100 });

        expect(res.statusCode).toBe(200);
        expect(res.body._id).toBe("prod-1");
        expect(mockService.CreateProduct).toHaveBeenCalled();
    });

    it("should update a product on PUT /product/:id", async () => {
        mockService.UpdateProduct.mockResolvedValue({ data: { _id: "prod-1", name: "Updated" } });

        const res = await request(app)
            .put("/product/prod-1")
            .send({ name: "Updated" });

        expect(res.statusCode).toBe(200);
        expect(res.body.name).toBe("Updated");
        expect(mockService.UpdateProduct).toHaveBeenCalledWith("prod-1", { name: "Updated" });
    });

    it("should handle error on PUT /product/:id", async () => {
        mockService.UpdateProduct.mockRejectedValue(new Error("Update failed"));

        const res = await request(app).put("/product/prod-1").send({ name: "Updated" });
        // Express default error handler sends 500
        expect(res.statusCode).toBe(500);
    });

    it("should update inventory on PUT /product/inventory/:id", async () => {
        mockService.ManageInventory.mockResolvedValue({ data: { _id: "prod-1", unit: 10 } });

        const res = await request(app)
            .put("/product/inventory/prod-1")
            .send({ qty: 5 });

        expect(res.statusCode).toBe(200);
        expect(mockService.ManageInventory).toHaveBeenCalledWith("prod-1", 5);
    });

    it("should get products by category", async () => {
        mockService.GetProductsByCategory.mockResolvedValue({ data: [{ _id: "prod-1" }] });

        const res = await request(app).get("/category/electronics");

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(mockService.GetProductsByCategory).toHaveBeenCalledWith("electronics");
    });

    it("should handle error in get products by category", async () => {
        mockService.GetProductsByCategory.mockRejectedValue(new Error("Not found"));
        const res = await request(app).get("/category/electronics");
        expect(res.statusCode).toBe(404);
    });

    it("should get product description by id", async () => {
        mockService.GetProductDescription.mockResolvedValue({ data: { _id: "prod-1" } });

        const res = await request(app).get("/prod-1");

        expect(res.statusCode).toBe(200);
        expect(res.body._id).toBe("prod-1");
    });

    it("should handle error in get product description by id", async () => {
        mockService.GetProductDescription.mockRejectedValue(new Error("Not found"));
        const res = await request(app).get("/bad-id");
        expect(res.statusCode).toBe(404);
    });

    it("should get selected products by ids", async () => {
        mockService.GetSelectedProducts.mockResolvedValue({ data: [{ _id: "prod-1" }] });

        const res = await request(app)
            .post("/ids")
            .send({ ids: ["prod-1"] });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    it("should add to wishlist on PUT /wishlist", async () => {
        mockService.PublishProductEvent.mockResolvedValue({ data: { product: { _id: "prod-1" } } });

        const res = await request(app)
            .put("/wishlist")
            .send({ _id: "prod-1" });

        expect(res.statusCode).toBe(200);
        expect(mockService.PublishProductEvent).toHaveBeenCalledWith("user-123", "prod-1", 0, "ADD_TO_WISHLIST");
    });

    it("should remove from wishlist on DELETE /wishlist/:id", async () => {
        mockService.PublishProductEvent.mockResolvedValue({ data: { product: { _id: "prod-1" } } });

        const res = await request(app).delete("/wishlist/prod-1");

        expect(res.statusCode).toBe(200);
        expect(mockService.PublishProductEvent).toHaveBeenCalledWith("user-123", "prod-1", 0, "REMOVE_FROM_WISHLIST");
    });

    it("should add to cart on PUT /cart", async () => {
        mockService.PublishProductEvent.mockResolvedValue({ data: { product: { _id: "prod-1" }, qty: 2 } });

        const res = await request(app)
            .put("/cart")
            .send({ _id: "prod-1", qty: 2 });

        expect(res.statusCode).toBe(200);
        expect(res.body.unit).toBe(2);
        expect(mockService.PublishProductEvent).toHaveBeenCalledWith("user-123", "prod-1", 2, "ADD_TO_CART");
    });

    it("should remove from cart on DELETE /cart/:id", async () => {
        mockService.PublishProductEvent.mockResolvedValue({ data: { product: { _id: "prod-1" }, qty: 0 } });

        const res = await request(app).delete("/cart/prod-1");

        expect(res.statusCode).toBe(200);
        expect(mockService.PublishProductEvent).toHaveBeenCalledWith("user-123", "prod-1", 0, "REMOVE_FROM_CART");
    });

    it("should get all products on GET /", async () => {
        mockService.GetProducts.mockResolvedValue({ data: { products: [{ _id: "prod-1" }] } });

        const res = await request(app).get("/");

        expect(res.statusCode).toBe(200);
        expect(mockService.GetProducts).toHaveBeenCalled();
    });

    it("should handle error on GET /", async () => {
        mockService.GetProducts.mockRejectedValue(new Error("Error"));
        const res = await request(app).get("/");
        expect(res.statusCode).toBe(404);
    });
});
