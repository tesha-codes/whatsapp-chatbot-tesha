const CLIENT_CHAT_TEMPLATES = {
  ERROR_MESSAGE:
    "🚫 I'm sorry, but I encountered an error processing your request. Please try again or contact our support team at support@tesha.co.zw or +263 78 2244 051.",

  AVAILABLE_SERVICES: (data) => {
    if (!data || !data.services || data.services.length === 0) {
      return "📋 I'm sorry, but I couldn't retrieve any services at the moment. Would you like to tell me what kind of service you're looking for and I can check if it's available?";
    }

    const servicesList = data.services
      .map((service) => `• ${service.name}: ${service.description}`)
      .join("\n");

    return `📋 Here are the services currently available on Tesha:

${servicesList}

Would you like to request any of these services today? Simply tell me which service you need, your location, and your preferred date and time. 😊`;
  },

  SERVICE_PROVIDERS_LIST: (data) => {
    if (!data || !data.providers || data.providers.length === 0) {
      return "⚠️ I couldn't find any service providers matching your criteria at the moment. Would you like to try a different service type or location?";
    }

    const providersList = data.providers
      .map(
        (provider, index) =>
          `${index + 1}. ${provider.name} ⭐ ${provider.rating.toFixed(1)}/5 (${
            provider.reviewCount
          } reviews)
   • Specializes in: ${
     Array.isArray(provider.specialties)
       ? provider.specialties.join(", ")
       : provider.specialties || "Various services"
   }
   • Rate: $${provider.rate}/hour`
      )
      .join("\n\n");

    return `📋 I found ${data.providers.length} service providers for ${
      data.serviceType
    } in ${data.location || "your area"}:

${providersList}

🔍 To book a service, please reply with the number of the provider you'd like to select (e.g., "1" for the first provider).`;
  },

  BOOKING_HISTORY: (data) => {
    if (!data || !data.bookings || data.bookings.length === 0) {
      return "📋 You don't have any booking history yet. Would you like to book a service now?";
    }

    const bookingsList = data.bookings
      .map(
        (booking, index) =>
          `${index + 1}. Booking ID: ${booking.id}
   • Service: ${booking.serviceType || "Not specified"}
   • Provider: ${booking.providerName || "Not assigned"}
   • Date: ${booking.date || "Not specified"} ${
            booking.time ? `at ${booking.time}` : ""
          }
   • Status: ${booking.status || "Pending"}${
            booking.rating ? ` ⭐ ${booking.rating}` : ""
          }`
      )
      .join("\n\n");

    return `📋 Here's your booking history:

${bookingsList}

Would you like to view details for any specific booking? Just type the booking ID (e.g., "${data.bookings[0].id}").`;
  },

  BOOKING_DETAILS: (data) => {
    if (!data || !data.id) {
      return "❌ I couldn't find details for this booking. Please check the booking ID and try again.";
    }

    return `📋 Booking Details for ${data.id}:

- Service: ${data.serviceType || "Not specified"}
- Provider: ${data.providerName || "Not assigned"} ${
      data.providerPhone ? `(${data.providerPhone})` : ""
    }
- Date & Time: ${data.date || "Not specified"} ${
      data.time ? `at ${data.time}` : ""
    }
- Location: ${data.location || "Not specified"}
- Status: ${data.status || "Pending"}
- Description: ${data.description || "No description provided"}
${data.notes ? `• Notes: ${data.notes}` : ""}
${data.rating ? `• Rating: ${data.rating}` : ""}

${
  data.status === "Scheduled" || data.status === "Pending"
    ? "Would you like to reschedule or cancel this booking? Just let me know."
    : data.status === "Completed" && !data.rating
    ? "Would you like to rate this service? You can say 'Rate this booking 4.5 stars'."
    : "Is there anything else you'd like to know?"
}`;
  },

  BOOKING_SCHEDULED: (data) => {
    if (!data || (!data.bookingId && !data.requestId)) {
      return "❌ There was an error scheduling your booking. Please try again.";
    }

    return `✅ Your booking has been scheduled successfully!

📋 Booking Details:
- Booking ID: ${data.bookingId || data.requestId}
- Service: ${data.serviceType || "Not specified"}
- Provider: ${data.providerName || "Not assigned yet"}
- Date & Time: ${data.date || "Not specified"} ${
      data.time ? `at ${data.time}` : ""
    }
- Location: ${data.location || "Not specified"}
${data.description ? `• Description: ${data.description}` : ""}

The service provider will be notified of your booking. You'll receive a confirmation message shortly.

Is there anything else you need help with today? 😊`;
  },

  BOOKING_RESCHEDULED: (data) => {
    if (!data || !data.bookingId) {
      return "❌ There was an error rescheduling your booking. Please try again.";
    }

    return `✅ Your booking has been rescheduled successfully!

📋 Updated Booking Details:
- Booking ID: ${data.bookingId}
- New Date & Time: ${data.newDate || "Not specified"} ${
      data.newTime ? `at ${data.newTime}` : ""
    }

The service provider will be notified of this change. Is there anything else you need help with?`;
  },

  BOOKING_CANCELLED: (data) => {
    if (!data || !data.bookingId) {
      return "❌ There was an error cancelling your booking. Please try again.";
    }

    return `✅ Your booking has been cancelled.

- Booking ID: ${data.bookingId}
- Reason: ${data.reason || "No reason provided"}

Would you like to schedule a new booking or find another service provider?`;
  },

  USER_PROFILE: (data) => {
    if (!data || !data.name) {
      return "❌ I couldn't retrieve your profile information. Please try again later.";
    }

    return `📋 Your Profile Information:

- Name: ${data.name || "Not set"}
- Phone: ${data.phone || "Not set"}
${data.email ? `• Email: ${data.email}` : ""}
- Address: ${data.address || "Not set"}
${data.defaultLocation ? `• Default Location: ${data.defaultLocation}` : ""}
- Member since: ${data.memberSince || "Not available"}

Would you like to update any of this information? Just let me know which field you'd like to change.`;
  },

  SERVICE_REQUEST_CREATED: (data) => {
    if (!data || !data.requestId) {
      return "❌ There was an error creating your service request. Please try again.";
    }

    // If there's a provider name, then this was a direct booking
    if (data.providerName) {
      return `✅ Great! Your service request has been created successfully.

📋 Request Details:
- Request ID: ${data.requestId}
- Service: ${data.serviceType || "Not specified"}
- When: ${data.date || "Not specified"} ${data.time ? `at ${data.time}` : ""}
- Where: ${data.location || "Not specified"}
${data.description ? `• Description: ${data.description}` : ""}

Your selected provider ${
        data.providerName
      } has been notified and will confirm shortly.
I'll update you on the status of your request. Is there anything else you need help with?`;
    }

    // If no provider name, then this was just a service request
    return `✅ I've created your service request!

📋 Request Details:
- Request ID: ${data.requestId}
- Service: ${data.serviceType || "Not specified"}
- When: ${data.date || "Not specified"} ${data.time ? `at ${data.time}` : ""}
- Where: ${data.location || "Not specified"}
${data.description ? `• Description: ${data.description}` : ""}

Would you like to see available service providers for this request?`;
  },
};

module.exports = CLIENT_CHAT_TEMPLATES;