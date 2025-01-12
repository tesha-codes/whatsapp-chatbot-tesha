const Redis = require("ioredis");
const { createClient } = require("redis");

class RedisConnection {
  constructor() {
    this.nodeRedisClient = null;
    this.ioRedisClient = null;
  }
  async getNodeRedisClient() {
    if (!this.nodeRedisClient) {
      this.nodeRedisClient = createClient({
        url: process.env.REDIS_URL,
        password: process.env.REDIS_PASSWORD,
      });

      this.nodeRedisClient.on("error", (err) => {
        console.error("Redis Client Error:", err);
      });

      await this.nodeRedisClient.connect();
    }
    return this.nodeRedisClient;
  }

  getIORedisClient() {
    if (!this.ioRedisClient) {
      this.ioRedisClient = new Redis({
        host: "redis",
        port: 6379,
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      this.ioRedisClient.on("error", (err) => {
        console.error("IORedis Error:", err);
      });
    }
    return this.ioRedisClient;
  }
}
