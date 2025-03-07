const Service = require("./../../models/services.model");
const User = require("./../../models/user.model");
const ServiceRequest = require("./../../models/request.model");
const crypto = require("crypto");
const dateParser = require("../../utils/dateParser");

class BookingManager {
  constructor(userId) {
    this.userId = userId;
  }

  // Generate a cryptographically secure unique booking ID
  async generateUniqueBookingId() {
    const attempts = 10;
    for (let i = 0; i < attempts; i++) {
      // Generate 8 random bytes and convert to alphanumeric string
      const randomBytes = crypto.randomBytes(4); // 4 bytes gives 8 hex characters
      const id = `REQ${randomBytes.toString("hex").substring(0, 8)}`;

      // Check if ID exists in database directly (no Redis cache check)
      const bookingExists = await ServiceRequest.exists({ id });
      if (!bookingExists) {
        return id;
      }
    }
    // Fallback to timestamp-based ID if all attempts fail, but this should be rare
    const timestamp = Date.now().toString();
    return `REQ${timestamp.slice(-8)}`;
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

  extractCity(location) {
    if (!location) return "Unknown";

    // Try different patterns to extract city
    const cityMatch = location.match(/in\s+([A-Za-z\s]+)$/i);
    if (cityMatch && cityMatch[1]) {
      return cityMatch[1].trim();
    }

    const splitLocation = location.split(",");
    if (splitLocation.length > 1) {
      return splitLocation[splitLocation.length - 1].trim();
    }

    const words = location.split(" ");
    if (words.length > 0) {
      return words[words.length - 1].trim();
    }

    return "Unknown";
  }

  async scheduleBookingFromSelection(
    selectionNumber,
    serviceType,
    date,
    time,
    location,
    description
  ) {
    console.log(
      `Scheduling booking from selection #${selectionNumber} for ${serviceType}`
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
      const service = await Service.findOne({
        $text: { $search: serviceType, $caseSensitive: false },
      });

      if (!service) {
        throw new Error(`Service type '${serviceType}' not found`);
      }

      // Find providers directly from database
      const city = this.extractCity(location);
      const providers = await User.find({
        accountType: "ServiceProvider",
        services: service._id,
        ...(city && city !== "Unknown"
          ? {
              $or: [
                {
                  "address.physicalAddress": {
                    $regex: new RegExp(city, "i"),
                  },
                },
                { "address.city": { $regex: new RegExp(city, "i") } },
              ],
            }
          : {}),
      })
        .select("_id name rating reviewCount services rate")
        .limit(5);

    if (!providers || providers.length === 0) {
      // Return empty array if no providers found
      return {
        bookingId: null,
        message: `No service providers available for ${serviceType} in ${location}`,
        providers: []
      };
    }


      // Format providers
      const formattedProviders = providers.map((p) => ({
        id: p._id.toString(),
        name: p.name || "Unknown Provider",
        rating: p.rating || 4.5,
        reviewCount: p.reviewCount || 25,
        specialties: [serviceType],
        rate: p.rate || 25,
      }));

      // Validate selection
      const index = parseInt(selectionNumber) - 1;
      if (isNaN(index) || index < 0 || index >= formattedProviders.length) {
        throw new Error(
          `Invalid selection number. Please select a number between 1 and ${formattedProviders.length}`
        );
      }

      console.log(
        `Selected provider index ${index} from ${formattedProviders.length} providers`
      );

      // Get selected provider
      const selectedProvider = formattedProviders[index];
      if (!selectedProvider || !selectedProvider.id) {
        throw new Error("Selected provider information is invalid");
      }

      console.log(
        `Selected provider: ${selectedProvider.name} (${selectedProvider.id})`
      );

      // Schedule the booking with the selected provider
      return await this.scheduleBooking(
        selectedProvider.id,
        serviceType,
        parsedDate.date,
        parsedTime.time,
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
      const provider = await User.findById(providerId).select("phone name");

      if (!provider) {
        console.error(
          `Provider with ID ${providerId} not found for notification`
        );
        return false;
      }

      // Format date and time for better readability
      let displayDate = requestDetails.date;
      let displayTime = requestDetails.time;

      if (
        typeof requestDetails.date === "string" &&
        requestDetails.date.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        displayDate = new Date(requestDetails.date).toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            month: "long",
            day: "numeric",
          }
        );
      }

      if (
        typeof requestDetails.time === "string" &&
        requestDetails.time.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
      ) {
        displayTime = new Date(
          `2000-01-01T${requestDetails.time}:00`
        ).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "numeric",
          hour12: true,
        });
      }

