const Subscription = require("../../models/subscription.model");
const ServiceProvider = require("../../models/serviceProvider.model");
const mongoose = require("mongoose");
const { Paynow } = require("paynow");

// Updated subscription plans based on the images
const SUBSCRIPTION_PLANS = {
  "Free Trial": {
    features: [
      "Profile listing on platform",
      "WhatsApp integration",
      "Basic task management",
      "Service request notifications",
      "Basic analytics dashboard",
      "Standard ranking in search results",
      "Community forum access",
    ],
    trialDurationDays: 90, // 3 months free trial
  },
  Basic: {
    monthlyPrice: 1.99,
    yearlyPrice: 22.0, // Save $1.88 annually
    features: [
      "Profile listing on platform",
      "WhatsApp integration",
      "Basic task management",
      "Service request notifications",
      "Basic analytics dashboard",
      "Standard ranking in search results",
      "Community forum access",
    ],
  },
  Premium: {
    monthlyPrice: 4.99,
    yearlyPrice: 65.0, // Save $5.12 annually
    features: [
      "All Basic Provider features",
      "Priority profile visibility",
      "Enhanced search ranking",
      "Advanced analytics and insights",
      "Performance metrics tracking",
      "Priority customer support",
      "Featured provider status",
      "Client review highlights",
      "Custom service area settings",
      "Extended service descriptions",
    ],
  },
};

// Initialize Paynow with your integration ID and integration key
const paynow = new Paynow(
  process.env.PAYNOW_INTEGRATION_ID,
  process.env.PAYNOW_INTEGRATION_KEY
);
paynow.resultUrl = process.env.PAYNOW_RESULT_URL;
paynow.returnUrl = process.env.PAYNOW_RETURN_URL;

class BillingManager {
  constructor(userId) {
    this.userId = userId;
  }

  async getBillingHistory() {
    try {
      const subscription = await Subscription.findOne({
        user: this.userId,
      }).sort({ createdAt: -1 });

      if (!subscription) {
        return {
          currentPlan: "No active subscription",
          history: [],
        };
      }

      const subscriptionHistory = await Subscription.find({
        user: this.userId,
      })
        .sort({ createdAt: -1 })
        .limit(10);

      // Get pricing based on billing cycle
      const getPlanPrice = (sub) => {
        if (sub.plan === "Free Trial") return 0;
        return sub.billingCycle === "Monthly"
          ? SUBSCRIPTION_PLANS[sub.plan].monthlyPrice
          : SUBSCRIPTION_PLANS[sub.plan].yearlyPrice;
      };

      return {
        currentPlan: {
          plan: subscription.plan,
          status: subscription.status,
          billingCycle: subscription.billingCycle || "N/A",
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew,
          features: SUBSCRIPTION_PLANS[subscription.plan].features,
          price: getPlanPrice(subscription),
        },
        nextRenewalDate: subscription.nextRenewalDate,
        paymentHistory: subscription.paymentHistory || [],
        history: subscriptionHistory.map((sub) => ({
          plan: sub.plan,
          billingCycle: sub.billingCycle || "N/A",
          startDate: sub.startDate,
          endDate: sub.endDate,
          status: sub.status,
          price: getPlanPrice(sub),
        })),
      };
    } catch (error) {
      console.error("Error getting billing history:", error);
      throw error;
    }
  }

