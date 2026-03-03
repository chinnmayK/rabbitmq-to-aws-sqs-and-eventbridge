const express = require('express');
const cors = require('cors');
const { customer, appEvents } = require('./api');
const ErrorHandler = require('../../shared/error-handler');


module.exports = async (app) => {

  app.use(express.json());
  app.use(cors());
  app.use(express.static(__dirname + '/public'))
  // Minimal health endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: process.env.SERVICE_NAME,
      timestamp: new Date().toISOString()
    });
  });

  //api
  // appEvents(app);

  customer(app);
  // error handling
  app.use(ErrorHandler);
}
