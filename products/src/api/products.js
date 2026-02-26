const { CUSTOMER_SERVICE, SHOPPING_SERVICE } = require("../config");
const ProductService = require("../services/product-service");
const {
  PublishCustomerEvent,
  PublishShoppingEvent,
  PublishMessage,
} = require("../utils");
const UserAuth = require("./middlewares/auth");

module.exports = (app) => {
  const service = new ProductService();

  app.get('/health', (req, res) => {
    return res.status(200).json({ status: 'Products service healthy' });
  });

  app.get("/whoami", (req, res, next) => {
    return res
      .status(200)
      .json({ msg: "/ or /products : I am products Service" });
  });

  app.post("/product/create", async (req, res, next) => {
    const { name, desc, type, unit, price, available, suplier, banner } =
      req.body;
    // validation
    const { data } = await service.CreateProduct({
      name,
      desc,
      type,
      unit,
      price,
      available,
      suplier,
      banner,
    });
    return res.json(data);
  });

  app.put("/product/:id", async (req, res, next) => {
    try {
      const { data } = await service.UpdateProduct(req.params.id, req.body);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  });

  app.put("/product/inventory/:id", async (req, res, next) => {
    try {
      const { qty } = req.body;
      const { data } = await service.ManageInventory(req.params.id, qty);
      return res.json(data);
    } catch (err) {
      next(err);
    }
  });

  app.get("/category/:type", async (req, res, next) => {
    const type = req.params.type;

    try {
      const { data } = await service.GetProductsByCategory(type);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(404).json({ error });
    }
  });

  app.get("/:id", async (req, res, next) => {
    const productId = req.params.id;

    try {
      const { data } = await service.GetProductDescription(productId);
      return res.status(200).json(data);
    } catch (error) {
      return res.status(404).json({ error });
    }
  });

  app.post("/ids", async (req, res, next) => {
    const { ids } = req.body;
    const products = await service.GetSelectedProducts(ids);
    return res.status(200).json(products);
  });

  app.put("/wishlist", UserAuth, async (req, res, next) => {
    const { _id } = req.user;

    try {
      const product = await service.PublishProductEvent(
        _id,
        req.body._id,
        0,
        "ADD_TO_WISHLIST"
      );
      res.status(200).json(product.data.product);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/wishlist/:id", UserAuth, async (req, res, next) => {
    const { _id } = req.user;
    const productId = req.params.id;

    try {
      const product = await service.PublishProductEvent(
        _id,
        productId,
        0,
        "REMOVE_FROM_WISHLIST"
      );
      res.status(200).json(product.data.product);
    } catch (err) {
      next(err);
    }
  });

  app.put("/cart", UserAuth, async (req, res, next) => {
    const { _id } = req.user;

    try {
      const product = await service.PublishProductEvent(
        _id,
        req.body._id,
        req.body.qty,
        "ADD_TO_CART"
      );

      const response = {
        product: product.data.product,
        unit: product.data.qty,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/cart/:id", UserAuth, async (req, res, next) => {
    const { _id } = req.user;
    const productId = req.params.id;

    try {
      const product = await service.PublishProductEvent(
        _id,
        productId,
        0,
        "REMOVE_FROM_CART"
      );

      const response = {
        product: product.data.product,
        unit: product.data.qty,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  });


  //get Top products and category
  app.get("/", async (req, res, next) => {
    //check validation
    try {
      const { data } = await service.GetProducts();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(404).json({ error });
    }
  });
};
