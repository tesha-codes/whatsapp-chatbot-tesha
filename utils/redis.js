require("dotenv").config();
const redis = require("redis");
const { promisify } = require("util");
//
const { REDIS_URL } = process.env;

// : redis
const client = redis.createClient(REDIS_URL);

// Promisify Redis commands
const getSession = promisify(client.get).bind(client);
const setSession = promisify(client.set).bind(client);
const deleteSession = promisify(client.del).bind(client);

module.exports = { getSession, setSession, deleteSession };
