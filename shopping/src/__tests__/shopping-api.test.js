const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../src/services/shopping-service', () => {
    return jest.fn().mockImplementation(() => {
        return {
            PlaceOrder: jest.fn(),
            GetOrders: jest.fn(),
            GetCart: jest.fn(),
            ManageCart: jest.fn(),
        };
    });
});

jest.mock('../../src/api/middlewares/auth', () => jest.fn((req, res, next) => {
    req.user = { _id: 'user-123' };
    next();
}));

jest.mock('../../../shared/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}));
jest.mock('../../../shared/utils', () => ({
    GenerateSalt: jest.fn(),
    GeneratePassword: jest.fn(),
    ValidatePassword: jest.fn(),
    GenerateSignature: jest.fn(),
    ValidateSignature: jest.fn(),
    FormateData: jest.fn((data) => data),
}));
jest.mock('../../../shared/msg-broker', () => ({
    CreateMessageBroker: jest.fn(() => ({
        PublishMessage: jest.fn(),
        StartSQSConsumer: jest.fn(),
    })),
}));

const shoppingAPI = require('../../src/api/shopping');
const ShoppingService = require('../../src/services/shopping-service');

let app;
let service;

beforeEach(async () => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    await shoppingAPI(app);
    service = ShoppingService.mock.instances[0];
});

describe('Shopping API', () => {
    describe('POST /order', () => {
        it('should return 200 and created order', async () => {
            service.PlaceOrder.mockResolvedValue({ data: { _id: 'order123' } });

            const response = await request(app)
                .post('/order')
                .send({ txnNumber: 'TXN1' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ _id: 'order123' });
        });
    });

    describe('GET /orders', () => {
        it('should return all orders', async () => {
            service.GetOrders.mockResolvedValue({ data: [{ _id: 'order1' }] });

            const response = await request(app).get('/orders');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
        });
    });

    describe('GET /cart', () => {
        it('should return cart data', async () => {
            service.GetCart.mockResolvedValue({ items: [] });

            const response = await request(app).get('/cart');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ items: [] });
        });
    });

    describe('POST /cart', () => {
        it('should update cart and return 200', async () => {
            service.ManageCart.mockResolvedValue({ data: { items: [] } });

            const response = await request(app)
                .post('/cart')
                .send({ product: { _id: 'p1' }, qty: 1, isRemove: false });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ items: [] });
        });
    });
});
