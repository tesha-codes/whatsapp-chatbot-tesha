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
    const { res, session, steps, phone, message, user } = this;

    // No session or default state - show main menu
    if (!session || session.step === steps.DEFAULT_CLIENT_STATE) {
      await this.showMainMenu(user.firstName);
      return res
        .status(StatusCodes.OK)
        .send(this.messages.CLIENT_HOME);
    }

    // Profile setup in progress
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

  async setupClientProfile() {
    const { res, steps, lActivity, phone, message } = this;

    if (message.toLowerCase() === "create account") {
      await setSession(phone, {
        step: steps.COLLECT_USER_FULL_NAME,
        message,
        lActivity,
      });
      return res
        .status(StatusCodes.OK)
        .send(this.messages.GET_FULL_NAME);
    }

    return res
      .status(StatusCodes.OK)
      .send("To use our services, you need to complete your profile first. Reply with 'Create Account' to continue.");
  }

  async mainEntry() {
    const { user, session } = this;

    // Check if profile is incomplete
    if (!user.firstName || !user.nationalId || !user.address) {
      return await this.setupClientProfile();
    }

    const initialStateResult = await this.handleInitialState();
    if (initialStateResult) return initialStateResult;

    // Main flow steps
    const flowSteps = {
      [this.steps.SELECT_MENU_ACTION]: this.handleMenuSelection.bind(this),
      [this.steps.SELECT_SERVICE_CATEGORY]: this.selectServiceCategory.bind(this),
      [this.steps.SELECT_SERVICE]: this.selectService.bind(this),
      [this.steps.BOOK_SERVICE]: this.bookService.bind(this),
    };

    if (flowSteps[session.step]) {
      return await flowSteps[session.step]();
    }

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
        await this.showMainMenu();
        return res.status(StatusCodes.OK).send("Your booking history will be displayed here.");
      },
      "my profile": async () => {
        const user = await getUser(this.phone);
        const profileInfo = `
*Your Profile Information* 📋

*Name:* ${user.firstName}
*ID Number:* ${user.nationalId}
*Address:* ${user.address?.physicalAddress || 'Not provided'}
*Phone:* ${this.phone}

To update any information, please contact our support team.`;

        await this.showMainMenu();
        return res.status(StatusCodes.OK).send(profileInfo);
      },
    };

    const selectedOption = menuOptions[message.toLowerCase()];
    if (selectedOption) {
      return await selectedOption();
    }

    return await this.handleDefaultState();
  }

  async collectFullName() {
    const { res, steps, lActivity, phone, message } = this;
    await updateUser({ phone, firstName: message });
    await setSession(phone, {
      step: steps.COLLECT_USER_ID,
      message,
      lActivity,
    });
    return res
      .status(StatusCodes.OK)
      .send(this.messages.GET_NATIONAL_ID);
  }

  async collectNationalId() {
    const { res, steps, lActivity, phone, message } = this;
    await updateUser({ phone, nationalId: message });
    await setSession(phone, {
      step: steps.COLLECT_USER_ADDRESS,
      message,
      lActivity,
    });
    return res
      .status(StatusCodes.OK)
      .send(this.messages.GET_ADDRESS);
  }

  async collectAddress() {
    const { res, steps, lActivity, phone, message } = this;
    await updateUser({
      phone,
      address: {
        physicalAddress: message,
      },
    });
    await setSession(phone, {
      step: steps.COLLECT_USER_LOCATION,
      message,
      lActivity,
    });
    return res
      .status(StatusCodes.OK)
      .send(this.messages.GET_LOCATION);
  }

  async collectLocation() {
    const { res, steps, lActivity, phone, message } = this;
    await updateUser({
      phone,
      address: {
        coordinates: message,
      },
    });

    const confirmation = `
*Profile Setup Confirmation*

✅ Thank you! Your profile has been successfully set up.
You're all set! If you need any further assistance, feel free to reach out. 😊
`;

    const user = await getUser(phone);
    await setSession(phone, {
      step: steps.SELECT_MENU_ACTION,
      message,
      lActivity,
    });
    await clientMainMenuTemplate(phone, user.firstName);

    return res.status(StatusCodes.OK).send(confirmation);
  }

  async selectServiceCategory() {
    const { res, message, phone, lActivity, steps, session } = this;
    const categoryNumber = parseInt(message);

    if (isNaN(categoryNumber) || categoryNumber < 1 || categoryNumber > 8) {
      return res.status(StatusCodes.OK).send(this.messages.CLIENT_WELCOME_MESSAGE);
    }

    const categories = {
      1: "Household Services",
      2: "Yard & Outdoor Services",
      3: "Errands & Shopping",
      4: "Skilled Tasks",
      5: "Moving & Hauling",
      6: "Pet Care",
      7: "Senior Care",
      8: "Home Maintenance"
    };

    const selectedCategory = await Category.findOne({ name: categories[categoryNumber] });
    if (!selectedCategory) {
      return res.status(StatusCodes.OK).send(this.messages.CLIENT_WELCOME_MESSAGE);
    }

    const services = await Service.find({ category: selectedCategory._id });
    if (!services.length) {
      return res.status(StatusCodes.OK).send(this.messages.UNAVAILABLE_SERVICE_PROVIDER);
    }

    const serviceList = services.map(service =>
      `${service.code}. ${service.name} - $${service.price}/hr`
    ).join('\n');

    await setSession(phone, {
      step: steps.BOOK_SERVICE,
      message,
      lActivity,
      categoryId: selectedCategory._id.toString()
    });

    return res.status(StatusCodes.OK).send(`
*Available Services in ${selectedCategory.name}*

Please select a service by typing its code:

${serviceList}
    `);
  }

  async bookService() {
    const { res, steps, lActivity, phone, message, session } = this;
    const code = parseInt(message);
    const service = await Service.findOne({
      code,
      category: session.categoryId,
    });

    if (!service) {
      return res.status(StatusCodes.OK).send("Invalid service code. Please try again.");
    }

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

    const responseMessage = `
📃 Thank you, *${user.firstName}*! 

Your request for *${service.name}* has been successfully created. 

📝 Request ID: *${reqID}*
📍 Location: *${request.address.physicalAddress}*

Our team will connect you with a service provider shortly. 
Please wait while we search for available providers...`;

    await queueProviderSearch({
      phone,
      serviceId: service._id.toString(),
      categoryId: session.categoryId,
      requestId: request._id.toString(),
    });

    await setSession(phone, {
      step: steps.SELECT_MENU_ACTION,
      message,
      lActivity,
      serviceId: service._id.toString(),
      requestId: request._id.toString(),
    });

    setImmediate(async () => {
      await clientMainMenuTemplate(phone, user.firstName);
    });

    return res.status(StatusCodes.OK).send(responseMessage);
  }

  async handleDefaultState() {
    const { user } = this;
    return await this.showMainMenu(user.firstName);
  }
}

module.exports = Client;