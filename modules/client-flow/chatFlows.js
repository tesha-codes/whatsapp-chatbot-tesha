const CLIENT_CHAT_TEMPLATES = {
  ERROR_MESSAGE:
    "🚫 I'm sorry, but I encountered an error processing your request. Please try again or contact our support team at support@tesha.co.zw or +263 78 2244 051.",

  AVAILABLE_SERVICES: (data) => {
    return `📋 Here are the services currently available on Tesha:

${data}

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

    const details = [
      `📋 Booking Details for ${data.id}:\n`,
      `• Service: ${data.serviceType}`,
      `• Service Description: ${data.serviceDescription}`,
      `• Provider: ${data.providerName} ${
        data.providerPhone ? `(${data.providerPhone})` : ""
      }`,
      `• Date: ${data.date}`,
      `• Time: ${data.time}`,
      `• Location: ${data.location}`,
      `• Status: ${data.status}`,
      `• Description: ${data.description}`,
      data.cancelReason && `• Cancellation Reason: ${data.cancelReason}`,
      data.clientFeedback && `• Client Feedback: ${data.clientFeedback}`,
      data.rating && `• Rating: ${data.rating}`,
    ]
      .filter(Boolean)
      .join("\n");

    const actionPrompt =
      data.status === "Scheduled" || data.status === "Pending"
        ? "\n\nWould you like to reschedule or cancel this booking? Just let me know."
        : data.status === "Completed" && data.rating === "Not rated yet"
        ? "\n\nWould you like to rate this service? You can say 'Rate this booking 4.5 stars'."
        : "\n\nIs there anything else you'd like to know?";

    return details + actionPrompt;
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

You can check the status of your booking anytime by typing 'my bookings'.

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
    if (!data) {
      return "❌ I couldn't retrieve your profile information. Please try again later.";
    }

    return `📋 Your Profile Information:

  📝 Name: ${data.firstName} ${data.lastName}
  📱 Phone: ${data.phone}
  🏠 Address: ${data.address.physicalAddress || "Not set"}
  🪪 National ID: ${data.nationalId || "Not set"}
  ⭐ Account Status: ${data.accountStatus || "Not available"}

  *Need to make changes?*
Simply send a message like:
- "Update firstname to John"
- "Change address to 1 Hacker Way, Harare"
`;
  },
};

module.exports = CLIENT_CHAT_TEMPLATES;
