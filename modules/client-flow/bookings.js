const ServiceProvider = require("../../models/serviceProvider.model");
const ServiceRequest = require("../../models/request.model");
const dateParser = require("../../utils/dateParser");
const BookingUtil = require("../../utils/bookingUtil");
const { sendTextMessage } = require("../../services/whatsappService");
const ChatHistoryManager = require("../../utils/chatHistory");

class BookingManager {
  constructor(userId) {
    this.userId = userId;
  }
  async getBookingHistory() {
    try {
      const requests = await ServiceRequest.find({ requester: this.userId })
        .populate("service", "title")
        .populate({
          path: "serviceProvider",
          select: "user", // Select the user field from ServiceProvider
          populate: {
            path: "user", //  populate User model through ServiceProvider
            select: "firstName lastName phone",
          },
        })
        .sort({ createdAt: -1 })
        .limit(10);

      console.log("Fetched booking history count :", requests.length);

      if (!requests || requests.length === 0) {
        return { bookings: [] };
      }

      const bookings = requests.map((req) => {
        //
        const user = req.serviceProvider?.user || {};
        return {
          id: req.id,
          serviceType: req.service?.title || "Unknown Service",
          providerName:
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
            "Unassigned",
          phone: user.phone || "Not available",
          date: req.date
            ? new Date(req.date).toISOString().split("T")[0]
            : "Not specified",
          time: req.time || "Not specified",
          status: req.status,
        };
      });

      return { bookings };
    } catch (error) {
      console.error("Error fetching booking history:", error);
      return { bookings: [] };
    }
  }

