const mongoose = require('mongoose');
const { ProviderGenerator } = require('./get-random-provider');

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

module.exports = ServiceManager;
