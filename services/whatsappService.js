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
  //  no template, send a regular message
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
    return sendTextMessage(userMobileNumber, messages.CLIENT_MAIN_MENU);
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
const serviceProviderMainMenuTemplate = async (userMobileNumber) => {
  const templateId = await templateManager.getAvailableTemplateId(
    "serviceProviderMainMenu",
    userMobileNumber
  );
  //  no template, send a regular message
  if (!templateId) {
    return sendTextMessage(userMobileNumber, messages.PROVIDER_MAIN_MENU);
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
};
