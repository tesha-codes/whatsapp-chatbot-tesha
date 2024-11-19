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
    this.validateConstructorParams(res, userResponse);

    this.res = res;
    this.userResponse = userResponse;
    this.session = session;
    this.user = user;
    this.steps = steps;
    this.messages = messages;
    this.lActivity = formatDateTime();
    this.setupCommonVariables();
  }

  validateConstructorParams(res, userResponse) {
    if (!res || typeof res.status !== 'function') {
      throw new ValidationError('Invalid response object');
    }
    if (!userResponse || !userResponse.sender) {
      throw new ValidationError('Invalid user response object');
    }
  }

  setupCommonVariables() {
    const { userResponse } = this;

    // Validate and normalize phone number
    this.phone = userResponse?.sender?.phone?.replace(/\D/g, '');
    if (!this.phone) {
      throw new ValidationError('Phone number is required');
    }

    // Safely extract message and username
    this.message = userResponse?.payload?.text ?? "";
    this.username = userResponse?.sender?.name ?? "";
  }

  async setSessionSafely(sessionData) {
    try {
      const session = {
        ...sessionData,
        lastUpdated: new Date().toISOString(),
        expiresAt: new Date(Date.now() + CONSTANTS.SESSION_TIMEOUT).toISOString()
      };
      await setSession(this.phone, session);
      return session;
    } catch (error) {
      console.error('Session update failed:', error);
      throw error;
    }
  }

  validateLocation(location) {
    if (!location ||
      typeof location.latitude !== 'number' ||
      typeof location.longitude !== 'number' ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180) {
      throw new ValidationError('Invalid location coordinates');
    }
    return true;
  }

  async handleInitialState() {
    try {
      const { res, session, steps, lActivity, phone, message, user } = this;

      if (!session || session.step === steps.DEFAULT_CLIENT_STATE) {
        const updatedUser = await getUser(phone);
        if (!updatedUser) {
          throw new ValidationError('User not found');
        }

        await clientMainMenuTemplate(phone, updatedUser.firstName);
        await this.setSessionSafely({
          step: steps.SELECT_SERVICE_CATEGORY,
          message,
          lActivity,
        });

        return res
          .status(StatusCodes.OK)
          .send(`Hello there 👋 ${updatedUser.firstName}`);
      }

      // Handle other initial states
      const stateHandlers = {
        [steps.SETUP_CLIENT_PROFILE]: this.setupClientProfile.bind(this),
        [steps.COLLECT_USER_FULL_NAME]: this.collectFullName.bind(this),
        [steps.COLLECT_USER_ID]: this.collectNationalId.bind(this),
        [steps.COLLECT_USER_ADDRESS]: this.collectAddress.bind(this),
        [steps.COLLECT_USER_LOCATION]: this.collectLocation.bind(this),
      };

      if (stateHandlers[session.step]) {
        return await stateHandlers[session.step]();
      }

      return null;
    } catch (error) {
      console.error('Error in handleInitialState:', error);
      return this.handleError(error);
    }
  }

  async mainEntry() {
    try {
      const initialStateResult = await this.handleInitialState();
      if (initialStateResult) return initialStateResult;

      const { session, steps } = this;

      const stateHandlers = {
        [steps.SELECT_SERVICE_CATEGORY]: this.selectServiceCategory.bind(this),
        [steps.SELECT_SERVICE]: this.selectService.bind(this),
        [steps.CONFIRM_ADDRESS_AND_LOCATION]: this.confirmAddressAndLocation.bind(this),
        [steps.CONFIRMED_LOC_ADDRESS]: this.confirmedLocationAddress.bind(this),
        [steps.WAITING_NEW_LOCATION]: this.handleNewLocation.bind(this),
        [steps.AWAITING_PROVIDER]: this.handleProviderAssignment.bind(this),
        [steps.PROVIDER_CONFIRMATION]: this.handleProviderConfirmation.bind(this),
      };

      if (stateHandlers[session.step]) {
        await stateHandlers[session.step]();
      } else {
        await this.handleDefaultState();
      }
    } catch (error) {
      console.error('Error in mainEntry:', error);
      return this.handleError(error);
    }
  }

  async showMainMenu() {
    try {
      const { res, phone, lActivity, steps, message } = this;

      await this.setSessionSafely({
        accountType: "Client",
        step: steps.SELECT_MENU_ACTION,
        message,
        lActivity,
      });

      await clientMainMenuTemplate(phone, '');
      return res.status(StatusCodes.OK).send("");
    } catch (error) {
      console.error('Error in showMainMenu:', error);
      return this.handleError(error);
    }
  }

  async selectService() {
    try {
      const { res, steps, lActivity, phone, message } = this;

      // Validate message is a number
      const categoryCode = parseInt(message);
      if (isNaN(categoryCode)) {
        return res.status(StatusCodes.BAD_REQUEST)
          .send("Please provide a valid category number.");
      }

      const category = await Category.findOne(
        { code: categoryCode },
        { _id: 1, name: 1 }
      );

      if (!category) {
        return res.status(StatusCodes.BAD_REQUEST)
          .send("Invalid category code. Please select a valid category.");
      }

      const services = await Service.find({ category: category._id });
      if (!services.length) {
        return res.status(StatusCodes.NOT_FOUND)
          .send("No services found in this category. Please try another category.");
      }

      let responseMessage = `
*${category.name}* 
Please select a service from the list below:
${services
          .map((s, index) => `${index + 1}. *${s.title}*\n${s.description}`)
          .join("\n\n")}

Reply with the number of the service you'd like to hire.
      `;

      await this.setSessionSafely({
        step: steps.CONFIRM_ADDRESS_AND_LOCATION,
        message,
        lActivity,
        categoryId: category._id.toString(),
        serviceCode: message
      });

      return res.status(StatusCodes.OK).send(responseMessage);
    } catch (error) {
      console.error('Error in selectService:', error);
      return this.handleError(error);
    }
  }

  async confirmAddressAndLocation() {
    try {
      const { res, steps, lActivity, phone, message, session } = this;
      const user = await User.findOne({ phone });

      if (!user || !user.address || !user.address.coordinates) {
        return res.status(StatusCodes.BAD_REQUEST)
          .send("Please update your location first.");
      }

      const customMessage = `
Please confirm if the provided location below matches your current location.

📍 *${user.address.physicalAddress}*
📌 Coordinates: ${user.address.coordinates.latitude}, ${user.address.coordinates.longitude}

Reply:
1. *YES* - if this location is correct
2. *NO* - if you want to provide a new location

Note: If providing a new location, please share your current location using WhatsApp's location feature.
      `;

      await this.setSessionSafely({
        step: steps.CONFIRMED_LOC_ADDRESS,
        message,
        lActivity,
        categoryId: session.categoryId,
        serviceCode: session.serviceCode,
        previousLocation: {
          coordinates: user.address.coordinates,
          physicalAddress: user.address.physicalAddress
        }
      });

      return res.status(StatusCodes.OK).send(customMessage);
    } catch (error) {
      console.error('Error in confirmAddressAndLocation:', error);
      return this.handleError(error);
    }
  }

  async confirmedLocationAddress() {
    try {
      const { res, steps, lActivity, phone, message, session } = this;

      if (message.toLowerCase() === 'yes' || (message.type === 'location')) {
        let user = await User.findOne({ phone });
        if (!user) {
          throw new ValidationError('User not found');
        }

        // Handle location update if new location provided
        if (message.type === 'location') {
          const newLocation = {
            latitude: message.latitude,
            longitude: message.longitude
          };

          // Validate new location
          this.validateLocation(newLocation);

          if (user.address && user.address.coordinates) {
            if (!user.locationHistory) {
              user.locationHistory = [];
            }

            if (user.locationHistory.length >= CONSTANTS.MAX_LOCATION_HISTORY) {
              user.locationHistory.shift(); 
            }

            user.locationHistory.push({
              coordinates: user.address.coordinates,
              physicalAddress: user.address.physicalAddress,
              timestamp: new Date()
            });
          }

          user.address = {
            coordinates: newLocation,
            physicalAddress: message.address || user.address.physicalAddress
          };

          user = await user.save();
        }

        const service = await Service.findOne({
          code: session.serviceCode,
          category: session.categoryId
        });

        if (!service) {
          return res.status(StatusCodes.NOT_FOUND)
            .send("❌ Service not found. Please try again.");
        }

        const reqID = "REQ" + crypto.randomBytes(3).toString("hex").toUpperCase();

        const request = await ServiceRequest.create({
          _id: new mongoose.Types.ObjectId(),
          city: user.address.city || "Unknown",
          requester: user._id,
          service: service._id,
          address: user.address,
          status: "PENDING",
          notes: "Awaiting service provider",
          id: reqID,
          location: {
            type: "Point",
            coordinates: [
              parseFloat(user.address.coordinates.longitude),
              parseFloat(user.address.coordinates.latitude)
            ]
          },
          createdAt: new Date(),
          searchAttempts: 0,
          searchTimeout: new Date(Date.now() + CONSTANTS.PROVIDER_SEARCH_TIMEOUT)
        });

        // Queue provider search with retry tracking
        await queueProviderSearch({
          phone,
          serviceId: service._id.toString(),
          categoryId: session.categoryId,
          requestId: request._id.toString(),
          location: user.address.coordinates,
          attempt: 1,
          maxAttempts: CONSTANTS.MAX_PROVIDER_RETRIES
        });

        await this.setSessionSafely({
          step: steps.AWAITING_PROVIDER,
          message,
          lActivity,
          requestId: request._id.toString()
        });

        const responseMessage = `
📃 Thank you for your request! 

Your service request has been created successfully.

📝 Request ID: *${reqID}*
📍 Location: *${request.address.physicalAddress}*
🔧 Service: *${service.title}*

⏳ We are now searching for available service providers in your area...
We will notify you as soon as we find a match!

_You can check the status of your request anytime by sending "status"._
        `;

        return res.status(StatusCodes.OK).send(responseMessage);
      }

      if (message.toLowerCase() === 'no') {
        await this.setSessionSafely({
          step: steps.WAITING_NEW_LOCATION,
          message,
          lActivity,
          categoryId: session.categoryId,
          serviceCode: session.serviceCode
        });

        return res.status(StatusCodes.OK)
          .send("Please share your current location using WhatsApp's location feature.");
      }

      return res.status(StatusCodes.BAD_REQUEST).send(`
Invalid response. Please reply with:
1. *YES* - if the shown location is correct
2. *NO* - if you want to provide a new location

Or share your new location using WhatsApp's location feature.
      `);
    } catch (error) {
      console.error('Error in confirmedLocationAddress:', error);
      return this.handleError(error);
    }
  }

  async handleProviderAssignment() {
    const { res, steps, lActivity, phone, message, session } = this;

    const request = await ServiceRequest.findById(session.requestId)
      .populate('service')
      .populate('provider');

    if (!request) {
      return res.status(StatusCodes.OK)
        .send("❌ Request not found. Please start a new service request.");
    }

    switch (request.status) {
      case 'PROVIDER_FOUND':
        const responseMessage = `
🎉 Great news! We found a service provider for your request!

👤 Provider: *${request.provider.firstName} ${request.provider.lastName}*
⭐ Rating: ${request.provider.rating || 'New Provider'}
📞 Contact: ${request.provider.phone}

Reply:
1. *ACCEPT* - to confirm this provider
2. *REJECT* - to search for another provider
        `;

        await setSession(phone, {
          step: steps.PROVIDER_CONFIRMATION,
          message,
          lActivity,
          requestId: request._id.toString()
        });

        return res.status(StatusCodes.OK).send(responseMessage);

      case 'NO_PROVIDER_FOUND':
        await setSession(phone, {
          step: steps.DEFAULT_CLIENT_STATE,
          message,
          lActivity
        });

        return res.status(StatusCodes.OK).send(`
❌ We're sorry, but we couldn't find any available service providers in your area at this time.

Would you like to:
1. Try again later
2. Choose a different service
        `);

      case 'PENDING':
      default:
        return res.status(StatusCodes.OK).send(`
⏳ We're still searching for a service provider...

We'll notify you as soon as we find someone available!
        `);
    }
  }

  async handleProviderConfirmation() {
    const { res, steps, lActivity, phone, message, session } = this;

    const request = await ServiceRequest.findById(session.requestId)
      .populate('service')
      .populate('provider');

    if (!request) {
      return res.status(StatusCodes.OK)
        .send("❌ Request not found. Please start a new service request.");
    }

    if (message.toLowerCase() === 'accept') {
      request.status = 'ACCEPTED';
      await request.save();

      await setSession(phone, {
        step: steps.DEFAULT_CLIENT_STATE,
        message,
        lActivity
      });

      return res.status(StatusCodes.OK).send(`
🎉 Perfect! Your service provider has been confirmed.

📝 Request Details:
ID: *${request.id}*
Provider: *${request.provider.firstName} ${request.provider.lastName}*
Service: *${request.service.title}*

Your provider will contact you shortly to discuss the service details.

Thank you for using our service! 🙏
      `);
    }

    if (message.toLowerCase() === 'reject') {
      request.status = 'PROVIDER_REJECTED';
      await request.save();

      // Queue new provider search
      await queueProviderSearch({
        phone,
        serviceId: request.service._id.toString(),
        categoryId: request.service.category.toString(),
        requestId: request._id.toString(),
        location: request.address.coordinates,
        excludeProvider: request.provider._id.toString()
      });

      await setSession(phone, {
        step: steps.AWAITING_PROVIDER,
        message,
        lActivity,
        requestId: request._id.toString()
      });

      return res.status(StatusCodes.OK).send(`
👌 Understood. We'll look for another service provider.
Please wait while we search...

We'll notify you as soon as we find another match!
      `);
    }

    return res.status(StatusCodes.OK).send(`
Invalid response. Please reply with:
*ACCEPT* - to confirm this provider
*REJECT* - to search for another provider
    `);
  }

  async handleDefaultState() {
    return await this.showMainMenu();
  }
}

module.exports = Client;