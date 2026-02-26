const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/profile', async (req, res, next) => {

    try {

        const token = req.headers.authorization;

        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // 1️⃣ Call Customer Service
        const customerResponse = await axios.get(
            `${process.env.CUSTOMER_SERVICE_URL || 'http://customer:8001'}/profile`,
            {
                headers: { Authorization: token }
            }
        );

        // 2️⃣ Call Shopping Service (Cart)
        const cartResponse = await axios.get(
            `${process.env.SHOPPING_SERVICE_URL || 'http://shopping:8003'}/cart`,
            {
                headers: { Authorization: token }
            }
        );

        // 3️⃣ Merge Responses
        const mergedResponse = {
            ...customerResponse.data,
            cart: cartResponse.data.data || cartResponse.data
        };

        return res.status(200).json(mergedResponse);

    } catch (error) {

        console.error("Aggregation Error:", error.message);

        return res.status(500).json({
            message: "Profile aggregation failed"
        });
    }
});

module.exports = router;
