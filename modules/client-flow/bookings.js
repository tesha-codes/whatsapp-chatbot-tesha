const Service = require("../../models/services.model");
const ServiceProvider = require("../../models/serviceProvider.model");
const ServiceRequest = require("../../models/request.model");
const dateParser = require("../../utils/dateParser");
const BookingUtil = require("../../utils/bookingUtil");

class BookingManager {
  constructor(userId) {
    this.userId = userId;
  }
  async getBookingHistory() {
    try {
      // Fetch actual bookings from database
      const requests = await ServiceRequest.find({ requester: this.userId })
        .populate("service", "title")
        .populate("serviceProviders", "name")
        .sort({ createdAt: -1 })
        .limit(10);

      // If no bookings found, return empty array
      if (!requests || requests.length === 0) {
        return { bookings: [] };
      }

      // Format the bookings data
      const bookings = requests.map((req) => {
        const provider =
          req.serviceProviders && req.serviceProviders.length > 0
            ? req.serviceProviders[0].name
            : "Unassigned";

        return {
          id: req.id,
          serviceType: req.service ? req.service.title : "Unknown Service",
          providerName: provider,
          date: req.date
            ? new Date(req.date).toISOString().split("T")[0]
            : "Not specified",
          time: req.time || "Not specified",
          status: req.status,
          rating: req.rating ? `${req.rating}/5` : undefined,
        };
      });

      return { bookings };
    } catch (error) {
      console.error("Error fetching booking history:", error);
      // Return empty array instead of hardcoded data
      return { bookings: [] };
    }
  }

  async getBookingDetails(bookingId) {
    try {
      // Find the booking in the database
      const request = await ServiceRequest.findOne({ id: bookingId })
        .populate("service", "title description")
        .populate("serviceProviders", "name phone");

      if (!request) {
        throw new Error(`Booking with ID ${bookingId} not found`);
      }

      // Format the booking details
      const provider =
        request.serviceProviders && request.serviceProviders.length > 0
          ? request.serviceProviders[0]
          : null;

      return {
        id: request.id,
        serviceType: request.service
          ? request.service.title
          : "Unknown Service",
        providerName: provider ? provider.name : "Unassigned",
        providerPhone: provider ? provider.phone : "Not available",
        date: request.date
          ? new Date(request.date).toISOString().split("T")[0]
          : "Not specified",
        time: request.time || "Not specified",
        location: request.address
          ? request.address.physicalAddress
          : "Not specified",
        status: request.status,
        description: request.notes || "No description provided",
        notes: request.serviceNotes || "",
        rating: request.rating ? `${request.rating}/5` : undefined,
      };
    } catch (error) {
      console.error("Error fetching booking details:", error);
      throw new Error(`Booking not found: ${error.message}`);
    }
  }
  async scheduleBookingWithProvider(
    provider,
    serviceType,
    date,
    time,
    location,
    description
  ) {
    console.log(
      `Scheduling booking with saved provider: ${provider.name} (${provider.id}) for ${serviceType}`
    );
    try {
      // Parse date and time
      const parsedDate = dateParser.parseDate(date);
      if (!parsedDate.success) {
        throw new Error(`Invalid date: ${parsedDate.message}`);
      }

      const parsedTime = dateParser.parseTime(time);
      if (!parsedTime.success) {
        throw new Error(`Invalid time: ${parsedTime.message}`);
      }

      // Find service
      let serviceObj = await Service.findOne({
        $text: { $search: serviceType, $caseSensitive: false },
      });

      if (!serviceObj) {
        // Try to find by title
        serviceObj = await Service.findOne({
          title: { $regex: new RegExp(serviceType, "i") },
        });

        if (!serviceObj) {
          throw new Error(`Service type '${serviceType}' not found`);
        }
      }

      // Generate a unique request ID
      const requestId = await BookingUtil.generateUniqueBookingId()

      // Extract city from location
      const city = BookingUtil.extractCity(location);

      // Combine date and time for a full datetime object
      const bookingDate = new Date(`${parsedDate.date}T${parsedTime.time}:00`);

      // Create service request object
      const serviceRequest = new ServiceRequest({
        service: serviceObj._id,
        requester: this.userId,
        serviceProviders: [provider.id],
        status: "Pending",
        address: {
          physicalAddress: location,
        },
        city: city,
        notes: description || "No additional details provided",
        id: requestId,
        confirmed: true,
        date: bookingDate,
        time: parsedTime.time,
        createdAt: new Date(),
      });

      // Save the request to database
      await serviceRequest.save();
      console.log(`Service request created with ID: ${requestId}`);

      // Send notification to the provider
      await this.notifyServiceProvider(provider.id, {
        requestId,
        serviceType,
        date: parsedDate.date,
        time: parsedTime.time,
        location,
        description,
      });

      // Return booking details
      return {
        bookingId: requestId,
        serviceType,
        date,
        time,
        location,
        description,
        providerName: provider.name,
        status: "Pending",
      };
    } catch (error) {
      console.error("Error in scheduleBookingWithProvider:", error);
      throw new Error(`Failed to schedule booking: ${error.message}`);
    }
  }

