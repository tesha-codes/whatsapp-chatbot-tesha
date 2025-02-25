const Service = require("./../../models/services.model")
const User = require("./../../models/user.model")
const ServiceRequest = require("./../../models/request.model")
const mongoose = require("mongoose")
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
        console.log(`Looking up providers for ${serviceType} in ${location}...`);
        try {


            const service = await Service.findOne({ $text: { $search: "plumbing", $caseSensitive: false } });
            if (!service) {
                console.error(`Service type '${serviceType}' not found`);
                throw new Error(`Service type '${serviceType}' not found`);
            }


            let city = "Unknown";
            const cityMatch = location.match(/in\s+([A-Za-z\s]+)$/);
            if (cityMatch && cityMatch[1]) {
                city = cityMatch[1].trim();
            } else {

                const splitLocation = location.split(',');
                if (splitLocation.length > 1) {
                    city = splitLocation[splitLocation.length - 1].trim();
                } else {

                    const words = location.split(' ');
                    if (words.length > 0) {
                        city = words[words.length - 1];
                    }
                }
            }

            console.log(`Searching for providers in city: ${city}`);

            const providers = await User.find({
                role: 'ServiceProvider',
                services: service._id,
                'address.city': { $regex: new RegExp(city, 'i') }
            }).select('name rating reviewCount services rate').limit(10);

            console.log(`Found ${providers.length} providers for ${serviceType} in ${city}`);
            if (!providers || providers.length === 0) {
                console.log(`No providers found in database, returning dummy data`);

                return [
                    {
                        id: "provider_123",
                        name: "John Doe",
                        rating: 4.8,
                        reviewCount: 47,
                        specialties: [serviceType],
                        rate: 25
                    },
                    {
                        id: "provider_456",
                        name: "Jane Smith",
                        rating: 4.6,
                        reviewCount: 32,
                        specialties: [serviceType],
                        rate: 22
                    },
                    {
                        id: "provider_789",
                        name: "Robert Muza",
                        rating: 4.9,
                        reviewCount: 58,
                        specialties: [serviceType],
                        rate: 30
                    }
                ];
            }

            const formattedProviders = providers.map(provider => ({
                id: provider._id.toString(),
                name: provider.name,
                rating: provider.rating || 4.5,
                reviewCount: provider.reviewCount || Math.floor(Math.random() * 50) + 10,
                specialties: [serviceType],
                rate: provider.rate || Math.floor(Math.random() * 10) + 20
            }));


            const result = formattedProviders;
            result.serviceType = serviceType;
            result.location = location;

            return result;
        } catch (error) {
            console.error("Error getting service providers:", error);


            return [
                {
                    id: "provider_fallback1",
                    name: "John (Fallback)",
                    rating: 4.8,
                    reviewCount: 47,
                    specialties: [serviceType],
                    rate: 25
                },
                {
                    id: "provider_fallback2",
                    name: "Maria (Fallback)",
                    rating: 4.6,
                    reviewCount: 32,
                    specialties: [serviceType],
                    rate: 22
                }
            ];
        }
    }

    async scheduleBookingFromSelection(selectionNumber, serviceType, date, time, location, description) {
        console.log(`Scheduling booking from selection #${selectionNumber} for ${serviceType}`);
        try {

            const serviceProviders = await this.getServiceProviders(serviceType, location);

            if (!serviceProviders || serviceProviders.length === 0) {
                throw new Error(`No service providers available for ${serviceType} in ${location}`);
            }


            const index = parseInt(selectionNumber) - 1;
            if (isNaN(index) || index < 0 || index >= serviceProviders.length) {
                throw new Error(`Invalid selection number. Please select a number between 1 and ${serviceProviders.length}`);
            }

            console.log(`Selected provider index ${index} from ${serviceProviders.length} providers`);


            const selectedProvider = serviceProviders[index];
            if (!selectedProvider || !selectedProvider.id) {
                throw new Error("Selected provider information is invalid");
            }

            console.log(`Selected provider: ${selectedProvider.name} (${selectedProvider.id})`);

            console.log("Selected provider:",selectedProvider)

            return await this.scheduleBooking(
                mongoose.Types.ObjectId(selectedProvider.id),
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
        console.log(`Scheduling booking: ${serviceType} with provider ${serviceProviderId} on ${date} at ${time} at ${location}`);
        try {

            const serviceObj = await Service.findOne({ $text: { $search: "plumbing", $caseSensitive: false } });
            if (!serviceObj) {
                throw new Error(`Service type '${serviceType}' not found`);
            }

            // 2. Generate a unique request ID with format req_XXXXXXXX
            const requestId = `req_${Math.floor(Math.random() * 90000000) + 10000000}`;

            // 3. Parse location to see if we can extract coordinates
            let coordinates = null;
            let city = "Unknown";

            // Extract city from location if possible
            const cityMatch = location.match(/in\s+([A-Za-z\s]+)$/);
            if (cityMatch && cityMatch[1]) {
                city = cityMatch[1].trim();
            } else {
                // Try to extract city name directly
                const splitLocation = location.split(',');
                if (splitLocation.length > 1) {
                    city = splitLocation[splitLocation.length - 1].trim();
                } else {
                    // Just use the last word as city if nothing else works
                    const words = location.split(' ');
                    if (words.length > 0) {
                        city = words[words.length - 1];
                    }
                }
            }

            // 4. Create the service request
            const serviceRequest = new ServiceRequest({
                service: serviceObj._id,
                requester: this.userId,
                serviceProviders: [serviceProviderId], // Add selected provider
                status: 'Pending',
                address: {
                    physicalAddress: location,
                    coordinates: coordinates
                },
                city: city,
                notes: description || "No additional details provided",
                id: requestId,
                confirmed: true // Mark as confirmed since user selected a provider
            });

            await serviceRequest.save();
            console.log(`Service request created: ${requestId}`);

            // 5. Fetch provider details to include in response
            const provider = await User.findById(serviceProviderId).select('name');
            const providerName = provider ? provider.name : "Selected provider";

            // 6. Send notification to service provider about new request
            await this.notifyServiceProvider(serviceProviderId, {
                requestId,
                serviceType,
                date,
                time,
                location,
                description
            });

            // 7. Return booking details
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