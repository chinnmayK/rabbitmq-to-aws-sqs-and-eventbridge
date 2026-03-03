jest.mock("../database/models", () => ({
    ProductModel: {
        find: jest.fn(),
        findById: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));

const ProductRepository = require("../database/repository/product-repository");
const { ProductModel } = require("../database/models");

let repo;

beforeEach(() => {
    jest.clearAllMocks();
    repo = new ProductRepository();
});

// ===================== PRODUCTS =====================
describe("ProductRepository - Products", () => {
    it("should return all products", async () => {
        ProductModel.find.mockResolvedValue([{ _id: "prod-1" }, { _id: "prod-2" }]);

        const result = await repo.Products();

        expect(ProductModel.find).toHaveBeenCalled();
        expect(result).toHaveLength(2);
    });
});

// ===================== FIND BY ID =====================
describe("ProductRepository - FindById", () => {
    it("should find product by id", async () => {
        ProductModel.findById.mockResolvedValue({ _id: "prod-1", name: "Widget" });

        const result = await repo.FindById("prod-1");

        expect(ProductModel.findById).toHaveBeenCalledWith("prod-1");
        expect(result.name).toBe("Widget");
    });

    it("should return null if not found", async () => {
        ProductModel.findById.mockResolvedValue(null);

        const result = await repo.FindById("bad-id");

        expect(result).toBeNull();
    });
});

// ===================== FIND BY CATEGORY =====================
describe("ProductRepository - FindByCategory", () => {
    it("should find products by category", async () => {
        ProductModel.find.mockResolvedValue([{ _id: "prod-1", type: "electronics" }]);

        const result = await repo.FindByCategory("electronics");

        expect(ProductModel.find).toHaveBeenCalledWith({ type: "electronics" });
    });
});

// ===================== FIND SELECTED PRODUCTS =====================
describe("ProductRepository - FindSelectedProducts", () => {
    it("should find products by selected ids", async () => {
        const mockExec = jest.fn().mockResolvedValue([{ _id: "prod-1" }]);
        const mockIn = jest.fn().mockReturnValue({ exec: mockExec });
        const mockWhere = jest.fn().mockReturnValue({ in: mockIn });
        ProductModel.find.mockReturnValue({ where: mockWhere });

        const result = await repo.FindSelectedProducts(["prod-1"]);

        expect(ProductModel.find).toHaveBeenCalled();
        expect(result).toHaveLength(1);
    });
});

// ===================== UPDATE PRODUCT =====================
describe("ProductRepository - UpdateProduct", () => {
    it("should update product by id", async () => {
        ProductModel.findByIdAndUpdate.mockResolvedValue({ _id: "prod-1", name: "Updated" });

        const result = await repo.UpdateProduct("prod-1", { name: "Updated" });

        expect(ProductModel.findByIdAndUpdate).toHaveBeenCalledWith("prod-1", { name: "Updated" }, { new: true });
    });
});

// ===================== UPDATE INVENTORY =====================
describe("ProductRepository - UpdateInventory", () => {
    it("should update inventory quantity", async () => {
        const mockSave = jest.fn().mockResolvedValue({ _id: "prod-1", unit: 15 });
        ProductModel.findById.mockResolvedValue({ _id: "prod-1", unit: 10, save: mockSave });

        const result = await repo.UpdateInventory("prod-1", 5);

        expect(mockSave).toHaveBeenCalled();
    });

    it("should throw error if product not found", async () => {
        ProductModel.findById.mockResolvedValue(null);

        await expect(repo.UpdateInventory("bad-id", 5)).rejects.toThrow("Product not found");
    });
});
