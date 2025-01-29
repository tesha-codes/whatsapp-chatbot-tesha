const { StatusCodes } = require("http-status-codes");
const { setSession } = require("../utils/redis");
const { createUser, updateUser, getUser } = require("../controllers/user.controllers");
const { formatDateTime } = require("../utils/dateUtil");
const Category = require("../models/category.model");
const { clientMainMenuTemplate } = require("../services/whatsappService");
const Service = require("../models/services.model");
const mongoose = require("mongoose");
const ServiceRequest = require("../models/request.model");
const User = require("../models/user.model");
const crypto = require("node:crypto");
const { queueProviderSearch } = require("../jobs/service-provider.job");
const OpenAI = require("openai");
require("dotenv").config();

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// AI Conversation Manager
class AIConversationManager {
    constructor() {
        this.state = 'start';
        this.context = {};
    }

    async processMessage(userInput, currentStep) {
        userInput = userInput.trim().toLowerCase();

        if (['exit', 'quit', 'stop', 'cancel'].includes(userInput)) {
            return this.resetConversation();
        }

        const intent = await this.interpretUserIntent(userInput, currentStep);

        if (intent.includes('exit') || intent.includes('cancel')) {
            return this.resetConversation();
        }

        switch (this.state) {
            case 'start':
                return await this.handleStart(userInput);
            case 'location':
                return await this.handleLocationCapture(userInput);
            case 'providers':
                return await this.handleProviderSelection(userInput);
            case 'time':
                return await this.handleTimeSelection(userInput);
            case 'confirm':
                return await this.handleConfirmation(userInput, intent);
            case 'feedback':
                return await this.handleFeedback(userInput);
            default:
                return this.provideHelp();
        }
    }

    resetConversation() {
        this.state = 'start';
        this.context = {};
        return { response: "Booking process cancelled. What service would you like to book today?", state: this.state };
    }

    provideHelp() {
        return { response: "I'm here to help you book a service. Could you clarify what you'd like to do?", state: this.state };
    }

    async handleStart(userInput) {
        const serviceType = await this.detectServiceIntent(userInput);

        if (serviceType) {
            this.context.service = serviceType;
            this.state = 'location';
            return { response: `Great! I'll help you find a ${serviceType}. What's your location?`, state: this.state };
        }

        return { response: "I can help with services like gardening, cleaning, tutoring, and more. What service do you need?", state: this.state };
    }

    async handleLocationCapture(userInput) {
        // Check if the user shared a geo-location (e.g., latitude and longitude)
        const geoLocation = this.extractGeoLocation(userInput);
        if (geoLocation) {
            this.context.location = geoLocation;
            this.state = 'providers';

            this.context.providers = await this.generateProviders();

            return {
                response: `Here are ${this.context.service} professionals near your location:\n\n` +
                    this.formatProviderList(this.context.providers) +
                    "\n\nSelect a provider by their ID.",
                state: this.state
            };
        }

        const location = this.extractLocation(userInput);
        if (location) {
            this.context.location = location;
            this.state = 'providers';

            this.context.providers = await this.generateProviders();

            return {
                response: `Here are ${this.context.service} professionals near ${location}:\n\n` +
                    this.formatProviderList(this.context.providers) +
                    "\n\nSelect a provider by their ID.",
                state: this.state
            };
        }

        return { response: "Could you specify your location? You can share your location or type it out.", state: this.state };
    }

    async handleProviderSelection(userInput) {
        const selectedProvider = this.context.providers.find(p =>
            p.id.toLowerCase() === userInput.toLowerCase());

        if (selectedProvider) {
            this.context.selectedProvider = selectedProvider;
            this.state = 'time';

            this.context.availableSlots = this.generateTimeSlots();

            return {
                response: `${selectedProvider.name}'s available times:\n\n` +
                    this.formatTimeSlots(this.context.availableSlots) +
                    "\n\nChoose a time slot number or type 'change' to see other providers.",
                state: this.state
            };
        }

        return { response: "Please select a valid provider ID.", state: this.state };
    }

    extractGeoLocation(userInput) {
        if (userInput.payload && userInput.payload.latitude && userInput.payload.longitude) {
            return {
                latitude: userInput.payload.latitude,
                longitude: userInput.payload.longitude
            };
        }
        return null;
    }

