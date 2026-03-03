const request = require("supertest");
const app = require("../app");

describe("Health endpoint", () => {
    it("should return 200", async () => {
        const res = await request(app).get("/health");
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe("ok");
    });
});
