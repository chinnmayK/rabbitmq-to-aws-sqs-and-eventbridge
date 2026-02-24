const express = require('express');
const cors = require('cors');
const path = require('path');
const { shopping, appEvents } = require('./api');
module.exports = async (app, channel) => {

    app.use(express.json());
    app.use(cors());
    app.use(express.static(__dirname + '/public'))

    //api
    // appEvents(app);

    shopping(app, channel);
    // error handling

}
