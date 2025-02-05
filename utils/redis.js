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
  await client.hSet(key, value);
  await client.expire(key, ttl);
};

// delete session
const deleteSession = async (key) => await client.del(key);

module.exports = { client, getSession, setSession, deleteSession };