  async getCurrentSubscription() {
    try {
      const subscription = await Subscription.findOne({
        user: this.userId,
      }).sort({ createdAt: -1 });

      if (!subscription) {
        return {
          status: "No active subscription",
          canInitiateNewSubscription: true,
        };
      }

      const isExpiringSoon =
        subscription.endDate &&
        (new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24) <
          7;

      return {
        plan: subscription.plan,
        billingCycle: subscription.billingCycle || "N/A",
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        isExpiringSoon,
        daysRemaining: subscription.endDate
          ? Math.max(
              0,
              Math.floor(
                (new Date(subscription.endDate) - new Date()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 0,
        autoRenew: subscription.autoRenew,
      };
    } catch (error) {
      console.error("Error getting current subscription:", error);
      throw error;
    }
  }

  async getSubscriptionPlans() {
    // Return all plan options for display
    const plans = [];

    // Add Basic monthly
    plans.push({
      name: "Basic",
      cycle: "Monthly",
      price: SUBSCRIPTION_PLANS.Basic.monthlyPrice,
      features: SUBSCRIPTION_PLANS.Basic.features,
    });

    // Add Premium monthly
    plans.push({
      name: "Premium",
      cycle: "Monthly",
      price: SUBSCRIPTION_PLANS.Premium.monthlyPrice,
      features: SUBSCRIPTION_PLANS.Premium.features,
    });

    // Add Basic yearly
    plans.push({
      name: "Basic",
      cycle: "Yearly",
      price: SUBSCRIPTION_PLANS.Basic.yearlyPrice,
      savings: (
        SUBSCRIPTION_PLANS.Basic.monthlyPrice * 12 -
        SUBSCRIPTION_PLANS.Basic.yearlyPrice
      ).toFixed(2),
      features: SUBSCRIPTION_PLANS.Basic.features,
    });

    // Add Premium yearly
    plans.push({
      name: "Premium",
      cycle: "Yearly",
      price: SUBSCRIPTION_PLANS.Premium.yearlyPrice,
      savings: (
        SUBSCRIPTION_PLANS.Premium.monthlyPrice * 12 -
        SUBSCRIPTION_PLANS.Premium.yearlyPrice
      ).toFixed(2),
      features: SUBSCRIPTION_PLANS.Premium.features,
    });

    return plans;
  }

  async initiateFreeTrialSubscription() {
    try {
      const serviceProvider = await ServiceProvider.findOne({
        user: this.userId,
      });

      if (!serviceProvider) {
        throw new Error("Service provider not found");
      }

      // Check if a subscription already exists
      const existingSubscription = await Subscription.findOne({
        user: this.userId,
      });

      if (existingSubscription) {
        return {
          status: "Subscription already exists",
          subscription: existingSubscription,
        };
      }

      // Calculate end date (3 months/90 days from now)
      const endDate = new Date();
      endDate.setDate(
        endDate.getDate() + SUBSCRIPTION_PLANS["Free Trial"].trialDurationDays
      );

      // Create new subscription
      const subscription = new Subscription({
        _id: new mongoose.Types.ObjectId(),
        user: this.userId,
        serviceProvider: serviceProvider._id,
        plan: "Free Trial",
        status: "Active",
        startDate: new Date(),
        endDate: endDate,
        nextRenewalDate: endDate,
      });

      await subscription.save();

      // Update service provider with subscription reference
      serviceProvider.subscription = subscription._id;
      await serviceProvider.save();

      return {
        status: "Free trial activated",
        subscription: {
          plan: subscription.plan,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          features: SUBSCRIPTION_PLANS["Free Trial"].features,
        },
      };
    } catch (error) {
      console.error("Error initiating free trial:", error);
      throw error;
    }
  }

  async initiatePayment(
    planName,
    billingCycle,
    paymentPhone,
    paymentMethod = "ecocash"
  ) {
    try {
      // Validate inputs
      if (!planName || !["Basic", "Premium"].includes(planName)) {
        throw new Error("Invalid plan selected");
      }

      if (!billingCycle || !["Monthly", "Yearly"].includes(billingCycle)) {
        throw new Error("Invalid billing cycle selected");
      }

      if (!paymentPhone || !/^07\d{8}$/.test(paymentPhone)) {
        throw new Error(
          "Invalid payment phone number. Phone number must be in format 07XXXXXXXX"
        );
      }

      // Validate payment method
      if (!["ecocash", "innbucks"].includes(paymentMethod.toLowerCase())) {
        throw new Error(
          "Invalid payment method. Supported methods: EcoCash, InnBucks"
        );
      }

      // Format phone number (remove + if present)
      const formattedPhone = paymentPhone.startsWith("+")
        ? paymentPhone.substring(1)
        : paymentPhone;

      // Get plan price
      const planPrice =
        billingCycle === "Monthly"
          ? SUBSCRIPTION_PLANS[planName].monthlyPrice
          : SUBSCRIPTION_PLANS[planName].yearlyPrice;

      // Get service provider
      const serviceProvider = await ServiceProvider.findOne({
        user: this.userId,
      });

      if (!serviceProvider) {
        throw new Error("Service provider not found");
      }

      // Generate a payment reference
      const paymentRef =
        "TESHA_" + serviceProvider._id.toString() + "_" + new Date().getTime();

      // Create payment with Paynow
      const payment = paynow.createPayment(paymentRef, "support@tesha.co.zw");

      // Add the subscription item to the payment
      payment.add(`${planName} ${billingCycle} Subscription`, planPrice);

      // Create a new payment record for the database
      const paymentRecord = {
        amount: planPrice,
        paymentDate: new Date(),
        paymentMethod: paymentMethod === "ecocash" ? "EcoCash" : "InnBucks",
        paymentPhone: formattedPhone,
        transactionId: paymentRef,
        status: "Pending",
      };

      // Initiate mobile payment
      const response = await paynow.sendMobile(
        payment,
        formattedPhone,
        paymentMethod.toLowerCase()
      );

      if (!response.success) {
        throw new Error(`Failed to initiate payment: ${response.error}`);
      }

      // Store poll URL and additional data in payment record
      paymentRecord.pollUrl = response.pollUrl;
      paymentRecord.instructions = response.instructions;

      // If there's an existing subscription, update it
      if (currentSubscription) {
        // If current subscription is active, set the start date to after current end date
        if (
          currentSubscription.status === "Active" &&
          new Date(currentSubscription.endDate) > new Date()
        ) {
          startDate.setTime(new Date(currentSubscription.endDate).getTime());
          endDate.setTime(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
        }

        currentSubscription.plan = planName;
        currentSubscription.billingCycle = billingCycle;
        currentSubscription.status = "Pending Payment";
        currentSubscription.startDate = startDate;
        currentSubscription.endDate = endDate;
        currentSubscription.nextRenewalDate = endDate;
        currentSubscription.paymentHistory = [
          ...(currentSubscription.paymentHistory || []),
          paymentRecord,
        ];

        await currentSubscription.save();

        return {
          paymentInitiated: true,
          paymentReference: paymentRef,
          amount: planPrice,
          plan: planName,
          billingCycle,
          paymentPhone: formattedPhone,
          instructions: response.instructions,
          nextStep: "Please check your phone for the EcoCash payment prompt",
        };
      }

      // Create a new subscription if one doesn't exist
      const subscription = new Subscription({
        _id: new mongoose.Types.ObjectId(),
        user: this.userId,
        serviceProvider: serviceProvider._id,
        plan: planName,
        billingCycle: billingCycle,
        status: "Pending Payment",
        startDate,
        endDate,
        nextRenewalDate: endDate,
        paymentHistory: [paymentRecord],
      });

      await subscription.save();

      // Update service provider with subscription reference
      serviceProvider.subscription = subscription._id;
      await serviceProvider.save();

      return {
        paymentInitiated: true,
        paymentReference: paymentRef,
        amount: planPrice,
        plan: planName,
        billingCycle,
        paymentPhone: formattedPhone,
        instructions: response.instructions,
        nextStep: "Please check your phone for the EcoCash payment prompt",
      };
    } catch (error) {
      console.error("Error initiating payment:", error);
      throw error;
    }
  }

  async toggleAutoRenewal(autoRenew) {
    try {
      const subscription = await Subscription.findOne({
        user: this.userId,
      }).sort({ createdAt: -1 });

      if (!subscription) {
        throw new Error("No active subscription found");
      }

      subscription.autoRenew = autoRenew;
      await subscription.save();

      return {
        enabled: autoRenew,
        plan: subscription.plan,
        endDate: subscription.endDate,
      };
    } catch (error) {
      console.error("Error toggling auto-renewal:", error);
      throw error;
    }
  }
}

module.exports = BillingManager;
