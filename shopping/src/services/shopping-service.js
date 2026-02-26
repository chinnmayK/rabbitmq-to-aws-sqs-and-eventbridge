const ShoppingRepository = require("../database/repository/shopping-repository");
const { FormateData, PublishMessage } = require("../utils");
const { CUSTOMER_SERVICE } = require("../config");

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

    return FormateData(result);
  }

  // ================= ORDER =================
  async PlaceOrder(payload) {
    const { _id, txnNumber } = payload;

    const order = await this.repository.CreateNewOrder(_id, txnNumber);

    if (order) {
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
  async SubscribeEvents(payload) {
    console.log("Shopping Service Processing Events");

    const { event, data } = JSON.parse(payload);
    const { userId, product, qty } = data;

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
        break;
    }
  }

  async SubscribeCustomerCreated(data) {
    const { userId } = data;
    const cart = await this.repository.CreateCart(userId);
    if (cart.isNew || cart.items.length === 0) {
      console.log("🛒 Cart initialized/verified for user:", userId);
    } else {
      console.log("⚠️ Cart already exists for user:", userId);
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