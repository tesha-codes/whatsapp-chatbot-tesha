require("dotenv").config();
const Redis = require("ioredis");
const { createClient } = require("redis");

const { REDIS_URL, REDIS_PROD_URL, SESSION_TTL } = process.env;

const redis_url = process.env.NODE_ENV === 'production' ? REDIS_PROD_URL : REDIS_URL;

// Redis session settings default to 24 hours unless set otherwise
const SESSION_EXPIRATION = SESSION_TTL || 24 * 60 * 60;

class RedisConnection {
  constructor() {
    this.nodeRedisClient = null;
    this.ioRedisClient = null;
  }

  // Get or create node-redis client (for sessions)
  async getNodeRedisClient() {
    if (!this.nodeRedisClient) {
      this.nodeRedisClient = createClient({ url: redis_url });

      this.nodeRedisClient.on("error", (err) =>
        console.log("Redis Client Error", err)
      );
      this.nodeRedisClient.on("connect", () =>
        console.log("Connected to Redis🔥🔥🔥...")
      );

      await this.nodeRedisClient.connect().catch(console.error);
    }
    return this.nodeRedisClient;
  }

  // Get or create ioRedis client (for Bull)
  getIORedisClient() {
    if (!this.ioRedisClient) {
      this.ioRedisClient = new Redis(redis_url, {
        maxRetriesPerRequest: null,
      });
    }
    return this.ioRedisClient;
  }
}

// Create singleton instance
const redisConnection = new RedisConnection();

module.exports = {
  redisConnection,
  SESSION_EXPIRATION,
};
