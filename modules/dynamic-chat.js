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
const CONSTANTS = require('../constants/index');
const { OpenAI } = require("openai");

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class OpenAIService {
    constructor(apiKey) {
        this.openai = new OpenAI({ apiKey });
    }

    async generateResponse(messages, model = "gpt-3.5-turbo") {
        try {
            const response = await this.openai.chat.completions.create({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 150,
            });
            return response.choices[0].message.content;
        } catch (error) {
            console.error("OpenAI API Error:", error);
            throw error;
        }
    }
}

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

        // Initialize OpenAI
        this.openai = new OpenAIService(process.env.OPENAI_API_KEY);

        // Bind methods
        this.handleError = this.handleError.bind(this);
        this.handleDynamicResponse = this.handleDynamicResponse.bind(this);
        this.setupClientProfile = this.setupClientProfile.bind(this);
        this.collectFullName = this.collectFullName.bind(this);
        this.collectNationalId = this.collectNationalId.bind(this);
        this.collectAddress = this.collectAddress.bind(this);
        this.collectLocation = this.collectLocation.bind(this);
        this.selectServiceCategory = this.selectServiceCategory.bind(this);
        this.selectService = this.selectService.bind(this);
        this.confirmAddressAndLocation = this.confirmAddressAndLocation.bind(this);
        this.confirmedLocationAddress = this.confirmedLocationAddress.bind(this);
        this.handleNewLocation = this.handleNewLocation.bind(this);
        this.handleProviderAssignment = this.handleProviderAssignment.bind(this);
        this.handleProviderConfirmation = this.handleProviderConfirmation.bind(this);
        this.handleDefaultState = this.handleDefaultState.bind(this);
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

    handleError(error) {
        console.error('Error in Client class:', error);

        if (this.res && typeof this.res.status === 'function') {
            const errorMessage = error.message || 'An unexpected error occurred';
            return this.res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(
                `❌ ${errorMessage}\n\nPlease try again or contact support if the problem persists.`
            );
        }

        throw error;
    }

    async handleDynamicResponse() {
        try {
            const { message, session, user } = this;

            // Prepare conversation history
            const messages = [
                {
                    role: "system",
                    content: `
            You are a helpful customer support assistant for a service platform. 
            Your goal is to assist users in requesting services, updating their profiles, 
            and answering questions. Be polite, concise, and professional.
            
            User Details:
            - Name: ${user?.firstName} ${user?.lastName}
            - Phone: ${this.phone}
            - Address: ${user?.address?.physicalAddress || "Not provided"}
          `,
                },
                { role: "user", content: message },
            ];

            // Add session context if available
            if (session?.context) {
                messages.push({ role: "assistant", content: session.context });
            }

            // Get response from OpenAI
            const response = await this.openai.generateResponse(messages);

            // Update session context
            await this.setSessionSafely({
                ...session,
                context: response,
            });

            // Send response to user
            return this.res.status(StatusCodes.OK).send(response);
        } catch (error) {
            console.error("Error in handleDynamicResponse:", error);
            return this.handleError(error);
        }
    }

    async handleInitialState() {
        try {
            const { res, session, steps, lActivity, phone, message } = this;

            // Check if user exists first
            const user = await getUser(phone);

            // If no user exists, start registration flow
            if (!user) {
                if (!session || session.step === steps.DEFAULT_CLIENT_STATE) {
                    return res.status(StatusCodes.OK).send(`
Welcome to our service! 👋
To get started, you'll need to create an account.

Reply with:
*CREATE ACCOUNT* - to set up your profile
          `);
                }

                // Handle registration flow states
                const registrationHandlers = {
                    [steps.SETUP_CLIENT_PROFILE]: this.setupClientProfile,
                    [steps.COLLECT_USER_FULL_NAME]: this.collectFullName,
                    [steps.COLLECT_USER_ID]: this.collectNationalId,
                    [steps.COLLECT_USER_ADDRESS]: this.collectAddress,
                    [steps.COLLECT_USER_LOCATION]: this.collectLocation
                };

                if (registrationHandlers[session.step]) {
                    return await registrationHandlers[session.step].call(this);
                }
            }

            // User exists, handle main menu and service flow
            if (!session || session.step === steps.DEFAULT_CLIENT_STATE) {
                await clientMainMenuTemplate(phone, user.firstName);
                await this.setSessionSafely({
                    step: steps.SELECT_SERVICE_CATEGORY,
                    message,
                    lActivity,
                });

                return res.status(StatusCodes.OK)
                    .send(`Welcome back ${user.firstName}! 👋\nHow can I help you today?`);
            }

            return null; // Allow flow to continue to main service handling
        } catch (error) {
            console.error('Error in handleInitialState:', error);
            return this.handleError(error);
        }
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
        let locationData;

        try {
            // Handle WhatsApp location message
            if (message.type === 'location') {
                locationData = message;
            } else {
                try {
                    locationData = typeof message === 'string' ? JSON.parse(message) : message;
                } catch (e) {
                    return res.status(StatusCodes.BAD_REQUEST).send(
                        "❌ Please share your location using WhatsApp's location sharing feature."
                    );
                }
            }

            if (!locationData?.latitude || !locationData?.longitude) {
                return res.status(StatusCodes.BAD_REQUEST).send(
                    "❌ Please share your location using WhatsApp's location sharing feature."
                );
            }

            const coordinates = {
                type: "Point",
                coordinates: [locationData.longitude, locationData.latitude]
            };

            // Update user with location
            await updateUser({
                phone,
                address: {
                    coordinates: locationData,
                    physicalAddress: message.address || ''
                }
            });

            const confirmation = `
*Profile Setup Confirmation*

✅ Thank you! Your profile has been successfully set up.
You're all set! If you need any further assistance, feel free to reach out. 😊
`;

            await Promise.all([
                clientMainMenuTemplate(phone, (await getUser(phone)).firstName),
                setSession(phone, {
                    step: steps.SELECT_SERVICE_CATEGORY,
                    message,
                    lActivity,
                })
            ]);

            return res.status(StatusCodes.OK).send(confirmation);

        } catch (error) {
            console.error('Error in collectLocation:', error);
            return this.handleError(error);
        }
    }

    async mainEntry() {
        try {
            const { session, steps } = this;

            // First handle initial/registration state
            const initialStateResult = await this.handleInitialState();
            if (initialStateResult) return initialStateResult;

            // Use OpenAI for dynamic responses
            if (session.step === steps.DYNAMIC_RESPONSE) {
                return await this.handleDynamicResponse();
            }

            // Then handle service request flow
            const serviceHandlers = {
                [steps.SELECT_SERVICE_CATEGORY]: this.selectServiceCategory,
                [steps.SELECT_SERVICE]: this.selectService,
                [steps.CONFIRM_ADDRESS_AND_LOCATION]: this.confirmAddressAndLocation,
                [steps.CONFIRMED_LOC_ADDRESS]: this.confirmedLocationAddress,
                [steps.WAITING_NEW_LOCATION]: this.handleNewLocation,
                [steps.AWAITING_PROVIDER]: this.handleProviderAssignment,
                [steps.PROVIDER_CONFIRMATION]: this.handleProviderConfirmation,
            };

            if (serviceHandlers[session.step]) {
                return await serviceHandlers[session.step].call(this);
            }

            return await this.handleDefaultState();
        } catch (error) {
            return this.handleError(error);
        }
    }

    async handleDefaultState() {
        return await this.showMainMenu();
    }
}

module.exports = Client;