  async getBookingDetails(bookingId) {
    try {
      const request = await ServiceRequest.findOne({ id: bookingId })
        .populate("service", "title description")
        .populate({
          path: "serviceProvider",
          select: "user",
          populate: {
            path: "user",
            select: "firstName lastName phone",
          },
        });

      if (!request) {
        return { message: "Booking not found" };
      }

      // Access user through serviceProvider
      const providerUser = request.serviceProvider?.user || {};

      return {
        id: request.id,
        serviceType: request.service?.title || "Unknown Service",
        serviceDescription:
          request.service?.description || "No description available",
        providerName:
          `${providerUser.firstName || ""} ${
            providerUser.lastName || ""
          }`.trim() || "Unassigned",
        providerPhone: providerUser.phone || "Not specified",
        date: request.date
          ? new Date(request.date).toISOString().split("T")[0]
          : "Not specified",
        time: request.time || "Not specified",
        location:
          [request.address?.physicalAddress, request.city]
            .filter(Boolean)
            .join(", ") || "Not specified",
        status: request.status,
        description: request.notes || "No additional notes",
        rating: request.providerRating
          ? `${request.providerRating}/5`
          : "Not rated yet",
        cancelReason: request.cancelReason || undefined, // Only include if present
        clientFeedback: request.clientFeedback || undefined, // Only include if present
      };
    } catch (error) {
      console.error("Error fetching booking details:", error);
      throw new Error(`Failed to retrieve booking: ${error.message}`);
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

      // Generate a unique request ID
      const requestId = await BookingUtil.generateUniqueBookingId();

      // Extract city from location
      const city = BookingUtil.getCity(location);

      // Combine date and time for a full datetime object
      const bookingDate = new Date(`${parsedDate.date}T${parsedTime.time}:00`);

      // Create service request object
      const serviceRequest = new ServiceRequest({
        service: provider.service_id,
        requester: this.userId,
        serviceProvider: provider.id,
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
      const provider = await ServiceProvider.findById(providerId).populate(
        "user",
        "firstName lastName phone"
      );
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

Please respond with "ACCEPT ${requestDetails.requestId}" to accept this request
or "DECLINE ${requestDetails.requestId} [reason]" to decline.
`;

      // Send notification to the provider
      if (provider.user?.phone) {
        await sendTextMessage(provider.user.phone, message);
        // Get existing pending requests array
        const pendingRequests =
          (await ChatHistoryManager.getMetadata(
            provider.user.phone,
            "pendingRequests"
          )) || [];

        // Add the new request to the array
        pendingRequests.push({
          requestId: requestDetails.requestId,
          timestamp: Date.now(),
          clientId: this.userId,
          serviceType: requestDetails.serviceType,
          date: requestDetails.date,
          time: requestDetails.time,
          location: requestDetails.location,
        });

        // Store updated array
        await ChatHistoryManager.storeMetadata(
          provider.user.phone,
          "pendingRequests",
          pendingRequests
        );

        console.log(
          `Successfully notified provider ${providerId} about request ${requestDetails.requestId}`
        );
        return true;
      } else {
        console.error("Provider phone number not found");
        return false;
      }
    } catch (error) {
      console.error("Error notifying service provider:", error);
      return false;
    }
  }

  // : notify client about booking updates
  async notifyClient(requestId, status, providerInfo = null) {
    try {
      const request = await ServiceRequest.findOne({
        id: requestId.toUpperCase(),
      })
        .populate("requester", "phone firstName lastName")
        .populate("service", "title");

      if (!request) {
        console.error(`Request ${requestId} not found for client notification`);
        return false;
      }

      const clientPhone = request.requester.phone;
      const clientName =
        request.requester.firstName || request.requester.lastName || "Client";

      let message = "";

      switch (status) {
        case "ACCEPTED":
          message = `
🎉 Service Request Accepted 🎉

Hello ${clientName},

Great news! Your service request (${requestId}) has been accepted by ${
            providerInfo?.name || "a service provider"
          }.

Service details:
- Service: ${request.service?.title || "Requested service"}
- Date: ${
            request.date
              ? new Date(request.date).toLocaleDateString()
              : "Not specified"
          }
- Time: ${request.time || "Not specified"}
- Provider contact: ${providerInfo?.phone || "Contact through app"}

Your provider will reach out before the appointment. If you need to make any changes, simply reply to this message.

Thank you for using Tesha!
`;
          break;

        case "DECLINED":
          message = `
📝 Service Request Update 📝

Hello ${clientName},

Unfortunately, your service request (${requestId}) was declined by the provider.

We're now searching for another available provider for you. We'll notify you as soon as we find someone suitable for your request.

If you'd like to modify your request or have any questions, please let us know.

Thank you for your patience!
`;
          break;

        case "RESCHEDULED":
          message = `
🗓️ Booking Rescheduled 🗓️

Hello ${clientName},

Your service request (${requestId}) has been rescheduled:

New appointment:
- Date: ${
            request.date
              ? new Date(request.date).toLocaleDateString()
              : "Not specified"
          }
- Time: ${request.time || "Not specified"}

If this new time doesn't work for you, please let us know and we can help reschedule again or find another provider.

Thank you,
Tesha Team
`;
          break;

        case "CANCELLED":
          message = `
❌ Booking Cancelled ❌

Hello ${clientName},

Your service request (${requestId}) has been cancelled.

If you'd like to book another service, feel free to start a new request anytime.

Thank you for using Tesha!
`;
          break;

        default:
          message = `
📝 Service Request Update 📝

Hello ${clientName},

There has been an update to your service request (${requestId}). The current status is: ${status}.

For any questions or further assistance, please reply to this message.

Thank you,
Tesha Team
`;
      }

      await sendTextMessage(clientPhone, message);

      // Store metadata for context awareness
      await ChatHistoryManager.storeMetadata(clientPhone, "requestUpdate", {
        requestId: requestId,
        status: status,
        timestamp: Date.now(),
        serviceType: request.service?.title || "Requested service",
      });

      console.log(
        `Successfully notified client about request ${requestId} status: ${status}`
      );
      return true;
    } catch (error) {
      console.error("Error notifying client:", error);
      return false;
    }
  }

  // Handle service provider response (acceptance)
  async handleRequestAcceptance(requestId, providerId) {
    try {
      const request = await ServiceRequest.findOne({
        id: requestId.toUpperCase(),
      }).populate("service", "title");
      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }

      // Update request status
      request.status = "ACCEPTED";
      await request.save();

      // Get provider information
      const provider = await ServiceProvider.findById(providerId).populate(
        "user",
        "firstName lastName phone"
      );

      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }

      // Notify client about acceptance
      const providerInfo = {
        name:
          `${provider.user?.firstName || ""} ${
            provider.user?.lastName || ""
          }`.trim() || "Service Provider",
        phone: provider.user?.phone || "Not available",
      };

      await this.notifyClient(requestId, "ACCEPTED", providerInfo);

      return {
        success: true,
        requestId,
        status: "ACCEPTED",
        message: "Request accepted successfully",
        serviceType: request.service?.title || "Requested service",
        date: request.date,
        time: request.time,
        location: request.address?.physicalAddress || "Not specified",
      };
    } catch (error) {
      console.error(`Error accepting request ${requestId}:`, error);
      return {
        success: false,
        requestId,
        error: error.message || "Failed to accept request",
      };
    }
  }

  // Handle service provider response (decline)
  async handleRequestDecline(requestId, providerId, reason = "Not available") {
    try {
      const request = await ServiceRequest.findOne({
        id: requestId.toUpperCase(),
      });
      if (!request) {
        throw new Error(`Request ${requestId} not found`);
      }

      // Update request status
      request.status = "PROVIDER_REJECTED";
      request.cancelReason = reason;
      await request.save();

      // Notify client about decline
      await this.notifyClient(requestId, "DECLINED");

      return {
        success: true,
        requestId,
        status: "DECLINED",
        reason,
        message: "Request declined successfully",
      };
    } catch (error) {
      console.error(`Error declining request ${requestId}:`, error);
      return {
        success: false,
        requestId,
        error: error.message || "Failed to decline request",
      };
    }
  }

  // Update rescheduleBooking to notify both parties
  async rescheduleBooking(bookingId, newDate, newTime) {
    console.log(
      `Rescheduling booking ${bookingId} to ${newDate} at ${newTime}`
    );
    try {
      // Find the booking in database
      const booking = await ServiceRequest.findOne({ id: bookingId });

      if (!booking) {
        return {
          success: false,
          message: `Booking with ID ${bookingId} not found`,
        };
      }

      // Store old values for notification
      const oldDate = booking.date;
      const oldTime = booking.time;

      // Update the booking
      booking.date = newDate;
      booking.time = newTime;
      booking.updatedAt = new Date();

      await booking.save();

      // Notify service provider of rescheduling
      if (booking.serviceProvider) {
        const provider = await ServiceProvider.findById(
          booking.serviceProvider
        ).populate("user", "firstName lastName phone");

        if (provider && provider.user?.phone) {
          const message = `
🗓️ Booking Rescheduled 🗓️

Hello ${provider.user?.firstName || provider.user?.lastName || "Provider"},

A booking has been rescheduled:

Request ID: ${bookingId}
Previous: ${
            oldDate ? new Date(oldDate).toLocaleDateString() : "Not specified"
          } at ${oldTime || "Not specified"}
New: ${newDate} at ${newTime}

Please update your schedule accordingly.
`;
          await sendTextMessage(provider.user.phone, message);

          // Store metadata for context awareness
          await ChatHistoryManager.storeMetadata(
            provider.user.phone,
            "bookingUpdate",
            {
              requestId: bookingId,
              action: "RESCHEDULED",
              oldDate: oldDate
                ? new Date(oldDate).toLocaleDateString()
                : "Not specified",
              oldTime: oldTime || "Not specified",
              newDate,
              newTime,
              timestamp: Date.now(),
            }
          );
        }
      }

      // Notify client
      await this.notifyClient(bookingId, "RESCHEDULED");

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

  // Update cancelBooking to notify both parties
  async cancelBooking(bookingId, reason) {
    console.log(`Cancelling booking ${bookingId} due to: ${reason}`);
    try {
      // Find the booking in database
      const booking = await ServiceRequest.findOne({ id: bookingId });

      if (!booking) {
        throw new Error(`Booking with ID ${bookingId} not found`);
      }

      // Update booking status
      booking.status = "CANCELLED";
      booking.cancelReason = reason;
      booking.updatedAt = new Date();

      await booking.save();

      // Notify service provider of cancellation
      if (booking.serviceProvider) {
        const provider = await ServiceProvider.findById(
          booking.serviceProvider
        ).populate("user", "firstName lastName phone");

        if (provider && provider.user?.phone) {
          const message = `
❌ Booking Cancelled ❌

Hello ${provider.user?.firstName || provider.user?.lastName || "Provider"},

A booking has been cancelled:

Request ID: ${bookingId}
Reason: ${reason || "Not specified"}
`;
          await sendTextMessage(provider.user.phone, message);

          // Store metadata for context awareness
          await ChatHistoryManager.storeMetadata(
            provider.user.phone,
            "bookingUpdate",
            {
              requestId: bookingId,
              action: "CANCELLED",
              reason,
              timestamp: Date.now(),
            }
          );
        }
      }

      // Notify client
      await this.notifyClient(bookingId, "CANCELLED");

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
