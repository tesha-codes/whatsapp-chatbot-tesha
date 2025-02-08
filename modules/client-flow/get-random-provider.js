const mongoose = require("mongoose");
const ServiceProvider = mongoose.model("ServiceProvider");

// Sample data arrays for generating realistic provider information.
const sampleFirstNames = ["John", "Jane", "Alex", "Emily", "Chris", "Katie", "Michael", "Sarah"];
const sampleLastNames = ["Doe", "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis"];
const sampleCities = ["Harare", "Bulawayo", "Mutare", "Gweru", "Kwekwe", "Masvingo"];
const sampleDescriptions = [
    "Experienced professional offering quality services.",
    "Reliable and friendly, always on time.",
    "High-quality services at affordable rates.",
    "Expert in home repairs and maintenance.",
    "Committed to excellent customer service."
];

const ProviderGenerator = {

    async createProviders(count, serviceId = null) {
        const providers = [];

        for (let i = 0; i < count; i++) {
            const firstName = sampleFirstNames[Math.floor(Math.random() * sampleFirstNames.length)];
            const lastName = sampleLastNames[Math.floor(Math.random() * sampleLastNames.length)];
            const city = sampleCities[Math.floor(Math.random() * sampleCities.length)];
            const description = sampleDescriptions[Math.floor(Math.random() * sampleDescriptions.length)];
            const rating = parseFloat((Math.random() * 4 + 1).toFixed(1)); 
            const service = serviceId ? serviceId : new mongoose.Types.ObjectId();

            // Create a new provider using the ServiceProvider schema.
            const sampleProvider = new ServiceProvider({
                firstName,
                lastName,
                city,
                description,
                rating,
                service,
                // For user and category, generate dummy ObjectIds (or adjust as needed).
                user: new mongoose.Types.ObjectId("67a3f7ca478cc685f7a4bf0d"),
                category: new mongoose.Types.ObjectId(),
                isProfileCompleted: true
            });

            providers.push(sampleProvider);
        }

        // Save all generated providers in parallel.
        await Promise.all(providers.map(provider => provider.save()));
    }
};

module.exports = { ProviderGenerator };
