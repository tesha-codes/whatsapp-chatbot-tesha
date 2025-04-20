const mongoose = require("mongoose");
const { fieldEncryption } = require("mongoose-field-encryption");
const crypto = require("node:crypto");

const SubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serviceProvider: {
      type: mongoose.Types.ObjectId,
      ref: "ServiceProvider",
      required: true,
    },
    plan: {
      type: String,
      enum: ["Basic", "Premium", "Free Trial"],
      required: true,
      default: "Free Trial",
    },
    billingCycle: {
      type: String,
      enum: ["Monthly", "Yearly"],
      default: "Monthly",
    },
    status: {
      type: String,
      enum: ["Active", "Expired", "Canceled", "Pending Payment"],
      default: "Active",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    paymentHistory: [
      {
        amount: Number,
        paymentDate: Date,
        paymentMethod: {
          type: String,
          default: "EcoCash",
        },
        paymentPhone: String,
        transactionId: String,
        status: {
          type: String,
          enum: ["Pending", "Completed", "Failed"],
          default: "Pending",
        },
      },
    ],
    nextRenewalDate: {
      type: Date,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

SubscriptionSchema.plugin(fieldEncryption, {
  fields: ["user"],
  secret: process.env.MONGO_SECRET_ENCRYPTION_KEY,
  saltGenerator: function (secret) {
    const salt = crypto.randomBytes(16).toString("hex").slice(0, 16);
    return salt;
  },
});

module.exports = mongoose.model("Subscription", SubscriptionSchema);
