const express = require("express");
const cors = require("cors");
const { products } = require("./api");
const ErrorHandler = require('../../shared/error-handler');

module.exports = async (app) => {
  app.use(express.json());
  app.use(cors());
  // Minimal health endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: process.env.SERVICE_NAME,
      timestamp: new Date().toISOString()
    });
  });

  products(app);
  app.use(ErrorHandler);
};
