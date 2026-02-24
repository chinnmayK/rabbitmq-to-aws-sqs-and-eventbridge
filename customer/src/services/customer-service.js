const { CustomerRepository } = require("../database/repository/customer-repository");
const {
  FormateData,
  GeneratePassword,
  GenerateSalt,
  GenerateSignature,
  ValidatePassword,
  PublishMessage,
} = require("../utils");

class CustomerService {
  constructor(channel) {
    this.repository = new CustomerRepository();
    this.channel = channel; // 👈 important
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

    const token = await GenerateSignature({
      email: customer.email,
      _id: customer._id,
    });

    // 🔥 PUBLISH EVENT (RabbitMQ + EventBridge)
    const payload = {
      event: "CustomerCreated",
      data: {
        userId: customer._id,
        email: customer.email,
        phone: customer.phone,
      },
    };

    await PublishMessage(
      this.channel,
      "CustomerCreated",
      JSON.stringify(payload)
    );

    console.log("📢 CustomerCreated event published");

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

    return FormateData({
      id: existingCustomer._id,
      token,
    });
  }

  // ================= PROFILE =================
  async GetProfile(id) {
    const customer = await this.repository.FindCustomerById({ id });

    if (!customer) throw new Error("Customer not found");

    return FormateData(customer);
  }

  async AddNewAddress(customerId, addressData) {
    const address = await this.repository.CreateAddress({
      _id: customerId,
      ...addressData,
    });

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

  // ================= CART =================
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
  async ManageOrder(customerId, order) {
    const result = await this.repository.AddOrderToProfile(
      customerId,
      order
    );

    return FormateData(result);
  }

  // ================= EVENT SUBSCRIBER =================
  async SubscribeEvents(payload) {
    console.log("Customer Service Processing Events");

    const { event, data } = JSON.parse(payload);
    const { userId, product, order, qty } = data;

    switch (event) {
      case "ADD_TO_WISHLIST":
      case "REMOVE_FROM_WISHLIST":
        await this.AddToWishlist(userId, product);
        break;

      case "ADD_TO_CART":
        await this.ManageCart(userId, product, qty, false);
        break;

      case "REMOVE_FROM_CART":
        await this.ManageCart(userId, product, qty, true);
        break;

      case "CREATE_ORDER":
        await this.ManageOrder(userId, order);
        break;

      default:
        break;
    }
  }
}

module.exports = CustomerService;