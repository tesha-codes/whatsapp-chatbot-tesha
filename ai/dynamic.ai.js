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
                    serviceDetails: response.serviceDetails || {},
                },
            };
        } catch (error) {
            console.error('AI Processing Error:', error);
            return {
                response: `I'm sorry, I'm having trouble understanding your request. Could you please provide more details about the service you need?`,
                state: {
                    step: 'SERVICE_CONFIRMATION',
                    serviceCategory: null,
                    location: null,
                    serviceDetails: {},
                },
            };
        }
    }

    async generateContextualResponse(message, currentStep, serviceDetectionResult) {
        const prompt = this.buildPrompt(message, currentStep, serviceDetectionResult);
        const response = await openai.completions.create({
            model: 'text-davinci-003',
            prompt,
            max_tokens: 300,
            n: 1,
            stop: ['Human:', 'Assistant:'],
            temperature: 0.7,
        });

        const generatedResponse = response.choices[0].text.trim();
        const nextStep = this.determineNextStep(currentStep, serviceDetectionResult);
        const serviceDetails = this.extractServiceDetails(generatedResponse);

        return {
            text: generatedResponse,
            nextStep,
            serviceDetails,
        };
    }

    buildPrompt(message, currentStep, serviceDetectionResult) {
        let prompt = `The user has said: "${message}". The current conversation step is "${currentStep}".`;

        if (serviceDetectionResult.categoryDetected) {
            prompt += ` The user has requested a ${serviceDetectionResult.category} service.`;
        } else {
            prompt += ' The user has not specified a service yet.';
        }

        prompt += `
    Based on the user's message and the current step, generate a helpful and context-appropriate response. The response should:
    - Confirm the service the user is requesting (if detected)
    - Request the user's location if the service is confirmed
    - Confirm the location with the user
    - Provide next steps for creating a service request
    - Be written in a friendly and conversational tone

    Response:
    `;

        return prompt;
    }

    determineNextStep(currentStep, serviceDetectionResult) {
        switch (currentStep) {
            case 'INITIAL':
                return serviceDetectionResult.categoryDetected
                    ? 'SERVICE_CONFIRMATION'
                    : 'SERVICE_CONFIRMATION';
            case 'SERVICE_CONFIRMATION':
                return 'LOCATION_CONFIRMATION';
            case 'LOCATION_CONFIRMATION':
                return 'PREPARE_REQUEST';
            case 'PREPARE_REQUEST':
                return 'REQUEST_SUBMITTED';
            default:
                return 'INITIAL';
        }
    }

    extractServiceDetails(response) {
        const categoryMatch = response.match(/a ([a-z]+) service/);
        const locationMatch = response.match(/location: ([^.]+)/);

        return {
            category: categoryMatch?.[1] || null,
            location: locationMatch?.[1] || null,
        };
    }

    async detectServiceRequest(message) {
        const serviceCategories = {
            'cleaning': ['clean', 'wash', 'cleaning', 'dust', 'vacuum', 'mop'],
            'plumbing': ['pipe', 'water', 'toilet', 'leak', 'drain', 'flush', 'plumber'],
            'electrical': ['light', 'socket', 'wire', 'electrical', 'repair', 'install'],
            'moving': ['move', 'transport', 'haul', 'relocate', 'shift'],
            'pet care': ['pet', 'dog', 'cat', 'walk', 'sit', 'groom'],
            'senior care': ['senior', 'elderly', 'companion', 'help', 'assist'],
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
                    name: { $regex: new RegExp(detectedCategory, 'i') },
                });

                if (categoryDoc) {
                    return {
                        categoryDetected: true,
                        category: detectedCategory,
                        categoryId: categoryDoc._id,
                    };
                }
            } catch (error) {
                console.error('Error in service detection:', error);
            }
        }

        return {
            categoryDetected: false,
            needMoreInfo: true,
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
            location: null,
        };
    }
}

module.exports = new AIConversationManager();