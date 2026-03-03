const request = require('supertest');
const express = require('express');

// ─── Mocks ──────────────────────────────────────────────────────────────────
// We manually create a mock object to inject
const mockService = {
    SignUp: jest.fn(),
    SignIn: jest.fn(),
    AddNewAddress: jest.fn(),
    GetProfile: jest.fn(),
    GetShopingDetails: jest.fn(),
    GetWishList: jest.fn(),
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

// We still mock the service module just in case anything else tries to require it,
// but we'll use the manual mock object for injection.
jest.mock('../services/customer-service', () => {
    return jest.fn().mockImplementation(() => mockService);
});

// ─── Setup ───────────────────────────────────────────────────────────────────
const customerAPI = require('../api/customer');

let app;

beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    // Inject the mock instance
    customerAPI(app, mockService);
});

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('Customer API', () => {
    describe('POST /signup', () => {
        it('should return 200 and data on successful signup', async () => {
            mockService.SignUp.mockResolvedValue({ data: { id: '123', token: 'token' } });

            const response = await request(app)
                .post('/signup')
                .send({ email: 'test@test.com', password: 'pass', phone: '123' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ id: '123', token: 'token' });
            expect(mockService.SignUp).toHaveBeenCalledWith({ email: 'test@test.com', password: 'pass', phone: '123' });
        });
    });

    describe('POST /login', () => {
        it('should return 200 and data on successful login', async () => {
            mockService.SignIn.mockResolvedValue({ data: { id: '123', token: 'token' } });

            const response = await request(app)
                .post('/login')
                .send({ email: 'test@test.com', password: 'pass' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ id: '123', token: 'token' });
        });
    });

    describe('POST /address', () => {
        it('should return 200 and add address', async () => {
            mockService.AddNewAddress.mockResolvedValue({ data: { street: 'main' } });

            const response = await request(app)
                .post('/address')
                .send({ street: 'main', postalCode: '123', city: 'city', country: 'country' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ street: 'main' });
        });
    });

    describe('GET /profile', () => {
        it('should return 200 and profile data', async () => {
            mockService.GetProfile.mockResolvedValue({ data: { email: 'test@test.com' } });

            const response = await request(app).get('/profile');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ email: 'test@test.com' });
        });
    });

    describe('GET /shoping-details', () => {
        it('should return 200 and shopping details', async () => {
            mockService.GetShopingDetails.mockResolvedValue({ data: { cart: [] } });

            const response = await request(app).get('/shoping-details');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ cart: [] });
        });
    });

    describe('GET /wishlist', () => {
        it('should return 200 and wishlist data', async () => {
            mockService.GetWishList.mockResolvedValue({ data: [{ item: '1' }] });

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