    extractLocation(userInput) {
        const locationPatterns = [
            /i\s*(?:am|'m)\s*(?:in|at)\s*(.+)/i,
            /located\s*(?:in|at)\s*(.+)/i,
            /my\s+location\s+is\s+(.+)/i
        ];

        for (const pattern of locationPatterns) {
            const match = userInput.match(pattern);
            if (match) return match[1].trim();
        }

        return userInput.trim();
    }

    async handleTimeSelection(userInput) {
        if (userInput === 'change') {
            this.state = 'providers';
            return {
                response: `Here are the providers again:\n\n` +
                    this.formatProviderList(this.context.providers) +
                    "\n\nSelect a provider by their ID.",
                state: this.state
            };
        }

        const slotIndex = parseInt(userInput) - 1;

        if (slotIndex >= 0 && slotIndex < this.context.availableSlots.length) {
            this.context.selectedTime = this.context.availableSlots[slotIndex];
            this.state = 'confirm';

            return {
                response: `Booking details:\n\n` +
                    this.formatBookingConfirmation() +
                    "\n\nConfirm booking? (yes/no)",
                state: this.state
            };
        }

        return { response: "Invalid time slot. Choose a number from the list or type 'change'.", state: this.state };
    }

    async handleConfirmation(userInput, intent) {
        if (intent.includes('no') || intent.includes('different')) {
            if (this.context.providers && this.context.providers.length > 1) {
                this.state = 'providers';
                return {
                    response: `No worries! Let's look at the providers again:\n\n` +
                        this.formatProviderList(this.context.providers) +
                        "\n\nWould you like to select a different provider?",
                    state: this.state
                };
            } else if (this.context.service) {
                this.state = 'start';
                return {
                    response: `I understand you're not satisfied. Let's start over.\n\n` +
                        `We were looking for a ${this.context.service}. Would you like to continue or choose a different service?`,
                    state: this.state
                };
            } else {
                return this.resetConversation();
            }
        }

        if (intent.includes('yes') || intent.includes('confirm')) {
            this.state = 'feedback';
            return {
                response: `Booking confirmed! 🎉\n\n` +
                    this.formatFinalBooking() +
                    "\n\nHow was your experience? (Great/Good/Okay/Poor)",
                state: this.state
            };
        }

        return { response: "I'm not sure what you mean. Would you like to confirm the booking (yes/no)?", state: this.state };
    }

    async handleFeedback(userInput) {
        this.context.feedback = userInput.trim().toLowerCase();
        this.state = 'start'; // Reset the state to start
        return {
            response: "Thanks for your feedback! You can now book another service or edit your profile.",
            state: this.state
        };
    }

    async detectServiceIntent(userInput) {
        const services = ['handyman', 'plumber', 'electrician', 'cleaner', 'tutor',
            'massage therapist', 'hairdresser', 'beautician',
            'personal trainer', 'chef', 'gardener', 'painter', 'carpenter'];

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `Based on the user's input, classify the service they need from this list: ${services.join(', ')}. If unsure, respond with "unknown".`
                    },
                    {
                        role: "user",
                        content: userInput
                    }
                ],
                max_tokens: 20
            });

            const serviceType = response.choices[0].message.content.trim().toLowerCase();
            return services.includes(serviceType) ? serviceType : null;
        } catch (error) {
            console.error("Service detection error:", error);
            return null;
        }
    }

    async generateProviders() {
        const providers = [];
        const count = Math.floor(Math.random() * 3) + 2;

        for (let i = 0; i < count; i++) {
            const specialty = await this.generateProviderSpecialties(this.context.service);
            providers.push({
                id: `P${i + 1}`,
                name: this.generateName(),
                specialty: specialty,
                rate: `$${Math.floor(Math.random() * 50) + 30}/hr`,
                rating: (4 + Math.random()).toFixed(1),
                distance: this.calculateDistance(),
                phone: `+1-555-${Math.floor(Math.random() * 9000) + 1000}`
            });
        }

        return providers;
    }

    generateName() {
        const firstNames = ['John', 'Maria', 'David', 'Sarah', 'Emma', 'Michael'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'];
        return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    }

    formatProviderList(providers) {
        return providers.map(p =>
            `ID: ${p.id} - ${p.name}\n` +
            `🔧 Specialty: ${p.specialty}\n` +
            `💰 Rate: ${p.rate} | ⭐ Rating: ${p.rating}\n` +
            `🗺️ Distance: ${p.distance}`
        ).join('\n\n');
    }

    generateTimeSlots() {
        const baseSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];
        return baseSlots.filter(() => Math.random() > 0.3);
    }

    formatTimeSlots(slots) {
        return slots.map((slot, index) =>
            `${index + 1}. ${slot}`
        ).join('\n');
    }

    formatBookingConfirmation() {
        return `Provider: ${this.context.selectedProvider.name}\n` +
            `Service: ${this.context.service}\n` +
            `Time: ${this.context.selectedTime}\n` +
            `Rate: ${this.context.selectedProvider.rate}`;
    }

    formatFinalBooking() {
        return `Provider: ${this.context.selectedProvider.name}\n` +
            `Contact: ${this.context.selectedProvider.phone}\n` +
            `Service: ${this.context.service}\n` +
            `Time: ${this.context.selectedTime}\n` +
            `Location: ${this.context.location}`;
    }

    calculateDistance() {
        return `${(Math.random() * 15).toFixed(1)} km`;
    }

    async generateProviderSpecialties(serviceType) {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `Generate a concise, professional 3-5 word specialty for a ${serviceType} professional.`
                    }
                ],
                max_tokens: 20
            });
            return response.choices[0].message.content.trim();
        } catch (error) {
            return "General Services";
        }
    }

    async interpretUserIntent(userInput, currentState) {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "Analyze the user's input and determine their intent. Consider the current conversation state and provide a clear interpretation."
                    },
                    {
                        role: "user",
                        content: `Current state: ${currentState}\nUser input: ${userInput}`
                    }
                ],
                max_tokens: 100
            });

            return response.choices[0].message.content.trim().toLowerCase();
        } catch (error) {
            console.error("Intent interpretation error:", error);
            return 'unknown';
        }
    }
}

