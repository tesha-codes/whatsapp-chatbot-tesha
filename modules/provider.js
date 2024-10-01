const { StatusCodes } = require("http-status-codes");

class ServiceProvider {
  constructor(res, userResponse, session, user, steps) {
    this.res = res;
    this.userResponse = userResponse;
    this.session = session;
    this.user = user;
    this.steps = steps;
  }

  async mainEntry() {
    const { userResponse, res, session, user, steps } = this;
    const phone = userResponse.sender.phone;
    const message = userResponse.payload?.text || "";
    const username = userResponse.sender.name;
    // : do the dirty work here
    // :
    return res.status(StatusCodes.OK).send("Oh, ndikuda basa here mudhara?");
  }
}

module.exports = ServiceProvider;
