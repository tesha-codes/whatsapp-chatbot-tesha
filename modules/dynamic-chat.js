const { StatusCodes } = require("http-status-codes");
const { setSession } = require("../utils/redis");
const { createUser, updateUser, getUser } = require("../controllers/user.controllers");
const { formatDateTime } = require("../utils/dateUtil");
const Category = require("../models/category.model");
const { clientMainMenuTemplate } = require("../services/whatsappService");
const Service = require("../models/services.model");
const mongoose = require("mongoose");
const ServiceRequest = require("../models/request.model");
const User = require("../models/user.model");
const crypto = require("node:crypto");
const { queueProviderSearch } = require("../jobs/service-provider.job");

class DynamicClient {
    constructor(res, userResponse, session, user, steps, messages) {
        this.res = res;
        this.userResponse = userResponse;
        this.session = session || {};
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

    async mainEntry() {
        try {
            // Handle initial state and registration
            const initialStateResult = await this.handleInitialState();
            if (initialStateResult) return initialStateResult;

            // Get current step from session
            const currentStep = this.session.step || this.steps.DEFAULT_CLIENT_STATE;

            // Handle different states
            switch (currentStep) {
                case this.steps.SELECT_SERVICE_CATEGORY:
                    return await this.handleServiceCategory();
                case this.steps.SELECT_SERVICE:
                    return await this.handleServiceSelection();
                case this.steps.BOOK_SERVICE:
                    return await this.handleBookService();
                case this.steps.AWAITING_PROVIDER:
                    return await this.handleAwaitingProvider();
                default:
                    return await this.handleDefaultState();
            }
        } catch (error) {
            console.error("Error in mainEntry:", error);
            return this.res.status(StatusCodes.OK).send("An error occurred. Please try again later.");
        }
    }

    async handleInitialState() {
        const { session, steps } = this;

        // No session or default state
        if (!session || session.step === steps.DEFAULT_CLIENT_STATE) {
            const updatedUser = await getUser(this.phone);
            await clientMainMenuTemplate(this.phone, updatedUser.firstName);
            await this.updateSession(steps.SELECT_SERVICE_CATEGORY);
            return this.res.status(StatusCodes.OK)
                .send(`Welcome back ${updatedUser.firstName}! How can I assist you today?`);
        }

        // Profile setup states
        if (this.isInProfileSetup()) {
            return await this.handleProfileSetup();
        }

        return null;
    }

    isInProfileSetup() {
        const profileSetupSteps = [
            this.steps.SETUP_CLIENT_PROFILE,
            this.steps.COLLECT_USER_FULL_NAME,
            this.steps.COLLECT_USER_ID,
            this.steps.COLLECT_USER_ADDRESS,
            this.steps.COLLECT_USER_LOCATION
        ];
        return profileSetupSteps.includes(this.session.step);
    }

    async handleProfileSetup() {
        switch (this.session.step) {
            case this.steps.SETUP_CLIENT_PROFILE:
                return await this.setupClientProfile();
            case this.steps.COLLECT_USER_FULL_NAME:
                return await this.collectFullName();
            case this.steps.COLLECT_USER_ID:
                return await this.collectNationalId();
            case this.steps.COLLECT_USER_ADDRESS:
                return await this.collectAddress();
            case this.steps.COLLECT_USER_LOCATION:
                return await this.collectLocation();
            default:
                return null;
        }
    }

    async handleServiceCategory() {
        try {
            const { message } = this;
            if (message.toLowerCase() === "request service" || message === "1") {
                // Fetch all service categories
                const categories = await Category.find({}, { name: 1, code: 1, description: 1 });

                let responseMessage = "*Available Service Categories*\n\n";
                categories.forEach(category => {
                    responseMessage += `${category.code}. *${category.name}*\n${category.description || ''}\n\n`;
                });
                responseMessage += "Please reply with the category number to proceed.";

                await this.updateSession(this.steps.SELECT_SERVICE);
                return this.res.status(StatusCodes.OK).send(responseMessage);
            }

            return this.res.status(StatusCodes.OK)
                .send("Please select 'Request Service' to view available categories.");
        } catch (error) {
            console.error("Error in handleServiceCategory:", error);
            return this.res.status(StatusCodes.OK)
                .send("Unable to fetch service categories. Please try again.");
        }
    }

    async handleServiceSelection() {
        try {
            const { message } = this;
            const categoryCode = parseInt(message);

            const category = await Category.findOne({ code: categoryCode });
            if (!category) {
                return this.res.status(StatusCodes.OK)
                    .send("Invalid category selection. Please choose a valid category number.");
            }

            const services = await Service.find({ category: category._id });
            if (!services.length) {
                return this.res.status(StatusCodes.OK)
                    .send("No services available in this category at the moment.");
            }

            let responseMessage = `*${category.name} Services*\n\n`;
            services.forEach((service, index) => {
                responseMessage += `${service.code || (index + 1)}. *${service.title}*\n${service.description || ''}\n\n`;
            });
            responseMessage += "Reply with the service number to book.";

            await this.updateSession(this.steps.BOOK_SERVICE, { categoryId: category._id });
            return this.res.status(StatusCodes.OK).send(responseMessage);

        } catch (error) {
            console.error("Error in handleServiceSelection:", error);
            return this.res.status(StatusCodes.OK)
                .send("Error processing your selection. Please try again.");
        }
    }

    async handleBookService() {
        try {
            const { message, session, phone, user } = this;
            const serviceCode = parseInt(message);

            const service = await Service.findOne({
                code: serviceCode,
                category: session.categoryId
            });

            if (!service) {
                return this.res.status(StatusCodes.OK)
                    .send("Invalid service selection. Please choose a valid service number.");
            }

            // Generate request ID
            const reqID = "REQ" + crypto.randomBytes(3).toString("hex").toUpperCase();

            // Create service request
            const request = await ServiceRequest.create({
                _id: new mongoose.Types.ObjectId(),
                city: user.city || "Unknown",
                requester: user._id,
                service: service._id,
                address: user.address,
                notes: "Service request from dynamic chat",
                id: reqID,
                status: "pending"
            });

            // Queue provider search
            await queueProviderSearch({
                phone,
                serviceId: service._id.toString(),
                categoryId: session.categoryId,
                requestId: request._id.toString()
            });

            const responseMessage = `
📋 *Service Request Confirmed*

Your request has been successfully created!

🔍 Request ID: *${reqID}*
🏠 Location: *${user.address?.physicalAddress || 'Not specified'}*
🛠️ Service: *${service.title}*

We are now searching for available service providers in your area.
You will receive a notification once a provider accepts your request.

Need help? Contact our support at 📞 XXXXX-XXXXX
`;

            await this.updateSession(this.steps.AWAITING_PROVIDER, {
                requestId: request._id.toString(),
                serviceId: service._id.toString()
            });

            return this.res.status(StatusCodes.OK).send(responseMessage);

        } catch (error) {
            console.error("Error in handleBookService:", error);
            return this.res.status(StatusCodes.OK)
                .send("Unable to process your booking. Please try again later.");
        }
    }

    async handleAwaitingProvider() {
        const responseMessage = `
Your service request is still being processed.
We'll notify you as soon as a provider accepts your request.

Need to cancel? Reply with 'cancel request'.
Need help? Contact our support at 📞 XXXXX-XXXXX
`;
        return this.res.status(StatusCodes.OK).send(responseMessage);
    }

    async handleDefaultState() {
        await clientMainMenuTemplate(this.phone, this.user.firstName);
        return this.res.status(StatusCodes.OK).send(this.messages.CLIENT_WELCOME_MESSAGE);
    }

    // Profile setup methods
    async setupClientProfile() {
        const { message } = this;
        if (message.toLowerCase() === "create account" || message === "1") {
            await this.updateSession(this.steps.COLLECT_USER_FULL_NAME);
            return this.res.status(StatusCodes.OK).send(this.messages.GET_FULL_NAME);
        }

        await this.updateSession(this.steps.DEFAULT_CLIENT_STATE);
        return this.res.status(StatusCodes.OK)
            .send("Profile creation cancelled. You need a profile to request services.");
    }

    async collectFullName() {
        const { message, phone } = this;
        if (message.length < 5) {
            return this.res.status(StatusCodes.OK)
                .send("Name is too short. Please enter your full name (first name and surname).");
        }

        const names = message.split(" ");
        const lastName = names[names.length - 1];
        const firstName = message.replace(lastName, "").trim();

        await updateUser({ phone, firstName, lastName });
        await this.updateSession(this.steps.COLLECT_USER_ID);
        return this.res.status(StatusCodes.OK).send(this.messages.GET_NATIONAL_ID);
    }

    async collectNationalId() {
        const { message, phone } = this;
        const idPattern = /^(\d{2})-(\d{7})-([A-Z])-(\d{2})$/;

        if (!idPattern.test(message)) {
            return this.res.status(StatusCodes.OK)
                .send("Invalid ID format. Please use the format: XX-XXXXXXX-X-XX");
        }

        await updateUser({ phone, nationalId: message });
        await this.updateSession(this.steps.COLLECT_USER_ADDRESS);
        return this.res.status(StatusCodes.OK).send(this.messages.GET_ADDRESS);
    }

    async collectAddress() {
        const { message, phone } = this;
        await updateUser({
            phone,
            address: { physicalAddress: message }
        });
        await this.updateSession(this.steps.COLLECT_USER_LOCATION);
        return this.res.status(StatusCodes.OK).send(this.messages.GET_LOCATION);
    }

    async collectLocation() {
        const { message, phone } = this;
        await updateUser({
            phone,
            address: { coordinates: message }
        });

        const confirmationMessage = `
*Profile Setup Complete* ✅

Thank you for completing your profile setup!
You can now start requesting services.

Need help? Our support team is available 24/7.
`;

        const user = await getUser(phone);
        await clientMainMenuTemplate(phone, user.firstName);
        await this.updateSession(this.steps.SELECT_SERVICE_CATEGORY);

        return this.res.status(StatusCodes.OK).send(confirmationMessage);
    }

    // Utility methods
    async updateSession(step, additionalData = {}) {
        const sessionData = {
            step,
            message: this.message,
            lActivity: this.lActivity,
            ...additionalData
        };
        await setSession(this.phone, sessionData);
    }
}

module.exports = DynamicClient;


