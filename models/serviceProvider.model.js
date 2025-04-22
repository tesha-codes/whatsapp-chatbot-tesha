const mongoose = require("mongoose");

const ServiceProviderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    category: {
      type: mongoose.Types.ObjectId,
      ref: "Category",
    },
    service: {
      type: mongoose.Types.ObjectId,
      ref: "Service",
    },
    city: {
      type: String,
      trim: true,
    },
    nationalIdImage: {
      type: String,
    },
    description: {
      type: String,
      trim: true,
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: 1.0,
    },
    hourlyRate: {
      type: Number,
      default: 1.0,
    },
    paymentStatus: {
      type: String,
      enum: ["Good Standing", "Payment Due", "Restricted"],
      default: "Good Standing",
    },
    outstandingPayments: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    lastPaymentDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

ServiceProviderSchema.index({ user: 1 });
ServiceProviderSchema.index({ category: 1 });
ServiceProviderSchema.index({ service: 1 });
ServiceProviderSchema.index({ city: 1 });

const ServiceProvider = mongoose.model(
  "ServiceProvider",
  ServiceProviderSchema
);

module.exports = ServiceProvider;
