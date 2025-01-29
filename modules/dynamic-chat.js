// modules/dynamic-chat.js
const { StatusCodes } = require("http-status-codes");
const { setSession } = require("../utils/redis");
const { updateUser, getUser } = require("../controllers/user.controllers");
const { analyzeMessage } = require("./ai-service");

class DynamicClient {
    constructor(res, userResponse, session, user, steps, messages) {
        // Preserve original parameters
        this.res = res;
        this.userResponse = userResponse;
        this.session = session;
        this.user = user;
        this.steps = steps;
        this.messages = messages;
        this.phone = userResponse.sender.phone;

        // Add AI capabilities
        this.message = userResponse.payload.text || "";
        this.location = userResponse.payload.location;
    }

    async mainEntry() {
        try {
            // Maintain original registration flow
            if (!this.user.isRegistered) {
                return this.handleRegistrationFlow();
            }

            // Enhanced service booking with AI
            return this.handleServiceRequest();
        } catch (error) {
            console.error("DynamicClient Error:", error);
            return this.sendResponse(this.messages.ERROR_GENERIC);
        }
    }

    async handleRegistrationFlow() {
        // Keep original step-based registration
        const stepHandlers = {
            [this.steps.COLLECT_USER_FULL_NAME]: this.handleFullName,
            [this.steps.COLLECT_USER_ID]: this.handleNationalID,
            [this.steps.COLLECT_USER_ADDRESS]: this.handleAddress,
            [this.steps.COLLECT_USER_LOCATION]: this.handleLocation
        };

        if (stepHandlers[this.session.step]) {
            return stepHandlers[this.session.step].call(this);
        }
        return this.startRegistration();
    }

    async startRegistration() {
        await this.updateSession(this.steps.COLLECT_USER_FULL_NAME);
        return this.sendResponse(this.messages.GET_FULL_NAME);
    }

    async handleFullName() {
        const name = this.message;
        if (!this.isValidName(name)) {
            return this.sendResponse("❌ Please enter both first and last names\nExample: John Doe");
        }

        const [firstName, lastName] = name.split(/\s+(.*)/);
        await updateUser({ phone: this.phone, firstName, lastName });
        await this.updateSession(this.steps.COLLECT_USER_ID);
        return this.sendResponse(this.messages.GET_NATIONAL_ID);
    }

    async handleNationalID() {
        const nationalId = this.message;
        if (!this.isValidNationalID(nationalId)) {
            return this.sendResponse("⚠️ Invalid ID format. Use: XX-XXXXXXX-X-XX\nExample: 63-1234567-X-89");
        }

        await updateUser({ phone: this.phone, nationalId });
        await this.updateSession(this.steps.COLLECT_USER_ADDRESS);
        return this.sendResponse(this.messages.GET_ADDRESS);
    }

    async handleAddress() {
        await updateUser({
            phone: this.phone,
            address: { physicalAddress: this.message }
        });
        await this.updateSession(this.steps.COLLECT_USER_LOCATION);
        return this.sendResponse(this.messages.GET_LOCATION);
    }

    async handleLocation() {
        const location = this.location ? [
            this.location.latitude,
            this.location.longitude
        ] : null;

        await updateUser({
            phone: this.phone,
            address: { coordinates: location },
            isRegistered: true
        });

        await this.updateSession(this.steps.DEFAULT_CLIENT_STATE);
        return this.sendResponse(this.messages.PROFILE_CONFIRMATION);
    }

    async handleServiceRequest() {
        // AI-enhanced service handling
        try {
            const { intent, entities } = await analyzeMessage(this.message);

            if (intent === 'REQUEST_SERVICE') {
                return this.processServiceRequest(entities);
            }

            // Fallback to original menu
            return this.sendResponse(this.messages.CLIENT_MAIN_MENU);
        } catch (error) {
            console.error("AI Service Error:", error);
            return this.legacyServiceFlow();
        }
    }

    async processServiceRequest(entities) {
        // Use extracted entities or ask for missing info
        const serviceType = entities.serviceType || await this.getServiceCategory();
        const location = entities.location || this.user.address;

        if (!serviceType) {
            return this.sendResponse("🔧 What service do you need help with?");
        }

        const providers = await this.findProviders(serviceType, location);
        return this.presentProviders(providers);
    }

    async legacyServiceFlow() {
        // Original service selection logic
        if (this.session.step === this.steps.SELECT_SERVICE_CATEGORY) {
            return this.selectServiceCategory();
        }
        if (this.session.step === this.steps.SELECT_SERVICE) {
            return this.selectService();
        }
        return this.sendResponse(this.messages.CLIENT_MAIN_MENU);
    }

    // Preserve original validation methods
    isValidName(name) {
        return name.trim().split(/\s+/).length >= 2;
    }

    isValidNationalID(id) {
        return /^\d{2}-\d{7}-[A-Z]-\d{2}$/i.test(id);
    }

    async updateSession(nextStep) {
        this.session.step = nextStep;
        await setSession(this.phone, this.session);
    }

    sendResponse(message) {
        return this.res.status(StatusCodes.OK).send(message);
    }
}

module.exports = DynamicClient;