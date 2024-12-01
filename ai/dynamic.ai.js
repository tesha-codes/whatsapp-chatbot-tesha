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
        const languageContextKeywords = {
            cleaning: {
                english: ['clean', 'wash', 'cleaning', 'dust', 'vacuum', 'mop'],
                shona: ['sadzira', 'hlamba', 'kunatsira', 'bvisa nguchu'],
                ndebele: ['hlanza', 'geza', 'songa', 'sucutsa']
            },
            plumbing: {
                english: ['pipe', 'water', 'toilet', 'leak', 'drain', 'flush', 'plumber'],
                shona: ['mvura', 'chimoto', 'pfipe', 'ngochani'],
                ndebele: ['amanzi', 'umtshWellington', 'i-paipi', 'hluma']
            },
            electrical: {
                english: ['light', 'socket', 'wire', 'electrical', 'repair', 'install'],
                shona: ['mweya', 'kuwirira', 'kurongedzera'],
                ndebele: ['isibane', 'i-sokethi', 'yenza']
            }
        };

        // Normalize and preprocess the message
        const normalizedMessage = message.toLowerCase()
            .replace(/[^\w\s]/gi, '')  // Remove punctuation
            .trim();

        // Enhanced intent detection across languages
        let detectedIntent = null;
        Object.entries(languageContextKeywords).forEach(([category, keywords]) => {
            const allKeywords = [
                ...keywords.english,
                ...keywords.shona,
                ...keywords.ndebele
            ];

            if (allKeywords.some(keyword => normalizedMessage.includes(keyword))) {
                detectedIntent = category;
            }
        });

        // Construct a more context-aware and linguistically sensitive prompt
        let prompt = `Conversation Context:
- User Message: "${message}"
- Current Step: "${currentStep}"
- Language Detection: Mixed language input detected

Service Intent Analysis:`;

        if (detectedIntent) {
            prompt += `
- Detected Service Category: ${detectedIntent}
- Potential Language Mix: Detected multilingual communication`;
        } else {
            prompt += `
- No clear service intent detected
- Possible reasons:
  * Ambiguous language use
  * Complex or colloquial expression`;
        }

        prompt += `

Response Generation Guidelines:
1. Understand the user's intent across potential language barriers
2. If service is unclear, ask clarifying questions gently
3. Be patient and supportive in communication
4. Offer multilingual support if possible
5. Guide the user to specify their service need clearly
6. Use simple, clear language
7. Be conversational and friendly

Recommended Response Strategy:
- If service detected: Confirm and seek clarification
- If service unclear: Ask gentle, open-ended questions
- Maintain a helpful, understanding tone

Required Response Elements:
- Clear acknowledgment of user's message
- Request for any missing information
- Guidance towards service request
- Friendly, inclusive language

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