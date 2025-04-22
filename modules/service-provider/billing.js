const PaymentRecord = require("../../models/paymentRecord.model");
const ServiceProvider = require("../../models/serviceProvider.model");
const ServiceRequest = require("../../models/request.model");
const { Paynow } = require("paynow");

// Initialize Paynow integration
const paynow = new Paynow(
  process.env.PAYNOW_INTEGRATION_ID,
  process.env.PAYNOW_INTEGRATION_KEY
);

// Set return URL
paynow.resultUrl =
  process.env.PAYNOW_RESULT_URL || "https://tesha.co.zw/api/payments/update";
paynow.returnUrl =
  process.env.PAYNOW_RETURN_URL || "https://tesha.co.zw/api/payments/return";

class BillingManager {
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
  //  Process a service fee payment with Paynow
  async initiatePayment(requestId, paymentMethod, paymentPhone) {
    try {
      const request = await ServiceRequest.findOne({
        id: requestId.toUpperCase(),
      });
      const payment = await PaymentRecord.findOne({
        serviceRequest: request._id,
      })
        .populate("serviceRequest")
        .populate({
          path: "serviceProvider",
          select: "user",
          populate: {
            path: "user",
            select: "_id firstName lastName email phone",
          },
        });

      if (!payment) {
        throw new Error(`Payment for request with ID ${requestId} not found`);
      }

      if (
        payment.serviceProvider?.user._id.toString() !== this.userId.toString()
      ) {
        throw new Error(
          "This payment record is not associated with your account"
        );
      }

      if (payment.status === "Paid") {
        throw new Error("This payment has already been processed");
      }
      if (!paymentPhone.match(/^07\d{8}$/)) {
        throw new Error(
          "Phone number must start with 07 and be 10 digits long eg. 0773456789"
        );
      }

      // Convert payment method to Paynow format
      const paynowMethod =
        paymentMethod.toLowerCase() === "ecocash" ? "ecocash" : "innbucks";

      // Create payment on Paynow
      const payment_ref = `TESHA-${payment.serviceRequest.id}-${Date.now()}`;

      // Create Paynow payment
      const paynowPayment = paynow.createPayment(
        payment_ref,
        "support@tesha.co.zw"
      );

      // Add the item to the payment
      paynowPayment.add("Service Fee", payment.serviceFee);

      // Initiate the mobile payment
      const response = await paynow.sendMobile(
        paynowPayment,
        paymentPhone,
        paynowMethod
      );

      if (response.success) {
        // Update payment record with transaction details
        payment.transactionId = response.pollUrl
          ? response.pollUrl.split("=").pop()
          : payment_ref;
        payment.pollUrl = response.pollUrl;
        payment.status = "Pending";
        payment.paymentPhone = paymentPhone;
        payment.paymentMethod = paymentMethod;
        await payment.save();

        return {
          success: true,
          pollUrl: response.pollUrl,
          instructions:
            response.instructions ||
            "1. You'll receive a prompt on your phone\n2. Enter your PIN to confirm payment\n3. We'll notify you once your payment is confirmed",
          payment: {
            id: payment._id,
            requestId: payment.serviceRequest.id,
            serviceFee: payment.serviceFee,
            paymentMethod: paymentMethod,
            paymentPhone: paymentPhone,
            reference: payment_ref,
          },
        };
      } else {
        console.error("Paynow payment initiation failed:", response.error);
        throw new Error(
          `Payment initiation failed: ${response.error || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error initiating payment:", error);
      throw error;
    }
  }

  // Get all pending or overdue payments
  async getPendingPayments() {
    try {
      const serviceProviderId = await this.getServiceProviderId();
      const payments = await PaymentRecord.find({
        serviceProvider: serviceProviderId,
        status: { $in: ["Pending", "Overdue"] },
      })
        .populate(
          "serviceRequest",
          "id estimatedHours totalCost serviceFee status completedAt"
        )
        .sort("-createdAt");

      return payments;
    } catch (error) {
      console.error("Error getting pending payments:", error);
      throw error;
    }
  }

  //  Get payment history with pagination
  async getPaymentHistory(limit = 10, page = 1) {
    try {
      const skip = (page - 1) * limit;
      const serviceProviderId = await this.getServiceProviderId();

      const payments = await PaymentRecord.find({
        serviceProvider: serviceProviderId,
      })
        .populate("serviceRequest", "id status completedAt")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit);

      const total = await PaymentRecord.countDocuments({
        serviceProvider: serviceProviderId,
      });

      // Calculate summary statistics
      const paidPayments = await PaymentRecord.find({
        serviceProvider: serviceProviderId,
        status: "Paid",
      });

      const totalPaid = paidPayments.reduce(
        (sum, payment) => sum + payment.serviceFee,
        0
      );
      const totalJobs = paidPayments.length;

      return {
        payments: payments.map((p) => ({
          id: p._id,
          requestId: p.serviceRequest?.id || "Unknown",
          amount: p.serviceFee,
          status: p.status,
          dueDate: p.dueDate,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
        })),
        summary: {
          totalPaid,
          totalJobs,
          averageFee: totalJobs > 0 ? totalPaid / totalJobs : 0,
        },
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("Error getting payment history:", error);
      throw error;
    }
  }

  // payment status summary for the provider
  async getPaymentsByStatus(status) {
    try {
      const serviceProviderId = await this.getServiceProviderId();
      const payments = await PaymentRecord.find({
        serviceProvider: serviceProviderId,
        status,
      })
        .populate("serviceRequest", "id estimatedHours totalCost city serviceFee status date time completedAt")
        .populate("requester", "firstName lastName phone");
      return payments;
    } catch (error) {
      console.error("Error getting provider payment status:", error);
      throw error;
    }
  }

  // Get the provider's hourly rate
  async getProviderHourlyRate() {
    try {
      const serviceProviderId = await this.getServiceProviderId();
      const provider = await ServiceProvider.findById(
        serviceProviderId
      ).populate("service", "unitPrice");

      if (!provider) {
        throw new Error(`Provider not found`);
      }

      // Use provider's hourly rate or service unit price as fallback, or default to 20
      return provider.hourlyRate || provider.service?.unitPrice || 20;
    } catch (error) {
      console.error("Error getting provider hourly rate:", error);
      return 20; // Default rate if error
    }
  }

  //  Check if the provider can receive new jobs
  async canReceiveJobs() {
    try {
      const serviceProviderId = await this.getServiceProviderId();
      const provider = await ServiceProvider.findById(serviceProviderId);

      if (!provider) {
        throw new Error(`Provider not found`);
      }

      const isRestricted = provider.paymentStatus === "Restricted";

      return {
        canReceive: !isRestricted,
        accountStatus: provider.paymentStatus || "Good Standing",
        outstandingPayments: provider.outstandingPayments || 0,
        reason: isRestricted
          ? "Your account is restricted due to overdue payments"
          : null,
      };
    } catch (error) {
      console.error("Error checking if provider can receive jobs:", error);
      throw error;
    }
  }
}

module.exports = BillingManager;
