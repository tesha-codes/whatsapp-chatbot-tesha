const ServiceProvider = require("../../models/serviceProvider.model");
const ServiceRequest = require("../../models/request.model");
const User = require("../../models/user.model");
const dateParser = require("../../utils/dateParser");
const BookingUtil = require("../../utils/bookingUtil");
const {
  sendTextMessage,
  sendProviderARequestTemplate,
} = require("../../services/whatsappService");
const { getSession, setSession } = require("../../utils/redis");
const { formatDateTime } = require("../../utils/dateUtil");
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
        "_id firstName lastName phone"
      );
      if (!provider) {
        console.error(
          `Provider with ID ${providerId} not found for notification`
        );
        return false;
      }

      const requester = await User.findById(this.userId).select(
        "_id firstName lastName phone"
      );
      //
      const requestMessage = `
      🔔 New Service Request 🔔

      Hello ${
        provider.user?.firstName || provider.user?.lastName || "Provider"
      },

      You have a new service request:
      - Request ID: ${requestDetails.requestId}
      - Client Name: ${requester.firstName} ${requester.lastName}
      - Client Phone: +${requester.phone}
      - Service: ${requestDetails.serviceType}
      - Date: ${requestDetails.date}
      - Time: ${requestDetails.time}
      - Location: ${requestDetails.location}
      - Description: ${requestDetails.description || "No details provided"}

      Please review and accept or decline this request. Reply with 'ACCEPT or 'DECLINE to proceed.
      `;
      //
      console.log(
        `[NOTIFICATION] Sending provider notification to ${provider.user?.phone}`
      );
      console.log(
        `Successfully notified provider ${providerId} about request ${requestDetails.requestId}`
      );

      const requestData = {
        providerName: `${provider.user?.firstName} ${
          provider.user?.lastName || ""
        }`.trim(),
        providerPhone: provider.user?.phone,
        requestId: requestDetails.requestId,
        clientName: `${requester.firstName} ${requester.lastName}`,
        clientPhone: requester.phone,
        serviceType: requestDetails.serviceType,
        date: requestDetails.date,
        time: requestDetails.time,
        location: requestDetails.location,
        description: requestDetails.description || "No details provided",
      };
      // run the notification in the next event loop iteration
      setImmediate(async () => {
        const providerPhone = provider.user?.phone;
        if (!providerPhone) return;
        const session = await getSession(providerPhone);
        // inject session if not present
        if (Object.keys(session).length === 0) {
          await setSession(providerPhone, {
            step: "SERVICE_PROVIDER_MAIN_MENU",
            message: "Service provider session injected",
            lActivity: formatDateTime(),
            accountType: "ServiceProvider",
          });
        }
        // inject chat histoty
        const mockUserMessage = "Whats is my pending requests?";
        await ChatHistoryManager.append(
          providerPhone,
          mockUserMessage,
          requestMessage
        );
        // inject pending requests details
        await ChatHistoryManager.storeMetadata(
          providerPhone,
          "pendingRequest",
          {
            providerId: provider.user?._id.toString(),
            providerName: provider.user?.firstName || provider.user?.lastName,
            phone: provider.user?.phone,
            requestId: requestDetails.requestId,
            serviceType: requestDetails.serviceType,
            date: requestDetails.date,
            time: requestDetails.time,
            location: requestDetails.location,
            description: requestDetails.description || "No details provided",
          }
        );

        console.log(
          `Stored pending requests metadata for ${provider.user?.phone}`
        );
        // send the request
        await sendProviderARequestTemplate(requestData);
        console.log(
          `Successfully sent request template to ${provider.user?.phone}`
        );
      });
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
      const booking = await ServiceRequest.findOne({ id: bookingId })
        .populate("requester", "_id firstName lastName phone")
        .populate({
          path: "serviceProvider",
          select: "user",
          populate: {
            path: "user",
            select: "_id firstName lastName phone",
          },
        });

      if (!booking) {
        return {
          success: false,
          message: `Service Request with ID ${bookingId} not found`,
        };
      }

      // check if the booking can be rescheduled
      if (booking.status !== "Pending") {
        return {
          success: false,
          message: `Service Request with ID ${bookingId} cannot be rescheduled at this time`,
        };
      }

      //  check if this user can actually reschedule this booking
      if (booking.requester._id.toString() !== this.userId.toString()) {
        return {
          success: false,
          message: `You are not authorized to reschedule this booking`,
        };
      }

      // old date and time
      const oldDate = booking.date;
      const oldTime = booking.time;

      // Update the booking
      booking.date = newDate;
      booking.time = newTime;
      booking.updatedAt = new Date();

      await booking.save();

      // Notify provider of rescheduling
      const provider = booking.serviceProvider?.user || {};
      const rescheduleMessage = `
🔄 Booking Rescheduled 🔄

Hello ${provider.firstName || provider.lastName || "Provider"},

Your booking has been rescheduled:
- Booking ID: ${bookingId}
- New Date: ${oldDate} -> ${newDate}
- New Time: ${oldTime} -> ${newTime}
- Client Name: ${booking.requester.firstName} ${booking.requester.lastName}
- Client Phone: +${booking.requester.phone}

Please confirm this change with the client.

You can check the status of your booking anytime by typing 'my bookings'.
      `;

      setImmediate(async () => {
        await sendTextMessage(provider.phone, rescheduleMessage);
        console.log(
          `Successfully notified provider ${provider._id} about rescheduling booking ${bookingId}`
        );
      });

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
      const booking = await ServiceRequest.findOne({ id: bookingId })
        .populate("requester", "_id firstName lastName phone")
        .populate({
          path: "serviceProvider",
          select: "user",
          populate: {
            path: "user",
            select: "_id firstName lastName phone",
          },
        });

      if (!booking) {
        throw new Error(`Service Request with ID ${bookingId} not found`);
      }

      // check if the booking can be rescheduled
      if (booking.status !== "Pending") {
        return {
          success: false,
          message: `Service Request with ID ${bookingId} cannot be rescheduled at this time`,
        };
      }

      //  check if this user can actually reschedule this booking
      if (booking.requester._id.toString() !== this.userId.toString()) {
        return {
          success: false,
          message: `You are not authorized to reschedule this booking`,
        };
      }

      // Update booking status
      booking.status = "Cancelled";
      booking.cancelReason = reason;
      booking.updatedAt = new Date();

      await booking.save();

      //  Notify provider of cancellation
      const provider = booking.serviceProvider?.user || {};
      const cancelMessage = `
❌ Booking Cancelled ❌

Hello ${provider.firstName || provider.lastName || "Provider"},

Your booking has been cancelled:
- Booking ID: ${bookingId}
- Client Name: ${booking.requester.firstName} ${booking.requester.lastName}
- Client Phone: +${booking.requester.phone}
- Reason: ${reason}

You can check the status of your booking anytime by typing 'my bookings'.
      `;

      setImmediate(async () => {
        await sendTextMessage(provider.phone, cancelMessage);
        console.log(
          `Successfully notified provider ${provider._id} about cancellation of booking ${bookingId}`
        );
      });

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
