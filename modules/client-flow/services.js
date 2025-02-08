const openai = require("../../config/openai");
const mongoose = require('mongoose');

// Zimbabwe cities with coordinates
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
                        content: `You are a data generator for a service provider platform in Zimbabwe. 
                        Generate realistic data for service providers including names, contact details, and professional information.`
                    },
                    {
                        role: "user",
                        content: `Generate ${count} service providers with these details:
                        - Full name (firstName, lastName)
                        - Email (professional format)
                        - Phone (Zimbabwe format: +263 7X XXX XXXX)
                        - Professional description
                        - EcoCash number (Zimbabwe mobile money format)
                        Return as JSON array with these exact fields.`
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
            // Seed categories
            const categories = [
                { name: 'Home Cleaning', description: 'House cleaning and maintenance services' },
                { name: 'Repairs', description: 'General repair services' },
                { name: 'Professional', description: 'Professional services' }
            ];
            await mongoose.model('Category').insertMany(categories);

            // Seed services
            const services = [
                {
                    name: 'House Cleaning',
                    category: categories[0]._id,
                    description: 'Regular house cleaning service',
                    basePrice: 30
                },
                {
                    name: 'Plumbing',
                    category: categories[1]._id,
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
            // Check if we need to seed initial data
            const categoriesCount = await mongoose.model('Category').countDocuments();
            if (categoriesCount === 0) {
                await this.seedInitialData();
            }

            // Generate provider data using OpenAI
            const { providers } = await this.generateProviderData(count);

            const savedProviders = [];
            for (const data of providers) {
                // Create user
                const city = CITIES[Math.floor(Math.random() * CITIES.length)];
                const user = new (mongoose.model('User'))({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    phone: data.phone,
                    role: 'provider',
                    address: {
                        physicalAddress: `${Math.floor(Math.random() * 1000)} Sample St, ${city.name}`,
                        city: city.name,
                        coordinates: {
                            type: 'Point',
                            coordinates: city.coords
                        }
                    }
                });
                await user.save();

                // Get random related data
                const category = await this.getRandomDocument('Category');
                const service = await this.getRandomDocument('Service');
                const subscription = await this.getRandomDocument('Subscription');

                // Create provider profile
                const provider = new (mongoose.model('ServiceProvider'))({
                    user: user._id,
                    category: category._id,
                    service: service._id,
                    city: city.name,
                    nationalIdImage: 'default_id.jpg',
                    description: data.description,
                    ecocashNumber: data.ecocashNumber,
                    subscription: subscription._id,
                    isProfileCompleted: true,
                    rating: (Math.random() * 2 + 3).toFixed(1) // Random rating between 3.0 and 5.0
                });
                await provider.save();

                savedProviders.push({ user, provider });
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
        return await Model.findOne().skip(random);
    }
}

// Updated ServiceManager class
class ServiceManager {
    constructor(userId) {
        this.userId = userId;
    }

    async findNearbyProviders(coordinates, serviceType, maxDistance = 10000) {
        try {
            const ServiceProvider = mongoose.model('ServiceProvider');
            let providers = await ServiceProvider.find({
                service: serviceType
            })
                .populate('user')
                .populate('category')
                .populate('service')
                .limit(10);

            // If no providers found, generate sample providers
            if (providers.length === 0) {
                console.log("No providers found, generating sample data...");
                await ProviderGenerator.createProviders(5);

                providers = await ServiceProvider.find({
                    service: serviceType
                })
                    .populate('user')
                    .populate('category')
                    .populate('service')
                    .limit(10);
            }

            return providers;
        } catch (error) {
            console.error("Error finding providers:", error);
            throw error;
        }
    }

    async getProviderDetails(providerId) {
        try {
            return await mongoose.model('ServiceProvider')
                .findById(providerId)
                .populate('user')
                .populate('category')
                .populate('service')
                .populate('subscription');
        } catch (error) {
            console.error("Error getting provider details:", error);
            throw error;
        }
    }

    async createBooking(bookingData) {
        try {
            const booking = new (mongoose.model('ServiceRequest'))({
                id: `BOOK_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                service: bookingData.serviceType,
                requester: this.userId,
                serviceProviders: [bookingData.providerId],
                status: 'Pending',
                address: {
                    physicalAddress: bookingData.location.address,
                    coordinates: bookingData.location.coordinates,
                    city: bookingData.location.city
                },
                notes: bookingData.notes
            });

            await booking.save();
            return booking;
        } catch (error) {
            console.error("Error creating booking:", error);
            throw error;
        }
    }
}

module.exports = {
    ProviderGenerator,
    ServiceManager
};