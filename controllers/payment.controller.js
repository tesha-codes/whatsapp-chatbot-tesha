const PaymentRecord = require("../models/paymentRecord.model");
const ServiceProvider = require("../models/serviceProvider.model");
const ServiceRequest = require("../models/request.model");


// create payment record when job is completed
const createPaymentRecord = async (requestId) => {
  try {
    const request = await ServiceRequest.findOne({
      id: requestId.toUpperCase(),
    })
      .populate("requester")
      .populate("service");

    if (!request) {
      throw new Error(`Request with ID ${requestId} not found`);
    }

    // Check if payment record already exists for this service request
    const existingPayment = await PaymentRecord.findOne({
      serviceRequest: request._id,
    });

    if (existingPayment) {
      console.log(`Payment record already exists for request ${requestId}`);
      return {
        requestId: request.id,
        paymentId: existingPayment._id,
        serviceFee: existingPayment.serviceFee,
        dueDate: existingPayment.dueDate,
        isExisting: true,
      };
    }

    // Calculate service fee if not already calculated
    if (!request.totalCost || !request.serviceFee) {
      const hourlyRate = await this.getProviderHourlyRate();
      const estimatedHours = request.estimatedHours || 1;
      const totalCost = hourlyRate * estimatedHours;
      const serviceFee = totalCost * 0.05;

      request.totalCost = totalCost;
      request.serviceFee = serviceFee;
      await request.save();
    }

    // Set due date 48 hours from now
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 48);

    // Create payment record
    const paymentRecord = new PaymentRecord({
      serviceRequest: request._id,
      serviceProvider: request.serviceProvider,
      requester: request.requester._id,
      totalAmount: request.totalCost,
      serviceFee: request.serviceFee,
      status: "Pending",
      dueDate: dueDate,
    });

    await paymentRecord.save();

    // Update request with payment status and due date
    request.paymentStatus = "Pending";
    request.paymentDueDate = dueDate;
    await request.save();

    // Update service provider payment status
    await ServiceProvider.updateOne(
      { _id: request.serviceProvider },
      {
        $set: { paymentStatus: "Payment Due" },
        $inc: { outstandingPayments: 1 },
      }
    );

    return {
      requestId: request.id,
      paymentId: paymentRecord._id,
      serviceFee: paymentRecord.serviceFee,
      dueDate: paymentRecord.dueDate,
      isExisting: false,
    };
  } catch (error) {
    console.error("Error creating payment record:", error);
    throw error;
  }
};

module.exports = {
  createPaymentRecord
};
