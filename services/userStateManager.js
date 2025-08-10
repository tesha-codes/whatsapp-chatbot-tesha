const { getSession, setSession } = require("../utils/redis");
const User = require("../models/user.model");
const ServiceProvider = require("../models/serviceProvider.model");

class UserStateManager {
  constructor() {
    this.SESSION_TTL = 24 * 60 * 60; // 24 hours
  }

  async getOrRecoverSession(phone) {
    try {
      // Try to get existing session
      let session = await getSession(phone);

      // If no session or empty session, try to recover from user data
      if (!session || Object.keys(session).length === 0) {
        console.log(`Recovering session for ${phone}`);
        session = await this.recoverSession(phone);
      }

      return session;
    } catch (error) {
      console.error(`Error getting/recovering session for ${phone}:`, error);
      return {};
    }
  }

  async recoverSession(phone) {
    try {
      const user = await User.findOne({ phone });

      if (!user) {
        // New user - start fresh
        return {};
      }

      // Determine the appropriate step based on user state
      const recoveredSession = {
        message: "",
        lActivity: new Date().toISOString(),
      };

      // Check registration completion
      if (!user.termsAndConditionsAccepted) {
        recoveredSession.step = "ACCEPT_TERMS";
      } else if (!user.accountType) {
        recoveredSession.step = "ACCEPTED_TERMS";
      } else if (user.accountType === "Client") {
        if (!user.firstName || !user.lastName) {
          recoveredSession.step = "COLLECT_CLIENT_FULL_NAME";
          recoveredSession.accountType = "Client";
        } else if (!user.verified) {
          recoveredSession.step = "WAITING_FOR_VERIFICATION";
          recoveredSession.accountType = "Client";
        } else if (user.accountStatus === "Suspended") {
          recoveredSession.step = "ACCOUNT_STATUS_SUSPENDED";
          recoveredSession.accountType = "Client";
        } else if (user.accountStatus === "Inactive") {
          recoveredSession.step = "ACCOUNT_STATUS_INACTIVE";
          recoveredSession.accountType = "Client";
        } else {
          recoveredSession.step = "CLIENT_MAIN_MENU";
          recoveredSession.accountType = "Client";
        }
      } else if (user.accountType === "ServiceProvider") {
        const provider = await ServiceProvider.findOne({ user: user._id });

        if (!user.firstName || !user.lastName) {
          recoveredSession.step = "COLLECT_PROVIDER_FULL_NAME";
          recoveredSession.accountType = "ServiceProvider";
        } else if (!provider) {
          recoveredSession.step = "PROVIDER_PROMPT_ACCOUNT";
          recoveredSession.accountType = "ServiceProvider";
        } else if (!provider.isProfileCompleted) {
          // Determine which step in provider registration
          const nextStep = await this.getNextProviderStep(user, provider);
          recoveredSession.step = nextStep;
          recoveredSession.accountType = "ServiceProvider";
        } else if (!user.verified) {
          recoveredSession.step = "WAITING_FOR_VERIFICATION";
          recoveredSession.accountType = "ServiceProvider";
        } else if (user.accountStatus === "Suspended") {
          recoveredSession.step = "ACCOUNT_STATUS_SUSPENDED";
          recoveredSession.accountType = "ServiceProvider";
        } else if (user.accountStatus === "Inactive") {
          recoveredSession.step = "ACCOUNT_STATUS_INACTIVE";
          recoveredSession.accountType = "ServiceProvider";
        } else {
          recoveredSession.step = "SERVICE_PROVIDER_MAIN_MENU";
          recoveredSession.accountType = "ServiceProvider";
        }
      }

      // Save recovered session
      await setSession(phone, recoveredSession, this.SESSION_TTL);
      console.log(`Session recovered for ${phone}: ${recoveredSession.step}`);

      return recoveredSession;
    } catch (error) {
      console.error(`Error recovering session for ${phone}:`, error);
      return {};
    }
  }

