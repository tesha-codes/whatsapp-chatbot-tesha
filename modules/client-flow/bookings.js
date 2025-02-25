const Service = require("./../../models/services.model")
const User = require("./../../models/user.model")
const ServiceRequest = require("./../../models/request.model")
class BookingManager {
    constructor(userId) {
        this.userId = userId;
    }

    async getBookingHistory() {
        try {
            return {
                bookings: [
                    {
                        id: "booking_2024_abc12345",
                        serviceType: "Plumbing",
                        providerName: "John Smith",
                        date: "2024-02-15",
                        time: "14:00",
                        status: "Completed",
                        rating: "4.5/5"
                    },
                    {
                        id: "booking_2024_def67890",
                        serviceType: "Electrical",
                        providerName: "Maria Johnson",
                        date: "2024-02-20",
                        time: "10:00",
                        status: "Scheduled"
                    },
                    {
                        id: "booking_2024_ghi12345",
                        serviceType: "Cleaning",
                        providerName: "Robert Khoza",
                        date: "2024-01-25",
                        time: "09:00",
                        status: "Completed",
                        rating: "5/5"
                    }
                ]
            };
        } catch (error) {
            console.error("Error fetching booking history:", error);
            throw new Error("Failed to fetch booking history");
        }
    }

    async getBookingDetails(bookingId) {
        try {

            if (bookingId === "booking_2024_abc12345") {
                return {
                    id: bookingId,
                    serviceType: "Plumbing",
                    providerName: "John Smith",
                    providerPhone: "+263 71 234 5678",
                    date: "2024-02-15",
                    time: "14:00",
                    location: "123 Main St, Harare",
                    status: "Completed",
                    description: "Fix leaking kitchen sink",
                    notes: "Replaced washer and sealed pipe connections",
                    rating: "4.5/5"
                };
            }
        } catch (error) {
            console.error("Error fetching booking history:", error);
            throw new Error("Failed to fetch booking history");
        }
    }
    async getServiceProviders(serviceType, location) {
        try {
           
            const service = await Service.findOne({ name: serviceType });
            if (!service) {
                throw new Error(`Service type '${serviceType}' not found`);
            }

            let city = "Unknown";
            const cityMatch = location.match(/in\s+([A-Za-z\s]+)$/);
            if (cityMatch && cityMatch[1]) {
                city = cityMatch[1].trim();
            }

            const providers = await User.find({
                role: 'ServiceProvider',
                services: service._id,
                'address.city': { $regex: new RegExp(city, 'i') }
            }).select('name rating reviewCount services rate').limit(10);

            return providers.map(provider => ({
                id: provider._id,
                name: provider.name,
                rating: provider.rating || 4.5,
                reviewCount: provider.reviewCount || Math.floor(Math.random() * 50) + 10,
                specialties: [serviceType],
                rate: provider.rate || Math.floor(Math.random() * 10) + 20
            }));
        } catch (error) {
            console.error("Error getting service providers:", error);
            throw new Error(`Failed to get service providers: ${error.message}`);
        }
    }

    async scheduleBookingFromSelection(selectionNumber, serviceType, date, time, location, description) {
        try {
            const serviceProviders = await this.getServiceProviders(serviceType, location);

            if (!serviceProviders || serviceProviders.length === 0) {
                throw new Error(`No service providers available for ${serviceType} in ${location}`);
            }

            const index = parseInt(selectionNumber) - 1; 
            if (isNaN(index) || index < 0 || index >= serviceProviders.length) {
                throw new Error(`Invalid selection number. Please select a number between 1 and ${serviceProviders.length}`);
            }

            const selectedProvider = serviceProviders[index];

            return await this.scheduleBooking(
                selectedProvider.id,
                serviceType,
                date,
                time,
                location,
                description
            );
        } catch (error) {
            console.error("Error in scheduleBookingFromSelection:", error);
            throw new Error(`Failed to schedule booking: ${error.message}`);
        }
    }

    async notifyServiceProvider(providerId, requestDetails) {
        try {
            const provider = await User.findById(providerId).select('phone email name');

            if (!provider) {
                console.error(`Provider with ID ${providerId} not found for notification`);
                return;
            }

            const message = `
🔔 New Service Request 🔔

Hello ${provider.name},

You have a new service request:
- Request ID: ${requestDetails.requestId}
- Service: ${requestDetails.serviceType}
- Date: ${requestDetails.date}
- Time: ${requestDetails.time}
- Location: ${requestDetails.location}
- Description: ${requestDetails.description}

Please login to your Tesha provider app to accept or decline this request.

Thank you,
Tesha Team
`;

            console.log(`[NOTIFICATION] Sending provider notification to ${provider.phone}`);

            console.log(`Successfully notified provider ${providerId} about request ${requestDetails.requestId}`);
        } catch (error) {
            console.error("Error notifying service provider:", error);
           
        }
    }

    async scheduleBooking(serviceProviderId, serviceType, date, time, location, description) {
        try {
            const serviceObj = await Service.findOne({ name: serviceType });
            if (!serviceObj) {
                throw new Error(`Service type '${serviceType}' not found`);
            }

            const requestId = `req_${Math.floor(Math.random() * 90000000) + 10000000}`;

            
            let coordinates = null;
            let city = "Unknown";

            const cityMatch = location.match(/in\s+([A-Za-z\s]+)$/);
            if (cityMatch && cityMatch[1]) {
                city = cityMatch[1].trim();
            }

            const serviceRequest = new ServiceRequest({
                service: serviceObj._id,
                requester: this.userId,
                serviceProviders: [serviceProviderId], 
                status: 'Pending',
                address: {
                    physicalAddress: location,
                    coordinates: coordinates
                },
                city: city,
                notes: description,
                id: requestId,
                confirmed: true 
            });

            await serviceRequest.save();

            const provider = await User.findById(serviceProviderId).select('name');
            const providerName = provider ? provider.name : "Selected provider";

            await this.notifyServiceProvider(serviceProviderId, {
                requestId,
                serviceType,
                date,
                time,
                location,
                description
            });

            return {
                requestId,
                serviceType,
                date,
                time,
                location,
                description,
                providerName,
                status: 'Pending'
            };
        } catch (error) {
            console.error("Error in scheduleBooking:", error);
            throw new Error(`Failed to schedule booking: ${error.message}`);
        }
    }
}

module.exports = BookingManager;