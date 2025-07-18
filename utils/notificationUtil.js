const Notification = require("../models/notification.model");

class NotificationUtil {


  static async createServiceProviderRegistrationNotification(serviceProvider, user, service, location) {
    try {
      const notification = new Notification({
        type: "service-provider",
        title: "New Service Provider Registration",
        description: `${user.firstName} ${user.lastName} has registered as a ${service.title} service provider in ${location}`,
        priority: "medium",
        actionUrl: `/service-providers/${serviceProvider._id}`,
        metadata: {
          userName: `${user.firstName} ${user.lastName}`,
          serviceName: service.title,
          location: location,
          providerId: serviceProvider._id,
        },
        relatedModels: {
          serviceProvider: serviceProvider._id,
          user: user._id,
        }
      });

      return await notification.save();
    } catch (error) {
      console.error("Error creating service provider registration notification:", error);
      throw error;
    }
  }

  static async createServiceRequestNotification(serviceRequest, user, service, location) {
    try {
      const notification = new Notification({
        type: "service-request",
        title: "New Service Request",
        description: `${user.firstName} ${user.lastName} requested ${service.title} in ${location}`,
        priority: "high",
        actionUrl: `/service-requests/${serviceRequest._id}`,
        metadata: {
          userName: `${user.firstName} ${user.lastName}`,
          serviceName: service.title,
          location: location,
          requestId: serviceRequest._id,
        },
        relatedModels: {
          serviceRequest: serviceRequest._id,
          user: user._id,
        }
      });

      return await notification.save();
    } catch (error) {
      console.error("Error creating service request notification:", error);
      throw error;
    }
  }


  static async createPaymentNotification(paymentRecord, serviceRequest, service, type = "received") {
    try {
      const isSuccess = type === "received";
      const notification = new Notification({
        type: "payment",
        title: isSuccess ? "Payment Received" : "Payment Failed",
        description: isSuccess 
          ? `USD $${paymentRecord.totalAmount.toFixed(2)} payment received for ${service.title} completion`
          : `USD $${paymentRecord.totalAmount.toFixed(2)} payment failed for ${service.title} - requires attention`,
        priority: isSuccess ? "low" : "high",
        actionUrl: isSuccess 
          ? `/payments/${paymentRecord._id}`
          : `/payments/failed/${paymentRecord._id}`,
        metadata: {
          amount: paymentRecord.totalAmount,
          serviceName: service.title,
          paymentMethod: paymentRecord.paymentMethod,
          status: paymentRecord.status,
          transactionId: paymentRecord.transactionId,
        },
        relatedModels: {
          paymentRecord: paymentRecord._id,
          serviceRequest: serviceRequest._id,
          user: paymentRecord.requester,
          serviceProvider: paymentRecord.serviceProvider,
        }
      });

      return await notification.save();
    } catch (error) {
      console.error("Error creating payment notification:", error);
      throw error;
    }
  }

  static async createClientRegistrationNotification(user, location) {
    try {
      const notification = new Notification({
        type: "user",
        title: "New Client Registration",
        description: `${user.firstName} ${user.lastName} has registered as a client in ${location}`,
        priority: "medium",
        actionUrl: `/users/${user._id}`,
        metadata: {
          userName: `${user.firstName} ${user.lastName}`,
          location: location,
          userId: user._id,
        },
        relatedModels: {
          user: user._id,
        }
      });

      return await notification.save();
    } catch (error) {
      console.error("Error creating client registration notification:", error);
      throw error;
    }
  }

  static async createServiceCompletionNotification(serviceRequest, serviceProvider, user, service) {
    try {
      const notification = new Notification({
        type: "service-request",
        title: "Service Completed",
        description: `${service.title} completed by ${user.firstName} ${user.lastName} - awaiting customer review`,
        priority: "low",
        actionUrl: `/service-requests/${serviceRequest._id}`,
        metadata: {
          userName: `${user.firstName} ${user.lastName}`,
          serviceName: service.title,
          requestId: serviceRequest._id,
          providerId: serviceProvider._id,
        },
        relatedModels: {
          serviceRequest: serviceRequest._id,
          serviceProvider: serviceProvider._id,
          user: user._id,
        }
      });

      return await notification.save();
    } catch (error) {
      console.error("Error creating service completion notification:", error);
      throw error;
    }
  }


  static async createProviderApplicationPendingNotification(serviceProvider, user, service) {
    try {
      const notification = new Notification({
        type: "service-provider",
        title: "Provider Application Pending",
        description: `${user.firstName} ${user.lastName}'s ${service.title} application requires document verification`,
        priority: "medium",
        actionUrl: `/service-providers/${serviceProvider._id}`,
        metadata: {
          userName: `${user.firstName} ${user.lastName}`,
          serviceName: service.title,
          providerId: serviceProvider._id,
        },
        relatedModels: {
          serviceProvider: serviceProvider._id,
          user: user._id,
        }
      });

      return await notification.save();
    } catch (error) {
      console.error("Error creating provider application pending notification:", error);
      throw error;
    }
  }

  static async createSystemAlertNotification(title, description, priority = "medium", metadata = {}) {
    try {
      const notification = new Notification({
        type: "alert",
        title: title,
        description: description,
        priority: priority,
        actionUrl: "/analytics/alerts",
        metadata: metadata,
      });

      return await notification.save();
    } catch (error) {
      console.error("Error creating system alert notification:", error);
      throw error;
    }
  }
}

module.exports = NotificationUtil;
