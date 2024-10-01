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
      required: true,
    },
    subscription: {
      types: [mongoose.Types.ObjectId],
      required: true,
      ref: "Subscription",
    },
  },
  { timestamps: true }
);

ServiceProviderSchema.index({ user: 1 });
ServiceProviderSchema.index({ category: 1 });
ServiceProviderSchema.index({ service: 1 });
ServiceProviderSchema.index({ city: 1 });

module.exports = mongoose.model("ServiceProvider", ServiceProviderSchema);