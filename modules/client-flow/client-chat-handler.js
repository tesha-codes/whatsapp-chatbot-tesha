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
        this.bookingContext = {}; 
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

    getAvailableTools() {
        return [
            {
                type: "function",
                function: {
                    name: "handle_location_selection",
                    description: "Handle location selection and provider matching",
                    parameters: {
                        type: "object",
                        properties: {
                            useSavedLocation: { type: "boolean" },
                            newAddress: { type: "string" }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "select_provider",
                    description: "Handle provider selection from list",
                    parameters: {
                        type: "object",
                        properties: {
                            providerNumber: { type: "number" }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "confirm_booking",
                    description: "Confirm the booking with the user",
                    parameters: {
                        type: "object",
                        properties: {
                            serviceType: { type: "string" },
                            date: { type: "string" },
                            time: { type: "string" },
                            location: { type: "string" },
                            providerId: { type: "string" }
                        },
                        required: ["serviceType", "date", "time", "location", "providerId"]
                    }
                }
            }
        ];
    }

    async executeToolCall(toolCall, message) {
        const { name, arguments: args } = toolCall.function;
        const params = JSON.parse(args);

        try {
            switch (name) {
                case "handle_location_selection":
                    return this.handleLocationSelection(params);

                case "select_provider":
                    return this.handleProviderSelection(params.providerNumber);

                case "confirm_booking":
                    return this.handleBookingConfirmation(params);

                default:
                    throw new Error(`Unsupported tool: ${name}`);
            }
        } catch (error) {
            console.error(`Tool execution error (${name}):`, error);
            return { error: error.message };
        }
    }

    async handleLocationSelection(params) {
        let location;
        if (params.useSavedLocation) {
            const user = await mongoose.model('User').findById(this.userId);
            if (!user?.address?.coordinates) throw new Error("No saved location found");
            location = user.address;
        } else {
            if (!params.newAddress) throw new Error("Please provide a valid address.");
            location = await geocodeAddress(params.newAddress);
        }

        this.bookingContext.location = location;
        const providers = await this.serviceManager.findNearbyProviders(
            location.coordinates,
            this.bookingContext.serviceType
        );

        if (providers.length === 0) {
            return {
                type: "NO_PROVIDERS",
                data: "No available providers in your area. Try expanding search radius?"
            };
        }

        this.bookingContext.providers = providers;
        return {
            type: "PROVIDER_LIST",
            data: providers.map((p, i) => ({
                number: i + 1,
                name: `${p.firstName} ${p.lastName}`,
                rating: p.rating,
                jobsCompleted: p.completedJobs
            }))
        };
    }

    async handleProviderSelection(providerNumber) {
        if (!this.bookingContext.providers) throw new Error("No providers loaded");
        const provider = this.bookingContext.providers[providerNumber - 1];
        if (!provider) throw new Error("Invalid selection");

        this.bookingContext.selectedProvider = provider._id;
        return {
            type: "PROVIDER_CONFIRMATION",
            data: {
                name: `${provider.firstName} ${provider.lastName}`,
                rating: provider.rating,
                bio: provider.bio
            }
        };
    }

    async handleBookingConfirmation(params) {
        const { serviceType, date, time, location, providerId } = params;
        const booking = await this.serviceManager.createBooking({
            serviceType,
            date,
            time,
            location,
            providerId
        });

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
                case "PROVIDER_LIST":
                    return `Available providers near you:\n${result.data.map(p =>
                        `${p.number}. ${p.name} ⭐ ${p.rating} (${p.jobsCompleted} jobs)`
                    ).join('\n')}\n\nReply with the provider number to select.`;

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

                case "NO_PROVIDERS":
                    return `⚠️ ${result.data}`;

                default:
                    return JSON.stringify(result.data);
            }
        }).join('\n\n');
    }
}

module.exports = ClientChatHandler;