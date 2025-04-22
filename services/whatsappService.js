const axios = require("axios");
const dotenv = require("dotenv");
const templateManager = require("./templateManager");
const { messages } = require("../modules/client");
const {
  USER_OPTIN_URL,
  TEXT_MSG_URL,
  TEMPLATE_MSG_URL,
  BULK_OPTIN_URL,
  TEMPLATE_LIST_URL,
} = require("../utils/constants");
dotenv.config();

const { API_KEY, APP_NAME, SOURCE_MOBILE_NUMBER } = process.env;
//
const config = {
  headers: {
    "Cache-Control": "no-cache",
    "Content-Type": "application/x-www-form-urlencoded",
    apiKey: API_KEY,
  },
};

const getUrlEncodedData = (data) => {
  const resultantData = new URLSearchParams();
  Object.keys(data).forEach((key) => {
    resultantData.append(
      key,
      typeof data[key] === "object" ? JSON.stringify(data[key]) : data[key]
    );
  });
  return resultantData;
};

const getTemplatesList = () => axios.get(TEMPLATE_LIST_URL, config);

const markUserOptIn = (userMobileNumber) => {
  const params = getUrlEncodedData({
    user: userMobileNumber,
  });

  return axios.post(USER_OPTIN_URL, params, config);
};

const markBulkOptIn = (userMobileNumbers) => {
  const params = getUrlEncodedData({
    users: userMobileNumbers,
  });

  return axios.post(BULK_OPTIN_URL, params, config);
};

const sendMediaImageMessage = (userMobileNumber, imageUrl, caption) => {
  const params = getUrlEncodedData({
    channel: "whatsapp",
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    "src.name": APP_NAME,
    message: {
      type: "image",
      originalUrl: imageUrl,
      previewUrl: imageUrl,
      caption,
    },
  });

  return axios.post(TEXT_MSG_URL, params, config);
};

const sendMediaVideoMessage = (userMobileNumber, videoUrl, caption) => {
  const params = getUrlEncodedData({
    channel: "whatsapp",
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    "src.name": APP_NAME,
    message: {
      type: "video",
      url: videoUrl,
      caption,
    },
    "src.name": APP_NAME,
  });

  return axios.post(TEXT_MSG_URL, params, config);
};

const sendTextMessage = (userMobileNumber, message) => {
  const params = getUrlEncodedData({
    channel: "whatsapp",
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    message: {
      type: "text",
      text: message,
    },
    "src.name": APP_NAME,
    disablePreview: false,
  });

  return axios.post(TEXT_MSG_URL, params, config);
};

const sendTemplateMessage = (
  userMobileNumber,
  templateId,
  templateParams,
  mediaMessage
) => {
  const params = getUrlEncodedData({
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    "src.name": APP_NAME,
    template: {
      id: templateId,
      params: templateParams,
    },
    message: mediaMessage,
  });

  return axios.post(TEMPLATE_MSG_URL, params, config);
};

const sendChooseAccountTypeTemplate = async (userMobileNumber) => {
  const templateId = await templateManager.getAvailableTemplateId(
    "chooseAccountType",
    userMobileNumber
  );
  //  no template, send a regular message
  if (!templateId) {
    return sendTextMessage(userMobileNumber, messages.USER_OR_PROVIDER);
  }

  const params = getUrlEncodedData({
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    "src.name": APP_NAME,
    template: {
      id: templateId,
      params: [],
    },
    message: {},
  });

  return axios.post(TEMPLATE_MSG_URL, params, config);
};
const clientMainMenuTemplate = async (userMobileNumber, name) => {
  const templateId = await templateManager.getAvailableTemplateId(
    "clientMainMenu",
    userMobileNumber
  );
  if (!templateId) {
    return sendTextMessage(userMobileNumber, messages.CLIENT_MAIN_MENU);
  }
  const params = getUrlEncodedData({
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    "src.name": APP_NAME,
    template: {
      id: templateId,
      params: [name],
    },
    message: {},
  });

  return axios.post(TEMPLATE_MSG_URL, params, config);
};

const registerClientTemplate = async (userMobileNumber) => {
  const templateId = await templateManager.getAvailableTemplateId(
    "registerClient",
    userMobileNumber
  );
  //  no template, send a regular message
  if (!templateId) {
    return sendTextMessage(userMobileNumber, messages.CREATE_CLIENT_ACCOUNT);
  }
  const params = getUrlEncodedData({
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    "src.name": APP_NAME,
    template: {
      id: templateId,
      params: [],
    },
    message: {},
  });

  return axios.post(TEMPLATE_MSG_URL, params, config);
};

const welcomeMessageTemplate = async (userMobileNumber) => {
  const templateId = await templateManager.getAvailableTemplateId(
    "welcomeMessage",
    userMobileNumber
  );
  //  no template, send a regular message
  if (!templateId) {
    return sendTextMessage(userMobileNumber, messages.WELCOME_MESSAGE);
  }
  const params = getUrlEncodedData({
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    "src.name": APP_NAME,
    template: {
      id: templateId,

      params: [],
    },
    message: {},
  });

  return axios.post(TEMPLATE_MSG_URL, params, config);
};

