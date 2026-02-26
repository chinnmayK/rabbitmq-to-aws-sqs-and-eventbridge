const { CustomerModel, AddressModel } = require("../models");

// Dealing with database operations
class CustomerRepository {

  async CreateCustomer({ email, password, phone, salt }) {
    const customer = new CustomerModel({
      email,
      password,
      salt,
      phone,
      address: [],
    });

    return await customer.save();
  }

  async CreateAddress({ _id, street, postalCode, city, country }) {
    const profile = await CustomerModel.findById(_id);

    if (!profile) throw new Error("Customer not found");

    const newAddress = new AddressModel({
      street,
      postalCode,
      city,
      country,
    });

    await newAddress.save();
    profile.address.push(newAddress);

    return await profile.save();
  }

  async FindCustomer({ email }) {
    return await CustomerModel.findOne({ email });
  }

  async FindCustomerById({ id }) {
    return await CustomerModel.findById(id).populate("address");
  }

  async Wishlist(customerId) {
    const profile = await CustomerModel.findById(customerId);
    return profile?.wishlist || [];
  }

  async AddWishlistItem(customerId, product) {
    const profile = await CustomerModel.findById(customerId);
    if (!profile) throw new Error("Customer not found");

    const exists = profile.wishlist.find(
      item => item._id.toString() === product._id.toString()
    );

    if (exists) {
      profile.wishlist = profile.wishlist.filter(
        item => item._id.toString() !== product._id.toString()
      );
    } else {
      profile.wishlist.push(product);
    }

    const result = await profile.save();
    return result.wishlist;
  }

  async AddOrderToProfile(customerId, order) {
    const profile = await CustomerModel.findById(customerId);
    if (!profile) throw new Error("Customer not found");

    profile.orders = profile.orders || [];
    profile.orders.push(order);

    return await profile.save();
  }
}

module.exports = { CustomerRepository };
