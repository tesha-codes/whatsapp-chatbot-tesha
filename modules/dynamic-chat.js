const { StatusCodes } = require("http-status-codes");
const { setSession, getSession } = require("../utils/redis");
const { updateUser, getUser } = require("../controllers/user.controllers");
const { analyzeMessage } = require("./ai-service"); // Your NLP layer

class DynamicClient {
    constructor(res, userResponse, session, user, messages) {
        this.res = res;
        this.userResponse = userResponse;
        this.session = session;
        this.user = user;
        this.messages = messages;
        this.phone = userResponse.sender.phone;
    }

    async mainEntry() {
        try {
            // Analyze user input using NLP
            const { intent, entities } = await analyzeMessage(this.userResponse.payload.text);

            // Handle registration flow
            if (!this.user.isRegistered) {
                return this.handleRegistration(entities);
            }

            // Handle post-registration conversations
            return this.handleServiceRequest(intent, entities);
        } catch (error) {
            console.error("DynamicClient Error:", error);
            return this.sendResponse(this.messages.ERROR_GENERIC);
        }
    }

    async handleRegistration(entities) {
        const missingFields = this.getMissingRegistrationFields();

        // Update user data from extracted entities
        if (Object.keys(entities).length > 0) {
            await updateUser({ phone: this.phone, ...entities });
            return this.checkRegistrationProgress();
        }

        // Prompt for missing fields dynamically
        return this.promptForMissingField(missingFields[0]);
    }

    async checkRegistrationProgress() {
        const updatedUser = await getUser(this.phone);
        const missingFields = this.getMissingRegistrationFields(updatedUser);

        if (missingFields.length === 0) {
            await updateUser({ phone: this.phone, isRegistered: true });
            return this.sendResponse(this.messages.PROFILE_CONFIRMATION);
        }

        return this.promptForMissingField(missingFields[0]);
    }

    getMissingRegistrationFields(user = this.user) {
        const requiredFields = ['firstName', 'lastName', 'nationalId', 'address'];
        return requiredFields.filter(field => !user[field]);
    }

    promptForMissingField(field) {
        const prompts = {
            firstName: "👤 Please provide your full name:",
            nationalId: "🆔 What's your national ID? (Format: XX-XXXXXXX-X-XX)",
            address: "📍 Share your address (text or location)"
        };

        return this.sendResponse(prompts[field]);
    }

    async handleServiceRequest(intent, entities) {
        // Use AI to route service requests (e.g., "I need a plumber")
        switch (intent) {
            case 'REQUEST_SERVICE':
                return this.sendResponse("🔧 What service do you need?");
            default:
                return this.sendResponse(this.messages.CLIENT_MAIN_MENU);
        }
    }

    sendResponse(message) {
        return this.res.status(StatusCodes.OK).send(message);
    }
}

module.exports = DynamicClient;