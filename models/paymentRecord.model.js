const mongoose = require("mongoose");

const PaymentRecordSchema = new mongoose.Schema(
  {
    serviceRequest: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
    },
    serviceProvider: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceProvider",
      required: true,
    },
    requester: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    serviceFee: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["EcoCash", "InnBucks", "ecocash", "innbucks"],
      default: "EcoCash",
    },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Overdue", "Failed"],
      default: "Pending",
    },
    paymentDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    transactionId: {
      type: String,
    },
    pollUrl: {
      type: String,
    },
    paymentPhone: {
      type: String,
    },
    remindersSent: {
      type: Number,
      default: 0,
    },
    lastReminderDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Indexes for better query performance
PaymentRecordSchema.index({ serviceProvider: 1, status: 1 });
PaymentRecordSchema.index({ serviceRequest: 1 });
PaymentRecordSchema.index({ dueDate: 1, status: 1 });

const PaymentRecord = mongoose.model("PaymentRecord", PaymentRecordSchema);

module.exports = PaymentRecord;
