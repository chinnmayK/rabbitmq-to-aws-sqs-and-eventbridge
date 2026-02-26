require('dotenv').config();

const express = require("express");
const cors = require("cors");
const proxy = require("express-http-proxy");

const app = express();

const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const customerRouter = require("./src/api/customer");

app.use("/customer", customerRouter);
app.use("/customer", proxy("http://customer:8001"));
app.use("/shopping", proxy("http://shopping:8003"));
app.use("/", proxy("http://products:8002"));

app.listen(PORT, () => {
  console.log(`✅ Gateway listening on port ${PORT}`);
});
