const promClient = require("prom-client");

const Registry = promClient.Registry;
const register = new Registry();

// Initialize default metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ register });

// : Custom metrics
const metrics = {
  httpRequestDuration: new promClient.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
  }),

  botRequestCounter: new promClient.Counter({
    name: "bot_requests_total",
    help: "Total number of bot requests",
    labelNames: ["status", "type"],
    registers: [register],
  }),

  redisOperations: new promClient.Counter({
    name: "redis_operations_total",
    help: "Total number of Redis operations",
    labelNames: ["operation", "status"],
    registers: [register],
  }),
};

module.exports = { register, metrics };
