const ServiceRequest = require("../../models/request.model");
const ServiceProvider = require("../../models/serviceProvider.model");
const {
  sendTextMessage,
  sendProviderCompletedJobNotification,
} = require("../../services/whatsappService");
const { createPaymentRecord } = require("../../controllers/payment.controller");
const ChatHistoryManager = require("../../utils/chatHistory");
const { getSession, setSession } = require("../../utils/redis");
const { formatDateTime } = require("../../utils/dateUtil");

class TaskManager {
  constructor(userId) {
    this.userId = userId;
  }

  async getServiceProviderId() {
    const serviceProvider = await ServiceProvider.findOne({
      user: this.userId,
    });
    if (!serviceProvider) throw new Error("ServiceProvider not found");
    return serviceProvider._id;
  }

  async getTasksOverview() {
    try {
      const serviceProviderId = await this.getServiceProviderId();

      const aggregation = await ServiceRequest.aggregate([
        {
          $match: {
            serviceProvider: serviceProviderId,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const overview = {
        total: 0,
        Pending: 0,
        Completed: 0,
        Declined: 0,
        "In Progress": 0,
        Cancelled: 0,
      };
      aggregation.forEach((item) => {
        overview[item._id] = item.count;
        overview.total += item.count;
      });

      console.log("Tasks overview:", overview);
      return overview;
    } catch (error) {
      console.error("Error getting tasks overview:", error);
      throw error;
    }
  }

  async getAllTasksHistory() {
    try {
      const serviceProviderId = await this.getServiceProviderId();

      const tasks = await ServiceRequest.find({
        serviceProvider: serviceProviderId,
      })
        .populate("service")
        .populate("requester", "firstName lastName phone")
        .sort({ createdAt: -1 })
        .limit(10);

      return tasks;
    } catch (error) {
      console.error("Error getting tasks history:", error);
      throw error;
    }
  }

  async getTasksByStatus(status) {
    try {
      const serviceProviderId = await this.getServiceProviderId();

      const tasks = await ServiceRequest.find({
        serviceProvider: serviceProviderId,
        status,
      })
        .populate("service")
        .populate("requester", "firstName lastName phone")
        .populate({
          path: "serviceProvider",
          select: "user",
          populate: {
            path: "user",
            select: "firstName lastName phone",
          },
        })
        .sort({ createdAt: -1 });

      return tasks;
    } catch (error) {
      console.error("Error getting tasks by status:", error);
      throw error;
    }
  }

  async getTaskDetails(taskId) {
    try {
      const serviceProviderId = await this.getServiceProviderId();

      const task = await ServiceRequest.findOne({
        id: taskId.toUpperCase(),
        serviceProvider: serviceProviderId,
      })
        .populate("service")
        .populate("requester", "firstName lastName phone")
        .populate({
          path: "serviceProvider",
          select: "user",
          populate: {
            path: "user",
            select: "firstName lastName phone",
          },
        });

      if (!task) throw new Error("Task not found");
      return task;
    } catch (error) {
      console.error("Error getting task details:", error);
      throw error;
    }
  }

  async updateTaskStatus(taskId, newStatus) {
    try {
      const serviceProviderId = await this.getServiceProviderId();
      const task = await ServiceRequest.findOne({
        id: taskId.toUpperCase(),
        serviceProvider: serviceProviderId,
        status: "Pending",
      });

      if (!task) throw new Error("Task not found or cannot be updated");

      task.status = newStatus;
      await task.save();

      return task;
    } catch (error) {
      console.error("Error updating task status:", error);
      throw error;
    }
  }
  //
  async acceptServiceRequest(requestId) {
    try {
      // :
      const request = await ServiceRequest.findOne({
        id: requestId.toUpperCase(),
      })
        .populate("requester", "_id firstName lastName phone")
        .populate({
          path: "serviceProvider",
          select: "user", // Select the user field from ServiceProvider
          populate: {
            path: "user", //  populate User model through ServiceProvider
            select: "_id firstName lastName phone",
          },
        });

      if (!request) {
        throw new Error(`Request with ID ${requestId} not found`);
      }
      console.log("Request: ", request);
      // Check if this provider is assigned to this request
      if (
        request.serviceProvider?.user._id.toString() !== this.userId.toString()
      ) {
        throw new Error("You are not assigned to this request");
      }
      // Updated status check to match schema enum values
      if (request.status !== "Pending") {
        throw new Error(
          `Request cannot be accepted as it is already in ${request.status} state`
        );
      }
      // save the request
      request.status = "In Progress";
      await request.save();

      // Notify the requester about the acceptance
      setImmediate(async () => {
        await sendTextMessage(
          request.requester.phone,
          `✅ Your service request *${requestId}* has been accepted by *${
            request.serviceProvider.user.firstName ||
            request.serviceProvider.user.lastName
          }* (+${
            request.serviceProvider.user.phone
          }).\n\nThey will contact you soon and don't forget to mark the task as completed once the task is completed by simply typing 'Task completed for the request ${requestId}' and leave a review for the service provider.`
        );
      });

      return request;
    } catch (error) {
      console.error(`Error accepting request ${requestId}:`, error);
      throw error;
    }
  }

  async declineServiceRequest(requestId, reason) {
    try {
      // :
      const request = await ServiceRequest.findOne({
        id: requestId.toUpperCase(),
      })
        .populate("requester", "_id firstName lastName phone")
        .populate({
          path: "serviceProvider",
          select: "user",
          populate: {
            path: "user",
            select: "_id firstName lastName phone",
          },
        });

      if (!request) {
        throw new Error(`Request with ID ${requestId} not found`);
      }

      // Check if this provider is assigned to this request
      if (
        request.serviceProvider?.user._id.toString() !== this.userId.toString()
      ) {
        throw new Error("You are not assigned to this request");
      }

      // Updated status check to match schema enum values
      if (request.status !== "Pending") {
        throw new Error(
          `Request cannot be declined as it is already in ${request.status} state`
        );
      }
      // Store cancel reason
      request.cancelReason = reason;
      request.status = "Declined";
      await request.save();

      //: Notify the requester about the decline
      setImmediate(async () => {
        await sendTextMessage(
          request.requester.phone,
          `❌ Your service request *${requestId}* has been declined by *${
            request.serviceProvider.user.firstName ||
            request.serviceProvider.user.lastName
          }* (+${request.serviceProvider.user.phone}).\n\nReason: ${reason}`
        );
      });

      return request;
    } catch (error) {
      console.error(`Error declining request ${requestId}:`, error);
      throw error;
    }
  }
  // Complete a job
  async completeJob(requestId, review = "") {
    try {
      const serviceProviderId = await this.getServiceProviderId();
      const request = await ServiceRequest.findOne({
        id: requestId.toUpperCase(),
      })
        .populate("service")
        .populate("requester", "firstName lastName phone");

      if (!request) {
        throw new Error(`Task with ID ${requestId} not found`);
      }

      // Check that this provider is assigned to this task
      if (request.serviceProvider.toString() !== serviceProviderId.toString()) {
        throw new Error("You are not assigned to this task");
      }

      if (request.status !== "In Progress" && request.status !== "Completed") {
        throw new Error(
          `Request status must be 'In Progress' or 'Completed' to mark as completed`
        );
      }

      // Update task as completed
      request.status = "Completed";
      request.completedAt = new Date();

      // Save review if provided by provider
      if (review) {
        request.providerFeedback = review;
      }

      await request.save();

      // Create payment record
      const paymentRecord = await createPaymentRecord(request.id);
      // Get service provider details
      const provider = await ServiceProvider.findById(
        serviceProviderId
      ).populate("user", "phone firstName lastName");

      setImmediate(async () => {
        // Store payment metadata for self-reference
        if (provider?.user?.phone) {
          const session = await getSession(provider?.user?.phone);
          // inject session if not present
          if (Object.keys(session).length === 0) {
            await setSession(provider?.user?.phone, {
              step: "SERVICE_PROVIDER_MAIN_MENU",
              message: "Service provider session injected",
              lActivity: formatDateTime(),
              accountType: "ServiceProvider",
            });
          }
          await ChatHistoryManager.storeMetadata(
            provider.user.phone,
            "pendingPayment",
            {
              requestId: request.id,
              paymentId: paymentRecord.paymentId.toString(),
              serviceFee: paymentRecord.serviceFee,
              dueDate: paymentRecord.dueDate,
            }
          );
        }
        // Notify client to provide review
        if (request.requester?.phone) {
          const session = await getSession(request.requester?.phone);
          // inject session if not present
          if (Object.keys(session).length === 0) {
            await setSession(request.requester?.phone, {
              step: "CLIENT_MAIN_MENU",
              message: "Client session injected",
              lActivity: formatDateTime(),
              accountType: "Client",
            });
          }

          const mockClientMessage = "what is my completed task?";
          const mockClientResponse = `
        ✅ Your service request *${requestId}* has been completed by *${
            provider?.user?.firstName || provider?.user?.lastName
          }* (+${provider?.user?.phone}).\n\n
       `;
          // inject chat history data for client
          await ChatHistoryManager.append(
            request.requester.phone,
            mockClientMessage,
            mockClientResponse
          );
          //
          await sendProviderCompletedJobNotification({
            clientPhone: request.requester.phone,
            clientName: `${request.requester.firstName || ""} ${
              request.requester.lastName || ""
            }`.trim(),
            requestId: request.id,
            serviceType: request.service?.title || "requested",
            providerName: `${provider?.user?.firstName || ""} ${
              provider?.user?.lastName || ""
            }`.trim(),
            totalCost: request.totalCost || 0,
          });
        }
      });

      return {
        request: {
          id: request.id,
          service: request.service?.title || "Service",
          status: request.status,
          completedAt: request.completedAt,
        },
        paymentRecord: {
          id: paymentRecord.paymentId.toString(),
          serviceFee: paymentRecord.serviceFee,
          dueDate: paymentRecord.dueDate,
        },
      };
    } catch (error) {
      console.error(`Error completing task ${requestId}:`, error);
      throw error;
    }
  }
}

module.exports = TaskManager;
