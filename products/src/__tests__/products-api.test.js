const request = require('supertest');
const express = require('express');

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockService = {
    CreateProduct: jest.fn(),
    GetProducts: jest.fn(),
    GetProductDescription: jest.fn(),
    GetProductsByCategory: jest.fn(),
    GetSelectedProducts: jest.fn(),
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

jest.mock('../services/product-service', () => {
    return jest.fn().mockImplementation(() => mockService);
});

// ─── Setup ───────────────────────────────────────────────────────────────────
const productsAPI = require('../api/products');

let app;

beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    productsAPI(app, mockService);
});

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('Products API', () => {
    describe('POST /product/create', () => {
        it('should return 200 and created product', async () => {
            mockService.CreateProduct.mockResolvedValue({ data: { _id: '123', name: 'Product' } });

            const response = await request(app)
                .post('/product/create')
                .send({ name: 'Product', type: 'Type' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ _id: '123', name: 'Product' });
        });
    });

    describe('GET /category/:type', () => {
        it('should return products by category', async () => {
            mockService.GetProductsByCategory.mockResolvedValue({ data: [{ _id: '123' }] });

            const response = await request(app).get('/category/electronics');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
        });
    });

    describe('GET /:id', () => {
        it('should return product description', async () => {
            mockService.GetProductDescription.mockResolvedValue({ data: { _id: '123' } });

            const response = await request(app).get('/123');

            expect(response.status).toBe(200);
            expect(response.body._id).toBe('123');
        });
    });

    describe('POST /ids', () => {
        it('should return selected products', async () => {
            mockService.GetSelectedProducts.mockResolvedValue({ data: [{ _id: '123' }] });

            const response = await request(app).post('/ids').send({ ids: ['123'] });

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
        });
    });

    describe('GET /', () => {
        it('should return all products', async () => {
            mockService.GetProducts.mockResolvedValue({ data: { products: [] } });

            const response = await request(app).get('/');

            expect(response.status).toBe(200);
            expect(response.body.products).toEqual([]);
        });
    });
});
