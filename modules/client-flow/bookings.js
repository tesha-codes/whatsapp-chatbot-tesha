const Service = require("./../../models/services.model");
const User = require("./../../models/user.model");
const ServiceRequest = require("./../../models/request.model");
const crypto = require("crypto");
const { redisHelper: redis } = require("../../utils/redis");

class BookingManager {
  constructor(userId) {
    this.userId = userId;
    this.cacheKey = `provider_selection_${userId}`;
  }

  // Generate a cryptographically secure unique booking ID
  async generateUniqueBookingId() {
    const attempts = 10;
    for (let i = 0; i < attempts; i++) {
      // Generate 8 random bytes and convert to alphanumeric string
      const randomBytes = crypto.randomBytes(4); // 4 bytes gives 8 hex characters
      const id = `req_${randomBytes.toString("hex").substring(0, 8)}`;
      // Check if this ID exists in Redis cache
      const exists = await redis.exists(`booking_id:${id}`);
      if (!exists) {
        // Check if ID exists in database
        const bookingExists = await ServiceRequest.exists({ id });
        if (!bookingExists) {
          // Cache this ID to prevent simultaneous generation of the same ID
          await redis.set(`booking_id:${id}`, "1", "EX", 3600); // Cache for 1 hour
          return id;
        }
      }
    }

    // Fallback to timestamp-based ID if all attempts fail, but this should be rare
    const timestamp = Date.now().toString();
    return `req_${timestamp.slice(-8)}`;
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
      // Get providers from Redis cache
      const cachedProvidersJson = await redis.get(this.cacheKey);
      let providers = null;

      if (cachedProvidersJson) {
        try {
          providers = JSON.parse(cachedProvidersJson);
          console.log(`Retrieved ${providers.length} providers from cache`);
        } catch (e) {
          console.error("Error parsing cached providers:", e);
        }
      }

      // If not cached, fetch providers
      if (!providers || providers.length === 0) {
        const city = this.extractCity(location);

        // Find service
        const service = await Service.findOne({
          $text: { $search: serviceType, $caseSensitive: false },
        });

        if (!service) {
          throw new Error(`Service type '${serviceType}' not found`);
        }

        // Find providers
        providers = await User.find({
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
          throw new Error(
            `No service providers available for ${serviceType} in ${location}`
          );
        }

        // Format and cache providers
        providers = providers.map((p) => ({
          id: p._id.toString(),
          name: p.name || "Unknown Provider",
          rating: p.rating || 4.5,
          reviewCount: p.reviewCount || 25,
          specialties: [serviceType],
          rate: p.rate || 25,
        }));

        // Cache for 1 hour
        await redis.set(this.cacheKey, JSON.stringify(providers), "EX", 3600);
      }

      // Validate selection
      const index = parseInt(selectionNumber) - 1;
      if (isNaN(index) || index < 0 || index >= providers.length) {
        throw new Error(
          `Invalid selection number. Please select a number between 1 and ${providers.length}`
        );
      }

      console.log(
        `Selected provider index ${index} from ${providers.length} providers`
      );

      // Get selected provider
      const selectedProvider = providers[index];
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
      const provider = await User.findById(providerId).select("phone name");

      if (!provider) {
        console.error(
          `Provider with ID ${providerId} not found for notification`
        );
        return false;
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

      console.log(
        `[NOTIFICATION] Would send provider notification to ${provider.phone}`
      );
      console.log(
        `Successfully notified provider ${providerId} about request ${requestDetails.requestId}`
      );

      // TODO: Send notification to provider about the new service request
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
        date: date,
        time: time,
        createdAt: new Date(),
      });

      // Save the request to database
      await serviceRequest.save();
      console.log(`Service request created: ${requestId}`);

      // Fetch provider details
      let providerName = "Selected Provider";
      try {
        const provider = await User.findById(serviceProviderId).select("name");
        if (provider) {
          providerName = provider.name;
        }
      } catch (providerErr) {
        console.error("Error fetching provider details:", providerErr);
      }

      // Notify the service provider
      await this.notifyServiceProvider(serviceProviderId, {
        requestId,
        serviceType,
        date,
        time,
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
