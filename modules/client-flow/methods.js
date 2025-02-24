const ServiceProvider = require("./../../models/serviceProvider.model")
const Services = require("./../../models/services.model")


class ServiceRequestManager {
    constructor(userId) {
        this.userId = userId;
    }

    async createServiceRequest(serviceType, description, location, preferredDate, preferredTime) {
        try {
            // In a real implementation, this would interact with a database
            const requestId = `req_${Date.now().toString().slice(-8)}`;

            // Store the service request in database
            await ServiceProvider.create({
                requestId,
                userId: this.userId,
                serviceType,
                description,
                location,
                preferredDate,
                preferredTime,
                status: "PENDING",
                createdAt: new Date()
            });

            return {
                requestId,
                serviceType,
                description,
                location,
                preferredDate,
                preferredTime
            };
        } catch (error) {
            console.error("Error creating service request:", error);
            throw new Error("Failed to create service request");
        }
    }

    async getAvailableServices() {
        try {
            const result = await Services.find()
            return result
        } catch (error) {
            console.error("Error fetching available services:", error);
            throw new Error("Failed to fetch available services");
        }
    }

    async getServiceProviders(serviceType, location) {
        try {
            return {
                serviceType,
                location,
                providers: [
                    {
                        id: "provider_123",
                        name: "John Smith",
                        specialties: ["Plumbing", "Electrical"],
                        rating: 4.8,
                        reviewCount: 47,
                        hourlyRate: 25,
                        availability: ["weekdays", "weekends"]
                    },
                    {
                        id: "provider_456",
                        name: "Maria Johnson",
                        specialties: ["Plumbing", "General Repair"],
                        rating: 4.6,
                        reviewCount: 32,
                        hourlyRate: 22,
                        availability: ["weekdays"]
                    },
                    {
                        id: "provider_789",
                        name: "Robert Khoza",
                        specialties: ["Plumbing", "Installation"],
                        rating: 4.9,
                        reviewCount: 58,
                        hourlyRate: 30,
                        availability: ["weekends"]
                    }
                ]
            };
        } catch (error) {
            console.error("Error fetching service providers:", error);
            throw new Error("Failed to fetch service providers");
        }
    }
}

module.exports = ServiceRequestManager;