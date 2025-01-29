const { StatusCodes } = require("http-status-codes");
const { setSession } = require("../utils/redis");
const { createUser, updateUser, getUser } = require("../controllers/user.controllers");
const OpenAI = require("openai");
const mongoose = require("mongoose");
const ServiceRequest = require("../models/request.model");
const crypto = require("node:crypto");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class AIConversationManager {
    constructor() {
        this.context = {};
        this.stateMap = {
            registration: ['collect_name', 'collect_id', 'collect_address'],
            booking: ['service_type', 'location', 'provider', 'time', 'confirmation']
        };
    }

    async processInput(userInput, userSession) {
        const conversationHistory = userSession.history || [];
        conversationHistory.push({ role: "user", content: userInput });

        const systemPrompt = this.createSystemPrompt(userSession);
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [systemPrompt, ...conversationHistory.slice(-4)]
        });

        const aiResponse = response.choices[0].message.content;
        return this.handleResponseLogic(aiResponse, userSession);
    }

    createSystemPrompt(session) {
        let prompt = `You're a booking assistant. Current context:\n`;
        prompt += `- Registration stage: ${session.registrationState || 'complete'}\n`;
        prompt += `- Booking progress: ${session.bookingState || 'not_started'}\n`;
        prompt += "Handle user request appropriately. Use quick replies for key actions.\n";

        if (session.bookingState === 'location') {
            prompt += "USER MAY SHARE LOCATION VIA:\n";
            prompt += "1. Live location (lat/long)\n2. Text address\n";
            prompt += "Extract and validate location data first!";
        }

        return { role: "system", content: prompt };
    }

    handleResponseLogic(aiResponse, session) {
        const responseObj = { text: aiResponse, actions: [] };

        if (session.registrationState) {
            const nextState = this.stateMap.registration.find(s => !session[s]);
            if (nextState) responseObj.actions.push({ type: 'update_session', key: nextState });
        }

        if (aiResponse.includes("LOCATION_REQUIRED")) {
            responseObj.actions.push({ type: 'request_location' });
            responseObj.text = "Please share your location or type your address:";
        }

        if (aiResponse.includes("SERVICE_OPTIONS")) {
            responseObj.actions.push({ type: 'quick_reply', options: ["Plumber", "Electrician", "Cleaner"] });
        }

        return responseObj;
    }

    extractLocation(payload) {
        if (payload.location) {
            return {
                coordinates: `${payload.location.latitude},${payload.location.longitude}`,
                address: payload.address || "Shared location"
            };
        }
        return { address: payload.text };
    }
}

class Client {
    constructor(userResponse) {
        this.phone = userResponse.sender.phone;
        this.payload = userResponse.payload;
        this.session = {};
        this.aiManager = new AIConversationManager();
    }

    async handleMessage() {
        await this.loadSession();

        if (!this.session.registered) {
            return this.handleRegistration();
        }

        const aiResponse = await this.aiManager.processInput(this.payload.text, this.session);
        await this.handleAiActions(aiResponse.actions);

        await this.updateSession();
        return this.createOutput(aiResponse.text);
    }

    async handleRegistration() {
        const requiredFields = ['fullName', 'nationalId', 'address'];
        const currentField = requiredFields.find(f => !this.user[f]);

        if (currentField) {
            this.session.registrationState = currentField;
            return this.promptRegistrationField(currentField);
        }

        this.session.registered = true;
        return "Registration complete! How can I help you today?";
    }

    promptRegistrationField(field) {
        const prompts = {
            fullName: "Please enter your full name:",
            nationalId: "Enter your national ID (format: XX-XXXXXXX-X-XX):",
            address: "Share your location or type your address:"
        };
        return prompts[field];
    }

    async handleAiActions(actions) {
        for (const action of actions) {
            switch (action.type) {
                case 'request_location':
                    await this.requestLocation();
                    break;
                case 'update_session':
                    this.session[action.key] = true;
                    break;
            }
        }
    }

    async requestLocation() {
        // Integration with WhatsApp location request API
        this.session.awaitingLocation = true;
    }

    async createOutput(text) {
        return {
            status: StatusCodes.OK,
            response: text,
            session: this.session
        };
    }
}

module.exports = Client;