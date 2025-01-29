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
const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class AIConversationManager {
    constructor() {
        this.state = 'start';
        this.context = {};
        this.serviceList = [
            'plumber', 'electrician', 'cleaner', 'tutor',
            'hairdresser', 'personal trainer', 'gardener',
            'painter', 'carpenter', 'technician'
        ];
    }

    async processMessage(userInput, currentStep) {
        userInput = typeof userInput === 'string' ? userInput.trim().toLowerCase() : userInput;

        if (this.isExitCommand(userInput)) {
            return this.resetConversation();
        }

        const intent = await this.interpretUserIntent(userInput, currentStep);
        if (intent.includes('exit') || intent.includes('cancel')) {
            return this.resetConversation();
        }

        return this.handleStateMachine(userInput, intent);
    }

    isExitCommand(input) {
        return ['exit', 'quit', 'stop', 'cancel'].includes(input);
    }

    async handleStateMachine(userInput, intent) {
        switch (this.state) {
            case 'start': return this.handleStart(userInput);
            case 'location': return this.handleLocationCapture(userInput);
            case 'providers': return this.handleProviderSelection(userInput);
            case 'time': return this.handleTimeSelection(userInput);
            case 'confirm': return this.handleConfirmation(userInput, intent);
            case 'feedback': return this.handleFeedback(userInput);
            default: return this.provideHelp();
        }
    }

    resetConversation() {
        this.state = 'start';
        this.context = {};
        return {
            response: "🗑️ Booking cancelled. What service would you like?",
            state: this.state
        };
    }

    provideHelp() {
        return {
            response: "🆘 How can I assist you? You can:\n- Book a service\n- Edit profile\n- Check bookings",
            state: this.state
        };
    }

    async handleStart(userInput) {
        const serviceType = await this.detectServiceIntent(userInput);
        if (!serviceType) {
            return {
                response: "🔧 Available services:\n" +
                    this.serviceList.map((s, i) => `${i + 1}. ${s}`).join('\n') +
                    "\n\nWhich service do you need?",
                state: this.state
            };
        }

        this.context.service = serviceType;
        this.state = 'location';
        return {
            response: `📌 Great choice with ${serviceType}!\n📍 Share location (live/send address)\n` +
                "⏩ Type 'skip' to continue without location",
            state: this.state
        };
    }

    async handleLocationCapture(userInput) {
        if (userInput === 'skip') {
            this.context.location = { type: 'skipped' };
            return this.proceedToProviders();
        }

        const geoLocation = this.extractGeoLocation(userInput);
        if (geoLocation) {
            this.context.location = {
                type: 'coordinates',
                data: geoLocation,
                address: await this.reverseGeocode(geoLocation)
            };
            return this.proceedToProviders();
        }

        const address = this.extractAddress(userInput);
        if (address) {
            this.context.location = { type: 'address', data: address };
            return this.proceedToProviders();
        }

        return {
            response: "📍 Please share location or type address\n📌 Example: '123 Main St' or send live location",
            state: this.state
        };
    }

    extractGeoLocation(input) {
        if (input.latitude && input.longitude) {
            return { lat: input.latitude, lng: input.longitude };
        }
        const match = String(input).match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
        return match ? { lat: match[1], lng: match[2] } : null;
    }

    extractAddress(input) {
        const patterns = [
            /(?:my address is|i'm at|located at|location:?)\s*(.+)/i,
            /^(\d+\s+[\w\s]+,\s*[\w\s]+)$/i
        ];
        for (const pattern of patterns) {
            const match = String(input).match(pattern);
            if (match) return match[1].trim();
        }
        return null;
    }

    async reverseGeocode(coords) {
        // Implement actual reverse geocoding service here
        return "Approximate location";
    }

    async proceedToProviders() {
        this.state = 'providers';
        this.context.providers = await this.generateProviders();

        return {
            response: `👷 Available ${this.context.service} professionals:\n\n` +
                this.formatProviderList() +
                "\n\n🔢 Reply with provider number\n🔄 Type 'back' to change service",
            state: this.state
        };
    }

    async generateProviders() {
        const count = Math.floor(Math.random() * 3) + 2;
        return Array.from({ length: count },async (_, i) => ({
            id: `P${i + 1}`,
            name: this.generateName(),
            specialty: await this.generateSpecialty(),
            rate: `$${Math.floor(Math.random() * 50) + 30}/hr`,
            rating: (4 + Math.random()).toFixed(1),
            distance: `${(Math.random() * 15).toFixed(1)} km`,
            phone: `+1-555-${Math.floor(1000 + Math.random() * 9000)}`
        }));
    }

    formatProviderList() {
        return this.context.providers.map(p =>
            `${p.id} ➡️ ${p.name}\n` +
            `⭐ ${p.rating} | 💰 ${p.rate} | 📏 ${p.distance}\n` +
            `🔧 ${p.specialty}`
        ).join('\n\n');
    }

    async handleProviderSelection(input) {
        if (input === 'back') {
            this.state = 'start';
            return { response: "🔄 Let's start over. What service do you need?", state: this.state };
        }

        const provider = this.context.providers.find(p => p.id === input.toUpperCase());
        if (!provider) return { response: "❌ Invalid provider ID. Please try again.", state: this.state };

        this.context.selectedProvider = provider;
        this.state = 'time';
        this.context.timeSlots = this.generateTimeSlots();

        return {
            response: `⏰ Available time slots:\n\n` +
                this.context.timeSlots.map((t, i) => `${i + 1}. ${t}`).join('\n') +
                "\n\n🔢 Choose slot number\n🔄 Type 'back' to choose different provider",
            state: this.state
        };
    }

    generateTimeSlots() {
        const base = ['9:00 AM', '10:30 AM', '1:00 PM', '3:30 PM', '5:00 PM'];
        return base.filter(() => Math.random() > 0.3);
    }

    async handleTimeSelection(input) {
        if (input === 'back') {
            this.state = 'providers';
            return { response: "👷 Available providers:\n\n" + this.formatProviderList(), state: this.state };
        }

        const slotIndex = parseInt(input) - 1;
        if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= this.context.timeSlots.length) {
            return { response: "❌ Invalid time slot. Please choose from the list.", state: this.state };
        }

        this.context.selectedTime = this.context.timeSlots[slotIndex];
        this.state = 'confirm';

        return {
            response: `📝 Confirm booking:\n\n` +
                `🧑🔧 Provider: ${this.context.selectedProvider.name}\n` +
                `⏰ Time: ${this.context.selectedTime}\n` +
                `📍 Location: ${this.formatLocation()}\n\n` +
                "✅ Confirm with 'yes'\n❌ Cancel with 'no'",
            state: this.state
        };
    }

    formatLocation() {
        if (!this.context.location) return "Not specified";
        if (this.context.location.type === 'skipped') return "Not provided";
        return this.context.location.address || this.context.location.data;
    }

    async handleConfirmation(input, intent) {
        if (intent.includes('no')) {
            return this.resetConversation();
        }

        if (intent.includes('yes')) {
            this.state = 'feedback';
            return {
                response: "🎉 Booking confirmed!\n\n" +
                    `📞 Contact: ${this.context.selectedProvider.phone}\n` +
                    "📅 We'll send reminders before your appointment\n\n" +
                    "🌟 How was your booking experience? (Great/Good/Okay/Poor)",
                state: this.state
            };
        }

        return { response: "❓ Please confirm with 'yes' or cancel with 'no'", state: this.state };
    }

    async handleFeedback(input) {
        this.context.feedback = input.toLowerCase();
        this.state = 'start';
        return {
            response: "📝 Thanks for your feedback!\n\n" +
                "You can now:\n1. Book another service\n2. Edit profile\n3. View bookings",
            state: this.state
        };
    }

    async detectServiceIntent(input) {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "system",
                    content: `Identify service from: ${this.serviceList.join(', ')}. Respond ONLY with the service name or 'unknown'.`
                }, {
                    role: "user",
                    content: input
                }],
                temperature: 0.3,
                max_tokens: 15
            });

            const service = response.choices[0].message.content.trim().toLowerCase();
            return this.serviceList.includes(service) ? service : null;
        } catch (error) {
            console.error("Service detection error:", error);
            return null;
        }
    }

    async interpretUserIntent(input, state) {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "system",
                    content: `Determine user intent. Current state: ${state}. Possible actions: confirm, cancel, change, back. Respond ONLY with the action.`
                }, {
                    role: "user",
                    content: input
                }],
                temperature: 0.2,
                max_tokens: 10
            });

            return response.choices[0].message.content.trim().toLowerCase();
        } catch (error) {
            console.error("Intent error:", error);
            return 'unknown';
        }
    }
}

