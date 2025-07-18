const { StatusCodes } = require("http-status-codes");
const { formatDateTime } = require("../../utils/dateUtil");
const { setSession } = require("../../utils/redis");
const { updateUser } = require("../../controllers/user.controllers");
const ChatHandler = require("./chatHandler");
const {
  sendMediaImageMessage,
  serviceProviderMainMenuTemplate,
  sendTextMessage
} = require("../../services/whatsappService");
const {
  createServiceProvider,
  updateProvider,
} = require("../../controllers/serviceProvider.controller");
const Category = require("../../models/category.model");
const Service = require("../../models/services.model");
const { uploadToS3 } = require("../../utils/uploadToS3");
const cityLookupService = require("../../utils/cityLookup");
const NotificationUtil = require("../../utils/notificationUtil");
const ServiceProviderModel = require("../../models/serviceProvider.model");

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

  setupCommonVariables() {
    const { userResponse } = this;
    this.phone = userResponse.sender.phone;
    this.message = userResponse.payload?.text || userResponse.payload || "";
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

    try {
      // wait message for un verified users
      switch (session.step) {
        case steps.PROVIDER_PROMPT_ACCOUNT:
          return this.handlePromptAccount();
        case steps.COLLECT_PROVIDER_FULL_NAME:
          return this.handleCollectFullName();
        case steps.COLLECT_USER_ID:
          return this.handleCollectNationalId();
        case steps.PROVIDER_COLLECT_CITY:
          return this.handleCollectCity();
        case steps.COLLECT_USER_ADDRESS:
          return this.handleCollectAddress();
        case steps.PROVIDER_COLLECT_LOCATION:
          return this.handleCollectLocation();
        case steps.PROVIDER_COLLECT_CATEGORY:
          return this.handleCollectCategory();
        case steps.PROVIDER_COLLECT_SERVICE:
          return this.handleCollectService();
        case steps.PROVIDER_COLLECT_DESCRIPTION:
          return this.handleCollectDescription();
        case steps.PROVIDER_COLLECT_HOURLY_RATE:
          return this.handleCollectHourRate();
        case steps.PROVIDER_COLLECT_ID_IMAGE:
          return this.handleCollectIdImage();
        case steps.WAITING_FOR_VERIFICATION:
          return this.handleWaitForVerification();
        case steps.ACCOUNT_STATUS_SUSPENDED:
          return this.handleAccountStatusSuspended();
        case steps.ACCOUNT_STATUS_INACTIVE:
          return this.handleAccountStatusInactive();
        case steps.SERVICE_PROVIDER_MAIN_MENU:
          return this.handleServiceProviderChat();
        default:
          return res
            .status(StatusCodes.ACCEPTED)
            .send(this.messages.DEV_IN_PROGRESS);
      }
    } catch (error) {
      console.error("Error in ServiceProvider mainEntry:", error);
      return res
        .status(StatusCodes.ACCEPTED)
        .send("An error occurred. Please try again later.");
    }
  }

  async handlePromptAccount() {
    if (this.message.toString().toLowerCase() === "create account") {
      await setSession(this.phone, {
        step: this.steps.COLLECT_PROVIDER_FULL_NAME,
        message: this.message,
        lActivity: this.lActivity,
      });
      await sendTextMessage(this.phone, this.messages.GET_FULL_NAME)
      return this.res.status(StatusCodes.OK).send("");
    } else {
      await setSession(this.phone, {
        step: this.steps.PROVIDER_PROMPT_ACCOUNT,
        message: this.message,
        lActivity: this.lActivity,
      });
      await sendTextMessage(this.phone, "❌ You have cancelled creating profile. You need to have a profile to be able to request services. If you change your mind, please type 'create account' to proceed.")
      return this.res
        .status(StatusCodes.OK)
        .send(
          ""
        );
    }
  }

  async handleCollectFullName() {
    if (this.message.toString().length > 16) {
      await sendTextMessage(this.phone, "❌ Name and surname provided is too long. Please re-enter your full name, name(s) first and then surname second.")
      return this.res
        .status(StatusCodes.OK)
        .send(
          ""
        );
    }
    const userNames = this.message.toString().split(" ");
    const lastName = userNames[userNames.length - 1];
    const firstName = this.message.toString().replace(lastName, " ").trim();
    //
    await updateUser({ phone: this.phone, firstName, lastName });
    await setSession(this.phone, {
      step: this.steps.COLLECT_USER_ID,
      message: this.message,
      lActivity: this.lActivity,
    });
    await sendTextMessage(this.phone, this.messages.GET_NATIONAL_ID)
    return this.res.status(StatusCodes.OK).send("");
  }

  async handleCollectNationalId() {
    const pattern = /^\d{2}-\d{4,}[A-Za-z]\d{2}$/;
    if (!pattern.test(this.message.toString())) {
      await sendTextMessage(this.phone, "❌ Invalid National Id format, please provide id in the format specified in the example.")
      return this.res
        .status(StatusCodes.OK)
        .send(
          ""
        );
    }

    const nationalId = this.message.toString().toUpperCase();
    await updateUser({ phone: this.phone, nationalId });
    await setSession(this.phone, {
      step: this.steps.PROVIDER_COLLECT_CITY,
      message: this.message,
      lActivity: this.lActivity,
    });
    await sendTextMessage(this.phone, this.messages.GET_CITY)
    return this.res.status(StatusCodes.OK).send("");
  }

  async handleCollectCity() {
    const city = this.message.toString();
    //  enforce cities in our lookup service
    const result = cityLookupService.lookupFromText(city);
    if (!result) {
      await sendTextMessage(this.phone, "❌ Invalid city. Please provide a valid city.")
      return this.res
        .status(StatusCodes.OK)
        .send("");
    }
    await createServiceProvider({ user: this.user._id, city: result?.city });
    await setSession(this.phone, {
      step: this.steps.COLLECT_USER_ADDRESS,
      message: this.message,
      lActivity: this.lActivity,
    });
    await sendTextMessage(this.phone, this.messages.GET_ADDRESS)
    return this.res.status(StatusCodes.OK).send("");
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
      step: this.steps.PROVIDER_COLLECT_LOCATION,
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
      step: this.steps.PROVIDER_COLLECT_CATEGORY,
      message: JSON.stringify(this.message),
      lActivity: this.lActivity,
    });
    const categories = await Category.find({}, "name code").sort("code");
    const categoryList = categories
      .map((cat) => `${cat.code}. ${cat.name}`)
      .join("\n");

    await sendTextMessage(this.phone, `${this.messages.CHOOSE_CATEGORY}\n${categoryList}`)
    return this.res
      .status(StatusCodes.OK)
      .send("");
  }

  async handleCollectCategory() {
    if (isNaN(this.message)) {
      await sendTextMessage(this.phone, "❌ Invalid category selection. Please choose a valid number from the list.")
      return this.res
        .status(StatusCodes.OK)
        .send(
          ""
        );
    }
    const categoryCode = parseInt(this.message);
    const category = await Category.findOne({ code: categoryCode });
    if (!category) {
      await sendTextMessage(this.phone, "❌ Invalid category selection. Please choose a valid number from the list.")
      return this.res
        .status(StatusCodes.OK)
        .send(
          ""
        );
    }
    await updateProvider(this.user._id, { category: category._id });
    await setSession(this.phone, {
      step: this.steps.PROVIDER_COLLECT_SERVICE,
      message: this.message,
      categoryId: category._id.toString(),
      lActivity: this.lActivity,
    });
    const services = await Service.find(
      { category: category._id },
      "title code"
    ).sort("code");
    const serviceList = services
      .map((svc) => `${svc.code}. ${svc.title}`)
      .join("\n");

    await sendTextMessage(this.phone, `${this.messages.CHOOSE_SERVICE}\n${serviceList}`)
    return this.res
      .status(StatusCodes.OK)
      .send("");
  }

  async handleCollectService() {
    if (isNaN(this.message)) {
      await sendTextMessage(this.phone, "❌ Invalid service selection. Please choose a valid number from the list.")
      return this.res
        .status(StatusCodes.OK)
        .send(
          ""
        );
    }
    const serviceCode = parseInt(this.message);
    const service = await Service.findOne({
      code: serviceCode,
      category: this.session.categoryId,
    });
    if (!service) {
      await sendTextMessage(this.phone, "❌ Invalid service selection. Please choose a valid number from the list.")
      return this.res
        .status(StatusCodes.OK)
        .send(
          ""
        );
    }
    await updateProvider(this.user._id, { service: service._id });
    await setSession(this.phone, {
      step: this.steps.PROVIDER_COLLECT_DESCRIPTION,
      message: this.message,
      lActivity: this.lActivity,
    });
    await sendTextMessage(this.phone, this.messages.GET_DESCRIPTION)
    return this.res.status(StatusCodes.OK).send();
  }

  async handleCollectDescription() {
    const description = this.message.toString();
    if (description.length > 200) {
      await sendTextMessage(this.phone, "❌ Description is too long. Please keep it under 200 characters.")
      return this.res
        .status(StatusCodes.OK)
        .send(
          ""
        );
    }
    await updateProvider(this.user._id, { description });
    await setSession(this.phone, {
      step: this.steps.PROVIDER_COLLECT_HOURLY_RATE,
      message: this.message,
      lActivity: this.lActivity,
    });
    await sendTextMessage(this.phone, this.messages.GET_HOURLY_RATE)
    return this.res.status(StatusCodes.OK).send();
  }

  async handleCollectHourRate() {
    const hourlyRate = +this.message;
    if (isNaN(hourlyRate)) {
      await sendTextMessage(this.phone, "Please provide a valid hourly rate in USD. e.g. 25")
      return this.res
        .status(StatusCodes.OK)
        .send("");
    }

    await updateProvider(this.user._id, { hourlyRate });
    await setSession(this.phone, {
      step: this.steps.PROVIDER_COLLECT_ID_IMAGE,
      message: this.message,
      lActivity: this.lActivity,
    });
    await sendTextMessage(this.phone, this.messages.UPLOAD_ID_IMAGE)
    return this.res.status(StatusCodes.OK).send();
  }

  async handleCollectIdImage() {
    const nationalIdImageUrl = this.message?.url;
    if (!nationalIdImageUrl) {
      return this.res
        .status(StatusCodes.OK)
        .send("❌ Please upload a valid ID image.");
    }
    // : check content type
    const contentType = this.message?.contentType;
    if (!contentType.startsWith("image/")) {
      await sendTextMessage(this.phone, "❌ Invalid image format. Please upload an image file.")
      return this.res
        .status(StatusCodes.OK)
        .send("");
    }
    // : upload to AWS S3
    const nationalIdImage = await uploadToS3(
      process.env.USRID_BUCKET_NAME,
      nationalIdImageUrl
    );
    // : save uploaded file
    await updateProvider(this.user._id, {
      nationalIdImage,
      isProfileCompleted: true,
    });

    // Create notification for service provider registration
    try {
      const serviceProvider = await ServiceProviderModel.findOne({ user: this.user._id })
        .populate('service', 'title')
        .populate('category', 'name');

      if (serviceProvider && serviceProvider.service) {
        await NotificationUtil.createServiceProviderRegistrationNotification(
          serviceProvider,
          this.user,
          serviceProvider.service,
          serviceProvider.city
        );
      }
    } catch (error) {
      console.error("Error creating service provider notification:", error);
    }

    await setSession(this.phone, {
      step: this.steps.WAITING_FOR_VERIFICATION,
      message: this.message.toString(),
      lActivity: this.lActivity,
    });
    await sendTextMessage(this.phone, this.messages.PROFILE_COMPLETE)
    return this.res.status(StatusCodes.OK).send("");
  }

  async handleWaitForVerification() {
    // Check if user is verified
    if (this.user.verified) {
      return this.handleServiceProviderMainMenu();
    }
    // Default case - user still waiting for verification
    await setSession(this.phone, {
      step: this.steps.WAITING_FOR_VERIFICATION,
      message: this.message,
      lActivity: this.lActivity,
    });
    await sendTextMessage(this.phone, this.messages.VERIFICATION_WAIT_MESSAGE)
    return this.res
      .status(StatusCodes.OK)
      .send("");
  }

  async handleAccountStatusSuspended() {
    await setSession(this.phone, {
      step: this.steps.ACCOUNT_STATUS_SUSPENDED,
      message: this.message,
      lActivity: this.lActivity,
      accountType: "ServiceProvider",
    });
    await sendTextMessage(this.phone, this.messages.SUSPENDED_MESSAGE)
    return this.res
      .status(StatusCodes.OK)
      .send();
  }

  async handleAccountStatusInactive() {
    await setSession(this.phone, {
      step: this.steps.ACCOUNT_STATUS_INACTIVE,
      message: this.message,
      lActivity: this.lActivity,
      accountType: "ServiceProvider",
    });
    await sendTextMessage(this.phone, this.messages.INACTIVE_MESSAGE)
    return this.res.status(StatusCodes.OK).send("");
  }

  async handleServiceProviderMainMenu() {
    await serviceProviderMainMenuTemplate(
      this.phone,
      this.user?.firstName || this.user?.lastName
    );
    await setSession(this.phone, {
      step: this.steps.SERVICE_PROVIDER_MAIN_MENU,
      message: this.message,
      lActivity: this.lActivity,
      accountType: "ServiceProvider",
    });
    return this.res.status(StatusCodes.OK).send("");
  }

  async handleServiceProviderChat() {
    const { res, user, phone, message } = this;

    try {
      // : Create chat handler instance
      const chatHandler = new ChatHandler(phone, user._id);
      // : Process message
      const response = await chatHandler.processMessage(message);
      await sendTextMessage(this.phone, response)
      return res.status(StatusCodes.OK).send("");
    } catch (error) {
      console.error("Error in handleServiceProviderChat:", error);
      await sendTextMessage(this.phone, this.messages.ERROR_OCCURRED)
      return res
        .status(StatusCodes.ACCEPTED)
        .send("");
    }
  }
}

module.exports = ServiceProvider;
