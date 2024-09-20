require("dotenv").config();
const { createClient } = require("redis");

const { REDIS_URL } = process.env;

const client = createClient({ url: REDIS_URL });

client.on("error", (err) => console.log("Redis Client Error", err));
client.on("connect", () => console.log("Connected to Redis🔥🔥🔥..."));

// Connect to Redis
client.connect().catch(console.error);

// Use async functions instead of promisify
const getSession = async (key) => await client.get(key);
const setSession = async (key, value) => await client.set(key, value);
const deleteSession = async (key) => await client.del(key);

module.exports = { getSession, setSession, deleteSession };