  async determineUserState(user, session, phone) {
    try {
      // No user - new registration
      if (!user) {
        return { state: "NEW_USER" };
      }

      // Check account status first
      if (user.accountStatus === "Suspended") {
        return { state: "SUSPENDED" };
      }

      if (user.accountStatus === "Inactive") {
        return { state: "INACTIVE" };
      }

      // Check if registration is incomplete
      if (!user.termsAndConditionsAccepted || !user.accountType) {
        return {
          state: "INCOMPLETE_REGISTRATION",
          stage: "TERMS_OR_TYPE",
        };
      }

      // Check Client registration completion
      if (user.accountType === "Client") {
        if (!user.firstName || !user.lastName) {
          return {
            state: "INCOMPLETE_REGISTRATION",
            stage: "CLIENT_PROFILE",
          };
        }

        if (!user.verified && this.requiresVerification(user)) {
          return { state: "NEEDS_VERIFICATION" };
        }

        return { state: "COMPLETE_CLIENT" };
      }

      // Check ServiceProvider registration completion
      if (user.accountType === "ServiceProvider") {
        const provider = await ServiceProvider.findOne({ user: user._id });

        if (
          !user.firstName ||
          !user.lastName ||
          !provider ||
          !provider.isProfileCompleted
        ) {
          return {
            state: "INCOMPLETE_REGISTRATION",
            stage: "PROVIDER_PROFILE",
          };
        }

        if (!user.verified && this.requiresVerification(user)) {
          return { state: "NEEDS_VERIFICATION" };
        }

        return { state: "COMPLETE_PROVIDER" };
      }

      // Default unknown state
      return { state: "UNKNOWN" };
    } catch (error) {
      console.error(`Error determining user state for ${phone}:`, error);
      return { state: "UNKNOWN" };
    }
  }

  async getNextProviderStep(user, provider) {
    // Determine the next step in provider registration
    if (!user.nationalId) return "COLLECT_USER_ID";
    if (!provider.city) return "PROVIDER_COLLECT_CITY";
    if (!user.address?.physicalAddress) return "COLLECT_USER_ADDRESS";
    if (!user.address?.coordinates) return "PROVIDER_COLLECT_LOCATION";
    if (!provider.category) return "PROVIDER_COLLECT_CATEGORY";
    if (!provider.service) return "PROVIDER_COLLECT_SERVICE";
    if (!provider.description) return "PROVIDER_COLLECT_DESCRIPTION";
    if (!provider.hourlyRate) return "PROVIDER_COLLECT_HOURLY_RATE";
    if (!provider.nationalIdImage) return "PROVIDER_COLLECT_ID_IMAGE";

    return "WAITING_FOR_VERIFICATION";
  }

  async getProviderProfile(userId) {
    try {
      return await ServiceProvider.findOne({ user: userId });
    } catch (error) {
      console.error(
        `Error getting provider profile for user ${userId}:`,
        error
      );
      return null;
    }
  }

  requiresVerification(user) {
    // Only service providers require verification
    // Regular clients (those looking for services) are automatically verified
    return user.accountType === "ServiceProvider";
  }

  async getNextProviderStep(user, provider) {
    // Determine the next step in provider registration
    if (!user.firstName || !user.lastName) {
      return "COLLECT_PROVIDER_FULL_NAME";
    }
    
    if (!user.nationalId) {
      return "COLLECT_USER_ID";
    }
    
    if (!provider || !provider.city) {
      return "PROVIDER_COLLECT_CITY";
    }
    
    if (!user.address || !user.address.physicalAddress) {
      return "COLLECT_USER_ADDRESS";
    }
    
    if (!provider.location || !provider.location.coordinates) {
      return "PROVIDER_COLLECT_LOCATION";
    }
    
    if (!provider.category) {
      return "PROVIDER_COLLECT_CATEGORY";
    }
    
    if (!provider.services || provider.services.length === 0) {
      return "PROVIDER_COLLECT_SERVICE";
    }
    
    if (!provider.description) {
      return "PROVIDER_COLLECT_DESCRIPTION";
    }
    
    if (!provider.hourlyRate) {
      return "PROVIDER_COLLECT_HOURLY_RATE";
    }
    
    if (!provider.idImage) {
      return "PROVIDER_COLLECT_ID_IMAGE";
    }
    
    return "PROVIDER_PROFILE_COMPLETE";
  }

  async updateUserVerificationStatus(phone, verified = true) {
    try {
      const user = await User.findOneAndUpdate(
        { phone },
        {
          verified,
          accountStatus: verified ? "Active" : user.accountStatus,
        },
        { new: true }
      );

      if (user) {
        // Update session to reflect verification
        const session = await getSession(phone);
        if (session && session.step === "WAITING_FOR_VERIFICATION") {
          session.step =
            user.accountType === "Client"
              ? "CLIENT_MAIN_MENU"
              : "SERVICE_PROVIDER_MAIN_MENU";
          await setSession(phone, session);
        }
      }

      return user;
    } catch (error) {
      console.error(`Error updating verification status for ${phone}:`, error);
      return null;
    }
  }
}

module.exports = UserStateManager;
