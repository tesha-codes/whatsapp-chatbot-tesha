const mongoose = require("mongoose");

const ServiceRequestSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    requester: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: "User",
    },
    serviceProviders: {
      type: [mongoose.Types.ObjectId],
      required: true,
      ref: "User",
      default: [],
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Cancelled"],
      default: "Pending",
    },
    address: {
      physicalAddress: {
        type: String,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: "2dsphere", // Enable geospatial queries
      },
    },
    city: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
    },
    id: {
      type: String,
      required: true,
      trim: true,
      index: true, // Add index for faster lookups
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    useSavedLocation: {
      // Track if user wants to use saved location
      type: Boolean,
      default: false,
    },
    confirmed: {
      // Track if the user has confirmed the booking
      type: Boolean,
      default: false,
    },
    // for better tracking
    cancelReason: {
      type: String,
    },
    providerRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    clientFeedback: {
      type: String,
    },
  },
  { timestamps: true }
);

// Indexes
ServiceRequestSchema.index({ requester: 1, status: 1 });
ServiceRequestSchema.index({ service: 1 });
ServiceRequestSchema.index({ serviceProviders: 1 });
ServiceRequestSchema.index({ date: 1 });
ServiceRequestSchema.index({ city: 1 });

const ServiceRequest = mongoose.model("ServiceRequest", ServiceRequestSchema);

module.exports = ServiceRequest;
