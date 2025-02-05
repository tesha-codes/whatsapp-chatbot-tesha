const ServiceRequest = require("../../models/request.model");
class TaskManager {
  constructor(userId) {
    this.userId = userId;
  }

  async getTasksOverview() {
    try {
      const aggregation = await ServiceRequest.aggregate([
        {
          $match: {
            serviceProviders: this.userId,
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
      const tasks = await ServiceRequest.find({
        serviceProviders: this.userId,
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
      const task = await ServiceRequest.findOne({
        _id: taskId,
        serviceProviders: this.userId,
      })
        .populate("service")
        .populate("requester", "firstName lastName phone")
        .populate("serviceProviders", "firstName lastName phone");

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
      const task = await ServiceRequest.findOne({
        _id: taskId,
        serviceProviders: this.userId,
        status: "Pending",
      });

      if (!task) {
        throw new Error("Task not found or cannot be updated");
      }

      task.status = newStatus;
      await task.save();

      return task;
    } catch (error) {
      console.error("Error updating task status:", error);
      throw error;
    }
  }
}

module.exports = TaskManager;
