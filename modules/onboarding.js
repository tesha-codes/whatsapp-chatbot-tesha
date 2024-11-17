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
  clientMainMenuTemplate,
} = require("./../services/whatsappService");

class Onboarding {
  static ACCOUNT_TYPES = {
    CLIENT: "Client",
    SERVICE_PROVIDER: "ServiceProvider",
  };

  static ACCOUNT_STATUS = {
    ACTIVE: "Active",
    SUSPENDED: "Suspended",
    INACTIVE: "Inactive",
  };

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

  setupCommonVariables() {
    const { userResponse } = this;
    this.phone = userResponse.sender.phone;
    this.message = userResponse.payload?.text || "";
    this.username = userResponse.sender.name;
  }

  async setUserSession(step, additionalData = {}) {
    return await setSession(this.phone, {
      step,
      message: this.message,
      lActivity: this.lActivity,
      ...additionalData,
    });
  }

  // Helper method to send response
  sendResponse(message = "") {
    return this.res.status(StatusCodes.OK).send(message);
  }

  // New user creation
  async createNewUser() {
    await createUser({
      phone: this.phone,
      username: this.username,
    });

    await welcomeMessageTemplate(this.phone);
    await this.setUserSession(this.steps.ACCEPT_TERMS);

    return this.sendResponse();
  }

  // Handle existing user without session
  async existingUserWithoutSession() {
    const { user } = this;

    // Check if user has completed initial setup
    if (!user.termsAndConditionsAccepted || !user.accountType) {
      await welcomeMessageTemplate(this.phone);
      await this.setUserSession(this.steps.ACCEPT_TERMS);
      return this.sendResponse();
    }

    // Route to appropriate handler based on account type
    return user.accountType === this.constructor.ACCOUNT_TYPES.CLIENT
      ? this.handleClientStatus()
      : this.handleServiceProviderStatus();
  }

  // Handle Client account status
  async handleClientStatus() {
    const { user } = this;

    // Handle unverified client
    if (!user.verified) {
      await this.setUserSession(this.steps.WAITING_FOR_VERIFICATION, {
        accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
      });
      return this.sendResponse(this.messages.VERIFICATION_WAIT_MESSAGE);
    }

    // Status handlers for verified clients
    const clientStatusHandlers = {
      [this.constructor.ACCOUNT_STATUS.ACTIVE]: async () => {
        await this.setUserSession(this.steps.DEFAULT_CLIENT_STATE, {
          accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
        });
        await clientMainMenuTemplate(
          this.phone,
          user?.firstName || user?.lastName
        );
        return this.sendResponse();
      },
      [this.constructor.ACCOUNT_STATUS.SUSPENDED]: async () => {
        await this.setUserSession(this.steps.ACCOUNT_STATUS_SUSPENDED, {
          accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
        });
        return this.sendResponse(this.messages.SUSPENDED_MESSAGE);
      },
      [this.constructor.ACCOUNT_STATUS.INACTIVE]: async () => {
        await this.setUserSession(this.steps.ACCOUNT_STATUS_INACTIVE, {
          accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
        });
        return this.sendResponse(this.messages.INACTIVE_MESSAGE);
      },
    };

    const handler = clientStatusHandlers[user.accountStatus];
    return handler
      ? handler()
      : this.sendResponse(
          "⚠️ Account status not recognized. Please double-check your account details or contact our support team for assistance. We're here to help! 😊"
        );
  }

  // Handle Service Provider account status
  async handleServiceProviderStatus() {
    const { user } = this;

    // Handle unverified service provider
    if (!user.verified) {
      await this.setUserSession(this.steps.WAITING_FOR_VERIFICATION, {
        accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
      });
      return this.sendResponse(this.messages.VERIFICATION_WAIT_MESSAGE);
    }

    // Status handlers for verified service providers
    const providerStatusHandlers = {
      [this.constructor.ACCOUNT_STATUS.ACTIVE]: async () => {
        await this.setUserSession(this.steps.SERVICE_PROVIDER_MAIN_MENU, {
          accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
        });
        await serviceProviderMainMenuTemplate(this.phone);
        return this.sendResponse();
      },
      [this.constructor.ACCOUNT_STATUS.SUSPENDED]: async () => {
        await this.setUserSession(this.steps.ACCOUNT_STATUS_SUSPENDED, {
          accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
        });
        return this.sendResponse(this.messages.SUSPENDED_MESSAGE);
      },
      [this.constructor.ACCOUNT_STATUS.INACTIVE]: async () => {
        await this.setUserSession(this.steps.ACCOUNT_STATUS_INACTIVE, {
          accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
        });
        return this.sendResponse(this.messages.INACTIVE_MESSAGE);
      },
    };

    const handler = providerStatusHandlers[user.accountStatus];
    return handler
      ? handler()
      : this.sendResponse("⚠️ Account status not recognized. Please double-check your account details or contact our support team for assistance. We're here to help! 😊");
  }

  // Handle terms acceptance
  async handleTermsAcceptance() {
    const message = this.message.toLowerCase();

    if (message === "accept terms") {
      await updateUser({
        phone: this.phone,
        termsAndConditionsAccepted: true,
      });
      await this.setUserSession(this.steps.ACCEPTED_TERMS);
      await sendChooseAccountTypeTemplate(this.phone);
      return this.sendResponse();
    }

    if (message === "decline terms") {
      await this.setUserSession(this.steps.ACCEPTED_TERMS);
      return this.sendResponse(this.messages.DECLINE_TERMS);
    }

    return this.sendResponse(
      "Invalid response. Please type 'Accept Terms' or 'Decline Terms' to proceed."
    );
  }

  // Handle account type selection
  async handleAccountTypeSelection() {
    const message = this.message.toLowerCase();

    const accountTypeHandlers = {
      client: async () => {
        await updateUser({
          phone: this.phone,
          accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
        });
        await this.setUserSession(this.steps.SETUP_CLIENT_PROFILE, {
          accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
        });
        await registerClientTemplate(this.phone);
      },
      "service provider": async () => {
        await updateUser({
          phone: this.phone,
          accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
        });
        await this.setUserSession(this.steps.PROVIDER_PROMPT_ACCOUNT, {
          accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
        });
        await registerServiceProviderTemplate(this.phone);
      },
    };

    const handler = accountTypeHandlers[message];
    if (handler) {
      await handler();
      return this.sendResponse();
    }

    return this.sendResponse(
      "Invalid response. Please reply with 'Client' or 'Service Provider' to proceed."
    );
  }

  // Main method to handle terms and account type
  async acceptTermsAndChooseAccountType() {
    const { session } = this;

    if (session.step === this.steps.ACCEPT_TERMS) {
      return this.handleTermsAcceptance();
    }

    if (session.step === this.steps.ACCEPTED_TERMS) {
      return this.handleAccountTypeSelection();
    }
  }
}

module.exports = Onboarding;
