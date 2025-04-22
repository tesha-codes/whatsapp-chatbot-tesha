const ServiceRequest = require("../models/request.model");

// Calculate costs for a service request
const calculateRequestCosts = async (requestId, estimatedHours = 1) => {
  try {
    const request = await ServiceRequest.findById(requestId)
      .populate({
        path: "serviceProvider",
        select: "hourlyRate",
      })
      .populate("service", "unitPrice");

    if (!request) {
      throw new Error(`Request with ID ${requestId} not found`);
    }

    // Get hourly rate from provider or use service unit price
    const hourlyRate =
      request.serviceProvider?.hourlyRate || request.service?.unitPrice || 20;

    // Calculate total cost
    const totalCost = hourlyRate * estimatedHours;

    // Calculate service fee (5%)
    const serviceFee = totalCost * 0.05;

    // Update the request with calculated values
    request.estimatedHours = estimatedHours;
    request.totalCost = totalCost;
    request.serviceFee = serviceFee;

    await request.save();

    return {
      estimatedHours,
      hourlyRate,
      totalCost,
      serviceFee,
    };
  } catch (error) {
    console.error("Error calculating request costs:", error);
    throw error;
  }
};

module.exports = {
  calculateRequestCosts,
};
