const { StatusCodes } = require("http-status-codes");

class ServiceProvider {
  constructor(res, userResponse, session, user, steps, messages) {
    this.res = res;
    this.userResponse = userResponse;
    this.session = session;
    this.user = user;
    this.steps = steps;
    this.messages = messages;
    this.lActivity = Date.now();
    this.setupCommonVariables();
  }

  //   setup common variables
  setupCommonVariables() {
    const { userResponse } = this;
    this.phone = userResponse.sender.phone;
    this.message = userResponse.payload?.text || "";
    this.username = userResponse.sender.name;
  }

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
