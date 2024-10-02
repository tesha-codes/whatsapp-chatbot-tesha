const { StatusCodes } = require("http-status-codes");
const { formatDateTime } = require("../utils/dateUtil");
const { setSession } = require("../utils/redis");
const { updateUser } = require("../controllers/user.controllers");
const {
  createServiceProvider,
  updateProvider,
} = require("../controllers/serviceProvider.controller");
const Category = require("../models/category.model");
const Service = require("../models/services.model");

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
      if (session.step === steps.PROVIDER_PROMPT_ACCOUNT) {
        if (message.toString().toLowerCase() === "create account") {
          await setSession(phone, {
            step: steps.COLLECT_PROVIDER_FULL_NAME,
            message,
            lActivity,
          });
          return res.status(StatusCodes.OK).send(messages.GET_FULL_NAME);
        } else {
          await setSession(phone, {
            step: steps.PROVIDER_PROMPT_ACCOUNT,
            message,
            lActivity,
          });
          return res
            .status(StatusCodes.OK)
            .send(
              "❌ You have cancelled creating profile. You need to have a profile to be able to request services. If you change your mind, please type 'create account' to proceed."
            );
        }
      } else if (session.step === steps.COLLECT_PROVIDER_FULL_NAME) {
        if (message.toString().length > 16) {
          return res
            .status(StatusCodes.OK)
            .send(
              "❌ Name and surname provided is too long. Please re-enter your full name, name(s) first and then surname second."
            );
        }
        const userNames = message.toString().split(" ");
        const lastName = userNames[userNames.length - 1];
        const firstName = message.toString().replace(lastName, " ").trim();

        await updateUser({ phone, firstName, lastName });
        await setSession(phone, {
          step: steps.COLLECT_USER_ID,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(messages.GET_NATIONAL_ID);
      } else if (session.step === steps.COLLECT_USER_ID) {
        const pattern = /^(\d{2})-(\d{7})-([A-Z])-(\d{2})$/;
        if (!pattern.test(message.toString())) {
          return res
            .status(StatusCodes.OK)
            .send(
              "❌ Invalid National Id format, please provide id in the format specified in the example."
            );
        }

        const nationalId = message.toString();
        await updateUser({ phone, nationalId });
        await setSession(phone, {
          step: steps.COLLECT_USER_ADDRESS,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(messages.GET_ADDRESS);
      } else if (session.step === steps.COLLECT_USER_ADDRESS) {
        const street = message.toString();
        await updateUser({
          phone,
          address: {
            physicalAddress: street,
          },
        });
        await setSession(phone, {
          step: steps.PROVIDER_COLLECT_LOCATION,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(messages.GET_LOCATION);
      } else if (session.step === steps.PROVIDER_COLLECT_LOCATION) {
       
        if (typeof message !== "object") {
          return res
            .status(StatusCodes.OK)
            .send(
              "❌ Invalid location format. Please send your location."
            );
        }
        await updateUser({
          phone,
          address: {
            coordinates: [longitude, latitude],
          },
        });
        await setSession(phone, {
          step: steps.PROVIDER_COLLECT_CITY,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(messages.GET_CITY);
      } else if (session.step === steps.PROVIDER_COLLECT_CITY) {
        const city = message.toString();
        await createServiceProvider(user._id, { city }); // create servive provider for the first time
        await setSession(phone, {
          step: steps.PROVIDER_COLLECT_CATEGORY,
          message,
          lActivity,
        });
        const categories = await Category.find({}, "name code").sort("code");
        const categoryList = categories
          .map((cat) => `${cat.code}. ${cat.name}`)
          .join("\n");
        return res
          .status(StatusCodes.OK)
          .send(`${messages.CHOOSE_CATEGORY}\n${categoryList}`);
      } else if (session.step === steps.PROVIDER_COLLECT_CATEGORY) {
        const categoryCode = parseInt(message);
        const category = await Category.findOne({ code: categoryCode });
        if (!category) {
          return res
            .status(StatusCodes.OK)
            .send(
              "❌ Invalid category selection. Please choose a valid number from the list."
            );
        }
        await updateProvider(user._id, { category: category._id });
        await setSession(phone, {
          step: steps.PROVIDER_COLLECT_SERVICE,
          message,
          categoryId: category._id,
          lActivity,
        });
        const services = await Service.find(
          { category: category._id },
          "title code"
        ).sort("code");
        const serviceList = services
          .map((svc) => `${svc.code}. ${svc.title}`)
          .join("\n");
        return res
          .status(StatusCodes.OK)
          .send(`${messages.CHOOSE_SERVICE}\n${serviceList}`);
      } else if (session.step === steps.PROVIDER_COLLECT_SERVICE) {
        const serviceCode = parseInt(message);
        const service = await Service.findOne({
          code: serviceCode,
          category: session.categoryId,
        });
        if (!service) {
          return res
            .status(StatusCodes.OK)
            .send(
              "❌ Invalid service selection. Please choose a valid number from the list."
            );
        }
        await updateProvider(user._id, { service: service._id });
        await setSession(phone, {
          step: steps.PROVIDER_COLLECT_DESCRIPTION,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(messages.GET_DESCRIPTION);
      } else if (session.step === steps.PROVIDER_COLLECT_DESCRIPTION) {
        const description = message.toString();
        if (description.length > 200) {
          return res
            .status(StatusCodes.OK)
            .send(
              "❌ Description is too long. Please keep it under 200 characters."
            );
        }
        await updateProvider(user._id, { description });
        await setSession(phone, {
          step: steps.PROVIDER_COLLECT_SUBSCRIPTION,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(messages.CHOOSE_SUBSCRIPTION);
      } else if (session.step === steps.PROVIDER_COLLECT_SUBSCRIPTION) {
        const subscriptionId = message.toString();
        // Here you should validate if the subscriptionId is valid
        await updateProvider(user._id, { subscription: subscriptionId });
        await setSession(phone, {
          step: steps.PROVIDER_COLLECT_ID_IMAGE,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(messages.UPLOAD_ID_IMAGE);
      } else if (session.step === steps.PROVIDER_COLLECT_ID_IMAGE) {
        const nationalIdImage = message.toString(); // Assuming this is a URL or file path
        // Here you should implement logic to handle and validate the uploaded image
        await updateProvider(user._id, {
          nationalIdImage,
          isProfileCompleted: true,
        });
        await setSession(phone, {
          step: steps.PROVIDER_PROFILE_COMPLETE,
          message,
          lActivity,
        });
        return res.status(StatusCodes.OK).send(messages.PROFILE_COMPLETE);
      } else {
        // Handle unknown step
        return res
          .status(StatusCodes.BAD_REQUEST)
          .send("Invalid step in the registration process.");
      }
    } catch (error) {
      console.error("Error in ServiceProvider mainEntry:", error);
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send("An error occurred. Please try again later.");
    }
  }
}

module.exports = ServiceProvider;
