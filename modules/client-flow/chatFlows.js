
const CLIENT_CHAT_TEMPLATES = {
  ERROR_MESSAGE: "🚫 I'm sorry, but I encountered an error processing your request. Please try again or contact our support team at support@tesha.co.zw or +263 78 2244 051.",

  SERVICE_REQUEST_CREATED: (data) => {
    return `✅ Great! Your service request has been created successfully.

📋 Request Details:
• Request ID: ${data.requestId}
• Service: ${data.serviceType}
• When: ${data.preferredDate} at ${data.preferredTime}
• Where: ${data.location}

I'll search for available service providers and get back to you shortly. Is there anything specific you're looking for in a service provider?`;
  },

  AVAILABLE_SERVICES: (data) => {
    const servicesList = data.services.map(service => `• ${service.name}: ${service.description}`).join('\n');

    return `📋 Here are the services currently available on Tesha:

${servicesList}

Would you like to request any of these services today?`;
  },

  SERVICE_PROVIDERS_LIST: (data) => {
    const providersList = data.providers.map((provider, index) =>
      `${index + 1}. ${provider.name} ⭐ ${provider.rating}/5 (${provider.reviewCount} reviews)
   • Specializes in: ${provider.specialties.join(', ')}
   • Rate: $${provider.hourlyRate}/hour
   • ID: ${provider.id}`
    ).join('\n\n');

    return `📋 I found ${data.providers.length} service providers for ${data.serviceType} in ${data.location}:

${providersList}

Would you like to book an appointment with any of these providers? Just let me know the provider ID and your preferred date and time.`;
  },

  BOOKING_HISTORY: (data) => {
    if (data.bookings.length === 0) {
      return "📋 You don't have any booking history yet. Would you like to book a service now?";
    }

    const bookingsList = data.bookings.map((booking, index) =>
      `${index + 1}. Booking ID: ${booking.id}
   • Service: ${booking.serviceType}
   • Provider: ${booking.providerName}
   • Date: ${booking.date} at ${booking.time}
   • Status: ${booking.status}${booking.status === "Completed" ? ` ⭐ ${booking.rating || "Not rated"}` : ""}`
    ).join('\n\n');

    return `📋 Here's your booking history:

${bookingsList}

Would you like to view details for any specific booking? Just provide the booking ID.`;
  },

  BOOKING_DETAILS: (data) => {
    return `📋 Booking Details for ${data.id}:

• Service: ${data.serviceType}
• Provider: ${data.providerName} (${data.providerPhone})
• Date & Time: ${data.date} at ${data.time}
• Location: ${data.location}
• Status: ${data.status}
• Description: ${data.description}
${data.notes ? `• Notes: ${data.notes}` : ""}
${data.status === "Completed" ? `• Rating: ${data.rating || "Not rated yet"}` : ""}

${data.status === "Scheduled" ? "Would you like to reschedule or cancel this booking?" :
        data.status === "Completed" && !data.rating ? "Would you like to rate this service?" :
          "What would you like to do next?"}`;
  },

  BOOKING_SCHEDULED: (data) => {
    return `✅ Your booking has been scheduled successfully!

📋 Booking Details:
• Booking ID: ${data.bookingId}
• Service: ${data.serviceType}
• Provider: ${data.providerName}
• Date & Time: ${data.date} at ${data.time}
• Location: ${data.location}

The service provider will be notified of your booking. You'll receive a confirmation message shortly.

Is there anything else you'd like to know about your booking?`;
  },

  BOOKING_RESCHEDULED: (data) => {
    return `✅ Your booking has been rescheduled successfully!

📋 Updated Booking Details:
• Booking ID: ${data.bookingId}
• New Date & Time: ${data.newDate} at ${data.newTime}

The service provider will be notified of this change. Is there anything else you need help with?`;
  },

  BOOKING_CANCELLED: (data) => {
    return `✅ Your booking has been cancelled.

• Booking ID: ${data.bookingId}
• Reason: ${data.reason}

Would you like to schedule a new booking or find another service provider?`;
  },

  USER_PROFILE: (data) => {
    return `📋 Your Profile Information:

• Name: ${data.name}
• Phone: ${data.phone}
• Email: ${data.email}
• Address: ${data.address}
• Default Location: ${data.defaultLocation || "Not set"}
• Member since: ${data.memberSince}

Would you like to update any of this information?`;
  }
};

module.exports = CLIENT_CHAT_TEMPLATES;