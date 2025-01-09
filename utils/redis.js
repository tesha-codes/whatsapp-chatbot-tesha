const { redisConnection, SESSION_EXPIRATION } = require("./redis-connection");

// helper functions
const getSession = async (key) => {
  const client = await redisConnection.getNodeRedisClient();
  return client.hGetAll(key);
};

const setSession = async (key, value, ttl = SESSION_EXPIRATION) => {
  const client = await redisConnection.getNodeRedisClient();
  await client.hSet(key, value);
  await client.expire(key, ttl);
};

const deleteSession = async (key) => {
  const client = await redisConnection.getNodeRedisClient();
  return client.del(key);
};

module.exports = { getSession, setSession, deleteSession };
