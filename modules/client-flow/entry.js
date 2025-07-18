const { StatusCodes } = require("http-status-codes");
const { formatDateTime } = require("../../utils/dateUtil");
const { setSession } = require("../../utils/redis");
const { updateUser, getUser } = require("../../controllers/user.controllers");
const {
  sendMediaImageMessage,
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
      return this.res
        .status(StatusCodes.ACCEPTED)
        .send("An error occurred. Please try again later.");
    }
  }

  async handlePromptAccount() {
    if (
      this.message.toString().toLowerCase() === "create account" ||
      this.message.toString().toLowerCase().includes("1")
    ) {
      await setSession(this.phone, {
        step: this.steps.COLLECT_CLIENT_FULL_NAME,
        message: this.message,
        lActivity: this.lActivity,
      });
      return this.res.status(StatusCodes.OK).send(this.messages.GET_FULL_NAME);
    } else {
      await setSession(this.phone, {
        step: this.steps.SETUP_CLIENT_PROFILE,
        message: this.message,
        lActivity: this.lActivity,
      });
      return this.res
        .status(StatusCodes.OK)
        .send(
          "❌ You have cancelled creating profile. If you change your mind, please type 'create account' to proceed."
        );
    }
  }

  async handleCollectFullName() {
    if (this.message.toString().length > 16) {
      return this.res
        .status(StatusCodes.OK)
        .send(
          "❌ Name and surname provided is too long. Please re-enter your full name, name(s) first and then surname second."
        );
    }
    const userNames = this.message.toString().split(" ");
    const lastName = userNames[userNames.length - 1];
    const firstName = this.message.toString().replace(lastName, " ").trim();

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
    });

    setImmediate(async () => {
      await clientMainMenuTemplate(
        this.phone,
        this.user?.firstName || this.user?.lastName
      );
    });

    let msg = `
    ✅ Thank you for completing your registration! Your account has been successfully created with the name ${firstName} ${lastName}. You can now access all services through the main menu. Welcome aboard!.
    `

    return this.res.status(StatusCodes.OK).send(msg);
  }


  async handleClientChat() {
    try {
      // Create chat handler instance
      const chatHandler = new ChatHandler(this.phone, this.user?._id);
      // Process message
      const response = await chatHandler.processMessage(this.message);
      // Return response
      return this.res.status(StatusCodes.OK).send(response);
    } catch (error) {
      console.error("Error in handleClientChat:", error);
      return this.res
        .status(StatusCodes.ACCEPTED)
        .send(
          this.messages.ERROR_OCCURRED ||
          "An error occurred processing your message. Please try again."
        );
    }
  }
}

module.exports = Client;
