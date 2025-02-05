const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const { client } = require("../utils/redis");

const ACTIVITY_TTL = 30 * 24 * 60 * 60; // 30 days

// Rate limiting configuration
const limiter = rateLimit({
  store: new RedisStore({
    client: client,
    prefix: "rate_limit:",
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

const trackActivity = async (req, res, next) => {
  try {
    const userResponse = req.body.payload;
    const { phone } = userResponse.sender;
    const activity = {
      phone,
      timestamp: new Date(),
      action: userResponse.payload?.text || userResponse.payload || "",
      messageType: userResponse.type,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      sessionId: req.sessionID,
    };

    // Store in Redis
    const activityKey = `activity:${phone}`;
    await client.lPush(activityKey, JSON.stringify(activity));
    await client.lTrim(activityKey, 0, 99); // Keep last 100 activities
    await client.expire(activityKey, ACTIVITY_TTL);

    // Add response time tracking
    req.activityTracking = {
      startTime: Date.now(),
    };

    // Track response time after response is sent
    res.on("finish", async () => {
      const responseTime = Date.now() - req.activityTracking.startTime;
      activity.responseTime = responseTime;

      // Store response time metrics
      await client.lPush(`metrics:responseTimes:${phone}`, responseTime);
      await client.lTrim(`metrics:responseTimes:${phone}`, 0, 99);
    });

    next();
  } catch (error) {
    console.error("Error tracking activity:", error);
    next(); // Continue even if tracking fails
  }
};

module.exports = { limiter, trackActivity };