  async notifyServiceProvider(providerId, requestDetails) {
    try {
      // Find the provider by ID
      const provider = await ServiceProvider.findById(providerId).populate("user", "firstName lastName phone");
      if (!provider) {
        console.error(
          `Provider with ID ${providerId} not found for notification`
        );
        return false;
      }

      const message = `
🔔 New Service Request 🔔

Hello ${provider.user?.firstName || provider.user?.lastName || "Provider"},

You have a new service request:
- Request ID: ${requestDetails.requestId}
- Service: ${requestDetails.serviceType}
- Date: ${requestDetails.date}
- Time: ${requestDetails.time}
- Location: ${requestDetails.location}
- Description: ${requestDetails.description || "No details provided"}

Please login to your Tesha provider app to accept or decline this request.

Thank you,
Tesha Team
`;
      console.log(message);
      console.log(
        `[NOTIFICATION] Sending provider notification to ${provider.user?.phone}`
      );
      console.log(
        `Successfully notified provider ${providerId} about request ${requestDetails.requestId}`
      );

      // TODO: Implement actual WhatsApp notification integration here
      // This could be a call to your WhatsApp messaging service

      return true;
    } catch (error) {
      console.error("Error notifying service provider:", error);
      return false;
    }
  }

  async rescheduleBooking(bookingId, newDate, newTime) {
    console.log(
      `Rescheduling booking ${bookingId} to ${newDate} at ${newTime}`
    );
    try {
      // Find the booking in database
      const booking = await ServiceRequest.findOne({ id: bookingId });

      if (!booking) {
        throw new Error(`Booking with ID ${bookingId} not found`);
      }

      // Update the booking
      booking.date = newDate;
      booking.time = newTime;
      booking.updatedAt = new Date();

      await booking.save();

      // TODO:  Notify provider of rescheduling

      return {
        bookingId,
        newDate,
        newTime,
        success: true,
      };
    } catch (error) {
      console.error("Error rescheduling booking:", error);
      throw new Error(`Failed to reschedule booking: ${error.message}`);
    }
  }

  async cancelBooking(bookingId, reason) {
    console.log(`Cancelling booking ${bookingId} due to: ${reason}`);
    try {
      // Find the booking in database
      const booking = await ServiceRequest.findOne({ id: bookingId });

      if (!booking) {
        throw new Error(`Booking with ID ${bookingId} not found`);
      }

      // Update booking status
      booking.status = "Cancelled";
      booking.cancelReason = reason;
      booking.updatedAt = new Date();

      await booking.save();

      //  TODO: Notify provider of cancellation

      return {
        bookingId,
        reason,
        success: true,
      };
    } catch (error) {
      console.error("Error cancelling booking:", error);
      throw new Error(`Failed to cancel booking: ${error.message}`);
    }
  }
}

module.exports = BookingManager;
