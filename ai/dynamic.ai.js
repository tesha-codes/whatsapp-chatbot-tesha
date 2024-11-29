const openai = require('../config/openai');
const mongoose = require('mongoose');
const Category = require('../models/Category'); // Ensure correct path to models
const Service = require('../models/Service');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const crypto = require('crypto');

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

            // Enhanced service detection and extraction
            const serviceDetectionResult = await this.detectServiceRequest(message);

            // Update conversation state
            this.updateConversationState(message, aiResponse.response);

            console.log('Service Detection Result:', JSON.stringify(serviceDetectionResult, null, 2));

            // Prepare response and next steps
            return {
                response: aiResponse.response,
                state: {
                    ...this.currentState,
                    serviceDetection: serviceDetectionResult,
                    nextStep: serviceDetectionResult.needMoreInfo
                        ? 'GATHER_SERVICE_DETAILS'
                        : 'PREPARE_SERVICE_REQUEST'
                }
            };
        } catch (error) {
            console.error('Detailed AI Processing Error:', error);

            return {
                response: `I'm having trouble understanding your request. Could you tell me more about the service you need?`,
                state: {
                    ...this.currentState,
                    nextStep: 'GATHER_SERVICE_DETAILS'
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
                // Find the category in the database
                const categoryDoc = await Category.findOne({
                    name: { $regex: new RegExp(detectedCategory, 'i') }
                });

                if (categoryDoc) {
                    // Find services in this category
                    const services = await Service.find({
                        category: categoryDoc._id
                    });

                    return {
                        categoryDetected: true,
                        category: detectedCategory,
                        categoryId: categoryDoc._id,
                        services: services.map(s => s.title),
                        needMoreInfo: services.length > 1, // Need more info if multiple services
                        specificService: services.length === 1 ? services[0] : null
                    };
                }
            } catch (error) {
                console.error('Error in service detection:', error);
            }
        }

        // If no clear category or service found
        return {
            categoryDetected: false,
            needMoreInfo: true,
            suggestedPrompt: `I'm not sure about the specific service you need. Could you provide more details? We offer services like:
- Cleaning
- Plumbing
- Electrical repairs
- Moving
- Pet care
- Senior care`
        };
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
     * Update conversation state based on service detection
     * @param {string} userMessage - User's message
     * @param {string} assistantResponse - AI's response
     */
    updateConversationState(userMessage, assistantResponse) {
        // Update state based on service detection
        if (this.currentState.serviceDetection) {
            const detection = this.currentState.serviceDetection;

            if (detection.categoryDetected) {
                this.currentState.serviceCategory = detection.category;

                // If only one service in category, pre-select it
                if (detection.specificService) {
                    this.currentState.serviceDetails.selectedService = detection.specificService;
                }
            }
        }

        // Existing state update logic
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
                specifics: {},
                selectedService: null
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