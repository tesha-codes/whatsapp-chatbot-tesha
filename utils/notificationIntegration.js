const NotificationUtil = require("../utils/notificationUtil");
const ServiceProvider = require('../models/serviceProvider.model')
const ServiceRequest = require('../models/request.model')


async function handleServiceProviderProfileCompletion(serviceProvider, user) {
    try {
        // Get service and category details
        const populatedProvider = await ServiceProvider.findById(serviceProvider._id)
            .populate('service', 'title')
            .populate('category', 'name');

        // Create notification when service provider completes profile
        await NotificationUtil.createServiceProviderRegistrationNotification(
            populatedProvider,
            user,
            populatedProvider.service,
            populatedProvider.city
        );

        console.log("Service provider registration notification created successfully");
    } catch (error) {
        console.error("Error creating service provider notification:", error);
    }
}

async function handleServiceRequestCreation(serviceRequest, requester) {
    try {
        // Get service details
        const populatedRequest = await ServiceRequest.findById(serviceRequest._id)
            .populate('service', 'title')
            .populate('requester', 'firstName lastName');

        // Create notification when service request is created
        await NotificationUtil.createServiceRequestNotification(
            populatedRequest,
            requester,
            populatedRequest.service,
            serviceRequest.address?.physicalAddress || "Unknown location"
        );

        console.log("Service request notification created successfully");
    } catch (error) {
        console.error("Error creating service request notification:", error);
    }
}

async function handlePaymentProcessing(paymentRecord, serviceRequest, type = "received") {
    try {
        // Get service details
        const populatedRequest = await ServiceRequest.findById(serviceRequest._id)
            .populate('service', 'title');

        // Create notification when payment is processed
        await NotificationUtil.createPaymentNotification(
            paymentRecord,
            serviceRequest,
            populatedRequest.service,
            type
        );

        console.log(`Payment ${type} notification created successfully`);
    } catch (error) {
        console.error("Error creating payment notification:", error);
    }
}

async function handleClientRegistration(user, location) {
    try {
        // Create notification when client completes registration
        await NotificationUtil.createClientRegistrationNotification(
            user,
            location || "Unknown location"
        );

        console.log("Client registration notification created successfully");
    } catch (error) {
        console.error("Error creating client registration notification:", error);
    }
}

module.exports = {
    handleServiceProviderProfileCompletion,
    handleServiceRequestCreation,
    handlePaymentProcessing,
    handleClientRegistration,
};
