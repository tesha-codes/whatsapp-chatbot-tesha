// modules/dynamic-chat.js
const { StatusCodes } = require("http-status-codes");
const { setSession } = require("../utils/redis");
const { updateUser } = require("../controllers/user.controllers");

class DynamicClient {
    constructor(res, userResponse, session, user, steps, messages) {
        this.res = res;
        this.userResponse = userResponse;
        this.session = session;
        this.user = user;
        this.steps = steps;
        this.messages = messages;
        this.phone = userResponse.sender.phone;
    }

    async mainEntry() {
        try {
            if (this.session.step === this.steps.COLLECT_USER_FULL_NAME) {
                return this.handleFullName();
            }
            if (this.session.step === this.steps.COLLECT_USER_ID) {
                return this.handleNationalID();
            }
            if (this.session.step === this.steps.COLLECT_USER_ADDRESS) {
                return this.handleAddress();
            }
            if (this.session.step === this.steps.COLLECT_USER_LOCATION) {
                return this.handleLocation();
            }
            return this.handleMainMenu();
        } catch (error) {
            console.error("DynamicClient Error:", error);
            return this.sendResponse(this.messages.ERROR_GENERIC);
        }
    }

    async handleFullName() {
        const name = this.userResponse.payload.text;
        if (!this.isValidName(name)) {
            return this.sendResponse("❌ Please enter both first and last names\nExample: John Doe");
        }

        const [firstName, lastName] = name.split(/\s+(.*)/);
        await updateUser({ phone: this.phone, firstName, lastName });
        await this.updateSession(this.steps.COLLECT_USER_ID);

        return this.sendResponse(this.messages.GET_NATIONAL_ID);
    }

    async handleNationalID() {
        const nationalId = this.userResponse.payload.text;
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
            address: { physicalAddress: this.userResponse.payload.text }
        });
        await this.updateSession(this.steps.COLLECT_USER_LOCATION);

        return this.sendResponse(this.messages.GET_LOCATION);
    }

    async handleLocation() {
        const location = this.userResponse.payload.location
            ? [this.userResponse.payload.location.latitude,
            this.userResponse.payload.location.longitude]
            : null;

        await updateUser({
            phone: this.phone,
            address: { coordinates: location }
        });

        await this.updateSession(this.steps.DEFAULT_CLIENT_STATE);
        return this.sendResponse(this.messages.PROFILE_CONFIRMATION);
    }

    async handleMainMenu() {
        return this.sendResponse(this.messages.CLIENT_MAIN_MENU);
    }

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