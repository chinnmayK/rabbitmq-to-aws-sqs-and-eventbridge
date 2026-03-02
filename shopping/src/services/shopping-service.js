const ShoppingRepository = require("../database/repository/shopping-repository");
const { FormateData, PublishMessage } = require("../utils");
const { CUSTOMER_SERVICE } = require("../config");
const logger = require("../logger");

class ShoppingService {
  constructor() {
    this.repository = new ShoppingRepository();
  }

  // ================= CART =================
  async GetCart({ _id }) {
    return await this.repository.Cart(_id);
  }

  async ManageCart(customerId, product, qty, isRemove) {
    const result = await this.repository.AddCartItem(
      customerId,
      product,
      qty,
      isRemove
    );

    logger.info("Cart Updated", { customerId, productId: product._id, qty, isRemove });

    return FormateData(result);
  }

  // ================= ORDER =================
  async PlaceOrder(payload) {
    const { _id, txnNumber } = payload;

    const order = await this.repository.CreateNewOrder(_id, txnNumber);

    if (order) {
      logger.info("Order Created", { customerId: _id, orderId: order._id });
      const payload = await this.GetOrderPayload(_id, order, "OrderCreated");
      await PublishMessage("OrderCreated", payload);
      return FormateData(order);
    }

    throw new Error("Order creation failed");
  }

  async GetOrders(customerId) {
    const orders = await this.repository.Orders(customerId);
    return FormateData(orders);
  }

  async GetOrderDetails(customerId, orderId) {
    const order = await this.repository.OrderDetails(customerId, orderId);

    if (!order) throw new Error("Order not found");

    return FormateData(order);
  }

  // ================= EVENT HANDLER =================
  async SubscribeEvents(payload, correlationId) {
    const { event, data } = JSON.parse(payload);
    const { userId, product, qty } = data;

    logger.info("Processing Event", { event, correlationId });

    switch (event) {
      case "ADD_TO_CART":
        await this.ManageCart(userId, product, qty, false);
        break;

      case "REMOVE_FROM_CART":
        await this.ManageCart(userId, product, qty, true);
        break;

      case "CustomerCreated":
        await this.SubscribeCustomerCreated(data);
        break;

      default:
        logger.warn("Unknown event received", { event, correlationId });
        break;
    }
  }

  async SubscribeCustomerCreated(data) {
    const { userId } = data;
    const cart = await this.repository.CreateCart(userId);
    if (cart.isNew || cart.items.length === 0) {
      logger.info("Cart Created", { customerId: userId });
    } else {
      logger.warn("Cart already exists for customer", { customerId: userId });
    }
  }

  // ================= CREATE ORDER EVENT PAYLOAD =================
  async GetOrderPayload(userId, order, event) {
    if (order) {
      const payload = {
        event,
        data: { userId, order },
      };

      return payload;
    } else {
      return FormateData({ error: "No Order Available" });
    }
  }
}

module.exports = ShoppingService;