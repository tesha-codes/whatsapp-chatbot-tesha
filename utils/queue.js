const { Queue } = require('bullmq');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function setupQueue(queueName, processFunction, options = {}) {
    // Create a new Bull queue

    const queue = new Queue(queueName, REDIS_URL, {
        defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: false,
        },
        ...options
    });

    // Process jobs in the queue
    queue.process(processFunction);

    // Set up basic event handlers
    queue.on('completed', (job) => {
        console.log(`Job ${job.id} in queue ${queueName} completed`);
    });

    queue.on('failed', (job, err) => {
        console.error(`Job ${job.id} in queue ${queueName} failed with error:`, err);
    });

    queue.on('error', (error) => {
        console.error(`Error in queue ${queueName}:`, error);
    });

    return queue;
}


module.exports = { setupQueue };