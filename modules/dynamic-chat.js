const { StatusCodes } = require("http-status-codes");
const { setSession } = require("../utils/redis");
const { updateUser, getUser } = require("../controllers/user.controllers");
const { formatDateTime } = require("../utils/dateUtil");
const { clientMainMenuTemplate } = require("../services/whatsappService");

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
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
        this.handleError = this.handleError.bind(this);
        this.setupClientProfile = this.setupClientProfile.bind(this);
        this.collectFullName = this.collectFullName.bind(this);
        this.collectNationalId = this.collectNationalId.bind(this);
        this.collectAddress = this.collectAddress.bind(this);
        this.collectLocation = this.collectLocation.bind(this);
    }

    async mainEntry() {
        try {
            // Handle registration flow through handleInitialState
            const initialStateResult = await this.handleInitialState();

            // Only proceed to default state if initialStateResult is explicitly null
            // This fixes the issue of registration messages being skipped
            if (initialStateResult !== null) {
                return initialStateResult;
            }

            // If we get here, user is already registered
            return await this.handleDefaultState();
        } catch (error) {
            return this.handleError(error);
        }
    }

    // Default state handler for registered users
    async handleDefaultState() {
        return this.res.status(StatusCodes.OK).send(
            "Welcome back! This is the main menu (registration flow complete)."
        );
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

    async handleInitialState() {
        try {
            const { res, session, steps, lActivity, phone, message } = this;

            // Check if user exists first
            const user = await getUser(phone);

            // If no user exists OR we're in the registration flow, handle registration
            if (!user || (session && session.step !== steps.DEFAULT_CLIENT_STATE)) {
                // If no session or in default state, show initial message
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

            // Only return null if the user exists AND we're not in a registration step
            return null;
        } catch (error) {
            return this.handleError(error);
        }
    }


    async setupClientProfile() {
        const { res, steps, lActivity, phone, message } = this;

        // Make the check case-insensitive and trim whitespace
        if (message.trim().toLowerCase() === "create account") {
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
            // Handle different types of location input
            if (message.type === 'location') {
                // Direct WhatsApp location message
                locationData = {
                    latitude: message.latitude,
                    longitude: message.longitude
                };
            } else {
                try {
                    // Try to parse if it's a string
                    locationData = typeof message === 'string' ? JSON.parse(message) : message;
                } catch (e) {
                    return res.status(StatusCodes.BAD_REQUEST).send(
                        "❌ Please share your location using WhatsApp's location sharing feature."
                    );
                }
            }

            // Validate location data
            if (!locationData?.latitude || !locationData?.longitude) {
                return res.status(StatusCodes.BAD_REQUEST).send(
                    "❌ Invalid location data. Please share your location using WhatsApp's location sharing feature."
                );
            }

            try {
                // Update user with location data
                await updateUser({
                    phone,
                    address: {
                        coordinates: {
                            latitude: locationData.latitude,
                            longitude: locationData.longitude
                        },
                        physicalAddress: message.address || ''
                    }
                });

                // Update session to completed state
                await setSession(phone, {
                    step: steps.DEFAULT_CLIENT_STATE,
                    message,
                    lActivity
                });

                // Send success response
                return res.status(StatusCodes.OK).send(
                    "✅ Location received and profile created successfully! You can now access our services."
                );

            } catch (updateError) {
                console.error('Error updating user or session:', updateError);
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(
                    "❌ There was an error saving your location. Please try again."
                );
            }

        } catch (error) {
            console.error('Error in collectLocation:', error);
            return this.handleError(error);
        }
    }
}

module.exports = Client;