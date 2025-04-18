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
      data.requestId
    }. The client has been notified.

Reason: ${data.reason || "No reason provided"}

Thank you for your prompt response.`,

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
