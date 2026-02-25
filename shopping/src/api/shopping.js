const ShoppingService = require("../services/shopping-service");
const { PublishMessage } = require("../utils");
const UserAuth = require("./middlewares/auth");
const { CUSTOMER_SERVICE } = require("../config");

module.exports = async (app) => {
  const service = new ShoppingService();

  // ================= PLACE ORDER =================
  app.post("/order", UserAuth, async (req, res, next) => {
    try {
      const { _id } = req.user;
      const { txnNumber } = req.body;

      const { data } = await service.PlaceOrder({ _id, txnNumber });

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  });

  // ================= GET ORDERS =================
  app.get("/orders", UserAuth, async (req, res, next) => {
    try {
      const { _id } = req.user;

      const { data } = await service.GetOrders(_id);

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  });

  // ================= ADD TO CART =================
  app.put("/cart", UserAuth, async (req, res, next) => {
    try {
      const { _id } = req.user;
      const { product, qty } = req.body;

      const { data } = await service.ManageCart(
        _id,
        product,
        qty,
        false
      );

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  });

  // ================= REMOVE FROM CART =================
  app.delete("/cart", UserAuth, async (req, res, next) => {
    try {
      const { _id } = req.user;
      const { product, qty } = req.body;

      const { data } = await service.ManageCart(
        _id,
        product,
        qty,
        true
      );

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  });

  // ================= GET CART =================
  app.get("/cart", UserAuth, async (req, res, next) => {
    try {
      const { _id } = req.user;

      const { data } = await service.GetCart({ _id });

      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  });

  // ================= HEALTH CHECK =================
  app.get("/whoami", (req, res) => {
    return res
      .status(200)
      .json({ msg: "/shopping : I am Shopping Service" });
  });
};