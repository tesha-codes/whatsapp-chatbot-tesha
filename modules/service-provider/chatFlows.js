const CHAT_TEMPLATES = {
  TASK_OVERVIEW: (data) => `
📊 *Your Task Dashboard*
━━━━━━━━━━━━━━━━━━
📈 Total Tasks: ${data.total}
⏳ Pending: ${data.Pending}
✅ Completed: ${data.Completed}
🚫 Cancelled: ${data.Cancelled}

*What would you like to do next?*
- Type "pending" to view pending tasks
- Type "completed" to view completed tasks
- Type "cancelled" to view cancelled tasks
- Type "task details" followed by task ID to view specific details`,

  TASK_LIST: (tasks) => {
    if (!tasks.length) {
      return "📭 No tasks found in this category. Your task list is currently empty.";
    }

    return (
      `*Your Tasks*\n━━━━━━━━━━━━━━━━━━\n` +
      tasks
        .map(
          (task, index) => `
🔹 *Task #${index + 1}*
🆔 ${task.id}
💼 ${task.service.title}
📍 ${task.address.physicalAddress}
📅 ${new Date(task.createdAt).toLocaleDateString()}
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
⭐ Rating: ${profile.provider.rating}/5

*Need to make changes?*
Simply send a message like:
- "Update name to John Smith"
- "Change city to Mutare"
- "Update service description to..."`,

  SUBSCRIPTION_INFO: (data) => `
💳 *Subscription Details*
━━━━━━━━━━━━━━━━━━
📦 Plan: ${data.currentPlan.plan}
${data.currentPlan.active ? "✅ Status: Active" : "⚠️ Status: Inactive"}
💰 Price: $${data.currentPlan.price}/month

✨ *Plan Features:*
${data.currentPlan.features.map((f) => `• ${f}`).join("\n")}

Need to change your plan? Type "plans" to see available options.`,

  BILLING_HISTORY: (data) => {
    if (!data.history.length) {
      return "📊 Your billing history is currently empty. New transactions will appear here.";
    }

    return (
      `
💳 *Billing History*
━━━━━━━━━━━━━━━━━━\n` +
      data.history
        .map(
          (sub, index) => `
🔹 *Transaction #${index + 1}*
📦 Plan: ${sub.plan}
📅 Started: ${new Date(sub.startDate).toLocaleDateString()}
📅 Ends: ${new Date(sub.endDate).toLocaleDateString()}
${getStatusEmoji(sub.status)} Status: ${sub.status}
━━━━━━━━━━━━━━━━━━`
        )
        .join("\n")
    );
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
