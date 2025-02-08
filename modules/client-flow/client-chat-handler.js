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
        this.currentStep = "askServiceType";
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

            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages,
                tools: this.getAvailableTools(),
                tool_choice: "auto",
            });

            const response = completion.choices[0].message;
            const toolCalls = response.tool_calls || [];

            if (toolCalls.length > 0) {
                const results = await Promise.all(
                    toolCalls.map(call => this.executeToolCall(call, message))
                );
                return this.formatResults(results);
            }

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
                    console.error(`Unknown tool called: ${name}`);
                    return {
                        type: "ERROR",
                        data: "Sorry, I encountered an error. Please try again."
                    };
            }
        } catch (error) {
            console.error(`Tool execution error (${name}):`, error);
            return { error: error.message };
        }
    }

    async askServiceType() {
        this.currentStep = "askServiceType";
        const services = await mongoose.model('Service').find({}).select('type description');

        return {
            type: "ASK_SERVICE_TYPE",
            data: "What type of service do you need? Available services:\n" +
                services.map(s => `• ${s.type}: ${s.description}`).join('\n')
        };
    }

    async askLocationPreference() {
        this.currentStep = "askLocationPreference";
        const savedLocation = await this.accountManager.getSavedLocation(this.userId);
        if (savedLocation) {
            return {
                type: "ASK_LOCATION_PREFERENCE",
                data: `Would you like to use your saved location?\n📍 ${savedLocation.physicalAddress}\n\nType **YES** to use this location or **NO** to provide a new one.`
            };
        }
        return {
            type: "ASK_NEW_LOCATION",
            data: "Where is the service needed? Please provide the full address (e.g., 123 Main St, City, Country) or share your live location."
        };
    }

    async handleLocationSelection(params) {
        try {
            let location;
            if (params.useSavedLocation) {
                const user = await mongoose.model('User').findById(this.userId);
                if (!user?.address?.coordinates) {
                    throw new Error("No saved location found");
                }
                location = {
                    address: user.address.physicalAddress,
                    coordinates: [
                        parseFloat(user.address.coordinates.longitude),
                        parseFloat(user.address.coordinates.latitude)
                    ],
                    city: user.address.city || "Unknown"
                };
            } else {
                if (!params.newAddress && !params.liveLocation) {
                    throw new Error("Please provide a valid address or share your live location.");
                }

                // Handle live location from WhatsApp
                if (params.liveLocation) {
                    const { latitude, longitude } = params.liveLocation;
                    try {
                        location = await geocodeAddress(`${latitude},${longitude}`);
                        if (!location || !location.address) {
                            throw new Error("Geocoding returned no address");
                        }
                    } catch (err) {
                        console.error("Geocoding live location failed, using coordinates fallback", err);
                        location = {
                            address: `Coordinates: ${latitude}, ${longitude}`,
                            coordinates: [parseFloat(longitude), parseFloat(latitude)],
                            city: "Unknown"
                        };
                    }
                } else {
                    // Handle a new address provided as text
                    try {
                        location = await geocodeAddress(params.newAddress);
                        if (!location || !location.address) {
                            throw new Error("Geocoding returned no address");
                        }
                    } catch (err) {
                        console.error("Geocoding address failed, using raw address as fallback", err);
                        location = {
                            address: params.newAddress,
                            coordinates: [], // Coordinates unavailable
                            city: "Unknown"
                        };
                    }
                }
            }

            // Final fallback if location is missing an address
            if (!location || !location.address) {
                if (params.liveLocation) {
                    const { latitude, longitude } = params.liveLocation;
                    location = {
                        address: `Coordinates: ${latitude}, ${longitude}`,
                        coordinates: [parseFloat(longitude), parseFloat(latitude)],
                        city: "Unknown"
                    };
                } else if (params.newAddress) {
                    location = {
                        address: params.newAddress,
                        coordinates: [],
                        city: "Unknown"
                    };
                }
            }

            this.bookingContext.location = location;

            // Find nearby providers using the available coordinates
            const providers = await this.serviceManager.findNearbyProviders(
                location.coordinates,
                this.bookingContext.serviceType
            );

            if (providers.length === 0) {
                return {
                    type: "ERROR",
                    data: "Sorry, no service providers are available in your area at the moment."
                };
            }

            this.bookingContext.providers = providers;
            this.currentStep = "selectProvider";

            return {
                type: "PROVIDER_LIST",
                data: {
                    providers: providers.map((p, i) => ({
                        number: i + 1,
                        name: `${p.firstName} ${p.lastName}`,
                        rating: p.rating
                    }))
                }
            };
        } catch (error) {
            console.error("Location selection error:", error);
            return {
                type: "ERROR",
                data: error.message
            };
        }
    }

    async askDateTime() {
        this.currentStep = "askDateTime";
        return {
            type: "ASK_DATE_TIME",
            data: "When do you need the service? (e.g., today, tomorrow, 2025-07-15) and what time? (e.g., 10 AM, 2 PM)"
        };
    }

    async selectProvider(providerNumber) {
        if (!this.bookingContext.providers) {
            throw new Error("No providers available");
        }

        const provider = this.bookingContext.providers[providerNumber - 1];
        if (!provider) {
            throw new Error("Invalid provider selection");
        }

        const providerDetails = await this.serviceManager.getProviderDetails(provider._id);
        this.bookingContext.selectedProvider = provider._id;
        this.currentStep = "confirmBooking";

        return {
            type: "PROVIDER_CONFIRMATION",
            data: {
                name: `${providerDetails.firstName} ${providerDetails.lastName}`,
                rating: providerDetails.rating,
                bio: providerDetails.bio,
                completedJobs: providerDetails.completedJobs
            }
        };
    }

    async confirmBooking(params) {
        try {
            const booking = await this.serviceManager.createBooking({
                serviceType: params.serviceType,
                date: params.date,
                time: params.time,
                location: this.bookingContext.location,
                providerId: this.bookingContext.selectedProvider,
                notes: params.notes
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
        } catch (error) {
            console.error("Booking confirmation error:", error);
            return {
                type: "ERROR",
                data: "Failed to confirm booking. Please try again."
            };
        }
    }

    getAvailableTools() {
        return [
            {
                type: "function",
                function: {
                    name: "askServiceType",
                    description: "Ask the user what type of service they need",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "askLocationPreference",
                    description: "Ask if the user wants to use their saved location",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "handleLocationSelection",
                    description: "Handle location selection and provider matching",
                    parameters: {
                        type: "object",
                        properties: {
                            useSavedLocation: { type: "boolean" },
                            newAddress: { type: "string" },
                            liveLocation: {
                                type: "object",
                                properties: {
                                    latitude: { type: "string" },
                                    longitude: { type: "string" }
                                }
                            }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "askDateTime",
                    description: "Ask for the preferred date and time",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "selectProvider",
                    description: "Handle provider selection from list",
                    parameters: {
                        type: "object",
                        properties: {
                            providerNumber: { type: "number" }
                        },
                        required: ["providerNumber"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "confirmBooking",
                    description: "Confirm the booking with all details",
                    parameters: {
                        type: "object",
                        properties: {
                            serviceType: { type: "string" },
                            date: { type: "string" },
                            time: { type: "string" },
                            notes: { type: "string" }
                        },
                        required: ["serviceType", "date", "time"]
                    }
                }
            }
        ];
    }

    formatResults(results) {
        return results.map(result => {
            if (result.error) return `⚠️ Error: ${result.error}`;

            switch (result.type) {
                case "ASK_SERVICE_TYPE":
                    return result.data;

                case "ASK_LOCATION_PREFERENCE":
                case "ASK_NEW_LOCATION":
                case "ASK_DATE_TIME":
                    return result.data;

                case "PROVIDER_LIST":
                    return "Available service providers:\n" +
                        result.data.providers.map(p =>
                            `${p.number}. ${p.name} (Rating: ${p.rating}⭐)`
                        ).join('\n') +
                        "\n\nPlease select a provider by typing their number.";

                case "PROVIDER_CONFIRMATION":
                    return `✅ Selected provider: ${result.data.name}\n` +
                        `Rating: ${result.data.rating}⭐\n` +
                        `Completed Jobs: ${result.data.completedJobs}\n` +
                        `Bio: ${result.data.bio}\n\n` +
                        `Type CONFIRM to book or CANCEL to choose another.`;

                case "BOOKING_CONFIRMED":
                    return `🎉 Booking confirmed!\n` +
                        `• Booking ID: ${result.data.id}\n` +
                        `• Service: ${result.data.serviceType}\n` +
                        `• Date: ${result.data.date}\n` +
                        `• Time: ${result.data.time}\n` +
                        `• Location: ${result.data.location}\n` +
                        `• Provider: ${result.data.provider}\n\n` +
                        `You'll receive a confirmation SMS with details.`;

                case "ERROR":
                    return `⚠️ ${result.data}`;

                default:
                    return JSON.stringify(result.data);
            }
        }).join('\n\n');
    }
}

module.exports = ClientChatHandler;
