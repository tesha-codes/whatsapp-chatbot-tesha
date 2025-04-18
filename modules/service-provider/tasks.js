const ServiceRequest = require("../../models/request.model");
const ServiceProvider = require("../../models/serviceProvider.model");
const { sendTextMessage } = require("../../services/whatsappService");

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

      const overview = { total: 0, Pending: 0, Completed: 0, Declined: 0, "In Progress": 0,  Cancelled: 0 };
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
          }).\nThey will contact you soon and don't forget to mark the task as completed once the task is completed.`
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
          }* (+${request.serviceProvider.user.phone}). Reason: ${reason}`
        );
      });

      return request;
    } catch (error) {
      console.error(`Error declining request ${requestId}:`, error);
      throw error;
    }
  }
}

module.exports = TaskManager;
