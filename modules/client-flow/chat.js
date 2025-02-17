const openai = require('../../config/openai');
const { StatusCodes } = require('http-status-codes');
const ClientTools = require('./tools');
const { createServiceRequest, getBookings } = require('../../controllers/request.controller');
const { updateUser, deleteUser, getUser } = require('../../controllers/user.controllers');
const ChatHistoryManager = require('../../utils/chatHistory');
const CHAT_TEMPLATES = require('./chatFlows');

class ClientChatHandler {
    constructor(phone, userId) {
        this.phone = phone;
        this.userId = userId;
        this.bookingState = null;
    }

    async processMessage(message) {
        try {
            const chatHistory = await ChatHistoryManager.get(this.phone);
            const messages = this.buildMessageHistory(chatHistory, message);

            const completion = await this.createOpenAICompletion(messages);
            const response = completion.choices[0].message;

            return await this.processResponse(response, messages, message);

        } catch (error) {
            console.error('Chat processing error:', error);
            return CHAT_TEMPLATES.ERROR_GENERIC;
        }
    }

    buildMessageHistory(chatHistory, message) {
        return [
            {
                role: 'system',
                content: `You are a client service assistant. Help users:
        1. Book home services
        2. Manage bookings
        3. Update profiles
        4. Delete accounts
        Current booking state: ${this.bookingState ? JSON.stringify(this.bookingState) : 'none'}`
            },
            ...chatHistory,
            { role: 'user', content: message }
        ];
    }

    async createOpenAICompletion(messages) {
        return await openai.chat.completions.create({
            model: 'gpt-4-turbo',
            messages,
            tools: ClientTools,
            tool_choice: 'auto',
        });
    }

    async processResponse(response, messages, originalMessage) {
        let responseText = response.content || '';
        const toolCalls = response.tool_calls || [];
        const toolResults = [];

        if (toolCalls.length > 0) {
            await this.processToolCalls(toolCalls, messages, toolResults);
        }

        if (toolResults.length > 0) {
            responseText = this.formatToolResults(toolResults);
        }

        await ChatHistoryManager.append(this.phone, originalMessage, responseText);
        return responseText;
    }

    async processToolCalls(toolCalls, messages, toolResults) {
        await Promise.all(toolCalls.map(async (toolCall) => {
            try {
                const result = await this.handleToolCall(toolCall);
                toolResults.push(result);
                messages.push(this.createToolMessage(toolCall, result));
            } catch (error) {
                console.error('Tool call failed:', error);
                toolResults.push({ error: error.message });
            }
        }));
    }

    createToolMessage(toolCall, result) {
        return {
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id
        };
    }

    async handleToolCall(toolCall) {
        const { name, arguments: args } = toolCall.function;
        const params = JSON.parse(args);

        switch (name) {
            case 'create_service_request':
                return this.handleServiceRequest(params);
            case 'view_booking_requests':
                return this.handleViewBookings(params);
            case 'update_client_profile':
                return this.handleProfileUpdate(params);
            case 'delete_client_account':
                return this.handleAccountDeletion(params);
            default:
                throw new Error(`Unsupported tool: ${name}`);
        }
    }

    async handleServiceRequest(params) {
        // Multi-step booking flow implementation
        if (!this.bookingState) {
            return this.initiateBookingFlow(params);
        }

        switch (this.bookingState.step) {
            case 'service_type':
                return this.processServiceType(params);
            case 'service_details':
                return this.processServiceDetails(params);
            case 'location':
                return this.processLocation(params);
            case 'confirmation':
                return this.processConfirmation(params);
            default:
                throw new Error('Invalid booking state');
        }
    }

    initiateBookingFlow(params) {
        this.bookingState = { step: 'service_type' };
        return {
            type: 'SERVICE_TYPE_REQUEST',
            data: CHAT_TEMPLATES.SERVICE_TYPE_PROMPT
        };
    }

    async processServiceType(params) {
        if (!params.service_type) {
            throw new Error('No service type provided');
        }

        this.bookingState.serviceType = params.service_type;
        this.bookingState.step = 'service_details';

        return {
            type: 'SERVICE_DETAILS_REQUEST',
            data: CHAT_TEMPLATES.SERVICE_DETAILS_PROMPT(params.service_type)
        };
    }

    async processServiceDetails(params) {
        if (!params.description || params.description.length < 20) {
            throw new Error('Service description too short');
        }

        this.bookingState.details = params.description;
        this.bookingState.step = 'location';

        return {
            type: 'LOCATION_REQUEST',
            data: CHAT_TEMPLATES.LOCATION_PROMPT(await getUser(this.userId))
        };
    }

    async processLocation(params) {
        if (!params.coordinates || !params.address) {
            throw new Error('Invalid location data');
        }

        this.bookingState.location = params;
        this.bookingState.step = 'confirmation';

        return {
            type: 'CONFIRMATION_REQUEST',
            data: CHAT_TEMPLATES.BOOKING_CONFIRMATION(this.bookingState)
        };
    }

    async processConfirmation(params) {
        if (!params.confirmation) {
            this.bookingState = null;
            return { type: 'BOOKING_CANCELLED', data: CHAT_TEMPLATES.BOOKING_CANCELLED };
        }

        const booking = await createServiceRequest({
            userId: this.userId,
            ...this.bookingState
        });

        this.bookingState = null;
        return {
            type: 'BOOKING_CREATED',
            data: CHAT_TEMPLATES.BOOKING_CONFIRMED(booking)
        };
    }

    async handleViewBookings(params) {
        const bookings = await getBookings(this.userId, params.status);
        return {
            type: 'BOOKING_LIST',
            data: bookings
        };
    }

    async handleProfileUpdate(params) {
        await updateUser(
            { _id: this.userId },
            { [params.field]: params.value }
        );

        return {
            type: 'PROFILE_UPDATE',
            data: { field: params.field, value: params.value }
        };
    }

    async handleAccountDeletion(params) {
        if (!params.confirmation) {
            return {
                type: 'DELETE_CONFIRMATION_NEEDED',
                data: CHAT_TEMPLATES.DELETE_CONFIRMATION
            };
        }

        await deleteUser(this.userId);
        return { type: 'ACCOUNT_DELETED' };
    }

    formatToolResults(results) {
        return results.map(result => {
            if (result.error) return `❌ Error: ${result.error}`;

            switch (result.type) {
                case 'BOOKING_LIST':
                    return CHAT_TEMPLATES.BOOKING_LIST(result.data);
                case 'PROFILE_UPDATE':
                    return CHAT_TEMPLATES.PROFILE_UPDATE_SUCCESS(result.data.field, result.data.value);
                case 'BOOKING_CREATED':
                    return result.data;
                case 'CONFIRMATION_REQUEST':
                case 'LOCATION_REQUEST':
                case 'SERVICE_DETAILS_REQUEST':
                case 'SERVICE_TYPE_REQUEST':
                    return result.data;
                case 'ACCOUNT_DELETED':
                    return CHAT_TEMPLATES.ACCOUNT_DELETED;
                default:
                    return '✅ Request processed successfully';
            }
        }).join('\n\n');
    }
}

module.exports = ClientChatHandler;