      const message = `
🔔 New Service Request 🔔

Hello ${provider.name},

You have a new service request:
- Request ID: ${requestDetails.requestId}
- Service: ${requestDetails.serviceType}
- Date: ${displayDate}
- Time: ${displayTime}
- Location: ${requestDetails.location}
- Description: ${requestDetails.description || "No details provided"}

Please login to your Tesha provider app to accept or decline this request.

Thank you,
Tesha Team
`;

      console.log(
        `[NOTIFICATION] Would send provider notification to ${provider.phone}`
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

  async scheduleBooking(
    serviceProviderId,
    serviceType,
    date,
    time,
    location,
    description
  ) {
    console.log(
      `Scheduling booking: ${serviceType} with provider ${serviceProviderId} on ${date} at ${time} at ${location}`
    );
    try {
      // Parse date and time if they're in natural language format
      let finalDate = date;
      let finalTime = time;

      if (typeof date === "string" && !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parsedDate = dateParser.parseDate(date);
        if (!parsedDate.success) {
          throw new Error(`Invalid date: ${parsedDate.message}`);
        }
        finalDate = parsedDate.date;
      }

      if (
        typeof time === "string" &&
        !time.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
      ) {
        const parsedTime = dateParser.parseTime(time);
        if (!parsedTime.success) {
          throw new Error(`Invalid time: ${parsedTime.message}`);
        }
        finalTime = parsedTime.time;
      }

      // Find the service
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
      const requestId = await this.generateUniqueBookingId();

      // Extract city from location
      const city = this.extractCity(location);

      // Combine date and time for a full datetime object
      const bookingDate = new Date(`${finalDate}T${finalTime}:00`);

      // Create service request object
      const serviceRequest = new ServiceRequest({
        service: serviceObj._id,
        requester: this.userId,
        serviceProviders: [serviceProviderId],
        status: "Pending",
        address: {
          physicalAddress: location,
        },
        city: city,
        notes: description || "No additional details provided",
        id: requestId,
        confirmed: true,
        date: bookingDate,
        time: finalTime,
        createdAt: new Date(),
      });

      // Save the request to database
      await serviceRequest.save();
      console.log(`Service request created: ${requestId}`);

      // Fetch provider details
      let providerName = "Selected Provider";
      try {
        const provider = await User.findById(serviceProviderId).select(
          "name phone"
        );
        if (provider) {
          providerName = provider.name;

          // Send notification to the provider
          await this.notifyServiceProvider(providerId, {
            requestId,
            serviceType,
            date: finalDate,
            time: finalTime,
            location,
            description,
          });
        }
      } catch (providerErr) {
        console.error("Error fetching provider details:", providerErr);
      }

      // Format date and time for display
      const formattedDate = new Date(finalDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const formattedTime = finalTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
        ? new Date(`2000-01-01T${finalTime}:00`).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
          })
        : finalTime;

      // Return booking details
      return {
        bookingId: requestId,
        serviceType,
        date: formattedDate,
        time: formattedTime,
        location,
        description,
        providerName,
        status: "Pending",
      };
    } catch (error) {
      console.error("Error in scheduleBooking:", error);
      throw new Error(`Failed to schedule booking: ${error.message}`);
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