// Initialize AI Conversation Manager
const aiConversationManager = new AIConversationManager();

// Client Class
class Client {
    constructor(res, userResponse, session, user, steps, messages) {
        this.res = res;
        this.userResponse = userResponse;
        this.session = session || {};
        this.user = user;
        this.steps = steps;
        this.messages = messages;
        this.lActivity = formatDateTime();
        this.context = {}; // Initialize context to avoid undefined errors
        this.setupCommonVariables();
    }

    setupCommonVariables() {
        const { userResponse } = this;
        this.phone = userResponse.sender.phone;
        this.message = userResponse.payload?.text || "";
        this.username = userResponse.sender.name;
    }

    async handleInitialState() {
        const { res, session, steps, lActivity, phone, message, user } = this;

        if (!session || session.step === steps.DEFAULT_CLIENT_STATE) {
            const updatedUser = await getUser(phone);
            await clientMainMenuTemplate(phone, updatedUser.firstName);
            await setSession(phone, {
                step: steps.SELECT_SERVICE_CATEGORY,
                message: message || "",
                lActivity: lActivity || new Date().toISOString(),
            });
            return res
                .status(StatusCodes.OK)
                .send(`Hello there 👋 ${updatedUser.firstName}`);
        }

        if (session.step === steps.SETUP_CLIENT_PROFILE) {
            return await this.setupClientProfile();
        }

        if (session.step === steps.COLLECT_USER_FULL_NAME) {
            return await this.collectFullName();
        }

        if (session.step === steps.COLLECT_USER_ID) {
            return await this.collectNationalId();
        }

        if (session.step === steps.COLLECT_USER_ADDRESS) {
            return await this.collectAddress();
        }

        if (session.step === steps.COLLECT_USER_LOCATION) {
            return await this.collectLocation();
        }

        // Handle feedback state transition
        if (session.step === steps.SELECT_SERVICE_CATEGORY && this.context?.feedback) {
            await clientMainMenuTemplate(phone, user.firstName);
            await setSession(phone, {
                step: steps.DEFAULT_CLIENT_STATE,
                message: "",
                lActivity: new Date().toISOString(),
            });
            return res.status(StatusCodes.OK).send(this.messages.CLIENT_WELCOME_MESSAGE);
        }

        return null;
    }

