
// const openai = require('../config/openai');

// class AIConversationManager {
//     constructor() {
//         this.conversationHistory = [];
//         this.currentState = {
//             step: 'SELECT_SERVICE_CATEGORY',
//             selectedService: null,
//             serviceDetails: {}
//         };
//     }

//     async processMessage(message, currentStep) {
//         const serviceCategories = `
// 🏠 Household Services
// 1. Cleaning, Laundry, Home Organization, Handyman tasks, etc.

// 🌳 Yard & Outdoor Services
// 2. Lawn care, Gardening, Yard cleanup, Pool maintenance, etc.

// 🛍 Errands & Shopping
// 3. Grocery shopping, Dog walking, Household item pickups, etc.

// 🛠 Skilled Tasks
// 4. Plumbing, Electrical work, Painting, Carpentry, etc.

// 🚚 Moving & Hauling
// 5. Local moving, Junk removal, Donation pickups, etc.

// 🐾 Pet Care
// 6. Dog walking, Pet sitting, Pet grooming, etc.

// 👵 Senior Care
// 7. Companion care, Personal care, Transportation, etc.

// 🏡 Home Maintenance
// 8. HVAC maintenance, Pest control, Appliance repair, etc.
// `;

//         const systemInstructions = `
// You are a helpful assistant that assists users in finding the right service from the following categories:
// ${serviceCategories}

// Guidelines:
// - Extract service requests from messages in English, Shona, Ndebele, or mixed languages
// - Keep responses short, polite, and engaging
// - Guide the user through service selection and details
// - Aim to understand the specific service needs clearly
// - If the user provides an unclear request, help them narrow down their needs
// - Reference the service categories to help users select the right service
// `;

//         const userMessage = `
// Previous Conversation History:
// ${this.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

// Current User Message: "${message}"
// Current Conversation Step: ${currentStep}
// `;

//         try {
//             const queryResponse = await openai.chat.completions.create({
//                 messages: [
//                     { role: 'system', content: systemInstructions },
//                     { role: 'user', content: userMessage },
//                 ],
//                 model: 'gpt-4o',
//                 temperature: 0.7,
//                 max_tokens: 250,
//             });

//             const dynamicMessage = queryResponse.choices[0].message;

//             // Update conversation history
//             this.conversationHistory.push(
//                 { role: 'user', content: message },
//                 { role: 'assistant', content: dynamicMessage.content }
//             );

//             // Update conversation state
//             this.updateConversationState(message, dynamicMessage.content);

//             return {
//                 response: dynamicMessage.content,
//                 state: this.currentState
//             };
//         } catch (error) {
//             console.error('Error with OpenAI API:', error);
//             return {
//                 response: 'Sorry, something went wrong. Please try again later.',
//                 state: this.currentState
//             };
//         }
//     }

//     updateConversationState(userMessage, assistantResponse) {
//         const serviceCategories = [
//             'household services', 'yard services', 'errands',
//             'skilled tasks', 'moving', 'pet care', 'senior care',
//             'home maintenance'
//         ];

//         if (this.currentState.step === 'SELECT_SERVICE_CATEGORY') {
//             // Try to identify service category
//             const identifiedCategory = serviceCategories.find(category =>
//                 userMessage.toLowerCase().includes(category)
//             );

//             if (identifiedCategory) {
//                 this.currentState.selectedService = identifiedCategory;
//                 this.currentState.step = 'CONFIRM_SERVICE_CATEGORY';
//             }
//         } else if (this.currentState.step === 'CONFIRM_SERVICE_CATEGORY') {
//             // Confirm service category
//             if (['yes', 'confirm', 'correct'].some(word =>
//                 userMessage.toLowerCase().includes(word))) {
//                 this.currentState.step = 'GATHER_SERVICE_DETAILS';
//             }
//         } else if (this.currentState.step === 'GATHER_SERVICE_DETAILS') {
//             // Store detailed service information
//             this.currentState.serviceDetails = {
//                 description: userMessage,
//                 timestamp: new Date()
//             };
//             this.currentState.step = 'PREPARE_SERVICE_REQUEST';
//         }

//         return this.currentState;
//     }

//     reset() {
//         this.conversationHistory = [];
//         this.currentState = {
//             step: 'SELECT_SERVICE_CATEGORY',
//             selectedService: null,
//             serviceDetails: {}
//         };
//     }
// }

// module.exports = new AIConversationManager();

const openai = require('../config/openai');
const mongoose = require('mongoose');

class AIConversationManager {
    constructor() {
        this.conversationHistory = [];
        this.currentState = {
            step: 'INITIAL',
            previousStep: null,

            serviceCategory: null,
            serviceType: null,
            serviceDetails: {
                description: '',
                timing: null,
                specifics: {}
            },

            locationStatus: {
                confirmed: false,
                providedLocation: null,
                profileLocation: null,
                locationVerificationRequired: false
            },

            requestId: null,
            requestStatus: 'PENDING'
        }
    }

    /**
     * @param {Object} params - Message processing parameters
     * @param {string} params.message - User's message
     * @param {Object} params.user - User profile information
     * @param {string} params.currentStep - Current conversation step
     * @returns {Promise<Object>} AI response and updated state
     */
    async processMessage({
        message,
        user,
        currentStep
    }) {
        this.updateUserLocationContext(user);
        const systemInstructions = this.prepareSystemInstructions();

        try {
            const queryResponse = await this.generateAIResponse({
                systemInstructions,
                message
            });

            const assistantResponse = queryResponse.choices[0].message.content;
            this.updateConversationHistory(message, assistantResponse);
            this.updateConversationState(message, assistantResponse);

            return {
                response: assistantResponse,
                state: this.currentState
            };
        } catch (error) {
            console.error('AI Processing Error:', error);
            return this.handleErrorResponse(error);
        }
    }