// PROVIDER TEMPLATES START HERE
const registerServiceProviderTemplate = async (userMobileNumber) => {
  const templateId = await templateManager.getAvailableTemplateId(
    "registerServiceProvider",
    userMobileNumber
  );
  //  no template, send a regular message
  if (!templateId) {
    return sendTextMessage(
      userMobileNumber,
      messages.REGISTER_SERVICE_PROVIDER
    );
  }
  const params = getUrlEncodedData({
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    "src.name": APP_NAME,
    template: {
      id: templateId,
      params: [],
    },
    message: {},
  });

  return axios.post(TEMPLATE_MSG_URL, params, config);
};
// service provider main menu template
const serviceProviderMainMenuTemplate = async (userMobileNumber, name) => {
  const templateId = await templateManager.getAvailableTemplateId(
    "serviceProviderMainMenu",
    userMobileNumber
  );
  if (!templateId) {
    return sendTextMessage(
      userMobileNumber,
      messages.SERVICE_PROVIDER_MAIN_MENU
    );
  }
  const params = getUrlEncodedData({
    source: SOURCE_MOBILE_NUMBER,
    destination: userMobileNumber,
    "src.name": APP_NAME,
    template: {
      id: templateId,
      params: [name],
    },
    message: {},
  });

  return axios.post(TEMPLATE_MSG_URL, params, config);
};

// send a proviver a request template
const sendProviderARequestTemplate = async (requestData) => {
  // destructure the request data
  const {
    providerName,
    providerPhone,
    requestId,
    clientName,
    date,
    serviceType,
    time,
    location,
    description,
    estimatedHours,
    hourlyRate,
    totalCost,
    serviceFee,
  } = requestData;
  // get the template id from the template manager
  const templateId = await templateManager.getAvailableTemplateId(
    "sendProviderARequest",
    providerPhone
  );
  //  no template, send a regular message
  if (!templateId) {
    const requestMessage = `
🔔 New Service Request 🔔

Hello ${providerName},

You have a new service request:
- Request ID: ${requestId}
- Client Name: ${clientName}
- Service: ${serviceType}
- Date: ${date}
- Time: ${time}
- Location: ${location}
- Description: ${description}

💰 Job Details:
- Estimated Hours: ${estimatedHours}
- Your Hourly Rate: $${hourlyRate}/hour
- Estimated Total: $${totalCost.toFixed(2)}
- Service Fee (5%): $${serviceFee.toFixed(2)}

Please review and accept or decline this request. Reply with 'ACCEPT or 'DECLINE to proceed.
    `;

    return sendTextMessage(providerPhone, requestMessage);
  }
  // send the template message
  const params = getUrlEncodedData({
    source: SOURCE_MOBILE_NUMBER,
    destination: providerPhone,
    "src.name": APP_NAME,
    template: {
      id: templateId,
      params: [
        providerName,
        requestId,
        serviceType,
        date,
        time,
        location,
        description,
        clientName,
        estimatedHours,
        `$${hourlyRate.toFixed(2)}/hour`,
        `$${totalCost.toFixed(2)}`,
        `$${serviceFee.toFixed(2)}`,
      ],
    },
    message: {},
  });

  return axios.post(TEMPLATE_MSG_URL, params, config);
};

// Send job completion notification to service provider
const sendJobCompletionNotification = async (requestData) => {
  const {
    providerPhone,
    providerName,
    requestId,
    serviceType,
    clientName,
    totalCost,
    serviceFee,
    rating,
    review,
  } = requestData;

  const message = `
🎉 *Job Completed by Client* 🎉

Hello ${providerName},

Your ${serviceType} service (${requestId}) has been marked as completed by ${clientName}.

💰 *Payment Details:*
- Total Amount: $${totalCost.toFixed(2)}
- Service Fee (5%): $${serviceFee.toFixed(2)}

⭐ *Client Rating:* ${rating} star${rating !== 1 ? "s" : ""}
📝 *Client Review:* "${review}"

⚠️ Please leave a review for the client and pay your service fee within 48 hours to maintain your account in good standing.

Reply with "*Pay service fee for ${requestId}*" to make your payment.

Thank you for using Tesha!`;

  return sendTextMessage(providerPhone, message);
};

// Send provider job completion notification to client
const sendProviderCompletedJobNotification = async (requestData) => {
  const {
    clientPhone,
    clientName,
    requestId,
    serviceType,
    providerName,
    totalCost,
  } = requestData;

  const message = `
🔔 *Service Provider Completed Job* 🔔

Hello ${clientName},

${providerName} has marked your ${serviceType} service (${requestId}) as completed.

📝 Total Cost: $${totalCost.toFixed(2)}

Are you satisfied with the service? Please reply with a rating from 1-5 stars and any feedback.

Example: "*Rate ${requestId} 5 stars - Great work, very professional!*"

Thank you for using Tesha!`;

  return sendTextMessage(clientPhone, message);
};

module.exports = {
  getTemplatesList,
  markBulkOptIn,
  markUserOptIn,
  sendMediaImageMessage,
  sendMediaVideoMessage,
  sendTextMessage,
  sendTemplateMessage,
  sendChooseAccountTypeTemplate,
  clientMainMenuTemplate,
  registerClientTemplate,
  welcomeMessageTemplate,
  registerServiceProviderTemplate,
  serviceProviderMainMenuTemplate,
  sendProviderARequestTemplate,
  sendJobCompletionNotification,
  sendProviderCompletedJobNotification,
};
