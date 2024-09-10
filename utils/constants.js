const dotenv = require("dotenv");
dotenv.config();
// 
const { APP_NAME } = process.env;

const BASE_URL = "https://api.gupshup.io/sm/api/v1";
export const USER_OPTIN_URL = `${BASE_URL}/app/opt/in/${APP_NAME}`;
export const TEXT_MSG_URL = `${BASE_URL}/msg`;
export const TEMPLATE_MSG_URL = `${BASE_URL}/template/msg`;
export const BULK_OPTIN_URL = `${BASE_URL}/app/opt/in/${APP_NAME}`;
export const TEMPLATE_LIST_URL = `${BASE_URL}/template/list/${APP_NAME}`;