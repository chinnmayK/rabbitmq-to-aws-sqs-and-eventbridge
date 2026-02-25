const { ProductRepository } = require("../database");
const { FormateData, PublishMessage } = require("../utils");
const { CUSTOMER_SERVICE, SHOPPING_SERVICE } = require("../config");
const redisClient = require("../utils/redis-client");

class ProductService {
  constructor() {
    this.repository = new ProductRepository();
  }

  // ================= CREATE PRODUCT =================
  async CreateProduct(productInputs) {
    const product = await this.repository.CreateProduct(productInputs);

    if (product) {
      // 🚀 Publish ProductCreated event
      const payload = {
        event: "ProductCreated",
        data: product
      };
      await PublishMessage("ProductCreated", payload);
    }

    return FormateData(product);
  }

  async UpdateProduct(productId, productData) {
    const product = await this.repository.UpdateProduct(productId, productData);
    return FormateData(product);
  }

  async ManageInventory(productId, qty) {
    const product = await this.repository.UpdateInventory(productId, qty);
    return FormateData(product);
  }

  // ================= GET ALL PRODUCTS =================
  async GetProducts() {

    const cacheKey = "products:all";

    // 1️⃣ Check cache
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      console.log("⚡ CACHE HIT");
      return FormateData(JSON.parse(cached));
    }

    console.log("🐢 CACHE MISS → DB");

    const products = await this.repository.Products();

    let categories = {};
    products.map(({ type }) => {
      categories[type] = type;
    });

    const response = {
      products,
      categories: Object.keys(categories),
    };

    // 2️⃣ Save to Redis (TTL 60 sec)
    await redisClient.set(cacheKey, JSON.stringify(response), {
      EX: 60,
    });

    return FormateData(response);
  }

  // ================= GET SINGLE PRODUCT =================
  async GetProductDescription(productId) {
    const product = await this.repository.FindById(productId);

    if (!product) throw new Error("Product not found");

    return FormateData(product);
  }

  // ================= GET BY CATEGORY =================
  async GetProductsByCategory(category) {
    const products = await this.repository.FindByCategory(category);
    return FormateData(products);
  }

  // ================= GET SELECTED PRODUCTS =================
  async GetSelectedProducts(selectedIds) {
    const products = await this.repository.FindSelectedProducts(selectedIds);
    return FormateData(products);
  }

  // ================= EVENT HANDLER =================
  async SubscribeEvents(payload) {
    console.log("Products Service Processing Events");

    const { event, data } = JSON.parse(payload);

    switch (event) {
      case "OrderCreated":
        // Idempotency: Ignore duplicate OrderCreated events
        const isProcessed = await redisClient.get(`processed_order:${data.order._id}`);
        if (isProcessed) {
          console.log(`⚠️ Order ${data.order._id} already processed by Products Service. Skipping.`);
          break;
        }

        await this.ReduceInventory(data);

        // Mark as processed (store for 30 days)
        await redisClient.set(`processed_order:${data.order._id}`, "true", {
          EX: 30 * 24 * 60 * 60
        });
        break;
      default:
        break;
    }
  }

  async ReduceInventory(data) {
    const { order } = data;

    if (order && order.items && order.items.length > 0) {
      order.items.map(async (item) => {
        // Decrease stock (qty is negative for Reduce)
        await this.repository.UpdateInventory(item.product._id, -item.unit);
        console.log(`📉 Inventory reduced for product ${item.product._id} by ${item.unit}`);
      });
    }
  }

  // ================= CREATE EVENT PAYLOAD =================
  async GetProductPayload(userId, { productId, qty }, event) {
    const product = await this.repository.FindById(productId);

    if (!product) {
      throw new Error("No product available");
    }

    const payload = {
      event,
      data: {
        userId,
        product,
        qty,
      },
    };

    return payload;
  }

  async PublishProductEvent(userId, productId, qty, event) {
    const payload = await this.GetProductPayload(userId, { productId, qty }, event);

    // Decoupled Publish: Just send the event
    await PublishMessage(event, payload);

    return payload;
  }
}

module.exports = ProductService;
