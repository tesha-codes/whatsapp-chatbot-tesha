const openai = require('../../config/openai');
const { StatusCodes } = require('http-status-codes');
const ClientTools = require('./tools');
const { createServiceRequest, getBookings } = require('../../controllers/request.controller');
const { updateUser, deleteUser } = require('../../controllers/user.controllers');
const ChatHistoryManager = require('../../utils/chatHistory');
const CHAT_TEMPLATES = require('./chatFlows');

class ClientChatHandler {
    constructor(phone, userId, session) {
        this.phone = phone;
        this.userId = userId;
        this.session = session;
        this.openai = openai;
        this.tools = ClientTools;
        this.bookingFlowSteps = {
            INIT: 0,
            SERVICE_TYPE: 1,
            SERVICE_DETAILS: 2,
            LOCATION: 3,
            CONFIRMATION: 4
        };
    }

    async processMessage(message) {
        try {
            const chatHistory = await ChatHistoryManager.get(this.phone);
            const messages = [
                {
                    role: 'system',
                    content: `You are Tesha, a friendly WhatsApp assistant helping clients book home services. 
          Current session step: ${this.session.step || 'main_menu'}. 
          User ID: ${this.userId}. Follow these rules:
          
          1. Guide users through booking process: Service Type → Details → Location → Confirmation
          2. Handle profile updates and booking inquiries
          3. Use emojis sparingly for better readability
          4. Never discuss pricing/payments directly - redirect to billing portal
          5. Maintain professional yet approachable tone`
                },
                ...chatHistory,
                { role: 'user', content: message }
            ];

            const runner = this.openai.beta.chat.completions.runTools({
                model: 'gpt-4-turbo',
                messages,
                tools: this.tools,
                tool_choice: 'auto'
            });

            let finalResponse = '';
            const toolResults = [];

            for await (const event of runner) {
                switch (event.event) {
                    case 'toolCall':
                        const toolCall = event.data;
                        try {
                            const result = await this.handleToolCall(toolCall);
                            toolResults.push(result);
                            messages.push({
                                role: 'tool',
                                content: JSON.stringify(result),
                                tool_call_id: toolCall.id
                            });
                        } catch (error) {
                            console.error('Tool call failed:', error);
                            toolResults.push({ error: error.message });
                        }
                        break;

                    case 'message':
                        finalResponse = event.data.content;
                        break;

                    case 'error':
                        throw event.data;
                }
            }

            await ChatHistoryManager.append(this.phone, message, finalResponse);

            return toolResults.length > 0
                ? this.formatToolResults(toolResults)
                : finalResponse || CHAT_TEMPLATES.ERROR_MESSAGE;

        } catch (error) {
            console.error('Chat processing error:', error);
            return CHAT_TEMPLATES.ERROR_MESSAGE;
        }
    }

    async handleToolCall(toolCall) {
        const { name, arguments: args } = toolCall.function;
        const params = JSON.parse(args);

        switch (name) {
            case 'create_service_request':
                return this.handleServiceBooking(params);

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

    async handleServiceBooking(params) {
        // Multi-step booking flow handling
        if (!this.session.bookingState) {
            this.session.bookingState = {
                step: this.bookingFlowSteps.INIT,
                serviceType: null,
                details: null,
                location: null
            };
        }

        const currentStep = this.session.bookingState.step;

        switch (currentStep) {
            case this.bookingFlowSteps.INIT:
                return this.initiateBookingFlow(params);

            case this.bookingFlowSteps.SERVICE_TYPE:
                return this.handleServiceType(params);

            case this.bookingFlowSteps.SERVICE_DETAILS:
                return this.handleServiceDetails(params);

            case this.bookingFlowSteps.LOCATION:
                return this.handleLocation(params);

            case this.bookingFlowSteps.CONFIRMATION:
                return this.handleConfirmation(params);

            default:
                throw new Error('Invalid booking flow state');
        }
    }

    async initiateBookingFlow(params) {
        if (!params.service_type) {
            return {
                type: 'SERVICE_TYPE_REQUEST',
                data: CHAT_TEMPLATES.SERVICE_TYPE_PROMPT
            };
        }

        this.session.bookingState.serviceType = params.service_type;
        this.session.bookingState.step = this.bookingFlowSteps.SERVICE_DETAILS;

        return {
            type: 'SERVICE_DETAILS_REQUEST',
            data: CHAT_TEMPLATES.SERVICE_DETAILS_PROMPT(params.service_type)
        };
    }

    async handleServiceType(params) {
        // Validation and transition logic
        const validServices = ['maid', 'handyman', 'plumbing', 'electrical'];
        if (!validServices.includes(params.service_type.toLowerCase())) {
            throw new Error('Invalid service type selected');
        }

        this.session.bookingState.serviceType = params.service_type;
        this.session.bookingState.step = this.bookingFlowSteps.SERVICE_DETAILS;

        return {
            type: 'SERVICE_DETAILS_REQUEST',
            data: CHAT_TEMPLATES.SERVICE_DETAILS_PROMPT(params.service_type)
        };
    }

    async handleServiceDetails(params) {
        // Validate service details
        if (!params.description || params.description.length < 20) {
            throw new Error('Description must be at least 20 characters');
        }

        this.session.bookingState.details = params.description;
        this.session.bookingState.step = this.bookingFlowSteps.LOCATION;

        return {
            type: 'LOCATION_REQUEST',
            data: CHAT_TEMPLATES.LOCATION_PROMPT
        };
    }

    async handleLocation(params) {
        // Validate location data
        if (!params.coordinates || !params.address) {
            throw new Error('Invalid location data provided');
        }

        this.session.bookingState.location = {
            coordinates: params.coordinates,
            address: params.address
        };
        this.session.bookingState.step = this.bookingFlowSteps.CONFIRMATION;

        return {
            type: 'CONFIRMATION_REQUEST',
            data: CHAT_TEMPLATES.BOOKING_CONFIRMATION(this.session.bookingState)
        };
    }

    async handleConfirmation(params) {
        if (!params.confirmation) {
            this.session.bookingState = null;
            return { type: 'BOOKING_CANCELLED', data: CHAT_TEMPLATES.BOOKING_CANCELLED };
        }

        const booking = await createServiceRequest({
            userId: this.userId,
            serviceType: this.session.bookingState.serviceType,
            description: this.session.bookingState.details,
            location: this.session.bookingState.location
        });

        this.session.bookingState = null;

        return {
            type: 'BOOKING_CREATED',
            data: CHAT_TEMPLATES.BOOKING_CONFIRMED(booking)
        };
    }

    formatToolResults(results) {
        return results.map(result => {
            if (result.error) return `❌ Error: ${result.error}`;

            switch (result.type) {
                case 'BOOKING_CREATED':
                    return result.data;

                case 'SERVICE_TYPE_REQUEST':
                case 'SERVICE_DETAILS_REQUEST':
                case 'LOCATION_REQUEST':
                case 'CONFIRMATION_REQUEST':
                    return result.data;

                case 'BOOKING_LIST':
                    return CHAT_TEMPLATES.BOOKING_LIST(result.data);

                case 'PROFILE_UPDATE':
                    return CHAT_TEMPLATES.PROFILE_UPDATED(result.data);

                default:
                    return '✅ Request processed successfully';
            }
        }).join('\n\n');
    }
}

module.exports = ClientChatHandler;