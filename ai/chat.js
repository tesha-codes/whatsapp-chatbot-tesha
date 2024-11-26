const openai = require('../config/openai');
const readLine = require('readline');

async function sendDynamicMessage(message) {

    const systemInstructions = `
You are a multilingual assistant that extracts service requests from messages in English, Shona, Ndebele, or a mix of these languages. 
- If the message contains a clear service request, confirm the user's intent by restating the service and asking for confirmation (e.g., "You mentioned fixing your roof. Is this correct?").
- If the user confirms, prompt them to describe their request in detail (e.g., "Can you clearly describe what you're looking for?").
- If the message is unclear or no service is mentioned, ask them to specify their need directly (e.g., "Could you let us know what you're looking for?").
- Keep responses short, polite, and engaging.
`;

    const userMessage = `
A user has messaged: "${message}". 
They are currently on the 'SELECT_SERVICE_CATEGORY' step. 
Based on their input, respond accordingly:
- Confirm the service if mentioned.
- If confirmed, ask for additional details about the service.
- If unclear, prompt them to specify their need.
`;

    try {
        const queryResponse = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: systemInstructions },
                { role: 'user', content: userMessage },
            ],
            model: 'chatgpt-4o-latest',
            temperature: 0.7,
            max_tokens: 150,
        });

        const dynamicMessage = queryResponse.choices[0].message;
        return dynamicMessage;
    } catch (error) {
        console.error('Error with OpenAI API:', error);
        return { content: 'Sorry, something went wrong. Please try again later.' };
    }
}

class ConversationManager {

    constructor() {
        // Store conversation history
        this.conversationHistory = [];

        // Track current conversation state
        this.currentState = {
            step: 'SELECT_SERVICE_CATEGORY',
            selectedService: null,
            serviceDetails: {}
        };
    }

    async sendDynamicMessage(message) {
        // Prepare system instructions with context awareness
        const systemInstructions = `
You are a multilingual assistant that helps users find the right handyman service.
Conversation Context:
- Current Step: ${this.currentState.step}
- Selected Service: ${this.currentState.selectedService || 'Not selected'}

Guidelines:
- Extract service requests from messages in English, Shona, Ndebele, or mixed languages
- Keep responses short, polite, and engaging
- Guide the user through service selection and details
- Aim to understand the specific service needs clearly
`;

        // Prepare user message with full conversation history
        const userMessage = `
Previous Conversation History:
${this.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current User Message: "${message}"
`;

        try {
            const queryResponse = await openai.chat.completions.create({
                messages: [
                    { role: 'system', content: systemInstructions },
                    { role: 'user', content: userMessage },
                ],
                model: 'gpt-4o',
                temperature: 0.7,
                max_tokens: 250,
            });

            const dynamicMessage = queryResponse.choices[0].message;

            // Update conversation history
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: dynamicMessage.content }
            );

            // Update conversation state based on response logic
            this.updateConversationState(message, dynamicMessage.content);

            return dynamicMessage;
        } catch (error) {
            console.error('Error with OpenAI API:', error);
            return { content: 'Sorry, something went wrong. Please try again later.' };
        }
    }

    updateConversationState(userMessage, assistantResponse) {
        // Logic to update conversation state and progress
        if (this.currentState.step === 'SELECT_SERVICE_CATEGORY') {
            // Check if a service was identified
            const services = ['roof repair', 'plumbing', 'electrical', 'painting', 'carpentry'];
            const identifiedService = services.find(service =>
                userMessage.toLowerCase().includes(service)
            );

            if (identifiedService) {
                this.currentState.selectedService = identifiedService;
                this.currentState.step = 'CONFIRM_SERVICE';
            }
        } else if (this.currentState.step === 'CONFIRM_SERVICE') {
            // Check for user confirmation
            if (['yes', 'confirm', 'correct'].some(word =>
                userMessage.toLowerCase().includes(word))) {
                this.currentState.step = 'GATHER_SERVICE_DETAILS';
            }
        } else if (this.currentState.step === 'GATHER_SERVICE_DETAILS') {
            // Store detailed service information
            this.currentState.serviceDetails = {
                description: userMessage,
                timestamp: new Date()
            };
            this.currentState.step = 'MATCH_HANDYMAN';
        } else if (this.currentState.step === 'MATCH_HANDYMAN') {
            // Final step - could integrate with a handyman matching system
            this.currentState.step = 'COMPLETE';
        }
    }

    // Method to reset conversation if needed
    resetConversation() {
        this.conversationHistory = [];
        this.currentState = {
            step: 'SELECT_SERVICE_CATEGORY',
            selectedService: null,
            serviceDetails: {}
        };
    }
}


const conversationManager = new ConversationManager();

const read = readLine.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const startConversation = () => {
    const askQuestion = (promptText) => {
        read.question(promptText, async (answer) => {
            if (answer.toLowerCase() === 'exit') {
                read.close();
                return;
            }

            const message = await conversationManager.sendDynamicMessage(answer);
            console.log('Assistant =>', message.content);

            startConversation();
        });
    };
    askQuestion("Ask about handyman services (type 'exit' to quit):\n");
};

startConversation();