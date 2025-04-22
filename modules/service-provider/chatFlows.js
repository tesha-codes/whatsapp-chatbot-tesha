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
Request ID: *${task.id}*
Service: ${task.service.title}
Client: ${task.requester.firstName} ${task.requester.lastName}
Phone: +${task.requester.phone}
City: ${task.city}
Date: ${task.date}
Time: ${task.time}
Price: ${task.service.unitPrice}
Estimated Hours: ${task.estimatedHours}
Total Cost: $${task.totalCost.toFixed(2)}
Service Fee: $${task.serviceFee.toFixed(2)}
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
- Request ID: *${task.id}*
- Client: ${task.requester.firstName} ${task.requester.lastName}
- Phone: +${task.requester.phone}
- Service: ${task.service.title}
- Estimated Hours: ${task.estimatedHours}
- Total Cost: $${task.totalCost.toFixed(2)}
- Service Fee: $${task.serviceFee.toFixed(2)}
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
🆔 Request ID: *${task.id}*
📦 Service: ${task.service.title}
💼 Client Name: ${task.requester.firstName} ${task.requester.lastName}
📱 Phone: +${task.requester.phone}
📍 City : ${task.city}
📅 Date: ${task.date}
🕒 Time: ${task.time}
💰 Price: ${task.service.unitPrice}
💰 Estimated Hours: ${task.estimatedHours}
💵 Total Cost: $${task.totalCost.toFixed(2)}
💳 Service Fee: $${task.serviceFee.toFixed(2)}
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

💰 Job Details:
- Estimated Hours: ${data.estimatedHours}
- Estimated Total: $${data.totalCost.toFixed(2)}
- Service Fee (5%): $${data.serviceFee.toFixed(2)}

Feel free to contact the client directly for any clarifications or directions. Don't forget to mark the task as completed once the job is done, and pay for the service fee by replying with "*Pay service fee for ${
      data.id
    }*" to maintain your account in good standing.

Thank you for your prompt response.
`,

  REQUEST_DECLINED: (data) =>
    `❌ You have declined the service request ${
      data.id
    }. The client has been notified.

Reason: ${data.cancelReason || "No reason provided"}

Thank you for your prompt response.`,

  PAYMENTS_BY_STATUS: (data) => {
    if (!data) {
      return "❌ Could not retrieve your payment information.";
    }

    return `
📜 *Payment History - ${data[0].status}* 📜

${data
  .map(
    (payment, index) => `
🔹 *Payment #${index + 1}*
- Request ID: *${payment.serviceRequest.id}*
- Client: ${payment.requester.firstName} ${payment.requester.lastName}
- Phone: +${payment.requester.phone}
- Estimated Hours: ${payment.serviceRequest.estimatedHours}
- Total Cost: $${payment.serviceRequest.totalCost.toFixed(2)}
- Service Fee: $${payment.serviceRequest.serviceFee.toFixed(2)}
- City: ${payment.serviceRequest.city}
- Date: ${new Date(payment.serviceRequest.date).toLocaleDateString()}
- Time: ${payment.serviceRequest.time}
- Payment Status: ${payment.status}
━━━━━━━━━━━━━━━━━━`
  )
  .join("\n")}
    `;
  },

  PAYMENT_HISTORY: (data) => {
    if (!data || !data.payments || data.payments.length === 0) {
      return "📜 *Payment History* 📜\n\nYou don't have any payment records yet.";
    }

    let response = "📜 *Payment History* 📜\n\n";

    // Summary section
    response += "📊 *Summary*\n";
    response += `Total Paid: $${data.summary.totalPaid.toFixed(2)}\n`;
    response += `Total Jobs: ${data.summary.totalJobs}\n`;
    response += `Average Fee: $${data.summary.averageFee.toFixed(2)}\n\n`;

    // Recent payments
    response += "🔍 *Recent Payments*\n";

    data.payments.forEach((payment, index) => {
      const statusEmoji =
        payment.status === "Paid"
          ? "✅"
          : payment.status === "Overdue"
          ? "⚠️"
          : "⏳";

      response += `${index + 1}. ${statusEmoji} Request #${
        payment.requestId
      }\n`;
      response += `   Amount: $${payment.amount.toFixed(2)}\n`;
      response += `   Status: ${payment.status}\n`;

      if (payment.paymentDate) {
        response += `   Paid on: ${new Date(
          payment.paymentDate
        ).toLocaleDateString()}\n`;
      } else if (payment.dueDate) {
        response += `   Due by: ${new Date(
          payment.dueDate
        ).toLocaleDateString()}\n`;
      }

      if (payment.paymentMethod && payment.status === "Paid") {
        response += `   Method: ${payment.paymentMethod}\n`;
      }

      response += "\n";
    });

    // Pagination info if applicable
    if (data.pagination && data.pagination.pages > 1) {
      response += `Page ${data.pagination.page} of ${data.pagination.pages}\n`;
      response += `Type "payment history page ${Math.min(
        data.pagination.page + 1,
        data.pagination.pages
      )}" to see more.\n`;
    }

    return response;
  },

  JOB_COMPLETED: (data) => {
    return `
✅ *Job Completed Successfully* ✅

You have marked job ${data.request.id} as completed!

📋 *Payment Details:*
- Service Fee: $${data.paymentRecord.serviceFee.toFixed(2)}
- Due Date: ${new Date(data.paymentRecord.dueDate).toLocaleDateString()}
- Request ID: ${data.request.id}

⏰ Please make payment within 48 hours to maintain your account in good standing.

To make payment now, reply with "*Pay service fee for ${data.request.id}*"

The client has been notified that you've completed the job. Thank you for providing your services through Tesha!`;
  },

  PAYMENT_INITIATED: (data) => {
    if (!data || !data.success) {
      return "❌ *Payment Failed* ❌\n\nThere was an error initiating your payment. Please try again or contact support.";
    }

    return `
🔄 *Payment Initiated* 🔄

Your payment of $${data.payment.serviceFee.toFixed(2)} for job *${
      data.payment.requestId
    }* has been initiated.

💬 ${
      data.instructions ||
      "Please check your phone to complete the payment process."
    }

Payment Details:
- Amount: $${data.payment.serviceFee.toFixed(2)}
- Method: ${data.payment.paymentMethod}
- Phone: ${data.payment.paymentPhone}
- Reference: ${data.payment.reference}

To check if your payment has been confirmed, reply with "*Check payment status for ${
      data.payment.requestId
    }*".
`;
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
