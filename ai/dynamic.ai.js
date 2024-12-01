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
            // Only attempt service detection if in appropriate steps
            const serviceDetectionResult = currentStep.includes('SERVICE')
                ? await this.detectServiceRequest(message)
                : { categoryDetected: false };

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
                response: `I apologize, but I'm having trouble understanding your request. Could you please provide more details about the service you need?`,
                state: {
                    step: currentStep, // Maintain current step
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
            model: 'gpt-3.5-turbo-instruct',
            prompt,
            max_tokens: 300,
            n: 1,
            stop: ['Human:', 'System:'],
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
        let prompt = `Detailed Conversation Context:
- Original User Message: "${message}"
- Current Conversation Step: "${currentStep}"
- Multilingual Communication Detected

Service Intent Analysis:`;

        if (serviceDetectionResult.categoryDetected) {
            prompt += `
- Detected Service Category: ${serviceDetectionResult.category}
- Confidence: High
- Language Interpretation: Mixed-language input successfully processed`;
        } else {
            prompt += `
- No Clear Service Intent Detected
- Possible Reasons:
  * Complex or ambiguous language use
  * Service not in predefined categories
  * Unique service request`;
        }

        prompt += `

Communication Guidelines:
1. Understand user's intent across language barriers
2. Be patient and supportive
3. Ask clarifying questions if service is unclear
4. Guide user towards precise service request
5. Offer multilingual understanding

Response Objectives:
- Confirm or clarify service type
- Request specific details if needed
- Maintain friendly, helpful tone
- Provide clear next steps

Recommended Response:
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
            'yard work': {
                english: ['yard', 'garden', 'landscaping', 'lawn', 'grass', 'outdoor', 'work'],
                shona: ['minda', 'mabasa', 'kushandira', 'kusesa', 'kubika'],
                ndebele: ['indawo', 'umhlaba', 'sebenza', 'hlonza']
            },
            'cleaning': {
                english: ['clean', 'wash', 'cleaning', 'dust', 'vacuum', 'mop'],
                shona: ['sadzira', 'hlamba', 'kunatsira', 'bvisa nguchu'],
                ndebele: ['hlanza', 'geza', 'songa', 'sucutsa']
            },
            'plumbing': {
                english: ['pipe', 'water', 'toilet', 'leak', 'drain', 'flush', 'plumber'],
                shona: ['mvura', 'chimoto', 'pfipe', 'ngochani'],
                ndebele: ['amanzi', 'umtshWellington', 'i-paipi', 'hluma']
            },
            'electrical': {
                english: ['light', 'socket', 'wire', 'electrical', 'repair', 'install'],
                shona: ['mweya', 'kuwirira', 'kurongedzera'],
                ndebele: ['isibane', 'i-sokethi', 'yenza']
            },
            'moving': {
                english: ['move', 'transport', 'haul', 'relocate', 'shift'],
                shona: ['pfuura', 'kuenda', 'kutakura'],
                ndebele: ['shayela', 'pendula', 'huqhela']
            },
            'pet care': {
                english: ['pet', 'dog', 'cat', 'walk', 'sit', 'groom'],
                shona: ['mbato', 'imbwa', 'gobvu', 'kuchengeta'],
                ndebele: ['isilwane', 'inja', 'ikati', 'lindela']
            }
        };

        // Normalize the message
        const normalizedMessage = message.toLowerCase()
            .replace(/[^\w\s]/gi, '')  // Remove punctuation
            .trim();

        // Enhanced detection with multilingual support
        let detectedCategory = null;
        Object.entries(serviceCategories).forEach(([category, keywords]) => {
            const allKeywords = [
                ...keywords.english,
                ...keywords.shona,
                ...keywords.ndebele
            ];

            if (allKeywords.some(keyword => normalizedMessage.includes(keyword))) {
                detectedCategory = category;
            }
        });

        // Specific handling for mixed-language yard work request
        if (!detectedCategory &&
            (normalizedMessage.includes('yard work') ||
                normalizedMessage.includes('yard') ||
                normalizedMessage.includes('minda') ||
                normalizedMessage.includes('kusesa'))) {
            detectedCategory = 'yard work';
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