    async mainEntry() {
        // First, handle initial state and registration
        const initialStateResult = await this.handleInitialState();
        if (initialStateResult) return initialStateResult;

        const { res, steps, lActivity, phone, message } = this;
        const currentStep = this.session.step || steps.DEFAULT_CLIENT_STATE;

        // Only engage AI if the user is past registration and in service selection steps
        const aiEnabledSteps = [
            steps.SELECT_SERVICE_CATEGORY,
            steps.SELECT_SERVICE,
            steps.BOOK_SERVICE
        ];

        if (aiEnabledSteps.includes(currentStep)) {
            try {
                const aiResult = await aiConversationManager.processMessage(
                    message,
                    currentStep
                );

                // Flatten the session data to work with the existing setSession function
                const flattenedSessionData = {
                    message: aiResult.state.message || "",
                    step: aiResult.state.step || currentStep,
                    serviceCategory: aiResult.state.serviceCategory || "",
                    location: aiResult.state.location || "",
                    serviceDetails: JSON.stringify(aiResult.state.serviceDetails || {}),
                };


                await setSession(phone, {
                    ...flattenedSessionData,
                    lActivity: lActivity || new Date().toISOString(),
                });

                return res.status(StatusCodes.OK).send(aiResult.response);
            } catch (error) {
                console.error("AI Conversation Error:", error);
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("An error occurred while processing your request.");
            }
        }

        // Handle other steps (non-AI steps)
        switch (currentStep) {
            case steps.SELECT_SERVICE_CATEGORY:
                return await this.handleServiceCategorySelection();
            case steps.SELECT_SERVICE:
                return await this.handleServiceSelection();
            case steps.BOOK_SERVICE:
                return await this.handleServiceBooking();
            default:
                return res.status(StatusCodes.OK).send(this.messages.CLIENT_WELCOME_MESSAGE);
        }
    }

    async handleServiceCategorySelection() {
        const { res, phone, message, lActivity } = this;

        // Fetch available service categories from the database
        const categories = await Category.find({});
        const categoryList = categories.map(cat => `- ${cat.name}`).join('\n');

        if (!message) {
            await setSession(phone, {
                step: steps.SELECT_SERVICE_CATEGORY,
                message: "",
                lActivity: lActivity || new Date().toISOString(),
            });
            return res.status(StatusCodes.OK).send(
                `Please select a service category:\n\n${categoryList}`
            );
        }

        const selectedCategory = categories.find(cat =>
            cat.name.toLowerCase() === message.trim().toLowerCase()
        );

        if (!selectedCategory) {
            return res.status(StatusCodes.OK).send(
                "Invalid category. Please select a valid category from the list:\n\n" +
                categoryList
            );
        }

        await setSession(phone, {
            step: steps.SELECT_SERVICE,
            serviceCategory: selectedCategory.name,
            lActivity: lActivity || new Date().toISOString(),
        });

        return res.status(StatusCodes.OK).send(
            `You selected: ${selectedCategory.name}. Now, let's choose a specific service.`
        );
    }

    async handleServiceSelection() {
        const { res, phone, message, lActivity, session } = this;

        // Fetch services under the selected category
        const services = await Service.find({ category: session.serviceCategory });
        const serviceList = services.map(service => `- ${service.name}`).join('\n');

        if (!message) {
            return res.status(StatusCodes.OK).send(
                `Please select a service:\n\n${serviceList}`
            );
        }

        const selectedService = services.find(service =>
            service.name.toLowerCase() === message.trim().toLowerCase()
        );

        if (!selectedService) {
            return res.status(StatusCodes.OK).send(
                "Invalid service. Please select a valid service from the list:\n\n" +
                serviceList
            );
        }

        await setSession(phone, {
            step: steps.BOOK_SERVICE,
            serviceDetails: JSON.stringify(selectedService),
            lActivity: lActivity || new Date().toISOString(),
        });

        return res.status(StatusCodes.OK).send(
            `You selected: ${selectedService.name}. Let's proceed to book this service.`
        );
    }

