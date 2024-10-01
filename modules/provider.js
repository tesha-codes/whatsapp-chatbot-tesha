const { StatusCodes } = require("http-status-codes");
const { formatDateTime } = require("../utils/dateUtil");

class ServiceProvider {
  constructor(res, userResponse, session, user, steps, messages) {
    this.res = res;
    this.userResponse = userResponse;
    this.session = session;
    this.user = user;
    this.steps = steps;
    this.messages = messages;
    this.lActivity = formatDateTime();
    this.setupCommonVariables();
  }

  //   setup common variables
  setupCommonVariables() {
    const { userResponse } = this;
    this.phone = userResponse.sender.phone;
    this.message = userResponse.payload?.text || "";
    this.username = userResponse.sender.name;
  }
  // important set session to expire 24 hours after last activity
  // check user if new or existing
  // NEW
  // send create account templates -> get user full name/business name, phone number, national id, buinesss category,
  // -> actual service,  city/town, business address, national id image, buinesss hours, any other desctriptions
  //
  // existing send exiting template
  // view tasks -> get user tasks
  // edit profile
  // delete profile

  async mainEntry() {
    const {
      res,
      session,
      user,
      steps,
      messages,
      lActivity,
      phone,
      username,
      message,
    } = this;
    // : do the dirty work here
    // :
    return res.status(StatusCodes.OK).send("Oh, ndikuda basa here mudhara?");
  }
}

module.exports = ServiceProvider;
