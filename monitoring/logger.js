const winston = require("winston");
const LokiTransport = require("winston-loki");

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new LokiTransport({
      host: "http://loki:3100",
      labels: { app: "express-app" },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => console.error(err),
    }),
  ],
});

module.exports = logger;