    async handleServiceBooking() {
        const { res, phone, message, lActivity, session } = this;

        const serviceDetails = JSON.parse(session.serviceDetails);

        if (!message) {
            return res.status(StatusCodes.OK).send(
                `You're about to book: ${serviceDetails.name}.\n\n` +
                "Please confirm by typing 'yes' or cancel by typing 'no'."
            );
        }

        if (message.trim().toLowerCase() === 'yes') {
            // Create a new service request
            const serviceRequest = new ServiceRequest({
                user: this.user._id,
                service: serviceDetails._id,
                status: 'pending',
                createdAt: new Date(),
            });

            await serviceRequest.save();

            await setSession(phone, {
                step: steps.DEFAULT_CLIENT_STATE,
                lActivity: lActivity || new Date().toISOString(),
            });

            return res.status(StatusCodes.OK).send(
                `Your booking for ${serviceDetails.name} has been confirmed! 🎉\n\n` +
                "You can now check your bookings or book another service."
            );
        } else if (message.trim().toLowerCase() === 'no') {
            await setSession(phone, {
                step: steps.SELECT_SERVICE_CATEGORY,
                lActivity: lActivity || new Date().toISOString(),
            });

            return res.status(StatusCodes.OK).send(
                "Booking cancelled. Let's start over."
            );
        } else {
            return res.status(StatusCodes.OK).send(
                "Invalid input. Please type 'yes' to confirm or 'no' to cancel."
            );
        }
    }

    async setupClientProfile() {
        const { res, phone, lActivity } = this;

        await setSession(phone, {
            step: steps.COLLECT_USER_FULL_NAME,
            lActivity: lActivity || new Date().toISOString(),
        });

        return res.status(StatusCodes.OK).send(
            "Let's set up your profile. What's your full name?"
        );
    }

    async collectFullName() {
        const { res, phone, message, lActivity } = this;

        if (!message) {
            return res.status(StatusCodes.OK).send(
                "Please provide your full name."
            );
        }

        await setSession(phone, {
            step: steps.COLLECT_USER_ID,
            fullName: message.trim(),
            lActivity: lActivity || new Date().toISOString(),
        });

        return res.status(StatusCodes.OK).send(
            "Thanks! Now, please provide your national ID number."
        );
    }

    async collectNationalId() {
        const { res, phone, message, lActivity } = this;

        if (!message) {
            return res.status(StatusCodes.OK).send(
                "Please provide your national ID number."
            );
        }

        await setSession(phone, {
            step: steps.COLLECT_USER_ADDRESS,
            nationalId: message.trim(),
            lActivity: lActivity || new Date().toISOString(),
        });

        return res.status(StatusCodes.OK).send(
            "Thanks! Now, please provide your address."
        );
    }

    async collectAddress() {
        const { res, phone, message, lActivity } = this;

        if (!message) {
            return res.status(StatusCodes.OK).send(
                "Please provide your address."
            );
        }

        await setSession(phone, {
            step: steps.COLLECT_USER_LOCATION,
            address: message.trim(),
            lActivity: lActivity || new Date().toISOString(),
        });

        return res.status(StatusCodes.OK).send(
            "Thanks! Now, please share your location."
        );
    }

    async collectLocation() {
        const { res, phone, message, lActivity, session } = this;

        if (!message) {
            return res.status(StatusCodes.OK).send(
                "Please share your location."
            );
        }

        const location = this.extractLocation(message);
        if (!location) {
            return res.status(StatusCodes.OK).send(
                "Invalid location. Please share your location again."
            );
        }

        // Update user profile with collected data
        const updatedUser = await updateUser(phone, {
            fullName: session.fullName,
            nationalId: session.nationalId,
            address: session.address,
            location: location,
        });

        await setSession(phone, {
            step: steps.DEFAULT_CLIENT_STATE,
            lActivity: lActivity || new Date().toISOString(),
        });

        return res.status(StatusCodes.OK).send(
            `Profile setup complete! Welcome, ${updatedUser.fullName}.`
        );
    }
}

module.exports = Client;