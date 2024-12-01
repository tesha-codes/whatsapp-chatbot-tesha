const openai = require('../config/openai');
const Category = require('../models/category.model');
const Service = require('../models/services.model');
const User = require('../models/user.model');

class AIConversationManager {
    constructor() {
        this.reset();
    }

    async processMessage(message, currentStep) {
        try {
            const serviceDetectionResult = await this.detectServiceRequest(message);

            const response = await this.generateContextualResponse(
                message,
                currentStep,
                serviceDetectionResult
            );

            this.updateConversationState(message, serviceDetectionResult);

            return {
                response: response.text,
                state: {
                    step: response.nextStep,
                    serviceCategory: this.currentState.serviceCategory,
                    location: this.currentState.location,
                    serviceDetails: response.serviceDetails || {}
                }
            };
        } catch (error) {
            console.error('AI Processing Error:', error);
            return {
                response: `I'm having trouble understanding your request. Could you clarify the service you need?`,
                state: {
                    step: 'SERVICE_CONFIRMATION',
                    serviceCategory: null,
                    location: null,
                    serviceDetails: {}
                }
            };
        }
    }

    async generateContextualResponse(message, currentStep, serviceDetectionResult) {
        switch (this.currentState.step) {
            case 'INITIAL':
                if (serviceDetectionResult.categoryDetected) {
                    return {
                        text: `I understand you're looking for a ${serviceDetectionResult.category} service. 
Is this correct? Please confirm with 'yes' or provide more details.`,
                        nextStep: 'SERVICE_CONFIRMATION',
                        serviceDetails: {
                            category: serviceDetectionResult.category
                        }
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
                if (this.isServiceConfirmed(message)) {
                    return {
                        text: `Great! Could you please share your current location or address where you need the ${this.currentState.serviceCategory} service?`,
                        nextStep: 'LOCATION_CONFIRMATION',
                        serviceDetails: {
                            category: this.currentState.serviceCategory
                        }
                    };
                }
                return {
                    text: 'Let\'s try again. What service do you need?',
                    nextStep: 'INITIAL'
                };

            case 'LOCATION_CONFIRMATION':
                if (this.isValidLocation(message)) {
                    return {
                        text: `You've provided the location: ${message}. 
Is this correct? Please confirm with 'yes' or provide a different location.`,
                        nextStep: 'PREPARE_REQUEST',
                        serviceDetails: {
                            category: this.currentState.serviceCategory,
                            location: message
                        }
                    };
                }
                return {
                    text: 'Please provide a valid location or address.',
                    nextStep: 'LOCATION_CONFIRMATION'
                };

            case 'PREPARE_REQUEST':
                if (this.isLocationConfirmed(message)) {
                    return {
                        text: `Thank you for confirming! 

🔍 Service Request Details:
- Service Category: ${this.currentState.serviceCategory}
- Location: ${this.currentState.location}

Our team is now searching for an available service provider. Please wait...`,
                        nextStep: 'REQUEST_SUBMITTED',
                        serviceDetails: {
                            category: this.currentState.serviceCategory,
                            location: this.currentState.location,
                            description: 'Service request from conversation'
                        }
                    };
                }
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

    async detectServiceRequest(message) {
        const serviceCategories = {
            'cleaning': ['clean', 'wash', 'cleaning', 'dust', 'vacuum', 'mop'],
            'plumbing': ['pipe', 'water', 'toilet', 'leak', 'drain', 'flush', 'plumber'],
            'electrical': ['light', 'socket', 'wire', 'electrical', 'repair', 'install'],
            'moving': ['move', 'transport', 'haul', 'relocate', 'shift'],
            'pet care': ['pet', 'dog', 'cat', 'walk', 'sit', 'groom'],
            'senior care': ['senior', 'elderly', 'companion', 'help', 'assist']
        };

        const normalizedMessage = message.toLowerCase();

        let detectedCategory = null;
        for (const [category, keywords] of Object.entries(serviceCategories)) {
            if (keywords.some(keyword => normalizedMessage.includes(keyword))) {
                detectedCategory = category;
                break;
            }
        }

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

        return {
            categoryDetected: false,
            needMoreInfo: true
        };
    }

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

    isValidLocation(message) {
        return message.length > 5 &&
            !message.toLowerCase().includes('confirm') &&
            !message.toLowerCase().includes('yes');
    }

    isServiceConfirmed(message) {
        return ['yes', 'correct', 'confirm', 'ok'].some(word =>
            message.toLowerCase().includes(word)
        );
    }

    isLocationConfirmed(message) {
        return ['yes', 'correct', 'confirm', 'ok'].some(word =>
            message.toLowerCase().includes(word)
        );
    }

    reset() {
        this.currentState = {
            step: 'INITIAL',
            serviceCategory: null,
            location: null
        };
    }
}

module.exports = new AIConversationManager();