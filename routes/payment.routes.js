const express = require("express");
const router = express.Router();
const PaymentRecord = require("../models/paymentRecord.model");
const ServiceProvider = require("../models/serviceProvider.model");
const ServiceRequest = require("../models/request.model");
const { sendTextMessage } = require("../services/whatsappService");

// Handle Paynow result callback
router.post("/update", async (req, res) => {
  try {
    const { reference, paynowreference, status, pollurl } = req.body;

    console.log("Received Paynow callback:", req.body);

    if (!reference) {
      return res.status(400).json({ error: "Missing reference parameter" });
    }

    // Extract request ID from reference (format: TESHA-REQUESTID-TIMESTAMP)
    const parts = reference.split("-");
    if (parts.length < 3 || parts[0] !== "TESHA") {
      return res.status(400).json({ error: "Invalid reference format" });
    }

    const requestId = parts[1];

    // Find the service request
    const request = await ServiceRequest.findOne({
      id: requestId.toUpperCase(),
    }).populate("serviceProvider");

    if (!request) {
      return res.status(404).json({ error: "Service request not found" });
    }

    // Find the payment record
    const payment = await PaymentRecord.findOne({
      serviceRequest: request._id,
      status: { $ne: "Paid" }, // Ignore already paid ones
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    if (
      status.toLowerCase() === "paid" ||
      status.toLowerCase() === "confirmed"
    ) {
      // Update payment record
      payment.status = "Paid";
      payment.paymentDate = new Date();
      payment.transactionId = paynowreference || pollurl;
      await payment.save();

      // Update service request
      request.paymentStatus = "Paid";
      await request.save();

      // Update service provider
      const provider = await ServiceProvider.findById(
        request.serviceProvider._id
      ).populate("user");
      const newOutstandingPayments = Math.max(
        0,
        (provider.outstandingPayments || 1) - 1
      );

      await ServiceProvider.updateOne(
        { _id: request.serviceProvider._id },
        {
          $set: {
            paymentStatus:
              newOutstandingPayments > 0 ? "Payment Due" : "Good Standing",
            lastPaymentDate: new Date(),
            outstandingPayments: newOutstandingPayments,
          },
          $inc: {
            totalEarnings: payment.totalAmount || 0,
          },
        }
      );

      // Notify service provider if we have phone number
      if (provider?.user?.phone) {
        const message = `
✅ *Payment Confirmed* ✅

Your service fee payment of $${payment.serviceFee.toFixed(2)} for job ${
          request.id
        } has been successfully processed.

Your account status is now in good standing.
You will continue to receive new job requests.

Thank you for your prompt payment!`;

        await sendTextMessage(provider.user.phone, message);
      }

      return res
        .status(200)
        .json({ success: true, message: "Payment processed successfully" });
    } else {
      // Update transaction ID but don't mark as paid
      payment.transactionId = paynowreference || pollurl;
      await payment.save();

      return res
        .status(200)
        .json({ success: true, message: "Payment status updated" });
    }
  } catch (error) {
    console.error("Error processing payment callback:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Handle Paynow return URL
router.get("/return", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Tesha Payment</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
          }
          .success {
            color: #28a745;
            font-size: 4em;
            margin: 20px 0;
          }
          h1 {
            color: #333;
          }
          p {
            color: #666;
            line-height: 1.5;
          }
          .button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 20px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="success">✓</div>
        <h1>Payment Completed</h1>
        <p>Your payment has been processed. Please return to WhatsApp to continue using Tesha services.</p>
        <p>You can type "Check payment status" to verify your payment was received.</p>
        <a class="button" href="https://wa.me/+263771860190" target="_blank">Return to WhatsApp</a>
      </body>
    </html>
  `);
});

module.exports = router;
