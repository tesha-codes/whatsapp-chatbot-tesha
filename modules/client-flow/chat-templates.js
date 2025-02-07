const CHAT_TEMPLATES = {
    BOOKING_OVERVIEW: (data) => `
📊 *Your Bookings Overview*
━━━━━━━━━━━━━━━━━━
📈 Total Bookings: ${data.total}
⏳ Pending: ${data.pending}
✅ Confirmed: ${data.confirmed}
🔄 In Progress: ${data.inProgress}
✨ Completed: ${data.completed}
🚫 Cancelled: ${data.cancelled}

*Need help with your bookings?*
- Type "view pending" to see pending bookings
- Type "view confirmed" to check confirmed bookings
- Type "view completed" to see completed bookings
- Type "book service" to make a new booking`,

    BOOKING_LIST: (bookings) => {
        if (!bookings.length) {
            return "📭 You don't have any bookings in this category yet. Type 'book service' to make your first booking!";
        }
        return (
            `*Your Bookings*\n━━━━━━━━━━━━━━━━━━\n` +
            bookings
                .map(
                    (booking, index) => `
🔹 *Booking #${index + 1}*
🆔 ${booking.id}
🏠 Service: ${booking.service.title}
👤 Provider: ${booking.provider.name}
📍 Location: ${booking.address}
📅 Date: ${new Date(booking.scheduledDate).toLocaleDateString()}
⏰ Time: ${booking.scheduledTime}
${getStatusEmoji(booking.status)} Status: ${booking.status}
💰 Price: $${booking.price}
━━━━━━━━━━━━━━━━━━`
                )
                .join("\n")
        );
    },

    CLIENT_PROFILE: (profile) => `
👤 *Your Profile*
━━━━━━━━━━━━━━━━━━
📝 Name: ${profile.firstName} ${profile.lastName}
📱 Phone: ${profile.phone}
📧 Email: ${profile.email}
🏠 Address: ${profile.address}
🌍 City: ${profile.city}

*Want to update your profile?*
Send a message like:
- "Update name to Jane Smith"
- "Change address to 123 Main St"
- "Update phone to +263 71 234 5678"`,

    BOOKING_DETAILS: (booking) => `
📋 *Booking Details*
━━━━━━━━━━━━━━━━━━
🆔 Booking ID: ${booking.id}
🏠 Service: ${booking.service.title}
👤 Provider: ${booking.provider.name}
⭐ Provider Rating: ${booking.provider.rating}/5
📍 Service Location: ${booking.address}
📅 Date: ${new Date(booking.scheduledDate).toLocaleDateString()}
⏰ Time: ${booking.scheduledTime}
💰 Price: $${booking.price}
${getStatusEmoji(booking.status)} Status: ${booking.status}

*Need to make changes?*
- Type "reschedule" to change date/time
- Type "cancel booking" to cancel
- Type "contact provider" to message provider`,

    PAYMENT_HISTORY: (data) => {
        if (!data.history.length) {
            return "📊 Your payment history is empty. Completed bookings will appear here.";
        }
        return (
            `💳 *Payment History*\n━━━━━━━━━━━━━━━━━━\n` +
            data.history
                .map(
                    (payment, index) => `
🔹 *Payment #${index + 1}*
🆔 ${payment.id}
🏠 Service: ${payment.service.title}
💰 Amount: $${payment.amount}
📅 Date: ${new Date(payment.date).toLocaleDateString()}
${getStatusEmoji(payment.status)} Status: ${payment.status}
━━━━━━━━━━━━━━━━━━`
                )
                .join("\n")
        );
    },

    SERVICE_CATEGORIES: (categories) => `
🎯 *Available Services*
━━━━━━━━━━━━━━━━━━
${categories
            .map(
                (category) => `
${category.emoji} *${category.name}*
${category.services.map((service) => `• ${service.title}`).join("\n")}`
            )
            .join("\n")}

*Ready to book?*
Type "book" followed by the service name
Example: "book house cleaning"`,

    ERROR_MESSAGE: `
⚠️ *Oops! Something went wrong*
We encountered a temporary issue. Please:
1. Try again in a few moments
2. Check your input and try again
3. Contact support at support@tesha.co.zw`,

    BOOKING_CONFIRMATION: (booking) => `
✅ *Booking Confirmed!*
━━━━━━━━━━━━━━━━━━
🆔 Booking ID: ${booking.id}
🏠 Service: ${booking.service.title}
📅 Date: ${new Date(booking.scheduledDate).toLocaleDateString()}
⏰ Time: ${booking.scheduledTime}
💰 Total: $${booking.price}

*What's Next?*
1. Provider will confirm shortly
2. You'll receive booking updates here
3. Payment will be collected after service

Need help? Type "support" to contact us.`
};

// Helper function for status emojis
function getStatusEmoji(status) {
    const statusEmojis = {
        pending: "⏳",
        confirmed: "✅",
        inProgress: "🔄",
        completed: "✨",
        cancelled: "🚫",
        paid: "💰",
        unpaid: "⚠️",
        refunded: "↩️",
        default: "📌"
    };
    return statusEmojis[status.toLowerCase()] || statusEmojis.default;
}

module.exports = CHAT_TEMPLATES;