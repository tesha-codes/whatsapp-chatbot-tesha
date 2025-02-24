const openai = require("../../config/openai");
const tools = require("./tools"); 
const ChatHistoryManager = require("../../utils/chatHistory");


class ClientChatHandler {
    constructor(phone, userId) {
        this.phone = phone;
        this.userId = userId;
    }

    async processMessage(message) {
        try {
            // Retrieve previous conversation history for context.
            const chatHistory = await ChatHistoryManager.get(this.phone);
            console.log("chatHistory", chatHistory);

            // Build the message history with a system prompt tailored for clients.
            const messages = [
                {
                    role: "system",
                    content: `You are ChatBuddy, a dedicated WhatsApp assistant helping clients book home services on the Tesha platform. Your tasks are:
1. Helping users select a service (options: cleaning, handyman, childcare, moving)
2. Requesting their service location (clients can share their location via WhatsApp)
3. Displaying a list of nearby service providers
4. Confirming the booking via the create_service_request tool

Keep your tone friendly and clear. Use one or two emojis per response to engage the user. Ask clarifying questions if needed, and always end with a proactive question such as "What else can I help you with?" Do not discuss unrelated topics.`
                },
                ...chatHistory,
                { role: "user", content: message }
            ];

            // Request a completion from OpenAI with tool support.
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages,
                tools,
                tool_choice: "auto",
            });

            const response = completion.choices[0].message;
            let responseText = response.content || "";
            const toolCalls = response.tool_calls || [];
            const toolResults = [];

            // Process any tool calls that the AI has requested.
            if (toolCalls.length > 0) {
                const processingPromises = toolCalls.map(async (toolCall) => {
                    try {
                        const result = await this.handleToolCall(toolCall);
                        toolResults.push(result);

                        // Add the tool result to the conversation history.
                        messages.push({
                            role: "tool",
                            content: JSON.stringify(result),
                            tool_call_id: toolCall.id,
                        });

                        return result;
                    } catch (error) {
                        console.error(`Tool call ${toolCall.id} failed:`, error);
                        return {
                            error: error.message,
                            tool: toolCall.function.name,
                        };
                    }
                });

                await Promise.all(processingPromises);
            }

            // If any tools were called, format their results into the response.
            if (toolResults.length > 0) {
                responseText = this.formatToolResults(toolResults);
            }

            // Update the conversation history with the new exchange.
            await ChatHistoryManager.append(this.phone, message, responseText);
            return responseText;
        } catch (error) {
            console.error("Error processing message:", error);
            return (
                "🚫 I apologize, but I encountered a technical issue while processing your request. " +
                "Please try again later. If the problem persists, contact support."
            );
        }
    }

    async handleToolCall(toolCall) {
        const { name, arguments: args } = toolCall.function;
        let params;
        try {
            params = JSON.parse(args);
            try {
                this.validateToolCall(name, params);
            } catch (validationError) {
                return {
                    type: "VALIDATION_ERROR",
                    error: validationError.message,
                    tool: name,
                };
            }
        } catch (error) {
            throw new Error(`Invalid parameters for ${name}: ${error.message}`);
        }

        try {
            switch (name) {
                case "create_service_request":
                    // Call the function to create a booking request.
                    const { createServiceRequest } = require("../../controllers/request.controller");
                    const booking = await createServiceRequest({ userId: this.userId, ...params });
                    return { type: "BOOKING_CREATED", data: booking };

                case "view_booking_requests":
                    // Call the function to retrieve booking requests.
                    const { getBookings } = require("../../controllers/request.controller");
                    const bookings = await getBookings(this.userId, params.status);
                    return { type: "BOOKING_LIST", data: bookings };

                case "update_client_profile":
                    const { updateUser } = require("../../controllers/user.controllers");
                    await updateUser({ _id: this.userId }, { [params.field]: params.value });
                    return { type: "PROFILE_UPDATE", data: { field: params.field, value: params.value } };

                case "delete_client_account":
                    const { deleteUser } = require("../../controllers/user.controllers");
                    if (params.confirmation) {
                        await deleteUser(this.userId);
                        return { type: "ACCOUNT_DELETED", data: { reason: params.reason } };
                    }
                    return { type: "DELETE_CONFIRMATION_NEEDED", data: { reason: params.reason } };

                default:
                    throw new Error(`Unsupported tool: ${name}`);
            }
        } catch (error) {
            console.error(`Tool execution error (${name}):`, error);
            throw new Error(`Service unavailable for ${name}`);
        }
    }

    validateToolCall(name, params) {
        // Example validations for client tool calls.
        if (name === "update_client_profile") {
            if (params.field === "address" && params.value.length < 10) {
                throw new Error("Address must be at least 10 characters long.");
            }
        }
        if (name === "delete_client_account") {
            if (params.reason && params.reason.length < 10) {
                throw new Error("Deletion reason must be at least 10 characters long.");
            }
        }
    }

    formatToolResults(results) {
        return results
            .map((result) => {
                if (result.error) return `❌ ${result.error}`;
                try {
                    return this.formatResponseFromTemplate(result);
                } catch (formatError) {
                    console.error("Response formatting failed:", formatError);
                    return "⚠️ An error occurred while formatting the response.";
                }
            })
            .join("\n\n");
    }

    formatResponseFromTemplate(result) {
        switch (result.type) {
            case "BOOKING_CREATED":
                return `🎉 Your booking is confirmed! Details: ${JSON.stringify(result.data)}`;
            case "BOOKING_LIST":
                return `Here are your bookings: ${JSON.stringify(result.data)}`;
            case "PROFILE_UPDATE":
                return `✅ Your profile has been updated: ${result.data.field} is now ${result.data.value}.`;
            case "ACCOUNT_DELETED":
                return `Your account has been deleted successfully. Reason: ${result.data.reason}`;
            case "DELETE_CONFIRMATION_NEEDED":
                return `⚠️ Please confirm deletion by replying "CONFIRM DELETE". Reason provided: ${result.data.reason}`;
            case "VALIDATION_ERROR":
                return `⚠️ Validation Error: ${result.error}`;
            default:
                return "I've completed your request. Is there anything else I can help with?";
        }
    }
}

module.exports = ClientChatHandler;
