require('dotenv').config()
const { Queue, Worker } = require('bullmq');

const Redis = require('ioredis');

// Parse Redis URL and create connection


function setupQueue(queueName, processFunction, options = {}) {


    // Create a new BullMQ queue with proper connection
    const queue = new Queue(queueName, {
        connection: new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null
        }),
        defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: false,
        },
        ...options
    });

    // Create a worker to process jobs
    const worker = new Worker(queueName, async (job) => {
        try {
            return await processFunction(job);
        } catch (error) {
            console.error(`Error processing job ${job.id}:`, error);
            throw error;
        }
    }, {
        connection: new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null }),
        concurrency: 5
    });

    // Set up worker event handlers
    worker.on('completed', (job) => {
        console.log(`Job ${job.id} in queue ${queueName} completed`);
    });

    worker.on('failed', (job, err) => {
        console.error(`Job ${job.id} in queue ${queueName} failed with error:`, err);
    });

    worker.on('error', (error) => {
        console.error(`Error in queue ${queueName}:`, error);
    });

    // Return both queue and worker for more control
    return { queue, worker };
}

// Example usage
async function addJob(queue, data) {
    try {
        const job = await queue.add('process', data);
        console.log(`Added job ${job.id} to queue`);
        return job;
    } catch (error) {
        console.error('Error adding job to queue:', error);
        throw error;
    }
}

module.exports = {
    setupQueue,
    addJob
};