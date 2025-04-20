const CHAT_TEMPLATES = {
  TASK_OVERVIEW: (data) => `
📊 *Your Task Dashboard*
━━━━━━━━━━━━━━━━━━
📈 Total Tasks: ${data.total}
⏳ Pending: ${data.Pending}
🔥 In Progress: ${data["In Progress"]}
❌ Declined: ${data.Declined}
🚫 Cancelled: ${data.Cancelled}
✅ Completed: ${data.Completed}

*What would you like to do next?*
- Type "pending" to view pending tasks
- Type "completed" to view completed tasks
- Type "cancelled" to view cancelled tasks
- Type "task details" followed by task/request ID to view specific details`,

  TASK_HISTORY: (tasks) => {
    if (!tasks.length) {
      return "📭 No tasks found in your history. Your task list is currently empty.";
    }

    return (
      `*Your Task History*\n━━━━━━━━━━━━━━━━━━\n` +
      tasks
        .map(
          (task, index) => `
🔹 *Task #${index + 1}*
Request ID: ${task.id}
Service: ${task.service.title}
Client: ${task.requester.firstName} ${task.requester.lastName}
Phone: +${task.requester.phone}
City: ${task.city}
Date: ${task.date}
Time: ${task.time}
Price: ${task.service.unitPrice}
Status: ${task.status}
Notes: ${task.notes || "No notes provided"}
━━━━━━━━━━━━━━━━━━`
        )
        .join("\n")
    );
  },

  LIST_TASK_BY_STATUS: (tasks) => {
    if (!tasks.length) {
      return "📭 No tasks found in this category. Your task list is currently empty.";
    }

    return (
      `*Your Tasks - ${tasks[0].status}*\n━━━━━━━━━━━━━━━━━━\n` +
      tasks
        .map(
          (task, index) => `
🔹 *Task #${index + 1}*
- Request ID: ${task.id}
- Client: ${task.requester.firstName} ${task.requester.lastName}
- Phone: +${task.requester.phone}
- Service: ${task.service.title}
- City: ${task.city}
- Date: ${new Date(task.date).toLocaleDateString()}
- Time: ${task.time}

${getStatusEmoji(task.status)} ${task.status}
━━━━━━━━━━━━━━━━━━`
        )
        .join("\n")
    );
  },

  PROFILE_VIEW: (profile) => `
👤 *Your Professional Profile*
━━━━━━━━━━━━━━━━━━
📝 Name: ${profile.firstName} ${profile.lastName}
📱 Phone: ${profile.phone}
🌍 City: ${profile.provider.city}
💼 Service: ${profile.provider.service.title}
💰 Price: ${profile.provider.service.unitPrice}
📍 Address: ${profile.provider.address.physicalAddress}
⭐ Rating: ${profile.provider.rating}/5

*Need to make changes?*
Simply send a message like:
- "Update name to John Smith"
- "Change city to Mutare"
- "Update service description to..."`,

  TASK_DETAILS: (task) => `
🔍 *Task/Booking Details*
━━━━━━━━━━━━━━━━━━
🆔 Request ID: ${task.id}
📦 Service: ${task.service.title}
💼 Client Name: ${task.requester.firstName} ${task.requester.lastName}
📱 Phone: +${task.requester.phone}
📍 City : ${task.city}
📅 Date: ${task.date}
🕒 Time: ${task.time}
💰 Price: ${task.service.unitPrice}
💡 Status:  ${task.status}
📝 Notes: ${task.notes || "No notes provided"}
`,
  REQUEST_ACCEPTED: (data) =>
    `✅ You have successfully accepted the service request ${
      data.id
    }. The client has been notified.

Please prepare for this task and ensure you have all necessary materials:

- Client: ${data.requester.firstName} ${data.requester.lastName}
- Phone: +${data.requester.phone}
- Date: ${
      data.date ? new Date(data.date).toLocaleDateString() : "Not specified"
    }
- Time: ${data.time || "Not specified"}
- Location: ${data.city || "Check request details"}
- Notes: ${data.notes || "No notes provided"}

Feel free to contact the client directly for any clarifications or directions.

Thank you for your prompt response.
`,

  REQUEST_DECLINED: (data) =>
    `❌ You have declined the service request ${
      data.id
    }. The client has been notified.

Reason: ${data.cancelReason || "No reason provided"}

Thank you for your prompt response.`,

  SUBSCRIPTION_PLANS: (data) => {
    let response = "📊 *Available Subscription Plans* 📊\n\n";

    // Group plans by billing cycle
    const monthlyPlans = data.filter((plan) => plan.cycle === "Monthly");
    const yearlyPlans = data.filter((plan) => plan.cycle === "Yearly");

    // Add monthly plans
    response += "📅 *Monthly Plans*\n";
    monthlyPlans.forEach((plan) => {
      response += `\n*${plan.name} Plan*: $${plan.price}/month\n`;
      response += "✅ Features:\n";
      plan.features.slice(0, 5).forEach((feature) => {
        response += `• ${feature}\n`;
      });
      if (plan.features.length > 5) {
        response += `• ...and ${plan.features.length - 5} more features\n`;
      }
    });

    // Add yearly plans
    response += "\n📆 *Yearly Plans* (Best Value)\n";
    yearlyPlans.forEach((plan) => {
      response += `\n*${plan.name} Plan*: $${plan.price}/year (Save $${plan.savings})\n`;
      response += "✅ Features:\n";
      plan.features.slice(0, 5).forEach((feature) => {
        response += `• ${feature}\n`;
      });
      if (plan.features.length > 5) {
        response += `• ...and ${plan.features.length - 5} more features\n`;
      }
    });

    response +=
      "\nTo subscribe, reply: 'Subscribe to [Plan Name] [Monthly/Yearly]'\nExample: 'Subscribe to Basic Monthly'";

    return response;
  },

  CURRENT_SUBSCRIPTION: (data) => {
    if (data.status === "No active subscription") {
      return "📱 You don't have an active subscription. Would you like to view available plans? Reply 'View plans' to see options.";
    }

    let response = "📊 *Your Current Subscription* 📊\n\n";
    response += `*Plan*: ${data.plan}\n`;
    response += `*Billing Cycle*: ${data.billingCycle}\n`;
    response += `*Status*: ${data.status}\n`;
    response += `*Start Date*: ${new Date(
      data.startDate
    ).toLocaleDateString()}\n`;
    response += `*End Date*: ${new Date(data.endDate).toLocaleDateString()}\n`;
    response += `*Days Remaining*: ${data.daysRemaining}\n`;
    response += `*Auto-Renewal*: ${data.autoRenew ? "Enabled" : "Disabled"}\n`;

    if (data.isExpiringSoon) {
      response +=
        "\n⚠️ *Your subscription is expiring soon!* Would you like to renew?";
    }

    return response;
  },

  PAYMENT_INITIATED: (data) => {
    let response = "💰 *Payment Initiated* 💰\n\n";
    response += `*Plan*: ${data.plan}\n`;
    response += `*Billing Cycle*: ${data.billingCycle}\n`;
    response += `*Amount*: $${data.amount}\n`;
    response += `*Payment Method*: ${data.paymentMethod}\n`;
    response += `*Payment Reference*: ${data.paymentReference}\n`;
    response += `*Payment Phone*: ${data.paymentPhone}\n\n`;

    response += "📱 *Instructions:*\n";
    if (data.instructions) {
      response += data.instructions + "\n\n";
    } else {
      response += `1. You'll receive a ${data.paymentMethod} prompt on your phone\n`;
      response += `2. Enter your ${data.paymentMethod} PIN to confirm payment\n`;
      response += "3. We'll notify you once your payment is confirmed\n\n";
    }

    response += "⏳ Your payment is being processed...";

    return response;
  },

  BILLING_HISTORY: (data) => {
    if (!data.currentPlan || data.currentPlan === "No active subscription") {
      return "📋 You don't have any billing history yet. Start by subscribing to a plan!";
    }

    let response = "📊 *Billing History* 📊\n\n";

    // Current plan info
    response += "*Current Plan:* " + data.currentPlan.plan + "\n";
    response += "*Status:* " + data.currentPlan.status + "\n";
    if (
      data.currentPlan.billingCycle &&
      data.currentPlan.billingCycle !== "N/A"
    ) {
      response += "*Billing Cycle:* " + data.currentPlan.billingCycle + "\n";
    }
    response += "*Price:* $" + data.currentPlan.price + "\n";

    // Payment history if any
    if (data.paymentHistory && data.paymentHistory.length > 0) {
      response += "\n*Recent Payments:*\n";
      data.paymentHistory.slice(0, 3).forEach((payment, i) => {
        response += `${i + 1}. $${payment.amount} - ${new Date(
          payment.paymentDate
        ).toLocaleDateString()} (${payment.status})\n`;
      });
    }

    // Subscription history
    if (data.history && data.history.length > 0) {
      response += "\n*Subscription History:*\n";
      data.history.slice(0, 3).forEach((sub, i) => {
        response += `${i + 1}. ${sub.plan} (${sub.status}) - From ${new Date(
          sub.startDate
        ).toLocaleDateString()} to ${new Date(
          sub.endDate
        ).toLocaleDateString()}\n`;
      });
    }

    return response;
  },

  ERROR_MESSAGE: `
⚠️ *Oops! Something went wrong*
We encountered a temporary issue. Please:
1. Try again in a few moments
2. Check your input and try again
3. Contact support if the issue persists`,
};

// Helper function for status emojis
function getStatusEmoji(status) {
  const statusEmojis = {
    pending: "⏳",
    completed: "✅",
    cancelled: "🚫",
    active: "✅",
    inactive: "⚠️",
    expired: "⌛",
    default: "📌",
  };
  return statusEmojis[status.toLowerCase()] || statusEmojis.default;
}

module.exports = CHAT_TEMPLATES;