const aiManager = new AIConversationManager();

class Client {
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
        this.phone = this.userResponse.sender.phone;
        this.message = this.userResponse.payload?.text || "";
        this.locationData = this.userResponse.payload?.location;
    }

    async mainEntry() {
        if (!this.user.profileComplete) {
            return this.handleProfileSetup();
        }

        if (this.locationData) {
            return this.handleLocationPayload();
        }

        if (!this.session.step || this.session.step === this.steps.DEFAULT_CLIENT_STATE) {
            return this.showMainMenu();
        }

        return this.handleAIConversation();
    }

    async handleAIConversation() {
        try {
            const result = await aiManager.processMessage(this.message || this.locationData, this.session.step);
            await this.updateSession(result.state);

            if (result.state === 'feedback') {
                await this.createServiceRequest();
            }

            return this.res.status(StatusCodes.OK).send(result.response);
        } catch (error) {
            console.error("Conversation error:", error);
            return this.sendError("Conversation processing failed");
        }
    }

    async updateSession(newState) {
        await setSession(this.phone, {
            step: newState,
            context: JSON.stringify(aiManager.context),
            lActivity: new Date().toISOString()
        });
    }

    async createServiceRequest() {
        const requestData = {
            _id: new mongoose.Types.ObjectId(),
            requester: this.user._id,
            service: aiManager.context.service,
            provider: aiManager.context.selectedProvider,
            time: aiManager.context.selectedTime,
            location: aiManager.context.location,
            status: 'pending'
        };

        await ServiceRequest.create(requestData);
        // Add notification logic here
    }

    async handleProfileSetup() {
        // Add profile setup logic here
    }

    async handleLocationPayload() {
        await updateUser({
            phone: this.phone,
            address: {
                coordinates: {
                    lat: this.locationData.latitude,
                    lng: this.locationData.longitude
                },
                physicalAddress: await this.reverseGeocode(this.locationData)
            }
        });

        await this.updateSession(this.steps.SELECT_SERVICE);
        return this.res.status(StatusCodes.OK).send("📍 Location saved! Choose a service:");
    }

    async showMainMenu() {
        await clientMainMenuTemplate(this.phone, this.user.firstName);
        await this.updateSession(this.steps.MAIN_MENU);

        const menu = "🏠 Main Menu\n\n" +
            "1️⃣ Book Service\n" +
            "2️⃣ My Bookings\n" +
            "3️⃣ Edit Profile\n" +
            "4️⃣ Help\n\n" +
            "Reply with the menu number";

        return this.res.status(StatusCodes.OK).send(menu);
    }

    sendError(message) {
        return this.res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(`❌ Error: ${message}`);
    }
    // Implement using Google Maps or other service
    async reverseGeocode(location) {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?` +
            `latlng=${location.lat},${location.lng}&key=${process.env.GOOGLE_MAPS_KEY}`
        );
        const data = await response.json();
        return data.results[0]?.formatted_address || 'Unknown location';
    }
}

module.exports = Client;