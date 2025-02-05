const Subscription = require("../../models/subscription.model");


const SUBSCRIPTION_PLANS = {
  "Free Trial": {
    price: 0,
    features: [
      "Basic task management",
      "Limited requests per day",
      "7 days duration",
    ],
    duration: 7,
  },
  Basic: {
    price: 10,
    features: ["Unlimited tasks", "Priority support", "Monthly analytics"],
    duration: 30,
  },
  Premium: {
    price: 25,
    features: [
      "All Basic features",
      "Advanced analytics",
      "Featured listing",
      "Priority matching",
    ],
    duration: 30,
  },
};

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

      return {
        currentPlan: {
          plan: subscription.plan,
          active: subscription.active,
          duration: subscription.duration,
          features: SUBSCRIPTION_PLANS[subscription.plan].features,
          price: SUBSCRIPTION_PLANS[subscription.plan].price,
        },
        history: subscriptionHistory.map((sub) => ({
          plan: sub.plan,
          startDate: sub.createdAt,
          endDate: this.calculateEndDate(sub.createdAt, sub.plan),
          status: sub.active ? "Active" : "Expired",
        })),
      };
    } catch (error) {
      console.error("Error getting billing history:", error);
      throw error;
    }
  }

  calculateEndDate(startDate, plan) {
    const duration = SUBSCRIPTION_PLANS[plan].duration;
    return new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
  }

  async getSubscriptionPlans() {
    return Object.entries(SUBSCRIPTION_PLANS).map(([name, details]) => ({
      name,
      ...details,
    }));
  }
}

module.exports = BillingManager;