    /**
     * @param {Object} user 
     */

    updateUserLocationContext(user) {
        if (user && user.address) {
            this.currentState.locationStatus.profileLocation = {
                physicalAddress: user.address.physicalAddress || null,
                coordinates: user.address.coordinates || null
            };
        }
    }

    /**
     * @returns {string} 
     */
    prepareSystemInstructions() {
        const serviceCategories = `
Service Categories:
🏠 Household: Cleaning, Laundry
🛠 Skilled: Plumbing, Electrical, Painting
🚚 Moving: Local moves, Junk removal
🐾 Pet Care: Walking, Sitting
👵 Senior Care: Companion, Transport
`;

        return `
Multilingual AI Assistant for Service Requests

Conversation Context:
- Current Step: ${this.currentState.step}
- Profile Location: ${JSON.stringify(this.currentState.locationStatus.profileLocation)}

Guidelines:
- Understand requests in English, Shona, Ndebele
- Extract precise service needs
- Ask clarifying questions
- Guide users systematically
- Be friendly and patient

${serviceCategories}
`;
    }

    /**
     * @param {Object} params 
     * @returns {Promise<Object>} AI response
     */
    async generateAIResponse({ systemInstructions, message }) {
        return await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemInstructions },
                ...this.getRecentConversationContext(),
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 300
        });
    }

    /** 
     * @returns {Array} 
     */
    getRecentConversationContext() {
        return this.conversationHistory.slice(-4);
    }

    /**
     * @param {string} userMessage - User's message
     * @param {string} assistantResponse - AI's response
     */
    updateConversationHistory(userMessage, assistantResponse) {
        this.conversationHistory.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: assistantResponse }
        );
    }

    /**
     * @param {string} userMessage - User's message
     * @param {string} assistantResponse - AI's response
     */
    updateConversationState(userMessage, assistantResponse) {
        const serviceKeywords = {
            'cleaning': ['clean', 'wash', 'cleaner'],
            'plumbing': ['pipe', 'water', 'toilet', 'leak'],
            'electrical': ['light', 'socket', 'wire'],
            'moving': ['move', 'transport', 'haul']
        };

        // Service category detection
        if (this.currentState.step === 'INITIAL') {
            const detectedService = Object.keys(serviceKeywords).find(service =>
                serviceKeywords[service].some(keyword =>
                    userMessage.toLowerCase().includes(keyword)
                )
            );

            if (detectedService) {
                this.currentState.serviceCategory = detectedService;
                this.currentState.step = 'SERVICE_DETAILS';
            }
        }

        // Service details gathering
        if (this.currentState.step === 'SERVICE_DETAILS') {
            this.currentState.serviceDetails.description = userMessage;
            this.currentState.step = 'LOCATION_VERIFICATION';
        }

        // Location verification
        if (this.currentState.step === 'LOCATION_VERIFICATION') {
            // Check if user confirms existing location
            if (['yes', 'confirm', 'correct'].some(word =>
                userMessage.toLowerCase().includes(word))) {
                this.currentState.locationStatus.confirmed = true;
                this.currentState.locationStatus.providedLocation =
                    this.currentState.locationStatus.profileLocation;
                this.currentState.step = 'PREPARE_REQUEST';
            }
            // Request to change location
            else if (['no', 'different', 'change'].some(word =>
                userMessage.toLowerCase().includes(word))) {
                this.currentState.locationStatus.locationVerificationRequired = true;
                this.currentState.step = 'REQUEST_NEW_LOCATION';
            }
        }

        // Prepare for service request
        if (this.currentState.step === 'PREPARE_REQUEST') {
            this.currentState.requestId = this.generateRequestId();
            this.currentState.requestStatus = 'READY';
        }

        return this.currentState;
    }

    /**
     * Generate unique request identifier
     * @returns {string} Unique request ID
     */
    generateRequestId() {
        return `REQ${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }

    /**
     * Handle error responses
     * @param {Error} error - Processing error
     * @returns {Object} Error response object
     */
    handleErrorResponse(error) {
        return {
            response: 'Sorry, I encountered an issue. Could you please repeat your request?',
            error: error.message,
            state: this.currentState
        };
    }

    /**
     * Reset conversation state
     */
    reset() {
        this.conversationHistory = [];
        this.currentState = {
            step: 'INITIAL',
            previousStep: null,
            serviceCategory: null,
            serviceType: null,
            serviceDetails: {
                description: '',
                timing: null,
                specifics: {}
            },
            locationStatus: {
                confirmed: false,
                providedLocation: null,
                profileLocation: null,
                locationVerificationRequired: false
            },
            requestId: null,
            requestStatus: 'PENDING'
        };
    }

    /**
     * Validate and process new location
     * @param {Object} locationData - Location information
     * @returns {boolean} Whether location was successfully processed
     */
    processNewLocation(locationData) {
        // Validate location data
        if (!locationData || (!locationData.coordinates && !locationData.address)) {
            return false;
        }

        this.currentState.locationStatus.providedLocation = locationData;
        this.currentState.locationStatus.confirmed = true;
        this.currentState.step = 'PREPARE_REQUEST';

        return true;
    }
}

module.exports = new AIConversationManager();
