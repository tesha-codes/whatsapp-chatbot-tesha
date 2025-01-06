const mongoose = require("mongoose");

module.exports = function (connectionURL) {
  let retryCount = 0;
  const maxRetries = 10;

  const connectWithRetry = async () => {
    try {
      const response = await mongoose.connect(connectionURL, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        maxPoolSize: 10,
      });
      console.log(
        `Successfully connected to ${response.connections[0]?.db.databaseName} ✅`
      );
      retryCount = 0; // Reset retry count on success
    } catch (err) {
      console.error(`MongoDB connection error: ${err}`);
      retryCount++;
      if (retryCount <= maxRetries) {
        const delay = Math.min(5000 * 2 ** retryCount, 60000); // Exponential backoff
        console.warn(`Retrying connection in ${delay / 1000} seconds...`);
        setTimeout(connectWithRetry, delay);
      } else {
        console.error("Max reconnection attempts reached. Exiting...");
        process.exit(1);
      }
    }
  };

  // Event listeners
  mongoose.connection.on("connected", () => {
    console.log("MongoDB connection established successfully ✅");
  });

  mongoose.connection.on("error", (err) => {
    console.error(`MongoDB connection error: ${err}`);
    if (err.name === "MongoNetworkError") {
      console.warn("Network error detected. Attempting reconnection...");
      connectWithRetry();
    }
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB connection disconnected. Initiating reconnection...");
    connectWithRetry();
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    try {
      await mongoose.connection.close(true);
      console.log("MongoDB connection closed due to app termination 🔌");
      process.exit(0);
    } catch (err) {
      console.error("Critical error during MongoDB connection closure:", err);
      process.exit(1);
    }
  });

  // Initial connection attempt
  return connectWithRetry();
};
