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
            messages: [systemPrompt, ...history.slice(-3)],
            temperature: 0.7,
        });

        const aiMessage = response.choices[0].message.content;
        return this.handleAIResponse(aiMessage, session);
    }

    createSystemPrompt(session, user) {
        let prompt = `User Context:\n- Registration: ${user?.registered ? 'Complete' : 'Pending'}\n`;
        prompt += `- Current Step: ${session.step || 'Initial'}\n`;
        prompt += `- Name: ${user?.firstName || 'Not provided'}\n`;
        prompt += `- ID: ${user?.nationalId ? 'Provided' : 'Missing'}\n`;
        prompt += "Response Guidelines:\n- Use natural conversation\n- Maintain session state\n- Request missing information\n";

        if (session.step === 'COLLECT_USER_LOCATION') {
            prompt += "USER MAY SHARE:\n- Live location (lat/long)\n- Text address\n";
        }

        return { role: "system", content: prompt };
    }

    handleAIResponse(aiMessage, session) {
        const response = {
            text: aiMessage,
            sessionUpdates: {},
            quickReplies: []
        };

        if (aiMessage.includes("REQUEST_FULL_NAME")) {
            response.sessionUpdates.step = 'COLLECT_USER_FULL_NAME';
            response.quickReplies = [];
        }

        if (aiMessage.includes("REQUEST_LOCATION")) {
            response.sessionUpdates.step = 'COLLECT_USER_LOCATION';
            response.quickReplies = ['Share Location', 'Type Address'];
        }

        response.sessionUpdates.aiHistory = [
            ...(session.aiHistory || []),
            { role: "assistant", content: aiMessage }
        ];

        return response;
    }

    static validateNationalID(id) {
        const sanitizedID = id.trim().toUpperCase()
            .replace(/\s+/g, '')
            .replace(/–/g, '-');

        const pattern = /^(\d{2})-(\d{7})-([A-Z])-(\d{2})$/;

        if (!pattern.test(sanitizedID)) {
            return {
                valid: false,
                message: "⚠️ Invalid format. Should be: XX-XXXXXXX-X-XX\nExample: 63-1234567-X-89"
            };
        }

        const [_, prefix, numbers, checkDigit, suffix] = sanitizedID.match(pattern);

        if (prefix !== suffix) {
            return {
                valid: false,
                message: "❌ Prefix and suffix should match (e.g., 63-...-63)"
            };
        }

        if (!this.validateCheckDigit(numbers, checkDigit)) {
            return {
                valid: false,
                message: "❌ Invalid check digit. Please double-check"
            };
        }

        return { valid: true, formattedID: sanitizedID };
    }

    static validateCheckDigit(numbers, checkDigit) {
        const sum = numbers.split('').reduce((acc, num) => acc + parseInt(num), 0);
        return String.fromCharCode(65 + (sum % 26)) === checkDigit;
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
        this.session = session || {};
        this.user = user;
        this.steps = steps;
        this.messages = messages;
        this.aiManager = new EnhancedAIManager();
        this.phone = userResponse.sender.phone;
    }

    async mainEntry() {
        try {
            if (!this.user) return this.handleNewUser();

            if (!this.user.registered) {
                return this.handleRegistration();
            }

            const aiResponse = await this.aiManager.processMessage(
                this.userResponse.payload.text,
                this.session,
                this.user
            );

            await this.updateSession(aiResponse.sessionUpdates);
            return this.sendResponse(aiResponse);

        } catch (error) {
            console.error("DynamicClient Error:", error);
            return this.res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(
                "😕 Oops! Something went wrong. Please try again later."
            );
        }
    }

    async handleRegistration() {
        // Handle full name collection
        if (this.session.step === this.steps.COLLECT_USER_FULL_NAME) {
            if (!this.validateName(this.userResponse.payload.text)) {
                return this.res.status(StatusCodes.OK).send(
                    "❌ Please enter both first and last names\nExample: John Doe"
                );
            }

            const [firstName, ...lastNames] = this.userResponse.payload.text.split(' ');
            await updateUser({
                phone: this.phone,
                firstName,
                lastName: lastNames.join(' '),
            });

            this.session.step = this.steps.COLLECT_USER_ID;
            await setSession(this.phone, this.session);
            return this.res.status(StatusCodes.OK).send(this.getRegistrationPrompt('nationalId'));
        }

        // Handle national ID validation
        if (this.session.step === this.steps.COLLECT_USER_ID) {
            const validation = EnhancedAIManager.validateNationalID(
                this.userResponse.payload.text
            );

            if (!validation.valid) {
                return this.res.status(StatusCodes.OK).send(
                    `${validation.message}\n\n📋 Example Format: 63-1234567-X-89`
                );
            }

            await updateUser({
                phone: this.phone,
                nationalId: validation.formattedID
            });

            this.session.step = this.steps.COLLECT_USER_ADDRESS;
            await setSession(this.phone, this.session);
            return this.res.status(StatusCodes.OK).send(this.getRegistrationPrompt('address'));
        }

        // Handle address collection
        if (this.session.step === this.steps.COLLECT_USER_ADDRESS) {
            await updateUser({
                phone: this.phone,
                address: {
                    physicalAddress: this.userResponse.payload.text
                }
            });

            this.session.step = this.steps.COLLECT_USER_LOCATION;
            await setSession(this.phone, this.session);
            return this.res.status(StatusCodes.OK).send(
                "📍 Please share your current location using the location button"
            );
        }

        // Handle location collection
        if (this.session.step === this.steps.COLLECT_USER_LOCATION) {
            const location = EnhancedAIManager.extractLocation(this.userResponse.payload);
            await updateUser({
                phone: this.phone,
                address: {
                    ...this.user.address?.address,
                    coordinates: location.coordinates
                }
            });

            await updateUser({ phone: this.phone, registered: true });
            return this.res.status(StatusCodes.OK).send(
                "🎉 Registration complete! How can I assist you today?\n\n" +
                "1. Request Service\n2. Edit Profile"
            );
        }

        // Initial registration prompt
        return this.res.status(StatusCodes.OK).send(
            "👋 Let's complete your registration!\n" +
            this.getRegistrationPrompt('fullName')
        );
    }

    validateName(name) {
        return name.trim().split(' ').length >= 2;
    }

    getRegistrationPrompt(field) {
        const prompts = {
            fullName: "👤 Please enter your full name:\nExample: John Doe",
            nationalId: "🆔 National ID Format:\n\n" +
                "XX-XXXXXXX-X-XX\n" +
                "Example: 63-1234567-X-89\n\n" +
                "Enter your ID number:",
            address: "🏠 Please type your physical address:"
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
                "👋 Welcome to Tesha! Let's create your profile.\n\n" +
                this.getRegistrationPrompt('fullName')
            );
        } catch (error) {
            console.error("User Creation Error:", error);
            return this.res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(
                "⚠️ Error creating profile. Please try again."
            );
        }
    }
}

module.exports = DynamicClient;