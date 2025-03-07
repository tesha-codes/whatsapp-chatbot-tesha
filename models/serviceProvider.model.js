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
    ecocashNumber: {
      type: String,
    },
    subscription: {
      type: mongoose.Types.ObjectId,
      ref: "Subscription",
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      default: 1.0
    }
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