const axios = require("axios");
const dotenv = require("dotenv");
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
    template: {
      id: templateId,
      params: templateParams,
    },
    message: mediaMessage,
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
};
