const ServiceRequest = require("../../models/request.model");
const mongoose = require('mongoose');
const { geocodeAddress } = require("../../utils/geocoding");

class ServiceManager {
    constructor(userId) {
        this.userId = userId;
    }

    async createBooking({ serviceType, date, time, location, notes, providerId }) {
        try {
            const service = await mongoose.model('Service').findOne({ type: serviceType });
            if (!service) throw new Error("Service type not found");

            const provider = await mongoose.model('User').findById(providerId);
            if (!provider || provider.role !== 'provider') throw new Error("Invalid provider");

            const bookingId = `BOOK_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

            const booking = new ServiceRequest({
                id: bookingId,
                service: service._id,
                requester: this.userId,
                serviceProviders: [providerId],
                status: 'Pending',
                address: {
                    physicalAddress: location.address,
                    coordinates: location.coordinates
                },
                notes: notes,
                city: location.city
            });

            await booking.save();
            return booking;
        } catch (error) {
            console.error("Error creating booking:", error);
            throw new Error("Failed to create booking. Please try again.");
        }
    }

    async findNearbyProviders(coordinates, serviceType, maxDistance = 10000) {
        try {
            return await mongoose.model('User').find({
                role: 'provider',
                'servicesOffered': serviceType,
                'address.coordinates': {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: coordinates
                        },
                        $maxDistance: maxDistance
                    }
                }
            }).select('firstName lastName rating profilePicture servicesOffered');
        } catch (error) {
            console.error("Error finding providers:", error);
            throw new Error("Failed to search for providers.");
        }
    }

    async getProviderDetails(providerId) {
        try {
            return await mongoose.model('User').findById(providerId)
                .select('firstName lastName rating completedJobs profilePicture bio');
        } catch (error) {
            console.error("Error getting provider details:", error);
            throw new Error("Failed to fetch provider details.");
        }
    }
}

module.exports = ServiceManager;