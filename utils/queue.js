const { Queue, Worker } = require("bullmq");
const { redisConnection } = require("./redis-connection");

function setupQueue(queueName, processFunction, options = {}) {
  const connection = redisConnection.getIORedisClient();

  const queue = new Queue(queueName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
    ...options,
  });

  const worker = new Worker(
    queueName,
    async (job) => {
      try {
        return await processFunction(job);
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} in queue ${queueName} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `Job ${job.id} in queue ${queueName} failed with error:`,
      err
    );
  });

  worker.on("error", (error) => {
    console.error(`Error in queue ${queueName}:`, error);
  });

  return { queue, worker, connection };
}

async function addJob(queue, jobName, data, options = {}) {
  try {
    const job = await queue.add(jobName, data, options);
    console.log(`Added job ${job.id} to queue`);
    return job;
  } catch (error) {
    console.error("Error adding job to queue:", error);
    throw error;
  }
}

module.exports = {
  setupQueue,
  addJob,
};
