const ServiceProvider = require("../../models/serviceProvider.model");
const ServiceRequest = require("../../models/request.model");
const User = require("../../models/user.model");
const dateParser = require("../../utils/dateParser");
const BookingUtil = require("../../utils/bookingUtil");
const {
  sendTextMessage,
  sendProviderARequestTemplate,
  sendJobCompletionNotification,
} = require("../../services/whatsappService");
const { getSession, setSession } = require("../../utils/redis");
const { formatDateTime } = require("../../utils/dateUtil");
const ChatHistoryManager = require("../../utils/chatHistory");
const {
  calculateRequestCosts,
} = require("../../controllers/request.controller");
const { createPaymentRecord } = require("../../controllers/payment.controller");

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
    description,
    estimatedHours = 1 // Default to 1 hour if not provided
  ) {
    console.log(
      `Scheduling booking with saved provider: ${provider.name} (${provider.id}) for ${serviceType}`
    );
    try {
      // Parse date and time
      // TODO: TIME and date shouild be be future time only not past dates
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

      // Validate and normalize estimated hours
      const normalizedHours = Math.max(
        0.5,
        Math.min(24, Number(estimatedHours) || 1)
      );

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

      // Calculate costs for the service request
      const costDetails = await calculateRequestCosts(
        serviceRequest._id,
        normalizedHours
      );

      // Send notification to the provider
      setImmediate(async () => {
        await this.notifyServiceProvider(provider.id, {
          requestId,
          serviceType,
          date: parsedDate.date,
          time: parsedTime.time,
          location,
          description,
          estimatedHours: normalizedHours,
          hourlyRate: costDetails.hourlyRate,
          totalCost: costDetails.totalCost,
          serviceFee: costDetails.serviceFee,
        });
      });

      // Return booking details
      return {
        bookingId: requestId,
        serviceType,
        date,
        time,
        location,
        description,
        estimatedHours: normalizedHours,
        totalCost: costDetails.totalCost,
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

      // Update to include job cost details
      const requestData = {
        providerPhone: provider.user?.phone,
        providerName: `${provider.user?.firstName} ${
          provider.user?.lastName || ""
        }`.trim(),
        requestId: requestDetails.requestId,
        clientName: `${requester.firstName} ${requester.lastName}`,
        clientPhone: requester.phone,
        serviceType: requestDetails.serviceType,
        date: requestDetails.date,
        time: requestDetails.time,
        location: requestDetails.location,
        description: requestDetails.description || "No details provided",
        estimatedHours: requestDetails.estimatedHours || 1,
        hourlyRate: requestDetails.hourlyRate || provider.hourlyRate || 20,
        totalCost: requestDetails.totalCost || 0,
        serviceFee: requestDetails.serviceFee || 0,
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

        // Store in chat history
        const mockUserMessage = "What are my pending requests?";

        // Create notification message with job cost details
        const requestMessage = `
🔔 New Service Request 🔔

Hello ${provider.user?.firstName || provider.user?.lastName || "Provider"},

You have a new service request:
- Request ID: ${requestDetails.requestId}
- Client Name: ${requester.firstName} ${requester.lastName}
- Client Phone: +${requester.phone}
- Service: ${requestDetails.serviceType}
- Date: ${requestDetails.date}
- Time: ${requestDetails.time}
- Location: ${requestDetails.location}
- Description: ${requestDetails.description || "No details provided"}

💰 Job Details:
- Estimated Hours: ${requestDetails.estimatedHours}
- Your Hourly Rate: $${requestData.hourlyRate}/hour
- Estimated Total: $${requestData.totalCost.toFixed(2)}
- Service Fee (5%): $${requestData.serviceFee.toFixed(2)}

Please review and accept or decline this request. Reply with 'ACCEPT' or 'DECLINE' to proceed.
      `;

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
            estimatedHours: requestDetails.estimatedHours,
            hourlyRate: requestData.hourlyRate,
            totalCost: requestData.totalCost,
            serviceFee: requestData.serviceFee,
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

  async completeJob(requestId, rating, review = "") {
    try {
      console.log(
        `Client marking job ${requestId} as completed with rating ${rating}`
      );

      // Find the request
      const request = await ServiceRequest.findOne({
        id: requestId.toUpperCase(),
      })
        .populate("service")
        .populate("serviceProvider")
        .populate("requester")
        .populate({
          path: "serviceProvider",
          populate: {
            path: "user",
            select: "firstName lastName phone",
          },
        });

      if (!request) {
        throw new Error(`Request with ID ${requestId} not found`);
      }

      // Verify this client is the requester
      if (request.requester._id.toString() !== this.userId.toString()) {
        throw new Error("You are not authorized to complete this request");
      }

      if (request.status !== "In Progress" && request.status !== "Completed") {
        throw new Error(
          `Request status must be 'In Progress' or 'Completed' to mark as completed`
        );
      }

      // Update request as completed
      request.status = "Completed";
      request.completedAt = new Date();

      // Save review
      request.reviewSubmitted = true;
      request.reviewContent = review || "";
      request.rating = rating;

      await request.save();

      // Create payment record
      const paymentRecord = await createPaymentRecord(request.id);

      // Notify service provider
      setImmediate(async () => {
        const providerPhone = request.serviceProvider?.user?.phone;
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
        //
        // store in chat history
        const mockUserMessage = "What are my completed jobs?";
        const requestMessage = `
🔔 Job Completed 🔔

Hello ${request.serviceProvider.user?.firstName || "Provider"},

You have a new job completed:
- Request ID: ${request.id}
- Client Name: ${request.requester.firstName} ${
          request.requester.lastName || ""
        }
- Client Phone: +${request.requester.phone}
- Service: ${request.service?.title || "Service"}
- Date: ${request.date}
- Time: ${request.time}
- Location: ${request.location}
- Description: ${request.description || "No details provided"}

💰 Job Details:
- Estimated Hours: ${request.estimatedHours}
- Your Hourly Rate: $${request.service?.unitPrice || 20}/hour
- Estimated Total: $${request.totalCost.toFixed(2)}
- Service Fee (5%): $${request.serviceFee.toFixed(2)}
        `;
        await ChatHistoryManager.append(
          providerPhone,
          mockUserMessage,
          requestMessage
        );

        // Store payment metadata for the provider
        await ChatHistoryManager.storeMetadata(
          providerPhone,
          "pendingPayment",
          {
            requestId: request.id,
            paymentId: paymentRecord.paymentId.toString(),
            serviceFee: request.serviceFee,
            dueDate: paymentRecord.dueDate,
          }
        );

        await sendJobCompletionNotification({
          providerPhone: request.serviceProvider.user.phone,
          providerName: `${request.serviceProvider.user.firstName || ""} ${
            request.serviceProvider.user.lastName || ""
          }`.trim(),
          requestId: request.id,
          serviceType: request.service?.title || "requested",
          clientName: `${request.requester.firstName} ${
            request.requester.lastName || ""
          }`.trim(),
          totalCost: request.totalCost || 0,
          serviceFee: request.serviceFee || 0,
          rating: rating,
          review: review || "No review provided",
        });
      });

      return {
        request: {
          id: request.id,
          service: request.service?.title || "Service",
          status: request.status,
          completedAt: request.completedAt,
          rating: rating,
          review: review || "No review provided",
        },
        paymentRecord: {
          id: paymentRecord.paymentId.toString(),
          serviceFee: paymentRecord.serviceFee,
          dueDate: paymentRecord.dueDate,
        },
      };
    } catch (error) {
      console.error("Error completing job:", error);
      throw error;
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
