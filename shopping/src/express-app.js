const express = require('express');
const cors = require('cors');
const path = require('path');
const { shopping, appEvents } = require('./api');
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
    app.use(express.static(__dirname + '/public'))

    //api
    // appEvents(app);

    shopping(app);
    // error handling
    app.use(ErrorHandler);
}
