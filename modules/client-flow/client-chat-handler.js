const openai = require("../../config/openai");
const ServiceManager = require("./services");
const AccountManager = require("../service-provider/account");
const ChatHistoryManager = require("../../utils/chatHistory");
const CHAT_TEMPLATES = require("./chat-templates");

class ClientChatHandler {
    constructor(phone, userId) {
        this.phone = phone;
        this.userId = userId;
        this.serviceManager = new ServiceManager(userId);
        this.accountManager = new AccountManager(userId);
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
- Always confirm booking details before proceeding
- Use clear, simple language with 1-2 emojis per message
- Break down booking process into simple steps
- If unsure about details, ask for clarification
- For technical issues, direct to support@tesha.co.zw`
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

            const response = await this.handleResponse(completion.choices[0].message);
            await ChatHistoryManager.append(this.phone, message, response);
            return response;
        } catch (error) {
            console.error("Chat processing error:", error);
            return CHAT_TEMPLATES.ERROR_MESSAGE;
        }
    }

    getAvailableTools() {
        return [
            {
                name: "book_service",
                description: "Book a new service",
                parameters: {
                    type: "object",
                    properties: {
                        serviceType: {
                            type: "string",
                            enum: ["cleaning", "repairs", "maintenance", "gardening", "painting"]
                        },
                        date: { type: "string", format: "date" },
                        time: { type: "string" },
                        location: { type: "string" },
                        notes: { type: "string" }
                    },
                    required: ["serviceType", "date", "time", "location"]
                }
            },
            {
                name: "view_bookings",
                description: "View booking history",
                parameters: {
                    type: "object",
                    properties: {
                        status: {
                            type: "string",
                            enum: ["all", "pending", "confirmed", "completed"]
                        }
                    }
                }
            },
            {
                name: "view_profile",
                description: "View client profile",
                parameters: {
                    type: "object",
                    properties: {}
                }
            },
            {
                name: "update_profile",
                description: "Update client profile",
                parameters: {
                    type: "object",
                    properties: {
                        field: {
                            type: "string",
                            enum: ["name", "phone", "email", "address", "city"]
                        },
                        value: { type: "string" }
                    },
                    required: ["field", "value"]
                }
            },
            {
                name: "delete_account",
                description: "Delete client account",
                parameters: {
                    type: "object",
                    properties: {
                        reason: { type: "string" },
                        confirmation: { type: "boolean" }
                    },
                    required: ["confirmation"]
                }
            }
        ];
    }

    async handleResponse(response) {
        let finalResponse = response.content || "";
        const toolCalls = response.tool_calls || [];

        if (toolCalls.length > 0) {
            const results = await Promise.all(toolCalls.map(call => this.executeToolCall(call)));
            finalResponse = this.formatResults(results);
        }

        return finalResponse;
    }

    async executeToolCall(toolCall) {
        const { name, arguments: args } = toolCall.function;
        const params = JSON.parse(args);

        try {
            switch (name) {
                case "book_service": {
                    const booking = await this.serviceManager.createBooking(params);
                    return {
                        type: "BOOKING_CONFIRMATION",
                        data: booking
                    };
                }

                case "view_bookings": {
                    const bookings = await this.serviceManager.getBookings(params.status);
                    return {
                        type: "BOOKING_LIST",
                        data: bookings
                    };
                }

                case "view_profile": {
                    const profile = await this.accountManager.getProfile();
                    return {
                        type: "CLIENT_PROFILE",
                        data: profile
                    };
                }

                case "update_profile": {
                    const updated = await this.accountManager.updateProfile(
                        params.field,
                        params.value
                    );
                    return {
                        type: "PROFILE_UPDATED",
                        data: updated
                    };
                }

                case "delete_account": {
                    if (!params.confirmation) {
                        return {
                            type: "DELETE_CONFIRMATION",
                            data: {
                                pendingBookings: await this.serviceManager.getPendingBookingsCount()
                            }
                        };
                    }
                    await this.accountManager.deleteAccount(params.reason);
                    return {
                        type: "ACCOUNT_DELETED",
                        data: { reason: params.reason }
                    };
                }

                default:
                    throw new Error(`Unsupported tool: ${name}`);
            }
        } catch (error) {
            console.error(`Tool execution error (${name}):`, error);
            return {
                type: "ERROR",
                error: error.message
            };
        }
    }

    formatResults(results) {
        return results.map(result => {
            if (result.error) {
                return CHAT_TEMPLATES.ERROR_MESSAGE;
            }
            return CHAT_TEMPLATES[result.type](result.data);
        }).join("\n\n");
    }
}

module.exports = ClientChatHandler;