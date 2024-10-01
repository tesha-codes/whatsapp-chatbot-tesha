const { format } = require("date-fns");

const formatDateTime = (date = new Date()) => {
  return format(date, "yyyy-MM-dd hh:mm:ss a");
};

module.exports = { formatDateTime };
