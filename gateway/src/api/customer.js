const express = require('express');
const axios = require('axios');
const router = express.Router();

async function safeCall(url, options) {
    for (let i = 0; i < 3; i++) {
        try {
            return await axios.get(url, options);
        } catch (err) {
            if (i === 2) throw err;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

router.get('/profile', async (req, res, next) => {

    try {

        const token = req.headers.authorization;

        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // 1️⃣ Call Customer Service
        const customerResponse = await safeCall(
            `${process.env.CUSTOMER_SERVICE_URL || 'http://customer:8001'}/profile`,
            {
                headers: { Authorization: token }
            }
        );

        // 2️⃣ Call Shopping Service (Cart)
        const cartResponse = await safeCall(
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
