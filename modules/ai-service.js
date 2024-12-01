const openai = require('../config/openai')
const mongoose = require('mongoose');
const ServiceRequest = require('../models/request.model');
const Service = require('../models/services.model');
const Category = require('../models/category.model');
const { queueProviderSearch } = require('../jobs/service-provider.job');

class AIServiceRequestHandler {
    constructor(openaiApiKey, userContext) {
        this.openai = openai
        this.userContext = userContext;
        this.conversationHistory = [];
    }

    async initializeServiceRequest() {
        try {
            // Initial AI-powered conversational prompt
            const initialPrompt = await this.generateInitialPrompt();

            return {
                status: 'STARTED',
                message: initialPrompt
            };
        } catch (error) {
            console.error('Error initializing service request:', error);
            throw error;
        }
    }

    async generateInitialPrompt() {
        const aiResponse = await this.openai.chat.completions.create({
            model: "chatgpt-4o-latest",
            messages: [
                {
                    role: "system",
                    content: `You are a friendly, helpful AI assistant helping a user request a service. 
          Be conversational, empathetic, and guide the user through their service request. 
          Ask open-ended questions to understand their needs precisely. You understand english, shona,and ndebele. Communication Guidelines:
1. Understand user's intent across language barriers
2. Be patient and supportive
3. Ask clarifying questions if service is unclear
4. Guide user towards precise service request
5. Offer multilingual understanding

Response Objectives:
- Confirm or clarify service type
- Request specific details if needed
- Maintain friendly, helpful tone
- Don't add too much text to respond, but make sure the response message is informative and clear.`
                },
                {
                    role: "user",
                    content: "I want to request a service"
                }
            ]
        });

        return aiResponse.choices[0].message.content;
    }

    async processUserResponse(userMessage) {
        try {
            // Add user message to conversation history
            this.conversationHistory.push({
                role: "user",
                content: userMessage
            });

            // Use AI to understand and refine the service request
            const aiUnderstanding = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `You are an AI assistant helping to categorize and understand a service request. 
            Extract the key details of the service needed, potential category, and any specific requirements.`
                    },
                    ...this.conversationHistory
                ]
            });

            const serviceDetails = await this.extractServiceDetails(
                aiUnderstanding.choices[0].message.content
            );

            // Continue conversation based on current stage
            if (!serviceDetails.category) {
                return this.requestServiceCategory(serviceDetails);
            }

            if (!serviceDetails.location) {
                return this.requestServiceLocation(serviceDetails);
            }

            // If we have enough details, proceed with service request
            return await this.createServiceRequest(serviceDetails);

        } catch (error) {
            console.error('Error processing user response:', error);
            throw error;
        }
    }

    async extractServiceDetails(aiResponse) {
        // Use AI or custom logic to parse the response and extract structured details
        const serviceDetails = {
            description: null,
            category: null,
            location: null,
            additionalNotes: null
        };

        // Example parsing logic - you'd want more sophisticated parsing
        const categories = await Category.find();
        const categoryNames = categories.map(cat => cat.name.toLowerCase());

        categoryNames.forEach(catName => {
            if (aiResponse.toLowerCase().includes(catName)) {
                serviceDetails.category = catName;
            }
        });

        // Add more extraction logic here

        return serviceDetails;
    }

    async requestServiceCategory(serviceDetails) {
        const categories = await Category.find();

        const aiCategoryPrompt = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Help the user choose a service category based on their description.
          Available categories are: ${categories.map(c => c.name).join(', ')}`
                },
                ...this.conversationHistory
            ]
        });

        return {
            status: 'NEED_CATEGORY',
            message: aiCategoryPrompt.choices[0].message.content,
            categories: categories
        };
    }

    async requestServiceLocation(serviceDetails) {
        const aiLocationPrompt = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "Ask the user about their location for the service request in a friendly, conversational manner."
                },
                ...this.conversationHistory
            ]
        });

        return {
            status: 'NEED_LOCATION',
            message: aiLocationPrompt.choices[0].message.content
        };
    }

    async createServiceRequest(serviceDetails) {
        const services = await Service.find({
            category: await Category.findOne({ name: serviceDetails.category })
        });

        const aiProviderSelection = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Help the user select a specific service from available options.
          Services: ${services.map(s => `${s.title}: ${s.description}`).join('; ')}`
                },
                ...this.conversationHistory
            ]
        });

        // Create service request logic similar to original implementation
        const request = await ServiceRequest.create({
            requester: this.userContext.user._id,
            service: services[0]._id,  // Simplified for example
            status: 'PENDING',
            description: serviceDetails.description,
            location: serviceDetails.location
        });

        // Queue provider search
        await queueProviderSearch({
            serviceId: request.service,
            location: serviceDetails.location
        });

        return {
            status: 'REQUEST_CREATED',
            message: "Your service request has been created. We're finding a provider for you!",
            requestId: request._id
        };
    }
}

module.exports = AIServiceRequestHandler;