const logger = require("./logger");
const { metrics } = require("./metrics");

const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.on("finish", () => {
    const duration = Date.now() - start;
    metrics.httpRequestDuration
      .labels(req.method, req.path, res.statusCode.toString())
      .observe(duration / 1000);

    logger.info("Request completed", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: duration,
    });
  });

  next();
};

module.exports = metricsMiddleware;
