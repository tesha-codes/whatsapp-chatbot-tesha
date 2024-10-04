// service-provider.job.js
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { getRequestedServiceProviders } = require("./../controllers/serviceProvider.controller");
const { sendTextMessage } = require("../services/whatsappService");


const connection = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});


const QUEUE_NAME = 'serviceProviderQueue';


const providerQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        }
    }
});


async function processProviderJob(job) {
    const { phone, serviceId, categoryId, requestId } = job.data;
    console.log(`Processing provider job for request ${requestId}`);

    try {
        const providers = await getRequestedServiceProviders({
            service: serviceId,
            category: categoryId
        });

        if (!providers || providers.length === 0) {
            await sendTextMessage(
                phone,
                "We're sorry, but there are no service providers available at the moment. We'll keep searching and notify you as soon as one becomes available."
            );
            return { status: 'NO_SERVICE_PROVIDERS', requestId };
        }

        let providersMessage = "We've found the following service providers for you:\n\n";

        providers.forEach((provider, index) => {
            providersMessage += `${index + 1}. ${provider.name}\n`;
            providersMessage += `   Rating: ${provider.rating} ⭐\n`;
            providersMessage += `   Experience: ${provider.experience} years\n\n`;
        });

        providersMessage += "Please reply with the number of the provider you'd like to choose, or type 'more' for additional options.";

        await sendTextMessage(phone, providersMessage);
        return { status: 'SERVICE_PROVIDERS_AVAILABLE', requestId, providersCount: providers.length };
    } catch (error) {
        console.error(`Error processing provider job for request ${requestId}:`, error);
        throw error; 
    }
}

const worker = new Worker(QUEUE_NAME, processProviderJob, {
    connection,
    concurrency: 5
});


worker.on('completed', (job) => {
    console.log(`Provider job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    console.error(`Provider job ${job.id} failed:`, err);
});

async function queueProviderSearch({ phone, serviceId, categoryId, requestId }) {
    try {
        const job = await providerQueue.add('findProviders', {
            phone,
            serviceId,
            categoryId,
            requestId
        }, {
            jobId: `provider-search-${requestId}`, // Unique job ID
            timeout: 5000 // 5 seconds timeout
        });

        console.log(`Added provider search job ${job.id} for request ${requestId}`);
        const respond =  await job.waitUntilFinished()
        return respond;
    } catch (error) {
        console.error('Error adding provider search job:', error);
        throw error;
    }
}


async function shutdown() {
    await worker.close();
    await providerQueue.close();
    await connection.quit();
}


module.exports = {
    queueProviderSearch,
    shutdown,
    providerQueue 
};