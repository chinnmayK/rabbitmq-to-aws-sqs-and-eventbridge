const ShoppingRepository = require("../database/repository/shopping-repository");
const { FormateData } = require("../utils");

class ShoppingService {
  constructor() {
    this.repository = new ShoppingRepository();
  }

  // ================= CART =================
  async GetCart({ _id }) {
    const cartItems = await this.repository.Cart(_id);
    return FormateData(cartItems);
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
  async PlaceOrder({ _id, txnNumber }) {
    const order = await this.repository.CreateNewOrder(_id, txnNumber);
    return FormateData(order);
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

      default:
        break;
    }
  }

  // ================= CREATE ORDER EVENT PAYLOAD =================
  async GetOrderPayload(userId, order, event) {
    if (!order) throw new Error("No order available");

    return {
      event,
      data: {
        userId,
        order,
      },
    };
  }
}

module.exports = ShoppingService;