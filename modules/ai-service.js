const { OpenAI } = require("openai"); // Or use Rasa/HuggingFace

const analyzeMessage = async (text) => {
    // Example using GPT-3.5 (replace with your preferred NLP model)
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
            role: "user",
            content: `Extract from: "${text}" as JSON:
      {
        "intent": "registration|service_request|other",
        "entities": {
          "firstName": "...",
          "lastName": "...",
          "nationalId": "...",
          "address": "..."
        }
      }`
        }]
    });

    return JSON.parse(response.choices[0].message.content);
};

module.exports = { analyzeMessage };