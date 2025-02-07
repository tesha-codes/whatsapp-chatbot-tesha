const ServiceRequest = require("../../models/request.model");

class ServiceManager {
    constructor(userId) {
        this.userId = userId;
    }

    async createBooking({ serviceType, date, time, location, notes }) {
        try {
            // First get the service ID based on service type
            const service = await mongoose.model('Service').findOne({
                type: serviceType
            });

            if (!service) {
                throw new Error("Service type not found");
            }

            // Generate a unique booking ID
            const bookingId = `BOOK_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

            const booking = new ServiceRequest({
                id: bookingId,
                service: service._id,
                requester: this.userId,
                status: 'Pending',
                address: {
                    physicalAddress: location,
                },
                notes: notes,
                city: location.split(',').pop().trim(), // Extract city from location
                serviceProviders: [] // Will be assigned later
            });

            await booking.save();
            return booking;
        } catch (error) {
            console.error("Error creating booking:", error);
            throw new Error("Failed to create booking. Please try again.");
        }
    }

    async getBookings(status = 'all') {
        try {
            let query = { requester: this.userId };

            if (status !== 'all') {
                query.status = status;
            }

            const bookings = await ServiceRequest.find(query)
                .populate('service', 'title type price')
                .populate('serviceProviders', 'firstName lastName')
                .sort({ createdAt: -1 });

            return bookings.map(booking => ({
                id: booking.id,
                serviceType: booking.service.type,
                status: booking.status,
                location: booking.address.physicalAddress,
                date: booking.createdAt,
                provider: booking.serviceProviders.length > 0
                    ? `${booking.serviceProviders[0].firstName} ${booking.serviceProviders[0].lastName}`
                    : 'Unassigned',
                notes: booking.notes
            }));
        } catch (error) {
            console.error("Error getting bookings:", error);
            throw new Error("Failed to fetch bookings.");
        }
    }

    async getBookingDetails(bookingId) {
        try {
            const booking = await ServiceRequest.findOne({
                id: bookingId,
                requester: this.userId
            })
                .populate('service', 'title type price description')
                .populate('serviceProviders', 'firstName lastName phone');

            if (!booking) {
                throw new Error("Booking not found");
            }

            return {
                id: booking.id,
                service: {
                    type: booking.service.type,
                    title: booking.service.title,
                    price: booking.service.price,
                    description: booking.service.description
                },
                status: booking.status,
                location: booking.address.physicalAddress,
                city: booking.city,
                date: booking.createdAt,
                notes: booking.notes,
                provider: booking.serviceProviders.length > 0 ? {
                    name: `${booking.serviceProviders[0].firstName} ${booking.serviceProviders[0].lastName}`,
                    phone: booking.serviceProviders[0].phone
                } : null
            };
        } catch (error) {
            console.error("Error getting booking details:", error);
            throw new Error("Failed to fetch booking details.");
        }
    }

    async getPendingBookingsCount() {
        try {
            return await ServiceRequest.countDocuments({
                requester: this.userId,
                status: 'Pending'
            });
        } catch (error) {
            console.error("Error counting pending bookings:", error);
            return 0;
        }
    }

    async cancelBooking(bookingId) {
        try {
            const booking = await ServiceRequest.findOne({
                id: bookingId,
                requester: this.userId,
                status: { $in: ['Pending', 'In Progress'] }
            });

            if (!booking) {
                throw new Error("Booking not found or cannot be cancelled");
            }

            booking.status = 'Cancelled';
            await booking.save();

            return {
                id: booking.id,
                status: 'Cancelled',
                message: 'Booking cancelled successfully'
            };
        } catch (error) {
            console.error("Error cancelling booking:", error);
            throw new Error("Failed to cancel booking.");
        }
    }

    async checkServiceAvailability(serviceType, date) {
        try {
            // Get the service ID
            const service = await mongoose.model('Service').findOne({
                type: serviceType
            });

            if (!service) {
                throw new Error("Service type not found");
            }

            // Count active bookings for this service on the given date
            const activeBookings = await ServiceRequest.countDocuments({
                service: service._id,
                status: { $in: ['Pending', 'In Progress'] },
                createdAt: {
                    $gte: new Date(date).setHours(0, 0, 0),
                    $lt: new Date(date).setHours(23, 59, 59)
                }
            });

            // Assuming each service has a daily limit of bookings
            const isAvailable = activeBookings < (service.dailyLimit || 10);

            return {
                available: isAvailable,
                message: isAvailable
                    ? "Service is available for booking"
                    : "Service is fully booked for this date"
            };
        } catch (error) {
            console.error("Error checking service availability:", error);
            throw new Error("Failed to check service availability.");
        }
    }
}

module.exports = ServiceManager;