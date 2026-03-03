const express = require("express");
const expressApp = require("./express-app");

const app = express();

// The user requested a specific /health endpoint in app.js
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Initialize existing middleware and routes
expressApp(app);

module.exports = app;
