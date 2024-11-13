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

    if (!session || session.step === steps.DEFAULT_CLIENT_STATE) {
      // User is in the default state or has no session
      const updatedUser = await getUser(phone);
      await clientMainMenuTemplate(phone, updatedUser.firstName);
      await setSession(phone, {
        step: steps.SELECT_SERVICE_CATEGORY,
        message,
        lActivity,
      });
      return res
        .status(StatusCodes.OK)
        .send(`Hello there 👋 ${updatedUser.firstName}`);
    }

    if (session.step === steps.SETUP_CLIENT_PROFILE) {
      return await this.setupClientProfile();
    }

    if (session.step === steps.COLLECT_USER_FULL_NAME) {
      return await this.collectFullName();
    }

    if (session.step === steps.COLLECT_USER_ID) {
      return await this.collectNationalId();
    }

    if (session.step === steps.COLLECT_USER_ADDRESS) {
      return await this.collectAddress();
    }

    if (session.step === steps.COLLECT_USER_LOCATION) {
      return await this.collectLocation();
    }

    return null;
  }

  async mainEntry() {
    const { user, session, steps } = this;

    // Handle profile setup first
    if (!user.firstName || !user.nationalId || !user.address) {
      if (!session || session.step !== steps.SETUP_CLIENT_PROFILE) {
        await setSession(this.phone, {
          step: steps.SETUP_CLIENT_PROFILE,
          message: this.message,
          lActivity: this.lActivity,
        });
        return this.res
          .status(StatusCodes.OK)
          .send("To use our services, you need to complete your profile first. Reply with 'Create Account' to continue.");
      }
    }

    const initialStateResult = await this.handleInitialState();
    if (initialStateResult) return initialStateResult;

    // Proceed with regular flow
    switch (session.step) {
      case steps.SELECT_SERVICE_CATEGORY:
        await this.selectServiceCategory();
        break;
      case steps.SELECT_SERVICE:
        await this.selectService();
        break;
      case steps.BOOK_SERVICE:
        await this.bookService();
        break;
      default:
        await this.handleDefaultState();
        break;
    }
  }

  async showMainMenu() {
    const { res, phone, lActivity, steps, message } = this;

    await setSession(phone, {
      accountType: "Client",
      step: steps.SELECT_MENU_ACTION,
      message,
      lActivity,
    });

    await clientMainMenuTemplate(phone, '');
    return res.status(StatusCodes.OK).send("");
  }

  async setupClientProfile() {
    const { res, steps, lActivity, phone, message } = this;
    if (message.toLowerCase() === "create account") {
      await setSession(phone, {
        step: steps.COLLECT_USER_FULL_NAME,
        message,
        lActivity,
      });
      return res.status(StatusCodes.OK).send(this.messages.GET_FULL_NAME);
    } else {
      await setSession(phone, {
        step: steps.DEFAULT_CLIENT_STATE,
        message,
        lActivity,
      });
      return res
        .status(StatusCodes.OK)
        .send(
          "❌ You have cancelled creating profile. You need to have a profile to be able to request services. "
        );
    }
  }

  async collectFullName() {
    const { res, steps, lActivity, phone, message } = this;
    if (message.length < 5) {
      return res
        .status(StatusCodes.OK)
        .send(
          "❌ Name and surname provided is too short. Please re-enter your full name, name(s) first and then surname second."
        );
    }
    const userNames = message.split(" ");
    const lastName = userNames[userNames.length - 1];
    const firstName = message.replace(lastName, " ").trim();

    await updateUser({ phone, firstName, lastName });
    await setSession(phone, {
      step: steps.COLLECT_USER_ID,
      message,
      lActivity,
    });
    return res.status(StatusCodes.OK).send(this.messages.GET_NATIONAL_ID);
  }

  async collectNationalId() {
    const { res, steps, lActivity, phone, message } = this;
    const pattern = /^(\d{2})-(\d{7})-([A-Z])-(\d{2})$/;
    if (!pattern.test(message)) {
      return res
        .status(StatusCodes.OK)
        .send(
          "❌ Invalid National Id format, please provide id in the format specified in the example."
        );
    }

    await updateUser({ phone, nationalId: message });
    await setSession(phone, {
      step: steps.COLLECT_USER_ADDRESS,
      message,
      lActivity,
    });
    return res.status(StatusCodes.OK).send(this.messages.GET_ADDRESS);
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
    return res.status(StatusCodes.OK).send(this.messages.GET_LOCATION);
  }

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

    setImmediate(async () => {
      const user = await getUser(phone);
      await clientMainMenuTemplate(phone, user.firstName);
      await setSession(phone, {
        step: steps.SELECT_SERVICE_CATEGORY,
        message,
        lActivity,
      });
    });

    return res.status(StatusCodes.OK).send(confirmation);
  }

  async selectServiceCategory() {
    const { res, steps, lActivity, phone, message } = this;
    if (message.toLowerCase() === "request service") {
      await setSession(phone, {
        step: steps.SELECT_SERVICE,
        message,
        lActivity,
      });
      return res
        .status(StatusCodes.OK)
        .send(this.messages.CLIENT_WELCOME_MESSAGE);
    }
  }

  async selectService() {
    const { res, steps, lActivity, phone, message } = this;
    const category = await Category.findOne(
      { code: +message },
      { _id: 1, name: 1 }
    );

    let queryId = new mongoose.Types.ObjectId(category._id);
    const services = await Service.find({ category: queryId });

    let responseMessage = `
*${category.name}* 
Please select a service from the list below:
${services
        .map((s, index) => `${index + 1}. *${s.title}*\n${s.description}`)
        .join("\n\n")}

Reply with the number of the service you'd like to hire.
    `;
    await setSession(phone, {
      step: steps.BOOK_SERVICE,
      message,
      lActivity,
      categoryId: category._id.toString(),
    });
    return res.status(StatusCodes.OK).send(responseMessage);
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

    setSession(phone, {
      step: steps.DEFAULT_CLIENT_STATE,
      message,
      lActivity,
      serviceId: service._id.toString(),
      requestId: request._id.toString(),
    });

    return res.status(StatusCodes.OK).send(responseMessage);
  }

  async handleDefaultState() {
    // Handle any default state logic here
    // This could include showing the main menu or handling unexpected states
  }
}

module.exports = Client;