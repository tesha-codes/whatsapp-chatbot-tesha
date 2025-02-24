const openai = require('../../config/openai');
const { StatusCodes } = require('http-status-codes');
const ClientTools = require('./tools');
const { createServiceRequest, getBookings } = require('../../controllers/request.controller');
const { updateUser, deleteUser, getUser } = require('../../controllers/user.controllers');
const ChatHistoryManager = require('../../utils/chatHistory');
const CHAT_TEMPLATES = require('./chatFlows');
const { getServiceProviders } = require("./methods")

class ClientChatHandler {
    constructor(phone, userId) {
        this.phone = phone;
        this.userId = userId;
        this.bookingState = null;
    }

    async processMessage(message) {
        if (!this.bookingState) {
            return this.initiateBookingFlow();
        }

        switch (this.bookingState.step) {
            case 'service_type':
                return this.processServiceType(message);
            case 'location':
                return this.processLocation(message);
            case 'confirmation':
                return this.processConfirmation(message);
            default:
                this.bookingState = null;
                return "I'm sorry, something went wrong. Please start over.";
        }
    }

    buildMessageHistory(message) {
        return [
            {
                role: 'system',
                content: `You are ChatBuddy, a friendly WhatsApp assistant helping clients book home services. Your role is to guide users step-by-step through the booking process with clarity and warmth. 

Please follow these guidelines:
1. Greet the client warmly and use simple language.
2. Ask for the type of service (e.g. cleaning, handyman, childcare, moving).
3. Request location details, which can be provided as either an address or an object with "latitude" and "longitude".
4. Present a list of nearby service providers based on the location provided.
5. Confirm the booking when the client replies with a clear confirmation (e.g., "yes").

Include one or two friendly emojis in your messages to enhance engagement.`
            },
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

    initiateBookingFlow() {
        this.bookingState = { step: 'service_type' };
        return "👋 Hi there! What type of service do you need? (Options: cleaning, handyman, childcare, moving)";
    }

    async processServiceType(message) {
        const serviceType = message.trim().toLowerCase();
        const validTypes = ['cleaning', 'handyman', 'childcare', 'moving'];

        if (!validTypes.includes(serviceType)) {
            return `Hmm, I didn't quite get that. Please choose a service from: ${validTypes.join(', ')}`;
        }

        this.bookingState.serviceType = serviceType;
        this.bookingState.step = 'location';
        return "Great! Now, please send your service location";
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

    async processLocation(message) {
        let location;
        try {
            location = JSON.parse(message);
        } catch (err) {
            return "Oops! The JSON format seems off. Please try again using valid JSON.";
        }

        if (location.latitude !== undefined && location.longitude !== undefined) {
           
            this.bookingState.location = {
                coordinates: { lat: location.latitude, lng: location.longitude },
                address: location.address || "Address not provided"
            };
        } else if (location.address) {
            return "To find nearby providers, please include your coordinates (latitude and longitude) along with your address.";
        } else {
            return "Please provide your location details with either an address or latitude and longitude.";
        }


        const providers = await getServiceProviders(this.bookingState.location.coordinates);
        if (!providers || providers.length === 0) {
            this.bookingState = null; 
            return "Sorry, we couldn't find any service providers near your location. 😕";
        }
        this.bookingState.providers = providers;
        this.bookingState.step = 'confirmation';

        const providerList = providers
            .map((p, i) => `${i + 1}. ${p.name} (${p.distance} km away)`)
            .join('\n');

        return `Here are some service providers near you:\n\n${providerList}\n\n` +
            "Would you like to confirm your booking? Please reply with 'yes' to confirm or 'no' to cancel. 👍";
    }

    async selectServiceProvider(params) {
        
    }

   
    async processConfirmation(message) {
        const response = message.trim().toLowerCase();

        if (response === 'yes' || response === 'y') {
            const params = {
                service_type: this.bookingState.serviceType,
                description: `Booking request for ${this.bookingState.serviceType}`,
                coordinates: this.bookingState.location.coordinates,
                address: this.bookingState.location.address,
                confirmation: true
            };

            try {
                const booking = await createServiceRequest({ userId: this.userId, ...params });
                this.bookingState = null;
                return `🎉 Your booking is confirmed! Here are the details: ${JSON.stringify(booking)}`;
            } catch (err) {
                this.bookingState = null;
                return `Uh-oh, there was an error creating your booking: ${err.message}`;
            }
        } else {
            this.bookingState = null;
            return "Booking cancelled. Let us know if you need any other services. 🙂";
        }
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