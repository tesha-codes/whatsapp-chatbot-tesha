const { StatusCodes } = require("http-status-codes");
const { setSession } = require("../utils/redis");
const {
  createUser,
  updateUser,
  getUser,
} = require("../controllers/user.controllers");
const { formatDateTime } = require("../utils/dateUtil");
const Category = require("../models/category.model");
const { clientMainMenuTemplate } = require("../services/whatsappService");
const Service = require("../models/services.model");
const mongoose = require("mongoose");
const ServiceRequest = require("../models/request.model");
const User = require("../models/user.model");
const crypto = require("node:crypto");
const { queueProviderSearch } = require("../jobs/service-provider.job");

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
    this.message = userResponse.payload?.text || "";
    this.username = userResponse.sender.name;
  }

  async handleInitialState() {
    const { res, session, steps, lActivity, phone, message, user } = this;

    // Check if user has a complete profile
    if (!user.firstName || !user.nationalId || !user.address) {
      return await this.handleIncompleteProfile();
    }

    // Handle default state or no session - show main menu
    if (!session || session.step === steps.DEFAULT_CLIENT_STATE) {
      await this.showMainMenu(user.firstName);
      return res
        .status(StatusCodes.OK)
        .send(`Hello there 👋 ${user.firstName}`);
    }

    if (session.step === steps.SETUP_CLIENT_PROFILE) {
      return await this.setupClientProfile();
    }

    // Profile collection steps
    const profileSteps = {
      [steps.COLLECT_USER_FULL_NAME]: this.collectFullName.bind(this),
      [steps.COLLECT_USER_ID]: this.collectNationalId.bind(this),
      [steps.COLLECT_USER_ADDRESS]: this.collectAddress.bind(this),
      [steps.COLLECT_USER_LOCATION]: this.collectLocation.bind(this),
    };

    if (profileSteps[session.step]) {
      return await profileSteps[session.step]();
    }

    return null;
  }

  async handleIncompleteProfile() {
    const { res, steps, lActivity, phone, message } = this;
    await setSession(phone, {
      step: steps.SETUP_CLIENT_PROFILE,
      message,
      lActivity,
    });
    return res.status(StatusCodes.OK).send(
      "To use our services, you need to complete your profile first. Reply with 'Create Account' to continue."
    );
  }

  async mainEntry() {
    const initialStateResult = await this.handleInitialState();
    if (initialStateResult) return initialStateResult;

    const { session, steps } = this;

    // Main flow steps
    const flowSteps = {
      [steps.SELECT_MENU_ACTION]: this.handleMenuSelection.bind(this),
      [steps.SELECT_SERVICE_CATEGORY]: this.selectServiceCategory.bind(this),
      [steps.SELECT_SERVICE]: this.selectService.bind(this),
      [steps.BOOK_SERVICE]: this.bookService.bind(this),
    };

    if (flowSteps[session.step]) {
      return await flowSteps[session.step]();
    }

    // If no matching step, return to main menu
    return await this.handleDefaultState();
  }

  async showMainMenu(firstName = '') {
    const { res, phone, lActivity, steps, message } = this;

    await setSession(phone, {
      accountType: "Client",
      step: steps.SELECT_MENU_ACTION,
      message,
      lActivity,
    });

    await clientMainMenuTemplate(phone, firstName);
    return res.status(StatusCodes.OK).send("");
  }

  async handleMenuSelection() {
    const { res, message, phone, lActivity, steps } = this;

    const menuOptions = {
      "request service": async () => {
        await setSession(phone, {
          step: steps.SELECT_SERVICE_CATEGORY,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(this.messages.CLIENT_WELCOME_MESSAGE);
      },
      "my bookings": async () => {
        // Implement viewing bookings logic
        await this.showMainMenu();
        return res.status(StatusCodes.OK).send("Your booking history will be displayed here.");
      },
      "my profile": async () => {
        // Implement profile viewing logic
        await this.showMainMenu();
        return res.status(StatusCodes.OK).send("Your profile information will be displayed here.");
      },
    };

    const selectedOption = menuOptions[message.toLowerCase()];
    if (selectedOption) {
      return await selectedOption();
    }

    // If no valid option selected, show menu again
    return await this.handleDefaultState();
  }

  // ... (keep existing profile setup methods unchanged)

  async collectLocation() {
    const { res, steps, lActivity, phone, message } = this;
    await updateUser({
      phone,
      address: {
        coordinates: message
      },
    });

    const confirmation = `
*Profile Setup Confirmation*

✅ Thank you! Your profile has been successfully set up.
You're all set! If you need any further assistance, feel free to reach out. 😊
`;

    // Set to default state and show menu after profile completion
    const user = await getUser(phone);
    await setSession(phone, {
      step: steps.SELECT_MENU_ACTION,
      message,
      lActivity,
    });
    await clientMainMenuTemplate(phone, user.firstName);

    return res.status(StatusCodes.OK).send(confirmation);
  }

  async bookService() {
    const { res, steps, lActivity, phone, message, session } = this;
    const code = parseInt(message);
    const service = await Service.findOne({
      code,
      category: session.categoryId,
    });
    const user = await User.findOne({ phone });

    const reqID = "REQ" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const request = await ServiceRequest.create({
      _id: new mongoose.Types.ObjectId(),
      city: "Harare",
      requester: user._id,
      service: service._id,
      address: user.address,
      notes: "Service booking is still in dev",
      id: reqID,
    });

    await request.save();
    const responseMessage = `
📃 Thank you, *${user.username}*! 

Your request for the service has been successfully created. 

📝 Your request ID is: *${reqID}*. 
📍 Location: *${request.address.physicalAddress}*

Our team will connect you with a service provider shortly. 
Please wait...`;

    await queueProviderSearch({
      phone,
      serviceId: service._id.toString(),
      categoryId: session.categoryId,
      requestId: request._id.toString(),
    });

    // Set to menu action state after booking
    await setSession(phone, {
      step: steps.SELECT_MENU_ACTION,
      message,
      lActivity,
      serviceId: service._id.toString(),
      requestId: request._id.toString(),
    });

    // Show menu template after confirmation
    setImmediate(async () => {
      await clientMainMenuTemplate(phone, user.firstName);
    });

    return res.status(StatusCodes.OK).send(responseMessage);
  }

  async handleDefaultState() {
    const { user } = this;
    // Always return to main menu as default behavior
    return await this.showMainMenu(user.firstName);
  }
}

module.exports = Client;