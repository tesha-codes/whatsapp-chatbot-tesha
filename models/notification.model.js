const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["service-provider", "service-request", "payment", "query", "alert", "user"],
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        priority: {
            type: String,
            enum: ["high", "medium", "low"],
            default: "medium",
        },
        actionUrl: {
            type: String,
            trim: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        // References to related entities
        relatedModels: {
            serviceProvider: {
                type: mongoose.Types.ObjectId,
                ref: "ServiceProvider",
            },
            paymentRecord: {
                type: mongoose.Types.ObjectId,
                ref: "PaymentRecord",
            },
            serviceRequest: {
                type: mongoose.Types.ObjectId,
                ref: "ServiceRequest",
            },
            user: {
                type: mongoose.Types.ObjectId,
                ref: "User",
            }
        }
    },
    { timestamps: true }
);

// Indexes for improved query performance
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ isRead: 1 });
NotificationSchema.index({ priority: 1 });
NotificationSchema.index({ timestamp: -1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ "relatedModels.serviceProvider": 1 });
NotificationSchema.index({ "relatedModels.user": 1 });

const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;
