const { StatusCodes } = require("http-status-codes");
const { getRequestedServiceProviders } = require("./../controllers/serviceProvider.controller")
const { setupQueue } = require('./../utils/queue')


async function processProviderJob(req, res, job) {
    const { phone, serviceId, categoryId, requestId } = job.data;

    const providers = await getRequestedServiceProviders({ service: serviceId, category: categoryId });

    if (providers === null) {
        return res.status(StatusCodes.OK).send("We're sorry, but there are no service providers available at the moment. We'll keep searching and notify you as soon as one becomes available.")
    } else {

        let providersMessage = "We've found the following service providers for you:\n\n";

        providers.forEach((provider, index) => {
            providersMessage += `${index + 1}. ${provider.name}\n`;
            providersMessage += `   Rating: ${provider.rating} ⭐\n`;
            providersMessage += `   Experience: ${provider.experience} years\n\n`;
        });

        providersMessage += "Please reply with the number of the provider you'd like to choose, or type 'more' for additional options.";

        return res.status(StatusCodes.OK).send(providersMessage)
    }
}

module.exports = setupQueue('serviceProviderQueue', processProviderJob);



