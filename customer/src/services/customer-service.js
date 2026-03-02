const { CustomerRepository } = require("../database/repository/customer-repository");
const {
  FormateData,
  GeneratePassword,
  GenerateSalt,
  GenerateSignature,
  ValidatePassword,
  PublishMessage,
} = require("../utils");
const logger = require("../logger");

class CustomerService {
  constructor() {
    this.repository = new CustomerRepository();
  }

  // ================= SIGN UP =================
  async SignUp({ email, password, phone }) {
    const existingCustomer = await this.repository.FindCustomer({ email });

    if (existingCustomer) {
      throw new Error("Customer already exists");
    }

    const salt = await GenerateSalt();
    const hashedPassword = await GeneratePassword(password, salt);

    const customer = await this.repository.CreateCustomer({
      email,
      password: hashedPassword,
      phone,
      salt,
    });

    logger.info("Customer Signed Up", { email, customerId: customer._id });

    const token = await GenerateSignature({
      email: customer.email,
      _id: customer._id,
    });

    // 🔥 Publish CustomerCreated
    const payload = {
      event: "CustomerCreated",
      data: {
        userId: customer._id,
        email: customer.email,
        phone: customer.phone,
      },
    };

    await PublishMessage(
      "CustomerCreated",
      payload
    );

    return FormateData({
      id: customer._id,
      token,
    });
  }

  // ================= SIGN IN =================
  async SignIn({ email, password }) {
    const existingCustomer = await this.repository.FindCustomer({ email });

    if (!existingCustomer) {
      throw new Error("Customer not found");
    }

    const validPassword = await ValidatePassword(
      password,
      existingCustomer.password,
      existingCustomer.salt
    );

    if (!validPassword) {
      throw new Error("Invalid credentials");
    }

    const token = await GenerateSignature({
      email: existingCustomer.email,
      _id: existingCustomer._id,
    });

    logger.info("Customer Signed In", { email, customerId: existingCustomer._id });

    return FormateData({
      id: existingCustomer._id,
      token,
    });
  }

  // ================= PROFILE =================
  async GetProfile(profileId) {
    const { _id } = profileId;
    const customer = await this.repository.FindCustomerById({ id: _id });

    if (!customer) throw new Error("Customer not found");

    return FormateData(customer);
  }

  async GetShopingDetails(id) {
    const customer = await this.repository.FindCustomerById({ id });

    if (!customer) throw new Error("Customer not found");

    return FormateData(customer);
  }

  async AddNewAddress(customerId, addressData) {
    const address = await this.repository.CreateAddress({
      _id: customerId,
      ...addressData,
    });

    logger.info("Customer Address Added", { customerId });

    // 🔥 Publish CustomerAddressAdded
    const payload = {
      event: "CustomerAddressAdded",
      data: {
        userId: customerId,
        address,
      },
    };

    await PublishMessage(
      "CustomerAddressAdded",
      payload
    );

    return FormateData(address);
  }

  // ================= WISHLIST =================
  async GetWishList(customerId) {
    const wishlist = await this.repository.Wishlist(customerId);
    return FormateData(wishlist);
  }

  async AddToWishlist(customerId, product) {
    const result = await this.repository.AddWishlistItem(customerId, product);
    return FormateData(result);
  }

  // ================= ORDER =================
  async ManageOrder(customerId, order) {
    const profile = await this.repository.FindCustomerById({ id: customerId });
    if (!profile) throw new Error("Customer not found");

    // Idempotency check: Don't process the same order twice
    const existingOrder = profile.orders && profile.orders.find(o => o._id === order._id);
    if (existingOrder) {
      logger.warn("Order already exists for customer, skipping", { orderId: order._id, customerId });
      return FormateData(profile);
    }

    const result = await this.repository.AddOrderToProfile(
      customerId,
      order
    );

    logger.info("Order Linked to Customer", { customerId, orderId: order._id });

    // 🔥 Publish CustomerOrderLinked
    const payload = {
      event: "CustomerOrderLinked",
      data: {
        userId: customerId,
        order,
      },
    };

    await PublishMessage(
      "CustomerOrderLinked",
      payload
    );

    return FormateData(result);
  }

  // ================= EVENT SUBSCRIBER =================
  async SubscribeEvents(payload, correlationId) {
    const { event, data } = JSON.parse(payload);
    const { userId, product, order, qty } = data;

    logger.info("Processing Event", { event, correlationId });

    switch (event) {
      case "ADD_TO_WISHLIST":
      case "REMOVE_FROM_WISHLIST":
        await this.AddToWishlist(userId, product);
        break;

      case "CREATE_ORDER":
      case "OrderCreated":
        await this.ManageOrder(userId, order);
        break;

      default:
        logger.warn("Unknown event received", { event, correlationId });
        break;
    }
  }
}

module.exports = CustomerService;