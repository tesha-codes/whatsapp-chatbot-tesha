const openai = require('../config/openai');
const readLine = require('readline');
const ServiceReference = require('../models/services.model');
const connectDb = require('../database/connect.database')

connectDb(process.env.MONGO_URL)
    .then(async (response) => {
        console.log(`Successfully connected to ${response.db.databaseName} ✅✅`);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

const sendMessage = async (message) => {
    const queryResponse = await openai.chat.completions
        .create({
            messages: [
                {
                    role: 'system',
                    content: "You are a multilingual assistant that extracts service requests from messages in English, Shona,Ndebele, or a mixer of either. In Zimbabwe people often mix languages shona and english or ndebele and english or both.Return one word to describe the service required"
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            model: 'chatgpt-4o-latest',
            max_tokens: 200
        });
    return queryResponse.choices[0].message.content
};



const handleServiceRequest = async (query) => {
    console.log("QUery: ", query)
    const providers = await ServiceReference.find({
        $text: { $search: query }
    });

    if (providers.length === 0) {
        return `Sorry, we couldn't find providers for "${query}". Please try again with a different request.`;
    }

    // Create response with provider list
    const providerList = providers.map((p, index) => `${index + 1}. ${p.title} - ${p.description}`).join('\n');
    return `Which of the following services best describe what you're looking for.":\n\n${providerList}\n\nPlease reply with the number of your choice to proceed.`;
};


const read = readLine.createInterface(
    {
        input: process.stdin,
        output: process.stdout
    }
);

const startConversation = () => {
    read.question("Ask ChatGPT anything!\n", async (answer) => {
        const message = await sendMessage(answer);
        const services = await handleServiceRequest(message)
        console.log(services);
        read.close();
    });

}
startConversation()

