const { StatusCodes } = require("http-status-codes");
const { setSession } = require("../utils/redis");
const { createUser, updateUser } = require("../controllers/user.controllers");
const { formatDateTime } = require("../utils/dateUtil");
const {
  sendChooseAccountTypeTemplate,
  registerClientTemplate,
  welcomeMessageTemplate,
  registerServiceProviderTemplate,
  serviceProviderMainMenuTemplate,
} = require("./../services/whatsappService");

class Onboarding {
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

  // variables usage destructured example
  // const { res, session, user, steps, messages, lActivity, phone, username, message} = this;

  //  create new new user
  async createNewUser() {
    const { res, steps, lActivity, phone, message, username } = this;
    //
    await createUser({ phone, username });

    console.log("Phone number: ", phone);

    const response = await welcomeMessageTemplate(phone);
    console.log("Some response to check: ", response);
    await setSession(phone, {
      step: steps.ACCEPT_TERMS,
      message,
      lActivity,
    });

    return res.status(StatusCodes.OK).send("");
  }

  // existing user without session
  async existingUserWithoutSession() {
    const { res, user, steps, messages, lActivity, phone, message } = this;

    if (user.termsAndConditionsAccepted && user.accountType) {
      // client.accountType
      if (user.accountType === "Client") {
        await setSession(phone, {
          accountType: "Client",
          step: steps.ACCEPTED_TERMS,
          message,
          lActivity,
        });

        return res.status(StatusCodes.OK).send(messages.CLIENT_HOME);
      }
      // provider.accountType
      if (user.accountType === "ServiceProvider") {
        if (user.verified && user.accountStatus === "Active") {
          // home stuff
          await setSession(phone, {
            accountType: "ServiceProvider",
            step: steps.SERVICE_PROVIDER_MAIN_MENU,
            message,
            lActivity,
          });
          // 
          await serviceProviderMainMenuTemplate(phone);
          return res.status(StatusCodes.OK).send("");

        } else if (user.verified && user.accountStatus === "Suspended") {
          await setSession(phone, {
            accountType: "ServiceProvider",
            step: steps.ACCOUNT_STATUS_SUSPENDED,
            message,
            lActivity,
          });
          return res.status(StatusCodes.OK).send(messages.SUSPENDED_MESSAGE);
        } else if (user.verified && user.accountStatus === "Inactive") {
          await setSession(phone, {
            accountType: "ServiceProvider",
            step: steps.ACCOUNT_STATUS_INACTIVE,
            message,
            lActivity,
          });
          return res.status(StatusCodes.OK).send(messages.INACTIVE_MESSAGE);
        } else if (!user.verified) {
          await setSession(phone, {
            accountType: "ServiceProvider",
            step: steps.WAITING_FOR_VERIFICATION,
            message,
            lActivity,
          });
          return res.status(StatusCodes.OK).send(messages.VERIFICATION_WAIT_MESSAGE);
        }else{
          return res.status(StatusCodes.OK).send("Not sure if this is happening");
        }
      }
    } else {
      // no session and no terms were accepted
      await setSession(phone, {
        step: steps.ACCEPTED_TERMS,
        message,
        lActivity,
      });
      return res.status(StatusCodes.OK).send(messages.WELCOME_TERMS);
    }
  }

  // nelwy created users accept terms and conditions and choose account types
  async acceptTermsAndChooseAccountType() {
    const { res, session, steps, messages, lActivity, phone, message } = this;
    // : accept terms and conditions
    if (session.step === steps.ACCEPT_TERMS) {
      if (message.toLowerCase() === "accept terms") {
        await updateUser({ phone, termsAndConditionsAccepted: true });
        await setSession(phone, {
          step: steps.ACCEPTED_TERMS,
          message,
          lActivity,
        });
        // send choose account type template
        await sendChooseAccountTypeTemplate(phone);
        return res.status(StatusCodes.OK).send("");
      } else if (message.toLowerCase() === "decline terms") {
        await setSession(phone, {
          step: steps.ACCEPTED_TERMS,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(message.DECLINE_TERMS);
      } else {
        const invalidMessage =
          "You have provided an invalid response. Please type 'Accept Terms' or 'Decline Terms'to proceed.";
        return res.status(StatusCodes.OK).send(invalidMessage);
      }
    } else if (session.step === steps.ACCEPTED_TERMS) {
      if (message.toLowerCase() === "client") {
        await updateUser({ phone, accountType: "Client" });
        await setSession(phone, {
          accountType: "Client",
          step: steps.SETUP_CLIENT_PROFILE,
          message,
          lActivity,
        });
        await registerClientTemplate(phone);
        return res.status(StatusCodes.OK).send("");
      } else if (message.toLowerCase() === "service provider") {
        await updateUser({ phone, accountType: "ServiceProvider" });
        await setSession(phone, {
          accountType: "ServiceProvider",
          step: steps.PROVIDER_PROMPT_ACCOUNT,
          message,
          lActivity,
        });
        await registerServiceProviderTemplate(phone);
        return res.status(StatusCodes.OK).send("");
      } else {
        const invalidMessage =
          "You have provided an invalid response. Please reply with 'Client' or 'Service Provider' to proceed.";
        return res.status(StatusCodes.OK).send(invalidMessage);
      }
    }
  }
}

module.exports = Onboarding;
