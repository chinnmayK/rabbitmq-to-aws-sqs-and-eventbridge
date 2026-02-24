const CustomerService = require("../services/customer-service");

module.exports = (app, channel) => {
    
    const service = new CustomerService(channel);
    app.use('/app-events',async (req,res,next) => {

        const { payload } = req.body;

        //handle subscribe events
        service.SubscribeEvents(payload);

        console.log("============= Shopping ================");
        console.log(payload);
        res.json(payload);

    });

}
