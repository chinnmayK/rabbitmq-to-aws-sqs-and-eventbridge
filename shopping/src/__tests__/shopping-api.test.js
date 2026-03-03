const request = require('supertest');
const express = require('express');

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockService = {
    PlaceOrder: jest.fn(),
    GetOrders: jest.fn(),
    GetCart: jest.fn(),
    ManageCart: jest.fn(),
};

jest.mock('../api/middlewares/auth', () => jest.fn((req, res, next) => {
    req.user = { _id: 'user-123' };
    next();
}));

jest.mock('../../../shared/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}));

jest.mock('../services/shopping-service', () => {
    return jest.fn().mockImplementation(() => mockService);
});

// ─── Setup ───────────────────────────────────────────────────────────────────
const shoppingAPI = require('../api/shopping');

let app;

beforeEach(async () => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    await shoppingAPI(app, mockService);
});

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('Shopping API', () => {
    describe('POST /order', () => {
        it('should return 200 and created order', async () => {
            mockService.PlaceOrder.mockResolvedValue({ data: { _id: 'order123' } });

            const response = await request(app)
                .post('/order')
                .send({ txnNumber: 'TXN1' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ _id: 'order123' });
        });
    });

    describe('GET /orders', () => {
        it('should return all orders', async () => {
            mockService.GetOrders.mockResolvedValue({ data: [{ _id: 'order1' }] });

            const response = await request(app).get('/orders');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
        });
    });

    describe('GET /cart', () => {
        it('should return cart data', async () => {
            mockService.GetCart.mockResolvedValue({ items: [] });

            const response = await request(app).get('/cart');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ items: [] });
        });
    });

    describe('POST /cart', () => {
        it('should update cart and return 200', async () => {
            mockService.ManageCart.mockResolvedValue({ data: { items: [] } });

            const response = await request(app)
                .put('/cart')
                .send({ product: { _id: 'p1' }, qty: 1, isRemove: false });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ items: [] });
        });
    });
});
