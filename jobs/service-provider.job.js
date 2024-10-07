const {
  getRequestedServiceProviders,
} = require("./../controllers/serviceProvider.controller");
const { sendTextMessage } = require("../services/whatsappService");

const { setupQueue, addJob } = require("../utils/queue");

const QUEUE_NAME = "serviceProviderQueue";

const { queue, worker, connection } = setupQueue(
  QUEUE_NAME,
  processProviderJob
);

async function processProviderJob(job) {
  const { phone, serviceId, categoryId, requestId } = job.data;
  console.log(`Processing provider job for request ${requestId}`);

  try {
    const providers = await getRequestedServiceProviders({
      service: serviceId,
      category: categoryId,
    });

    if (!providers || providers.length === 0) {
      await sendTextMessage(
        phone,
        "We're sorry, but there are no service providers available at the moment. We'll keep searching and notify you as soon as one becomes available."
      );
      return { status: "NO_SERVICE_PROVIDERS", requestId };
    }

    let providersMessage =
      "We've found the following service providers for you:\n\n";

    providers.forEach((provider, index) => {
      providersMessage += `${index + 1}. ${provider.name}\n`;
      providersMessage += `   Rating: ${provider.rating} ⭐\n`;
      providersMessage += `   Experience: ${provider.experience} years\n\n`;
    });

    providersMessage +=
      "Please reply with the number of the provider you'd like to choose, or type 'more' for additional options.";

    await sendTextMessage(phone, providersMessage);
    return {
      status: "SERVICE_PROVIDERS_AVAILABLE",
      requestId,
      providersCount: providers.length,
    };
  } catch (error) {
    console.error(
      `Error processing provider job for request ${requestId}:`,
      error
    );
    throw error;
  }
}

async function queueProviderSearch({
  phone,
  serviceId,
  categoryId,
  requestId,
}) {
  try {
    const job = await addJob(
      queue,
      "findProviders",
      {
        phone,
        serviceId,
        categoryId,
        requestId,
      },
      {
        jobId: `provider-search-${requestId}`, // Unique job ID
        timeout: 5000, // 5 seconds timeout
      }
    );
    console.log(`Added provider search job ${job.id} for request ${requestId}`);
    return job;
  } catch (error) {
    console.error("Error adding provider search job:", error);
    return { status: "ERROR", requestId, error: error.message };
  }
}

async function shutdown() {
  await worker.close();
  await queue.close();
  await connection.quit();
}

module.exports = {
  queueProviderSearch,
  shutdown,
  queue,
};
