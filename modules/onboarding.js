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
  sendTextMessage,
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

  async sendResponse(message = "") {
    if (message) {
      await sendTextMessage(this.phone, message);
    }
    return this.res.status(200).send("");
  }

  async createNewUser() {
    try {
      const newUser = await createUser({
        phone: this.phone,
        username: this.username,
      });

      await welcomeMessageTemplate(this.phone);
      await this.setUserSession(this.steps.ACCEPT_TERMS);

      console.log(`New user created: ${this.phone}`);
      return this.sendResponse();
    } catch (error) {
      console.error(`Error creating new user ${this.phone}:`, error);
      return this.sendResponse(
        "An error occurred during registration. Please try again or contact support."
      );
    }
  }

  async existingUserWithoutSession() {
    const { user } = this;

    try {
      // Check if user has completed initial setup
      if (!user.termsAndConditionsAccepted) {
        // User hasn't accepted terms yet
        await welcomeMessageTemplate(this.phone);
        await this.setUserSession(this.steps.ACCEPT_TERMS);
        return this.sendResponse();
      }

      if (!user.accountType) {
        // User accepted terms but didn't choose account type
        await sendChooseAccountTypeTemplate(this.phone);
        await this.setUserSession(this.steps.ACCEPTED_TERMS);
        return this.sendResponse();
      }

      // User has account type - check verification and profile completion
      if (!user.verified) {
        // Check if profile is complete
        if (user.accountType === this.constructor.ACCOUNT_TYPES.CLIENT) {
          if (!user.firstName || !user.lastName) {
            // Incomplete client profile
            await this.setUserSession(this.steps.COLLECT_CLIENT_FULL_NAME, {
              accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
            });
            return this.sendResponse(this.messages.GET_FULL_NAME);
          }
        } else if (
          user.accountType === this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER
        ) {
          // Check provider profile completion
          const ServiceProvider = require("../models/serviceProvider.model");
          const providerProfile = await ServiceProvider.findOne({
            user: user._id,
          });

          if (!providerProfile || !providerProfile.isProfileCompleted) {
            // Redirect to provider registration
            await this.setUserSession(this.steps.PROVIDER_PROMPT_ACCOUNT, {
              accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
            });
            await registerServiceProviderTemplate(this.phone);
            return this.sendResponse();
          }
        }

        // Profile complete but not verified
        await this.setUserSession(this.steps.WAITING_FOR_VERIFICATION, {
          accountType: user.accountType,
        });
        return this.sendResponse(this.messages.VERIFICATION_WAIT_MESSAGE);
      }

      // Route to appropriate handler based on account type and status
      return user.accountType === this.constructor.ACCOUNT_TYPES.CLIENT
        ? this.handleClientStatus()
        : this.handleServiceProviderStatus();
    } catch (error) {
      console.error(
        `Error handling existing user without session ${this.phone}:`,
        error
      );
      return this.sendResponse(
        "Welcome back! We're having trouble loading your profile. Please try again or contact support."
      );
    }
  }

  async handleClientStatus() {
    const { user } = this;

    try {
      const clientStatusHandlers = {
        [this.constructor.ACCOUNT_STATUS.ACTIVE]: async () => {
          await this.setUserSession(this.steps.CLIENT_MAIN_MENU, {
            accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
          });
          await clientMainMenuTemplate(
            this.phone,
            user?.firstName || user?.lastName || "Client"
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

      const handler = clientStatusHandlers[user.accountStatus || "Active"];
      return handler
        ? handler()
        : this.sendResponse(
            "⚠️ Account status not recognized. Please contact our support team for assistance."
          );
    } catch (error) {
      console.error(`Error handling client status for ${this.phone}:`, error);
      return this.sendResponse(
        "An error occurred. Please try again or contact support."
      );
    }
  }

  async handleServiceProviderStatus() {
    const { user } = this;

    try {
      const providerStatusHandlers = {
        [this.constructor.ACCOUNT_STATUS.ACTIVE]: async () => {
          await this.setUserSession(this.steps.SERVICE_PROVIDER_MAIN_MENU, {
            accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
          });
          await serviceProviderMainMenuTemplate(
            this.phone,
            user?.firstName || user?.lastName || "Provider"
          );
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

      const handler = providerStatusHandlers[user.accountStatus || "Active"];
      return handler
        ? handler()
        : this.sendResponse(
            "⚠️ Account status not recognized. Please contact our support team for assistance."
          );
    } catch (error) {
      console.error(`Error handling provider status for ${this.phone}:`, error);
      return this.sendResponse(
        "An error occurred. Please try again or contact support."
      );
    }
  }

  async handleTermsAcceptance() {
    const message = this.message.toLowerCase().trim();

    // Accept variations
    if (message === "accept terms" || message === "1" || message === "accept" || 
        message === "yes" || message.includes("accept")) {
      try {
        await updateUser({
          phone: this.phone,
          termsAndConditionsAccepted: true,
        });
        await this.setUserSession(this.steps.ACCEPTED_TERMS);
        await sendChooseAccountTypeTemplate(this.phone);
        return this.sendResponse();
      } catch (error) {
        console.error(`Error accepting terms for ${this.phone}:`, error);
        return this.sendResponse(
          "An error occurred. Please try again or contact support."
        );
      }
    }

    // Decline variations
    if (
      message === "decline terms" ||
      message === "2" ||
      message === "decline" ||
      message === "no"
    ) {
      await this.setUserSession(this.steps.ACCEPT_TERMS);
      return this.sendResponse(this.messages.DECLINE_TERMS);
    }

    // Invalid input - guide user
    return this.sendResponse(
      "Please reply with '1' to Accept Terms or '2' to Decline Terms.\n\nYou can also reply with 'Accept' or 'Decline'."
    );
  }

  async handleAccountTypeSelection() {
    const message = this.message.toLowerCase().trim();

    const accountTypeHandlers = {
      client: async () => await this.selectClientAccount(),
      1: async () => await this.selectClientAccount(),
      "service provider": async () => await this.selectProviderAccount(),
      provider: async () => await this.selectProviderAccount(),
      serviceprovider: async () => await this.selectProviderAccount(),
      2: async () => await this.selectProviderAccount(),
    };

    const handler = accountTypeHandlers[message];
    if (handler) {
      return handler();
    }

    // Check for partial matches
    if (message.includes("client") || message.includes("hire")) {
      return this.selectClientAccount();
    }
    
    if (message.includes("provider") || message.includes("service") || message.includes("offer")) {
      return this.selectProviderAccount();
    }

    return this.sendResponse(
      "Please reply with '1' for Client or '2' for Service Provider.\n\nYou can also reply with 'Client' or 'Service Provider'."
    );
  }

  async selectClientAccount() {
    try {
      await updateUser({
        phone: this.phone,
        accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
      });
      await this.setUserSession(this.steps.SETUP_CLIENT_PROFILE, {
        accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
      });
      await registerClientTemplate(this.phone);
      return this.sendResponse();
    } catch (error) {
      console.error(`Error selecting client account for ${this.phone}:`, error);
      return this.sendResponse(
        "An error occurred. Please try again or contact support."
      );
    }
  }

  async selectProviderAccount() {
    try {
      await updateUser({
        phone: this.phone,
        accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
      });
      await this.setUserSession(this.steps.PROVIDER_PROMPT_ACCOUNT, {
        accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
      });
      await registerServiceProviderTemplate(this.phone);
      return this.sendResponse();
    } catch (error) {
      console.error(
        `Error selecting provider account for ${this.phone}:`,
        error
      );
      return this.sendResponse(
        "An error occurred. Please try again or contact support."
      );
    }
  }

  async acceptTermsAndChooseAccountType() {
    const { session } = this;

    try {
      // Determine current step and handle accordingly
      if (session.step === this.steps.ACCEPT_TERMS || !this.user.termsAndConditionsAccepted) {
        return this.handleTermsAcceptance();
      }

      if (session.step === this.steps.ACCEPTED_TERMS || !this.user.accountType) {
        return this.handleAccountTypeSelection();
      }

      // Handle cases where user has completed initial setup but flow continued
      if (this.user.termsAndConditionsAccepted && this.user.accountType) {
        console.log(`User ${this.phone} has completed initial setup, routing to appropriate flow`);
        
        if (this.user.accountType === this.constructor.ACCOUNT_TYPES.CLIENT) {
          // Check if client profile is complete
          if (!this.user.firstName || !this.user.lastName) {
            await this.setUserSession(this.steps.COLLECT_CLIENT_FULL_NAME, {
              accountType: this.constructor.ACCOUNT_TYPES.CLIENT,
            });
            return this.sendResponse(this.messages.GET_FULL_NAME);
          } else {
            return this.handleClientStatus();
          }
        } else if (this.user.accountType === this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER) {
          // Check provider profile completion
          const ServiceProvider = require("../models/serviceProvider.model");
          const providerProfile = await ServiceProvider.findOne({
            user: this.user._id,
          });

          if (!this.user.firstName || !this.user.lastName) {
            await this.setUserSession(this.steps.COLLECT_PROVIDER_FULL_NAME, {
              accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
            });
            return this.sendResponse(this.messages.GET_FULL_NAME);
          } else if (!providerProfile || !providerProfile.isProfileCompleted) {
            await this.setUserSession(this.steps.PROVIDER_PROMPT_ACCOUNT, {
              accountType: this.constructor.ACCOUNT_TYPES.SERVICE_PROVIDER,
            });
            await registerServiceProviderTemplate(this.phone);
            return this.sendResponse();
          } else {
            return this.handleServiceProviderStatus();
          }
        }
      }

      // Fallback for unexpected states
      console.warn(`Unexpected session state for ${this.phone}: ${session.step}`);
      
      if (!this.user.termsAndConditionsAccepted) {
        await this.setUserSession(this.steps.ACCEPT_TERMS);
        await welcomeMessageTemplate(this.phone);
        return this.sendResponse();
      }

      if (!this.user.accountType) {
        await this.setUserSession(this.steps.ACCEPTED_TERMS);
        await sendChooseAccountTypeTemplate(this.phone);
        return this.sendResponse();
      }

      // Route to appropriate status handler
      return this.user.accountType === this.constructor.ACCOUNT_TYPES.CLIENT
        ? this.handleClientStatus()
        : this.handleServiceProviderStatus();
        
    } catch (error) {
      console.error(
        `Error in acceptTermsAndChooseAccountType for ${this.phone}:`,
        error
      );
      return this.sendResponse(
        "An error occurred during registration. Please try again or contact support."
      );
    }
  }
}

module.exports = Onboarding;
