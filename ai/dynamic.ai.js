const openai = require('../config/openai');
const Category = require('../models/category.model');
const Service = require('../models/services.model');
const User = require('../models/user.model');

class AIConversationManager {
    constructor() {
        this.reset();
    }

    /**
     * Process user message and generate AI response
     * @param {string} message - User's message
     * @param {string} currentStep - Current conversation step
     * @returns {Promise<Object>} AI response and updated state
     */
    async processMessage(message, currentStep) {
        try {
            // Detect service request details
            const serviceDetectionResult = await this.detectServiceRequest(message);

            // Generate appropriate response based on current conversation state
            const response = await this.generateContextualResponse(
                message,
                currentStep,
                serviceDetectionResult
            );

            // Update conversation state
            this.updateConversationState(message, serviceDetectionResult);

            return {
                response: response.text,
                state: {
                    ...this.currentState,
                    serviceDetection: serviceDetectionResult,
                    nextStep: response.nextStep
                }
            };
        } catch (error) {
            console.error('AI Processing Error:', error);
            return {
                response: `I'm having trouble understanding your request. Could you clarify the service you need?`,
                state: {
                    ...this.currentState,
                    nextStep: 'SERVICE_CONFIRMATION'
                }
            };
        }
    }

    /**
     * Generate contextual response based on conversation state
     * @param {string} message - User's message
     * @param {string} currentStep - Current conversation step
     * @param {Object} serviceDetectionResult - Detected service details
     * @returns {Promise<Object>} Response object with text and next step
     */
    async generateContextualResponse(message, currentStep, serviceDetectionResult) {
        // Different response logic based on current conversation state
        switch (this.currentState.step) {
            case 'INITIAL':
                // Service not yet confirmed
                if (serviceDetectionResult.categoryDetected) {
                    return {
                        text: `I understand you're looking for a ${serviceDetectionResult.category} service. 
Is this correct? Please confirm with 'yes' or provide more details.`,
                        nextStep: 'SERVICE_CONFIRMATION'
                    };
                }
                return {
                    text: `I'm not sure about the specific service you need. Could you provide more details? 
We offer services like:
- Cleaning
- Plumbing
- Electrical repairs
- Moving
- Pet care
- Senior care`,
                    nextStep: 'SERVICE_CONFIRMATION'
                };

            case 'SERVICE_CONFIRMATION':
                // Service confirmed, ask for location
                if (this.isServiceConfirmed(message)) {
                    return {
                        text: `Great! Could you please share your current location or address where you need the ${this.currentState.serviceCategory} service?`,
                        nextStep: 'LOCATION_CONFIRMATION'
                    };
                }
                // If not confirmed, restart service detection
                return {
                    text: 'Let\'s try again. What service do you need?',
                    nextStep: 'INITIAL'
                };

            case 'LOCATION_CONFIRMATION':
                // Location provided, confirm details
                if (this.isValidLocation(message)) {
                    return {
                        text: `You've provided the location: ${message}. 
Is this correct? Please confirm with 'yes' or provide a different location.`,
                        nextStep: 'PREPARE_REQUEST'
                    };
                }
                return {
                    text: 'Please provide a valid location or address.',
                    nextStep: 'LOCATION_CONFIRMATION'
                };

            case 'PREPARE_REQUEST':
                // Location confirmed, prepare service request
                if (this.isLocationConfirmed(message)) {
                    return {
                        text: `Thank you for confirming! 

🔍 Service Request Details:
- Service Category: ${this.currentState.serviceCategory}
- Location: ${this.currentState.location}

Our team is now searching for an available service provider. Please wait...`,
                        nextStep: 'REQUEST_SUBMITTED'
                    };
                }
                // If location not confirmed, ask again
                return {
                    text: 'Could you confirm your location again?',
                    nextStep: 'LOCATION_CONFIRMATION'
                };

            default:
                return {
                    text: 'Something went wrong. Let\'s start over. What service do you need?',
                    nextStep: 'INITIAL'
                };
        }
    }

