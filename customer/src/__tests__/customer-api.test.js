const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../src/services/customer-service', () => {
    return jest.fn().mockImplementation(() => {
        return {
            SignUp: jest.fn(),
            SignIn: jest.fn(),
            AddNewAddress: jest.fn(),
            GetProfile: jest.fn(),
            GetShopingDetails: jest.fn(),
            GetWishList: jest.fn(),
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
}));

const customerAPI = require('../../src/api/customer');
const CustomerService = require('../../src/services/customer-service');

let app;
let service;

beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    customerAPI(app);
    // Grab the mock instance created inside the API
    service = CustomerService.mock.instances[0];
});

describe('Customer API', () => {
    describe('POST /signup', () => {
        it('should return 200 and data on successful signup', async () => {
            service.SignUp.mockResolvedValue({ data: { id: '123', token: 'token' } });

            const response = await request(app)
                .post('/signup')
                .send({ email: 'test@test.com', password: 'pass', phone: '123' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ id: '123', token: 'token' });
            expect(service.SignUp).toHaveBeenCalledWith({ email: 'test@test.com', password: 'pass', phone: '123' });
        });
    });

    describe('POST /login', () => {
        it('should return 200 and data on successful login', async () => {
            service.SignIn.mockResolvedValue({ data: { id: '123', token: 'token' } });

            const response = await request(app)
                .post('/login')
                .send({ email: 'test@test.com', password: 'pass' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ id: '123', token: 'token' });
        });
    });

    describe('POST /address', () => {
        it('should return 200 and add address', async () => {
            service.AddNewAddress.mockResolvedValue({ data: { street: 'main' } });

            const response = await request(app)
                .post('/address')
                .send({ street: 'main', postalCode: '123', city: 'city', country: 'country' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ street: 'main' });
            expect(service.AddNewAddress).toHaveBeenCalledWith('user-123', { street: 'main', postalCode: '123', city: 'city', country: 'country' });
        });
    });

    describe('GET /profile', () => {
        it('should return 200 and profile data', async () => {
            service.GetProfile.mockResolvedValue({ data: { email: 'test@test.com' } });

            const response = await request(app).get('/profile');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ email: 'test@test.com' });
        });
    });

    describe('GET /shoping-details', () => {
        it('should return 200 and shopping details', async () => {
            service.GetShopingDetails.mockResolvedValue({ data: { cart: [] } });

            const response = await request(app).get('/shoping-details');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ cart: [] });
        });
    });

    describe('GET /wishlist', () => {
        it('should return 200 and wishlist data', async () => {
            service.GetWishList.mockResolvedValue({ data: [{ item: '1' }] });

            const response = await request(app).get('/wishlist');

            expect(response.status).toBe(200);
            expect(response.body).toEqual([{ item: '1' }]);
        });
    });

    describe('GET /health', () => {
        it('should return 200 health status', async () => {
            const response = await request(app).get('/health');
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('Customer service healthy');
        });
    });

    describe('GET /whoami', () => {
        it('should return 200 whoami status', async () => {
            const response = await request(app).get('/whoami');
            expect(response.status).toBe(200);
            expect(response.body.msg).toContain('Customer Service');
        });
    });
});
