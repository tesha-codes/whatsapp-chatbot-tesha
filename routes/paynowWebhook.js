const express = require("express");
const router = express.Router();
const Subscription = require("../models/subscription.model");
const { sendTextMessage } = require("../services/whatsappService");

router.post("/webhook", async (req, res) => {
  try {
    // Get payment data from request
    const { reference, status, amount, phone } = req.body;

    if (!reference) {
      return res.status(400).send({ error: "Missing reference" });
    }

    // Find subscription with this payment reference
    const subscription = await Subscription.findOne({
      "paymentHistory.transactionId": reference,
    }).populate({
      path: "user",
      select: "phone firstName",
    });

    if (!subscription) {
      return res.status(404).send({ error: "Subscription not found" });
    }

    // Update payment status
    const paymentIndex = subscription.paymentHistory.findIndex(
      (p) => p.transactionId === reference
    );

    if (paymentIndex === -1) {
      return res.status(404).send({ error: "Payment not found" });
    }

    // Update payment status
    subscription.paymentHistory[paymentIndex].status =
      status === "paid" ? "Completed" : "Failed";

    // If payment was successful, activate subscription
    if (status === "paid") {
      subscription.status = "Active";
      await subscription.save();

      // Send confirmation message via WhatsApp
      if (subscription.user && subscription.user.phone) {
        const message =
          `✅ *Payment Confirmed* ✅\n\n` +
          `Your payment of $${amount} for the ${subscription.plan} ${subscription.billingCycle} plan has been received.\n\n` +
          `Your subscription is now active until ${new Date(
            subscription.endDate
          ).toLocaleDateString()}.\n\n` +
          `Thank you for subscribing to Tesha!`;

        await sendTextMessage(subscription.user.phone, message);
      }
    } else {
      // Payment failed
      if (subscription.user && subscription.user.phone) {
        const message =
          `❌ *Payment Failed* ❌\n\n` +
          `We couldn't process your payment for the ${subscription.plan} ${subscription.billingCycle} plan.\n\n` +
          `Please try again by replying 'Retry payment' or contact support if the issue persists.`;

        await sendTextMessage(subscription.user.phone, message);
      }
    }

    return res.status(200).send({ success: true });
  } catch (error) {
    console.error("Error in Paynow webhook:", error);
    return res.status(500).send({ error: "Internal server error" });
  }
});

module.exports = router;
