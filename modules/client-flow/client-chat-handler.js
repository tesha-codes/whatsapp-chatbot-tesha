const openai = require("../../config/openai");
const ServiceManager = require("./services");
const AccountManager = require("../service-provider/account");
const ChatHistoryManager = require("../../utils/chatHistory");
const CHAT_TEMPLATES = require("./chat-templates");
const { geocodeAddress } = require("../../utils/geocoding");
const mongoose = require('mongoose');

class ClientChatHandler {
    constructor(phone, userId) {
        this.phone = phone;
        this.userId = userId;
        this.serviceManager = new ServiceManager(userId);
        this.accountManager = new AccountManager(userId);
        this.bookingContext = {}; // Tracks booking details during the conversation
        this.currentStep = "askServiceType"; // Tracks the current step in the conversation
    }

    async processMessage(message) {
        try {
            const chatHistory = await ChatHistoryManager.get(this.phone);
            const messages = [
                {
                    role: "system",
                    content: `You are Tesha, a friendly WhatsApp assistant for booking home services. Your core functions are:
1. Help clients book services (cleaning, repairs, maintenance, etc.)
2. View and manage their bookings
3. Handle profile updates and account management

Key behaviors:
- Ask one question at a time and wait for the user's response.
- Extract booking details (service type, date, time, location) from free-form messages.
- Ask if the user wants to use their saved location or provide a new one.
- Validate locations globally using geocoding.
- Confirm the booking summary before proceeding.
- Handle corrections gracefully if the user changes their mind.
- Use natural, conversational language with 1-2 emojis per message.`
                },
                ...chatHistory,
                { role: "user", content: message }
            ];

            // Use OpenAI Functions to extract details and handle the conversation
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages,
                tools: this.getAvailableTools(),
                tool_choice: "auto",
            });

            const response = completion.choices[0].message;
            const toolCalls = response.tool_calls || [];

            if (toolCalls.length > 0) {
                const results = await Promise.all(toolCalls.map(call => this.executeToolCall(call, message)));
                return this.formatResults(results);
            }

            // If no tool calls, return the assistant's response
            await ChatHistoryManager.append(this.phone, message, response.content);
            return response.content;
        } catch (error) {
            console.error("Chat processing error:", error);
            return CHAT_TEMPLATES.ERROR_MESSAGE;
        }
    }

    async executeToolCall(toolCall, message) {
        const { name, arguments: args } = toolCall.function;
        const params = JSON.parse(args);

        try {
            switch (name) {
                case "askServiceType":
                    return this.askServiceType();

                case "askLocationPreference":
                    return this.askLocationPreference();

                case "handleLocationSelection":
                    return this.handleLocationSelection(params);

                case "askDateTime":
                    return this.askDateTime();

                case "selectProvider":
                    return this.selectProvider(params.providerNumber);

                case "confirmBooking":
                    return this.confirmBooking(params);

                default:
                    throw new Error(`Unsupported tool: ${name}`);
            }
        } catch (error) {
            console.error(`Tool execution error (${name}):`, error);
            return { error: error.message };
        }
    }

    async askServiceType() {
        this.currentStep = "askServiceType";
        return {
            type: "ASK_SERVICE_TYPE",
            data: "What type of service do you need? (e.g., cleaning, repairs, maintenance)"
        };
    }

    async askLocationPreference() {
        this.currentStep = "askLocationPreference";
        const savedLocation = await this.accountManager.getSavedLocation(this.userId);
        if (savedLocation) {
            return {
                type: "ASK_LOCATION_PREFERENCE",
                data: `Would you like to use your saved location?\n📍 ${savedLocation.address}\n\nType **YES** to use this location or **NO** to provide a new one.`
            };
        }
        return {
            type: "ASK_NEW_LOCATION",
            data: "Where is the service needed? Please provide the full address (e.g., 123 Main St, City, Country)."
        };
    }

    async handleLocationSelection(params) {
        let location;
        if (params.useSavedLocation) {
            const user = await mongoose.model('User').findById(this.userId);
            if (!user?.address?.coordinates) throw new Error("No saved location found");
            location = {
                address: user.address.physicalAddress,
                coordinates: [
                    parseFloat(user.address.coordinates.longitude), // Convert to number
                    parseFloat(user.address.coordinates.latitude)  // Convert to number
                ],
                city: user.address.city
            };
        } else {
            if (!params.newAddress) throw new Error("Please provide a valid address.");
            location = await geocodeAddress(params.newAddress);
        }

        this.bookingContext.location = location;
        this.currentStep = "askDateTime";
        return {
            type: "ASK_DATE_TIME",
            data: "When do you need the service? (e.g., today, tomorrow, 2025-07-15) and what time? (e.g., 10 AM, 2 PM)"
        };
    }

    async askDateTime() {
        this.currentStep = "askDateTime";
        return {
            type: "ASK_DATE_TIME",
            data: "When do you need the service? (e.g., today, tomorrow, 2025-07-15) and what time? (e.g., 10 AM, 2 PM)"
        };
    }

    async selectProvider(providerNumber) {
        if (!this.bookingContext.providers) throw new Error("No providers loaded");
        const provider = this.bookingContext.providers[providerNumber - 1];
        if (!provider) throw new Error("Invalid selection");

        this.bookingContext.selectedProvider = provider._id;
        this.currentStep = "confirmBooking";
        return {
            type: "PROVIDER_CONFIRMATION",
            data: {
                name: `${provider.firstName} ${provider.lastName}`,
                rating: provider.rating,
                bio: provider.bio
            }
        };
    }

    async confirmBooking(params) {
        const { serviceType, date, time, location, providerId } = params;
        const booking = await this.serviceManager.createBooking({
            serviceType,
            date,
            time,
            location,
            providerId
        });

        this.currentStep = "completed";
        return {
            type: "BOOKING_CONFIRMED",
            data: {
                id: booking.id,
                serviceType: booking.service.type,
                date: booking.date,
                time: booking.time,
                location: booking.address.physicalAddress,
                provider: `${booking.serviceProviders[0].firstName} ${booking.serviceProviders[0].lastName}`
            }
        };
    }

    formatResults(results) {
        return results.map(result => {
            if (result.error) return `⚠️ Error: ${result.error}`;

            switch (result.type) {
                case "ASK_SERVICE_TYPE":
                    return `What type of service do you need? (e.g., cleaning, repairs, maintenance)`;

                case "ASK_LOCATION_PREFERENCE":
                    return result.data;

                case "ASK_NEW_LOCATION":
                    return result.data;

                case "ASK_DATE_TIME":
                    return result.data;

                case "PROVIDER_CONFIRMATION":
                    return `✅ Selected provider: ${result.data.name}\n` +
                        `Rating: ${result.data.rating}\n` +
                        `Bio: ${result.data.bio}\n\n` +
                        `Type CONFIRM to book or CANCEL to choose another.`;

                case "BOOKING_CONFIRMED":
                    return `🎉 Booking confirmed!\n` +
                        `• Service: ${result.data.serviceType}\n` +
                        `• Date: ${result.data.date}\n` +
                        `• Time: ${result.data.time}\n` +
                        `• Location: ${result.data.location}\n` +
                        `• Provider: ${result.data.provider}\n\n` +
                        `You'll receive a confirmation SMS with details.`;

                default:
                    return JSON.stringify(result.data);
            }
        }).join('\n\n');
    }
}

module.exports = ClientChatHandler;