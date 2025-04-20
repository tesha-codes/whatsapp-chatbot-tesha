const cron = require("node-cron");
const Subscription = require("../models/subscription.model");
const User = require("../models/user.model");
const { sendTextMessage } = require("../services/whatsappService");
const {Paynow} = require("paynow");

const paynow = new Paynow(
  process.env.PAYNOW_INTEGRATION_ID,
  process.env.PAYNOW_INTEGRATION_KEY
);

// Run daily at 1 AM
cron.schedule("0 1 * * *", async () => {
  try {
    console.log("Running subscription expiry check...");

    // Find subscriptions expiring in the next 7 days
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    const expiringSubscriptions = await Subscription.find({
      endDate: { $lte: expiryDate, $gt: new Date() },
      status: "Active",
    }).populate({
      path: "user",
      select: "phone firstName",
    });

    console.log(`Found ${expiringSubscriptions.length} expiring subscriptions`);

    // Notify users
    for (const subscription of expiringSubscriptions) {
      if (subscription.user && subscription.user.phone) {
        const daysLeft = Math.ceil(
          (subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)
        );

        // Special handling for free trial expiry
        if (subscription.plan === "Free Trial") {
          let message = `⚠️ *Free Trial Ending Soon* ⚠️\n\n`;
          message += `Hello ${subscription.user.firstName || "there"},\n\n`;
          message += `Your free trial will expire in ${daysLeft} day${
            daysLeft !== 1 ? "s" : ""
          }.\n\n`;
          message += `To continue using our premium features, you'll need to subscribe to one of our plans.\n\n`;
          message += `Reply 'View plans' to see available subscription options.`;

          await sendTextMessage(subscription.user.phone, message);
        } else {
          let message = `⚠️ *Subscription Expiring Soon* ⚠️\n\n`;
          message += `Hello ${subscription.user.firstName || "there"},\n\n`;
          message += `Your ${
            subscription.plan
          } subscription will expire in ${daysLeft} day${
            daysLeft !== 1 ? "s" : ""
          }.\n\n`;
          message += `To renew your subscription, simply reply with 'Renew subscription' or 'View plans' to see other options.`;

          await sendTextMessage(subscription.user.phone, message);
        }
      }
    }

    // Handle expired subscriptions
    const today = new Date();
    const expiredSubscriptions = await Subscription.find({
      endDate: { $lt: today },
      status: "Active",
    }).populate({
      path: "user",
      select: "phone firstName",
    });

    for (const subscription of expiredSubscriptions) {
      subscription.status = "Expired";
      await subscription.save();

      // Notify user if we have their contact
      if (subscription.user && subscription.user.phone) {
        const wasFreeTrial = subscription.plan === "Free Trial";

        let message = wasFreeTrial
          ? `📢 *Free Trial Expired* 📢\n\n`
          : `📢 *Subscription Expired* 📢\n\n`;

        message += wasFreeTrial
          ? `Your free trial has ended. To continue enjoying our premium features, please subscribe to a paid plan.`
          : `Your ${subscription.plan} subscription has expired.`;

        message += `\n\nReply 'View plans' to see available subscription options.`;

        await sendTextMessage(subscription.user.phone, message);
      }
    }
  } catch (error) {
    console.error("Error in subscription expiry check:", error);
  }
});

// Run every 15 minutes to check pending payments
// TODO: check if this is too frequent
cron.schedule('*/15 * * * *', async () => {
  try {
    console.log('Checking pending payments...');
    
    // Find subscriptions with pending payments
    const pendingSubscriptions = await Subscription.find({
      'paymentHistory.status': 'Pending',
      status: 'Pending Payment'
    }).populate({
      path: 'user',
      select: 'phone firstName'
    });
    
    for (const subscription of pendingSubscriptions) {
      // Get the pending payment
      const pendingPayment = subscription.paymentHistory.find(p => p.status === 'Pending');
      
      if (!pendingPayment || !pendingPayment.pollUrl) continue;
      
      // Check payment status with Paynow
      try {
        const status = await paynow.pollTransaction(pendingPayment.pollUrl);
        
        if (status.paid) {
          // Update payment status to completed
          pendingPayment.status = 'Completed';
          subscription.status = 'Active';
          await subscription.save();
          
          // Send confirmation message
          if (subscription.user && subscription.user.phone) {
            const message = `✅ *Payment Confirmed* ✅\n\n` +
              `Your payment of $${pendingPayment.amount} for the ${subscription.plan} ${subscription.billingCycle} plan has been received.\n\n` +
              `Your subscription is now active until ${new Date(subscription.endDate).toLocaleDateString()}.\n\n` +
              `Thank you for subscribing to Tesha!`;
            
            await sendTextMessage(subscription.user.phone, message);
          }
        } else if (status.cancelled) {
          // Update payment status to failed
          pendingPayment.status = 'Failed';
          await subscription.save();
          
          // Send failure message
          if (subscription.user && subscription.user.phone) {
            const message = `❌ *Payment Cancelled* ❌\n\n` +
              `Your payment for the ${subscription.plan} ${subscription.billingCycle} plan was cancelled.\n\n` +
              `Please try again by replying 'Retry payment' or contact support if you need assistance.`;
            
            await sendTextMessage(subscription.user.phone, message);
          }
        }
        // If still pending, do nothing
      } catch (error) {
        console.error(`Error checking payment status for ${pendingPayment.transactionId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error checking pending payments:', error);
  }
});

module.exports = {
  startJobs: () => console.log("Subscription jobs scheduled"),
};
