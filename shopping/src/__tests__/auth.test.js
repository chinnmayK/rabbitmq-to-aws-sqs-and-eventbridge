jest.mock("../utils", () => ({
    ValidateSignature: jest.fn(),
}));

const auth = require("../api/middlewares/auth");
const { ValidateSignature } = require("../utils");

describe("Auth Middleware", () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { headers: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    it("should call next() if signature is valid", async () => {
        ValidateSignature.mockResolvedValue(true);

        await auth(req, res, next);

        expect(ValidateSignature).toHaveBeenCalledWith(req);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 403 if signature is invalid", async () => {
        ValidateSignature.mockResolvedValue(false);

        await auth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: "Not Authorized" });
    });
});
