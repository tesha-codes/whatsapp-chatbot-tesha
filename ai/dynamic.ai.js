const openai = require('../config/openai');
const mongoose = require('mongoose');

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
            console.log('Processing message:', message);
            console.log('Current step:', currentStep);

            // Prepare system instructions with current context
            const systemInstructions = this.prepareSystemInstructions(currentStep);

            // Generate AI response
            const aiResponse = await this.generateAIResponse({
                systemInstructions,
                message
            });

            // Update conversation history and state
            this.updateConversationHistory(message, aiResponse.response);
            this.updateConversationState(message, aiResponse.response);

            console.log('AI Response:', JSON.stringify(aiResponse, null, 2));

            return {
                response: aiResponse.response,
                state: {
                    ...this.currentState,
                    nextStep: aiResponse.next_step
                }
            };
        } catch (error) {
            console.error('Detailed AI Processing Error:', error);

            // Provide a fallback response
            return {
                response: `I'm having trouble understanding your request. Could you please rephrase or be more specific? Error: ${error.message}`,
                state: {
                    ...this.currentState,
                    step: 'ERROR_HANDLING'
                }
            };
        }
    }

    /**
     * Prepare system instructions for AI
     * @param {string} currentStep - Current conversation step
     * @returns {string} System instructions
     */
    prepareSystemInstructions(currentStep) {
        const serviceCategories = `
Service Categories:
🏠 Household: Cleaning, Laundry
🛠 Skilled: Plumbing, Electrical, Painting
🚚 Moving: Local moves, Junk removal
🐾 Pet Care: Walking, Sitting
👵 Senior Care: Companion, Transport
`;

        return `
AI Assistant Response Guidelines:
- Understand requests in English, Shona, Ndebele
- Provide clear, actionable responses
- Extract precise service needs
- Ask clarifying questions if needed
- Response must include 'response' and 'next_step'
- Be friendly and systematic

Conversation Context:
- Current Step: ${currentStep}
- Service Category: ${this.currentState.serviceCategory || 'Not Selected'}

${serviceCategories}

Respond in JSON format:
{
  "response": "Your friendly message to user",
  "next_step": "SUGGESTED_NEXT_STEP"
}
`;
    }

    /**
     * Generate AI response using OpenAI
     * @param {Object} params - Generation parameters
     * @returns {Promise<Object>} Parsed AI response
     */
    async generateAIResponse({ systemInstructions, message }) {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            response_format: { type: "json_object" },
            messages: [
                { role: 'system', content: systemInstructions },
                ...this.getRecentConversationContext(),
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 300
        });

        // Parse the structured response
        return JSON.parse(response.choices[0].message.content);
    }

    /**
     * Update conversation history
     * @param {string} userMessage - User's message
     * @param {string} assistantResponse - AI's response
     */
    updateConversationHistory(userMessage, assistantResponse) {
        this.conversationHistory.push(
            { role: 'user', content: userMessage },
            { role: 'assistant', content: assistantResponse }
        );

        // Limit conversation history to last 6 messages
        if (this.conversationHistory.length > 6) {
            this.conversationHistory = this.conversationHistory.slice(-6);
        }
    }

    /**
     * Get recent conversation context
     * @returns {Array} Recent conversation messages
     */
    getRecentConversationContext() {
        return this.conversationHistory.slice(-4);
    }

    /**
     * Update conversation state based on messages
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

        // Detect service category
        if (!this.currentState.serviceCategory) {
            const detectedService = Object.keys(serviceKeywords).find(service =>
                serviceKeywords[service].some(keyword =>
                    userMessage.toLowerCase().includes(keyword)
                )
            );

            if (detectedService) {
                this.currentState.serviceCategory = detectedService;
            }
        }

        // Update state based on conversation flow
        switch (this.currentState.step) {
            case 'INITIAL':
                this.currentState.step = 'SERVICE_DETAILS';
                break;
            case 'SERVICE_DETAILS':
                this.currentState.serviceDetails.description = userMessage;
                this.currentState.step = 'LOCATION_VERIFICATION';
                break;
            case 'LOCATION_VERIFICATION':
                if (this.isLocationConfirmation(userMessage)) {
                    this.currentState.locationStatus.confirmed = true;
                    this.currentState.step = 'PREPARE_REQUEST';
                }
                break;
            case 'PREPARE_REQUEST':
                this.currentState.requestId = this.generateRequestId();
                this.currentState.requestStatus = 'READY';
                this.currentState.step = 'COMPLETE';
                break;
        }
    }

    /**
     * Check if message confirms location
     * @param {string} message - User's message
     * @returns {boolean} Whether location is confirmed
     */
    isLocationConfirmation(message) {
        return ['yes', 'confirm', 'correct'].some(word =>
            message.toLowerCase().includes(word)
        );
    }

    /**
     * Generate unique request identifier
     * @returns {string} Unique request ID
     */
    generateRequestId() {
        return `REQ${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }

    /**
     * Reset conversation state
     */
    reset() {
        this.conversationHistory = [];
        this.currentState = {
            step: 'INITIAL',
            serviceCategory: null,
            serviceDetails: {
                description: '',
                timing: null,
                specifics: {}
            },
            locationStatus: {
                confirmed: false,
                providedLocation: null
            },
            requestId: null,
            requestStatus: 'PENDING'
        };
    }
}

module.exports = new AIConversationManager();