// services/nlp-service.js
const { OpenAI } = require("openai");
require("dotenv").config()
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function analyzeMessage(text) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user",
                content: `Extract from: "${text}":
                - intent (registration/service_request/other)
                - serviceType (if mentioned)
                - location (if mentioned)
                Return as JSON`
            }]
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error("NLP Error:", error);
        return { intent: 'other' };
    }
}

module.exports = { analyzeMessage };