    /**
     * Detect and extract service request details
     * @param {string} message - User's message
     * @returns {Promise<Object>} Service detection results
     */
    async detectServiceRequest(message) {
        // Predefined service categories and keywords
        const serviceCategories = {
            'cleaning': ['clean', 'wash', 'cleaning', 'dust', 'vacuum', 'mop'],
            'plumbing': ['pipe', 'water', 'toilet', 'leak', 'drain', 'flush', 'plumber'],
            'electrical': ['light', 'socket', 'wire', 'electrical', 'repair', 'install'],
            'moving': ['move', 'transport', 'haul', 'relocate', 'shift'],
            'pet care': ['pet', 'dog', 'cat', 'walk', 'sit', 'groom'],
            'senior care': ['senior', 'elderly', 'companion', 'help', 'assist']
        };

        // Normalize message
        const normalizedMessage = message.toLowerCase();

        // First, try to match a service category
        let detectedCategory = null;
        for (const [category, keywords] of Object.entries(serviceCategories)) {
            if (keywords.some(keyword => normalizedMessage.includes(keyword))) {
                detectedCategory = category;
                break;
            }
        }

        // If category found, attempt to find a specific service
        if (detectedCategory) {
            try {
                const categoryDoc = await Category.findOne({
                    name: { $regex: new RegExp(detectedCategory, 'i') }
                });

                if (categoryDoc) {
                    return {
                        categoryDetected: true,
                        category: detectedCategory,
                        categoryId: categoryDoc._id
                    };
                }
            } catch (error) {
                console.error('Error in service detection:', error);
            }
        }

        // If no clear category found
        return {
            categoryDetected: false,
            needMoreInfo: true
        };
    }

    /**
     * Update conversation state
     * @param {string} message - User's message
     * @param {Object} serviceDetectionResult - Detected service details
     */
    updateConversationState(message, serviceDetectionResult) {
        switch (this.currentState.step) {
            case 'INITIAL':
                if (serviceDetectionResult.categoryDetected) {
                    this.currentState.serviceCategory = serviceDetectionResult.category;
                    this.currentState.step = 'SERVICE_CONFIRMATION';
                }
                break;
            case 'SERVICE_CONFIRMATION':
                if (this.isServiceConfirmed(message)) {
                    this.currentState.step = 'LOCATION_CONFIRMATION';
                }
                break;
            case 'LOCATION_CONFIRMATION':
                if (this.isValidLocation(message)) {
                    this.currentState.location = message;
                    this.currentState.step = 'PREPARE_REQUEST';
                }
                break;
            case 'PREPARE_REQUEST':
                if (this.isLocationConfirmed(message)) {
                    this.currentState.step = 'REQUEST_SUBMITTED';
                }
                break;
        }
    }

    /**
     * Validate location input
     * @param {string} message - User's location input
     * @returns {boolean} Whether location is valid
     */
    isValidLocation(message) {
        // Basic location validation
        return message.length > 5 &&
            !message.toLowerCase().includes('confirm') &&
            !message.toLowerCase().includes('yes');
    }

    /**
     * Check if service is confirmed
     * @param {string} message - User's confirmation message
     * @returns {boolean} Whether service is confirmed
     */
    isServiceConfirmed(message) {
        return ['yes', 'correct', 'confirm', 'ok'].some(word =>
            message.toLowerCase().includes(word)
        );
    }

    /**
     * Check if location is confirmed
     * @param {string} message - User's confirmation message
     * @returns {boolean} Whether location is confirmed
     */
    isLocationConfirmed(message) {
        return ['yes', 'correct', 'confirm', 'ok'].some(word =>
            message.toLowerCase().includes(word)
        );
    }

    /**
     * Reset conversation state
     */
    reset() {
        this.currentState = {
            step: 'INITIAL',
            serviceCategory: null,
            location: null,
            requestDetails: null
        };
    }
}

module.exports = new AIConversationManager();