const { StatusCodes } = require("http-status-codes");
const { formatDateTime } = require("../../utils/dateUtil");
const { setSession } = require("../../utils/redis");
const { updateUser, getUser } = require("../../controllers/user.controllers");
const {
  sendMediaImageMessage,
  sendTextMessage,
  clientMainMenuTemplate,
} = require("../../services/whatsappService");
const ChatHandler = require("./chatHandler");
const NotificationUtil = require("../../utils/notificationUtil");

class Client {
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
    this.message = userResponse.payload?.text || userResponse.payload || "";
    this.username = userResponse.sender.name;
  }

  async mainEntry() {
    try {
      console.log(`Processing client entry for step: ${this.session.step}`);

      switch (this.session.step) {
        case this.steps.SETUP_CLIENT_PROFILE:
          return this.handlePromptAccount();
        case this.steps.COLLECT_CLIENT_FULL_NAME:
          return this.handleCollectFullName();
        case this.steps.CLIENT_MAIN_MENU:
          return this.handleClientChat();

        default:
          console.log(
            `Unknown step: ${this.session.step}, starting with main menu`
          );
          await setSession(this.phone, {
            step: this.steps.CLIENT_MAIN_MENU,
            message: this.message,
            lActivity: this.lActivity,
          });
          return this.handleClientChat();
      }
    } catch (error) {
      console.error("Client processing error:", error);
      await sendTextMessage(this.phone, "An error occurred. Please try again later.")
      return this.res
        .status(StatusCodes.ACCEPTED)
        .send("");
    }
  }

  async handlePromptAccount() {
    const message = this.message.toString().toLowerCase().trim();
    
    if (message === "create account" || 
        message === "1" || 
        message.includes("create") ||
        message === "yes") {
      await setSession(this.phone, {
        step: this.steps.COLLECT_CLIENT_FULL_NAME,
        message: this.message,
        lActivity: this.lActivity,
        accountType: "Client",
      });
      await sendTextMessage(this.phone, this.messages.GET_FULL_NAME);
      return this.res.status(StatusCodes.OK).send("");
    } else if (message === "cancel" || 
               message === "2" || 
               message.includes("cancel") ||
               message === "no") {
      await setSession(this.phone, {
        step: this.steps.SETUP_CLIENT_PROFILE,
        message: this.message,
        lActivity: this.lActivity,
        accountType: "Client",
      });
      await sendTextMessage(this.phone, "❌ You have cancelled creating profile. If you change your mind, please type 'create account' to proceed.");
      return this.res.status(StatusCodes.OK).send("");
    } else {
      // Invalid input, re-prompt with guidance
      await sendTextMessage(this.phone, "Please reply with '1' to Create Account or '2' to Cancel.\n\nYou can also reply with 'Create Account' or 'Cancel'.");
      return this.res.status(StatusCodes.OK).send("");
    }
  }

  async handleCollectFullName() {
    const fullName = this.message.toString().trim();
    
    // Validation checks
    if (fullName.length < 3) {
      await sendTextMessage(this.phone, "❌ Name too short. Please enter your full name (at least 3 characters).");
      return this.res.status(StatusCodes.OK).send("");
    }
    
    if (fullName.length > 50) {
      await sendTextMessage(this.phone, "❌ Name too long. Please enter a shorter name (maximum 50 characters).");
      return this.res.status(StatusCodes.OK).send("");
    }

    const nameParts = fullName.split(/\s+/);
    if (nameParts.length < 2) {
      await sendTextMessage(this.phone, "❌ Please provide both your first name and surname.\nExample: John Doe");
      return this.res.status(StatusCodes.OK).send("");
    }

    // Extract first and last name properly
    const firstName = nameParts.slice(0, -1).join(" ");
    const lastName = nameParts[nameParts.length - 1];

    try {
      await updateUser({ phone: this.phone, firstName, lastName });

      // Create notification for client registration
      try {
        const updatedUser = await getUser(this.phone);
        if (updatedUser) {
          await NotificationUtil.createClientRegistrationNotification(
            updatedUser,
            updatedUser.address?.city || "Unknown location"
          );
        }
      } catch (error) {
        console.error("Error creating client registration notification:", error);
      }

      await setSession(this.phone, {
        step: this.steps.CLIENT_MAIN_MENU,
        message: this.message,
        lActivity: this.lActivity,
        accountType: "Client",
      });

      setImmediate(async () => {
        await clientMainMenuTemplate(
          this.phone,
          firstName
        );
      });

      const msg = `✅ Thank you for completing your registration! Your account has been successfully created with the name ${firstName} ${lastName}. You can now access all services through the main menu. Welcome aboard!`;

      await sendTextMessage(this.phone, msg);
      return this.res.status(StatusCodes.OK).send("");
    } catch (error) {
      console.error("Error saving client full name:", error);
      await sendTextMessage(this.phone, "❌ An error occurred while saving your information. Please try again.");
      return this.res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("");
    }
  }


  async handleClientChat() {
    try {
      // Create chat handler instance
      const chatHandler = new ChatHandler(this.phone, this.user?._id);
      // Process message
      const response = await chatHandler.processMessage(this.message);
      // Return response
      await sendTextMessage(this.phone, response)
      return this.res.status(StatusCodes.OK).send("");
    } catch (error) {
      console.error("Error in handleClientChat:", error);
      await sendTextMessage(this.phone, this.messages.ERROR_OCCURRED ||
        "An error occurred processing your message. Please try again.")
      return this.res
        .status(StatusCodes.ACCEPTED)
        .send("");
    }
  }
}

module.exports = Client;
