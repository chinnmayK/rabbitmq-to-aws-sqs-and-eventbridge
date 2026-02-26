const mongoose = require('mongoose');
const { OrderModel, CartModel } = require('../models');
const { v4: uuidv4 } = require('uuid');

// Dealing with database operations
class ShoppingRepository {

    // ================= GET ORDERS =================
    async Orders(customerId) {
        return await OrderModel.find({ customerId });
    }

    // ================= GET CART =================
    async Cart(customerId) {

        let cartItems = await CartModel.findOne({ customerId });

        // ✅ FIX: Never throw error if cart doesn't exist
        // Auto-create empty cart instead
        if (!cartItems) {
            cartItems = await CartModel.create({
                customerId,
                items: []
            });
        }

        return cartItems;
    }

    // ================= ADD / REMOVE CART ITEM =================
    async AddCartItem(customerId, item, qty, isRemove) {

        let cart = await CartModel.findOne({ customerId });

        const { _id } = item;

        // ✅ If cart does not exist, create it
        if (!cart) {
            cart = await CartModel.create({
                customerId,
                items: []
            });
        }

        let cartItems = cart.items;
        let isExist = false;

        if (cartItems.length > 0) {

            cartItems.forEach(existingItem => {

                if (existingItem.product._id.toString() === _id.toString()) {

                    if (isRemove) {
                        cartItems.splice(cartItems.indexOf(existingItem), 1);
                    } else {
                        existingItem.unit = qty;
                    }

                    isExist = true;
                }

            });
        }

        if (!isExist && !isRemove) {
            cartItems.push({
                product: { ...item },
                unit: qty
            });
        }

        cart.items = cartItems;

        return await cart.save();
    }

    // ================= CREATE NEW ORDER =================
    async CreateNewOrder(customerId, txnId) {

        const cart = await CartModel.findOne({ customerId });

        if (!cart || cart.items.length === 0) {
            return null; // ✅ safer return
        }

        let amount = 0;

        cart.items.forEach(item => {
            amount += parseInt(item.product.price) * parseInt(item.unit);
        });

        const orderId = uuidv4();

        const order = new OrderModel({
            orderId,
            customerId,
            amount,
            status: 'received',
            items: cart.items
        });

        const orderResult = await order.save();

        // ✅ Clear cart after order
        cart.items = [];
        await cart.save();

        return orderResult;
    }

    // ================= CREATE CART (used on CustomerCreated event) =================
    async CreateCart(customerId) {

        const existingCart = await CartModel.findOne({ customerId });

        if (existingCart) {
            return existingCart;
        }

        return await CartModel.create({
            customerId,
            items: []
        });
    }

}

module.exports = ShoppingRepository;