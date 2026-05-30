import app from '../app'
import request from "supertest";
import mongoose from 'mongoose';

// Connect to test database before tests
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || '');
});

// Disconnect after all tests complete
afterAll(async () => {
  await mongoose.connection.close();
});

// Clear collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("API Server", () => {
  it("should respond with 404 for unknown route", async () => {
    const response = await request(app).get("/unknown-route");
    expect(response.status).toBe(404);
  });
});