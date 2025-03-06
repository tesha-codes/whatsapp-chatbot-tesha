require("dotenv").config();
const { createClient } = require("redis");

const { REDIS_URL, SESSION_TTL } = process.env;

// Redis session settings default to 24 hours unless set otherwise
const SESSION_EXPIRATION = SESSION_TTL || 24 * 60 * 60;

const client = createClient({ url: REDIS_URL });

client.on("error", (err) => console.log("Redis Client Error", err));
client.on("connect", () => console.log("Connected to Redis🔥🔥🔥..."));

// Connect to Redis
client.connect().catch(console.error);

// helper functions
// get session
const getSession = async (key) => await client.hGetAll(key);

// set session
const setSession = async (key, value, ttl = SESSION_EXPIRATION) => {
  const fields = Object.entries(value);
  await client.hSet(key, fields.flat());
  await client.expire(key, ttl);
};

// delete session
const deleteSession = async (key) => await client.del(key);

// Promisify Redis operations
const redisHelper = {
  // Set a key with optional expiry
  set: async (key, value, exType, exValue) => {
    try {
      if (exType && exValue) {
        return await client.set(key, value, exType, exValue);
      } else {
        return await client.set(key, value);
      }
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  },

  // Get a key's value
  get: async (key) => {
    try {
      return await client.get(key);
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  },

  // Check if a key exists
  exists: async (key) => {
    try {
      return await client.exists(key);
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  },

  // Delete a key
  del: async (key) => {
    try {
      return await client.del(key);
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  },

  // Set key expiry
  expire: async (key, seconds) => {
    try {
      return await client.expire(key, seconds);
    } catch (error) {
      console.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }
};

module.exports = { client, redisHelper, getSession, setSession, deleteSession };
