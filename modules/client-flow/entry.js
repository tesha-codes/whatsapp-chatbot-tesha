const { StatusCodes } = require("http-status-codes");
const { formatDateTime } = require("../../utils/dateUtil");
const { setSession } = require("../../utils/redis");
const { updateUser, getUser } = require("../../controllers/user.controllers");
const {
  sendMediaImageMessage,
  clientMainMenuTemplate,
} = require("../../services/whatsappService");
const ChatHandler = require("./chatHandler");

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
        case this.steps.COLLECT_CLIENT_NATIONAL_ID:
          return this.handleCollectNationalId();
        case this.steps.COLLECT_CLIENT_ID_IMAGE:
          return this.handleCollectIdImage();
        case this.steps.COLLECT_CLIENT_ADDRESS:
          return this.handleCollectAddress();
        case this.steps.COLLECT_CLIENT_LOCATION:
          return this.handleCollectLocation();
        case this.steps.CLIENT_REGISTRATION_COMPLETE:
          return this.handleRegistrationComplete();
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
    await setSession(this.phone, {
      step: this.steps.COLLECT_CLIENT_NATIONAL_ID,
      message: this.message,
      lActivity: this.lActivity,
    });
    return this.res.status(StatusCodes.OK).send(this.messages.GET_NATIONAL_ID);
  }

  async handleCollectNationalId() {
    const pattern = /^(\d{2})-(\d{7})-([A-Z])-(\d{2})$/;
    if (!pattern.test(this.message.toString())) {
      return this.res
        .status(StatusCodes.OK)
        .send(
          "❌ Invalid National Id format, please provide id in the format specified in the example."
        );
    }

    const nationalId = this.message.toString();
    await updateUser({ phone: this.phone, nationalId });
    await setSession(this.phone, {
      step: this.steps.COLLECT_CLIENT_ID_IMAGE,
      message: this.message,
      lActivity: this.lActivity,
    });
    return this.res.status(StatusCodes.OK).send(this.messages.UPLOAD_ID_IMAGE);
  }

  async handleCollectIdImage() {
    const nationalIdImageUrl = this.message?.url;
    if (!nationalIdImageUrl) {
      return this.res
        .status(StatusCodes.OK)
        .send("❌ Please upload a valid ID image.");
    }
    // Check content type
    const contentType = this.message?.contentType;
    if (!contentType || !contentType.startsWith("image/")) {
      return this.res
        .status(StatusCodes.OK)
        .send("❌ Invalid image format. Please upload an image file.");
    }

    // Here you'd typically upload to S3 or another storage service
    console.log("Would upload ID image to storage:", nationalIdImageUrl);

    await setSession(this.phone, {
      step: this.steps.COLLECT_CLIENT_ADDRESS,
      message: this.message.toString(),
      lActivity: this.lActivity,
    });
    return this.res.status(StatusCodes.OK).send(this.messages.GET_ADDRESS);
  }

  async handleCollectAddress() {
    const street = this.message.toString();
    await updateUser({
      phone: this.phone,
      address: {
        physicalAddress: street,
      },
    });
    await setSession(this.phone, {
      step: this.steps.COLLECT_CLIENT_LOCATION,
      message: this.message,
      lActivity: this.lActivity,
    });
    const locationImgURL =
      "https://tesha-util.s3.af-south-1.amazonaws.com/WhatsApp+Image+2024-10-06+at+11.49.44_12568059.jpg";
    await sendMediaImageMessage(
      this.phone,
      locationImgURL,
      "Please share your location by tapping the location icon in WhatsApp and selecting 'Send your current location'"
    );
    return this.res.status(StatusCodes.OK).send("");
  }

  async handleCollectLocation() {
    console.log("Location:", this.message);
    if (typeof this.message !== "object") {
      return this.res
        .status(StatusCodes.OK)
        .send("❌ Invalid location format. Please send your location.");
    }
    await updateUser({
      phone: this.phone,
      address: {
        coordinates: this.message,
      },
    });
    await setSession(this.phone, {
      step: this.steps.CLIENT_MAIN_MENU,
      message: JSON.stringify(this.message),
      lActivity: this.lActivity,
    });

    const successMessage = `*Profile Setup Confirmation*

✅ Thank you! Your profile has been successfully set up. You're all set! 🎉

Here's what is available to you today:

🛎️ *Request a Service Provider* e.g (I am looking for a someone to sweep my yard today at 12pm.)
🔧 *Update Your Profile* e.g (Update my name to [your name])
🗑️ *Deactivate Account*
📝 *View Booking History*

What would you like to do today?
`;
    return this.res.status(StatusCodes.OK).send(successMessage);
  }

  async handleRegistrationComplete() {
    try {
      await clientMainMenuTemplate(
        this.phone,
        this.user?.firstName || this.user?.lastName
      );

      // Update session to main menu
      await setSession(this.phone, {
        step: this.steps.CLIENT_MAIN_MENU,
        message: this.message,
        lActivity: this.lActivity,
      });

      return this.res.status(StatusCodes.OK).send("");
    } catch (error) {
      console.error("Error in handleRegistrationComplete:", error);
      return this.res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send("There was an error setting up your account. Please try again.");
    }
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
