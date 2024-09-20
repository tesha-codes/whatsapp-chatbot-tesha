const dotenv = require("dotenv");
dotenv.config();
//
const { APP_NAME } = process.env;

const BASE_URL = "https://api.gupshup.io/sm/api/v1";
const USER_OPTIN_URL = `${BASE_URL}/app/opt/in/${APP_NAME}`;
const TEXT_MSG_URL = `${BASE_URL}/msg`;
const TEMPLATE_MSG_URL = `${BASE_URL}/template/msg`;
const BULK_OPTIN_URL = `${BASE_URL}/app/opt/in/${APP_NAME}`;
const TEMPLATE_LIST_URL = `${BASE_URL}/template/list/${APP_NAME}`;

module.exports = {
  BASE_URL,
  USER_OPTIN_URL,
  TEXT_MSG_URL,
  TEMPLATE_MSG_URL,
  BULK_OPTIN_URL,
  TEMPLATE_LIST_URL,
  APP_NAME,
};
