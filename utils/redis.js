require("dotenv").config();
const { createClient } = require("redis");

const { promisify } = require("util");
//
const { REDIS_URL } = process.env;

// : redis
const client = createClient({ url: REDIS_URL });

client.on("error", (err) => console.log("Redis Client Error", err));

client.on("connect", () => console.log("Connected to Redis..."));

// Promisify Redis commands
const getSession = promisify(client.get).bind(client);
const setSession = promisify(client.set).bind(client);
const deleteSession = promisify(client.del).bind(client);

module.exports = { getSession, setSession, deleteSession };
