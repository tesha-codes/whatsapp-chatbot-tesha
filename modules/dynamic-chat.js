// modules/dynamic-chat.js
const { StatusCodes } = require("http-status-codes");
const { setSession, getSession } = require("../utils/redis");
const { createUser, updateUser, getUser } = require("../controllers/user.controllers");
const OpenAI = require("openai");
const mongoose = require("mongoose");
const ServiceRequest = require("../models/request.model");
const crypto = require("node:crypto");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class EnhancedAIManager {
    constructor() {
        this.stateTransitions = {
            registration: ['fullName', 'nationalId', 'address', 'location'],
            booking: ['serviceType', 'location', 'provider', 'time', 'confirmation']
        };
    }

    async processMessage(userInput, session, user) {
        const history = session.aiHistory || [];
        history.push({ role: "user", content: userInput });

        const systemPrompt = this.createSystemPrompt(session, user);
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [systemPrompt, ...history.slice(-3)]
        });

        const aiMessage = response.choices[0].message.content;
        return this.handleAIResponse(aiMessage, session);
    }

    createSystemPrompt(session, user) {
        let prompt = `User Context:\n- Registration: ${user ? 'Complete' : 'Pending'}\n`;
        prompt += `- Current Step: ${session.step || 'Initial'}\n`;
        prompt += "Available Services: Cleaning, Plumbing, Electrical, Tutoring\n";
        prompt += "Response Guidelines:\n- Use natural conversation\n- Maintain session state\n- Request missing information\n";

        if (session.step === 'COLLECT_USER_LOCATION') {
            prompt += "USER MAY SHARE:\n- Live location (lat/long)\n- Text address\n";
        }

        return { role: "system", content: prompt };
    }

    handleAIResponse(aiMessage, session) {
        const response = { text: aiMessage, sessionUpdates: {} };

        // Handle registration steps
        if (aiMessage.includes("REQUEST_FULL_NAME")) {
            response.sessionUpdates.step = 'COLLECT_USER_FULL_NAME';
        }

        if (aiMessage.includes("REQUEST_LOCATION")) {
            response.sessionUpdates.step = 'COLLECT_USER_LOCATION';
            response.quickReplies = ['Share Location', 'Type Address'];
        }

        // Maintain session history
        response.sessionUpdates.aiHistory = [
            ...(session.aiHistory || []),
            { role: "assistant", content: aiMessage }
        ];

        return response;
    }

    static extractLocation(payload) {
        if (payload.location) {
            return {
                coordinates: [payload.location.latitude, payload.location.longitude],
                address: payload.address || "Shared Location"
            };
        }
        return { address: payload.text };
    }
}

class DynamicClient {
    constructor(res, userResponse, session, user, steps, messages) {
        this.res = res;
        this.userResponse = userResponse;
        this.session = session;
        this.user = user;
        this.steps = steps;
        this.messages = messages;
        this.aiManager = new EnhancedAIManager();
        this.phone = userResponse.sender.phone;
    }

    async mainEntry() {
        try {
            if (!this.user) return this.handleNewUser();
            if (!this.session.step) this.session.step = this.steps.DEFAULT_CLIENT_STATE;

            // Handle registration flow
            if (!this.user.registered) return this.handleRegistration();

            // Process AI conversation
            const aiResponse = await this.aiManager.processMessage(
                this.userResponse.payload.text,
                this.session,
                this.user
            );

            // Update session
            await this.updateSession(aiResponse.sessionUpdates);

            // Send response
            return this.sendResponse(aiResponse);

        } catch (error) {
            console.error("DynamicClient Error:", error);
            return this.res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(
                "😕 Oops! Something went wrong. Please try again later."
            );
        }
    }

    async handleRegistration() {
        // Handle full name collection specifically
        if (this.session.step === this.steps.COLLECT_USER_FULL_NAME) {
            if (!this.validateName(this.userResponse.payload.text)) {
                return this.res.status(StatusCodes.OK).send(
                    "❌ Invalid name format. Please enter both first and last names"
                );
            }

            const [firstName, ...lastNames] = this.userResponse.payload.text.split(' ');
            await updateUser({
                phone: this.phone,
                firstName,
                lastName: lastNames.join(' '),
            });

            // Progress to national ID collection
            this.session.step = this.steps.COLLECT_USER_ID;
            await setSession(this.phone, this.session);

            return this.res.status(StatusCodes.OK).send(this.messages.GET_NATIONAL_ID);
        }

        // Existing general registration check
        const requiredFields = ['firstName', 'nationalId', 'address'];
        const missingField = requiredFields.find(f => !this.user[f]);

        if (missingField) {
            const stepMap = {
                firstName: this.steps.COLLECT_USER_FULL_NAME,
                nationalId: this.steps.COLLECT_USER_ID,
                address: this.steps.COLLECT_USER_ADDRESS
            };

            this.session.step = stepMap[missingField];
            await setSession(this.phone, this.session);

            return this.res.status(StatusCodes.OK).send(
                this.getRegistrationPrompt(missingField)
            );
        }

        await updateUser({ phone: this.phone, registered: true });
        return this.res.status(StatusCodes.OK).send(
            "✅ Registration complete! How can I assist you today?"
        );
    }

    validateName(name) {
        return name.trim().split(' ').length >= 2;
    }

    getRegistrationPrompt(field) {
        const prompts = {
            firstName: "Please enter your full name:",
            nationalId: "Enter your national ID (format: XX-XXXXXXX-X-XX):",
            address: "Share your location or type your address:"
        };
        return prompts[field];
    }

    async updateSession(updates) {
        this.session = { ...this.session, ...updates };
        await setSession(this.phone, this.session);
    }

    sendResponse(aiResponse) {
        const response = {
            text: aiResponse.text,
            quickReplies: aiResponse.quickReplies
        };

        return this.res.status(StatusCodes.OK).send(response);
    }

    async handleNewUser() {
        try {
            const newUser = await createUser({
                phone: this.phone,
                username: this.userResponse.sender.name
            });

            this.user = newUser;
            this.session.step = this.steps.SETUP_CLIENT_PROFILE;
            await setSession(this.phone, this.session);

            return this.res.status(StatusCodes.OK).send(
                "👋 Welcome! Let's set up your profile. Please start with your full name:"
            );
        } catch (error) {
            console.error("User Creation Error:", error);
            return this.res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(
                "⚠️ Error creating user profile. Please try again."
            );
        }
    }
}

module.exports = DynamicClient;
