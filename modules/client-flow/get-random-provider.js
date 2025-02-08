const openai = require("../../config/openai");
const mongoose = require('mongoose');

// Zimbabwe cities with coordinates [longitude, latitude]
const CITIES = [
    { name: 'Harare', coords: [31.0492, -17.8216] },
    { name: 'Bulawayo', coords: [28.5833, -20.1500] },
    { name: 'Chitungwiza', coords: [31.0750, -18.0127] },
    { name: 'Mutare', coords: [32.6500, -18.9667] },
    { name: 'Gweru', coords: [29.8167, -19.4500] }
];

class ProviderGenerator {
    static async generateProviderData(count = 5) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: `Generate realistic Zimbabwean service provider data in JSON format. 
                        Include these fields for each provider: firstName, lastName, email, phone, description, ecocashNumber.`
                    },
                    {
                        role: "user",
                        content: `Create ${count} service providers with:
                        - Zimbabwean names
                        - Professional emails
                        - Zimbabwean phone numbers (+263 format)
                        - Realistic service descriptions
                        - Valid EcoCash numbers
                        Return as { "providers": [...] }`
                    }
                ],
                response_format: { type: "json_object" }
            });

            return JSON.parse(completion.choices[0].message.content);
        } catch (error) {
            console.error("Error generating provider data:", error);
            throw error;
        }
    }

    static async seedInitialData() {
        try {
            const categories = [
                { name: 'Home Cleaning', description: 'House cleaning and maintenance services' },
                { name: 'Repairs', description: 'General repair services' },
                { name: 'Professional', description: 'Professional services' }
            ];
            await mongoose.model('Category').insertMany(categories);

            const services = [
                {
                    name: 'House Cleaning',
                    category: (await mongoose.model('Category').findOne({ name: 'Home Cleaning' }))._id,
                    description: 'Regular house cleaning service',
                    basePrice: 30
                },
                {
                    name: 'Plumbing',
                    category: (await mongoose.model('Category').findOne({ name: 'Repairs' }))._id,
                    description: 'Plumbing repair and maintenance',
                    basePrice: 50
                }
            ];
            await mongoose.model('Service').insertMany(services);

            // Seed subscriptions
            const subscriptions = [
                {
                    name: 'Basic',
                    price: 10,
                    duration: 30,
                    features: ['Basic listing', 'Customer support']
                },
                {
                    name: 'Premium',
                    price: 30,
                    duration: 30,
                    features: ['Featured listing', 'Priority support', 'Analytics']
                }
            ];
            await mongoose.model('Subscription').insertMany(subscriptions);

        } catch (error) {
            console.error("Error seeding initial data:", error);
            throw error;
        }
    }

    static async createProviders(count = 5) {
        try {
         
            if ((await mongoose.model('Category').countDocuments()) === 0) {
                await this.seedInitialData();
            }

            const { providers } = await this.generateProviderData(count);
            const savedProviders = [];

            for (const data of providers) {
                const city = CITIES[Math.floor(Math.random() * CITIES.length)];

                const user = new (mongoose.model('User'))({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    phone: data.phone,
                    role: 'provider',
                    address: {
                        physicalAddress: `${Math.floor(Math.random() * 1000)} ${city.name} Street`,
                        city: city.name,
                        coordinates: {
                            latitude: city.coords[1].toString(),
                            longitude: city.coords[0].toString()
                        }
                    }
                });
                await user.save();

                const provider = new (mongoose.model('ServiceProvider'))({
                    user: user._id,
                    category: await this.getRandomDocument('Category'),
                    service: await this.getRandomDocument('Service'),
                    description: data.description,
                    ecocashNumber: data.ecocashNumber,
                    subscription: await this.getRandomDocument('Subscription'),
                    isProfileCompleted: true,
                    rating: parseFloat((Math.random() * 2 + 3).toFixed(1)), // 3.0-5.0
                    completedJobs: Math.floor(Math.random() * 100)
                });
                await provider.save();

                savedProviders.push(provider);
            }

            return savedProviders;
        } catch (error) {
            console.error("Error creating providers:", error);
            throw error;
        }
    }

    static async getRandomDocument(modelName) {
        const Model = mongoose.model(modelName);
        const count = await Model.countDocuments();
        const random = Math.floor(Math.random() * count);
        return Model.findOne().skip(random);
    }
}

module.exports = ProviderGenerator;