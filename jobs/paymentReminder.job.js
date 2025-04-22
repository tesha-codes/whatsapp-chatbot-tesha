const cron = require("node-cron");
const PaymentRecord = require("../models/paymentRecord.model");
const ServiceProvider = require("../models/serviceProvider.model");
const { sendTextMessage } = require("../services/whatsappService");

// Run daily at 1 AM
cron.schedule("0 1 * * *", async () => {
  try {
    console.log("Running payment reminder check...");

    // Find payments that are due but not paid
    const now = new Date();
    const overduePayments = await PaymentRecord.find({
      status: "Pending",
      dueDate: { $lt: now },
    })
      .populate({
        path: "serviceProvider",
        select: "user",
        populate: {
          path: "user",
          select: "phone firstName lastName",
        },
      })
      .populate("serviceRequest", "id estimatedHours totalCost serviceFee");

    console.log(`Found ${overduePayments.length} overdue payments`);

    // Process each overdue payment
    for (const payment of overduePayments) {
      // Update payment status to overdue
      payment.status = "Overdue";
      await payment.save();

      // If provider has a phone number, send reminder
      if (payment.serviceProvider?.user?.phone) {
        const daysPastDue = Math.floor(
          (now - new Date(payment.dueDate)) / (1000 * 60 * 60 * 24)
        );

        let message = `🚨 *Payment Overdue* 🚨\n\n`;
        message += `Hello ${
          payment.serviceProvider.user.firstName ||
          payment.serviceProvider.user.lastName ||
          "Provider"
        },\n\n`;
        message += `Your payment of $${payment.serviceFee.toFixed(
          2
        )} for service request ${
          payment.serviceRequest.id
        } is now ${daysPastDue} day${
          daysPastDue !== 1 ? "s" : ""
        } overdue.\n\n`;

        // Add warning about account restriction after 48 hours
        if (daysPastDue >= 1) {
          message += `⚠️ Your account will be restricted from receiving new jobs if payment is not made within 48 hours.\n\n`;
        }

        // Add more severe warning if already past 48 hours
        if (daysPastDue >= 2) {
          message += `⛔ Your account is now restricted from receiving new jobs. Please make payment as soon as possible to restore full access.\n\n`;

          // Update provider payment status to Restricted
          await ServiceProvider.updateOne(
            { _id: payment.serviceProvider._id },
            {
              $set: { paymentStatus: "Restricted" },
              $inc: { outstandingPayments: 1 },
            }
          );
        }

        message += `To make payment, please reply with "Pay service fee" or contact support for assistance.\n\n`;
        message += `Thank you for your prompt attention to this matter.`;

        await sendTextMessage(payment.serviceProvider.user.phone, message);

        // Update reminder tracking
        payment.remindersSent += 1;
        payment.lastReminderDate = now;
        await payment.save();
      }
    }

    // Also check for providers that need to be restricted
    const providersToRestrict = await ServiceProvider.find({
      paymentStatus: "Payment Due",
      outstandingPayments: { $gt: 0 },
    }).populate("user", "phone firstName lastName");

    for (const provider of providersToRestrict) {
      // Check if they have any payments overdue by more than 48 hours
      const overdue48Hours = await PaymentRecord.findOne({
        serviceProvider: provider._id,
        status: "Overdue",
        dueDate: { $lt: new Date(now - 48 * 60 * 60 * 1000) },
      });

      if (overdue48Hours) {
        // Restrict the provider's account
        provider.paymentStatus = "Restricted";
        await provider.save();

        // Notify the provider
        if (provider.user?.phone) {
          const message =
            `⛔ *Account Restricted* ⛔\n\n` +
            `Hello ${
              provider.user.firstName || provider.user.lastName || "Provider"
            },\n\n` +
            `Your account has been restricted due to overdue service fees. You will not receive new job requests until your outstanding payments are settled.\n\n` +
            `Please make payment as soon as possible to restore full access to your account.\n\n` +
            `To make payment, please reply with "Pay service fee" or contact support for assistance.`;

          await sendTextMessage(provider.user.phone, message);
        }
      }
    }
  } catch (error) {
    console.error("Error in payment reminder job:", error);
  }
});

module.exports = {
  startJobs: () => console.log("Payment reminder jobs scheduled"),
};
