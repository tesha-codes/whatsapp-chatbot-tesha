const ServiceRequest = require("../../models/request.model");
const ServiceProvider = require("../../models/serviceProvider.model");
const User = require("../../models/user.model");
const BookingManager = require("../client-flow/bookings");

class TaskManager {
  constructor(userId) {
    this.userId = userId;
  }

  async getTasksOverview() {
    try {
      // Changed from serviceProviders to serviceProvider
      const aggregation = await ServiceRequest.aggregate([
        {
          $match: {
            serviceProvider: this.userId,
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
        "In Progress": 0, // Added missing status
        Completed: 0,
        Cancelled: 0,
      };

      aggregation.forEach((item) => {
        overview[item._id] = item.count;
        overview.total += item.count;
      });

      return overview;
    } catch (error) {
      console.error("Error getting tasks overview:", error);
      throw error;
    }
  }

  async getTasksByStatus(status) {
    try {
      // Changed from serviceProviders to serviceProvider
      const tasks = await ServiceRequest.find({
        serviceProvider: this.userId,
        status,
      })
        .populate("service")
        .populate("requester", "firstName lastName phone")
        .sort({ createdAt: -1 });

      return tasks;
    } catch (error) {
      console.error("Error getting tasks by status:", error);
      throw error;
    }
  }

  async getTaskDetails(taskId) {
    try {
      // Changed from serviceProviders to serviceProvider
      const task = await ServiceRequest.findOne({
        _id: taskId,
        serviceProvider: this.userId,
      })
        .populate("service")
        .populate("requester", "firstName lastName phone")
        // Changed to single serviceProvider instead of array
        .populate("serviceProvider", "firstName lastName phone");

      if (!task) {
        throw new Error("Task not found");
      }

      return task;
    } catch (error) {
      console.error("Error getting task details:", error);
      throw error;
    }
  }

  async updateTaskStatus(taskId, newStatus) {
    try {
      // Changed from serviceProviders to serviceProvider
      const task = await ServiceRequest.findOne({
        _id: taskId,
        serviceProvider: this.userId,
        status: "Pending",
      });

      if (!task) {
        throw new Error("Task not found or cannot be updated");
      }

      // Validate the new status against enum values
      if (
        !["Pending", "In Progress", "Completed", "Cancelled"].includes(
          newStatus
        )
      ) {
        throw new Error("Invalid status value");
      }

      task.status = newStatus;
      await task.save();

      return task;
    } catch (error) {
      console.error("Error updating task status:", error);
      throw error;
    }
  }

  async acceptServiceRequest(requestId) {
    try {
      // :
      const request = await ServiceRequest.findOne({ id: requestId.toUpperCase() });

      if (!request) {
        throw new Error(`Request with ID ${requestId} not found`);
      }
      console.log("request", request);
      // Check if this provider is assigned to this request
      if (request.serviceProvider.toString() !== this.userId) {
        throw new Error("You are not assigned to this request");
      }

      // Updated status check to match schema enum values
      if (request.status !== "Pending") {
        throw new Error(
          `Request cannot be accepted as it is already in ${request.status} state`
        );
      }

      // Create a BookingManager instance to handle client notification
      const bookingManager = new BookingManager(request.requester);

      // Use the BookingManager to handle the acceptance
      const result = await bookingManager.handleRequestAcceptance(
        requestId,
        this.userId
      );

      return result;
    } catch (error) {
      console.error(`Error accepting request ${requestId}:`, error);
      return {
        success: false,
        requestId,
        error: error.message,
      };
    }
  }

  async declineServiceRequest(requestId, reason) {
    try {
      // :
      const request = await ServiceRequest.findOne({
        id: requestId.toUpperCase(),
      });

      if (!request) {
        throw new Error(`Request with ID ${requestId} not found`);
      }

      // Check if this provider is assigned to this request
      if (request.serviceProvider.toString() !== this.userId) {
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
      request.status = "Cancelled";
      await request.save();

      // Create a BookingManager instance to handle client notification
      const bookingManager = new BookingManager(request.requester);
      // Use the BookingManager to handle the decline
      const result = await bookingManager.handleRequestDecline(
        requestId,
        this.userId,
        reason
      );

      return result;
    } catch (error) {
      console.error(`Error declining request ${requestId}:`, error);
      return {
        success: false,
        requestId,
        error: error.message,
      };
    }
  }
}

module.exports = TaskManager;
