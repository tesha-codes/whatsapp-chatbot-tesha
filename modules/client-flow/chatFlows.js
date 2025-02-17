const CLIENT_CHAT_TEMPLATES = {
    // Main Menu
    MAIN_MENU: `🏠 *Welcome to Your Dashboard*  
  What would you like to do?  
  1. 🛎️ Book New Service  
  2. 📅 View Bookings  
  3. 👤 Edit Profile  
  4. 🗑️ Delete Account  
  5. ℹ️ Help Center  

  Reply with the number or option name`,

    // Booking Flow
    SERVICE_TYPE_PROMPT: `🔧 *Choose Your Service Type*  
  1. 🧹 Domestic Cleaning  
  2. 🔨 Handyman Services  
  3. 👶 Childcare  
  4. 🪑 Furniture Assembly  
  5. 🚚 Moving Help  

  Reply with number or service name`,

    SERVICE_DETAILS_PROMPT: `📝 *Describe Your Needs*  
  Please include:  
  • Specific requirements  
  • Preferred date/time  
  • Duration needed  

  Example: "Full house cleaning every Tuesday 2-4 PM, 3 bedrooms"`,

    LOCATION_PROMPT: (user) => `📍 *Service Location*  
  1. Use saved address: ${user?.address?.physicalAddress || 'Not set'}  
  2. 📎 Send new location  
  3. Type custom address  

  Reply with number or full address`,

    BOOKING_CONFIRMATION: (booking) => `📋 *Booking Summary*  
  Service: ${booking.service}  
  Date: ${booking.date}  
  Location: ${booking.location}  
  Provider: ${booking.provider?.name || 'To be assigned'}  

  Confirm with ✅ YES or ❌ NO`,

    // Bookings Management
    BOOKING_LIST: (bookings) => {
        if (!bookings?.length) return `📭 No upcoming bookings found. Start with 'Book Service'!`;

        return `📅 *Your Bookings*\n` +
            bookings.map((b, i) => `
      ${i + 1}. ${b.service}  
      📆 ${b.date} | 🕒 ${b.time}  
      👷 ${b.provider?.name || 'Pending assignment'}`).join('\n');
    },

    // Profile Management
    PROFILE_VIEW: (user) => `👤 *Your Profile*  
  Name: ${user.firstName} ${user.lastName}  
  Phone: ${user.phone}  
  Address: ${user.address?.physicalAddress || 'Not set'}  

  To update, type:  
  "Change name to..."  
  "Update address to..."`,

    PROFILE_UPDATE_SUCCESS: (field, value) => `✅ Successfully updated:  
  ${field}: ${value}`,

    // Account Deletion
    DELETE_CONFIRMATION: `⚠️ *Confirm Account Deletion*  
  Type "CONFIRM DELETE" to permanently remove your account`,

    // System Messages
    BOOKING_SUCCESS: (bookingId) => `🎉 *Booking Confirmed!*  
  ID: ${bookingId}  
  Our provider will contact you shortly.`,

    ERROR_GENERIC: `⚠️ Temporary System Issue  
  Please try again in a few minutes.`,

    getStatusEmoji: (status) => ({
        pending: '🕒',
        confirmed: '✅',
        in_progress: '👷♂️',
        completed: '🎉',
        cancelled: '❌'
    }[status.toLowerCase()] || '📌')
};

module.exports = CLIENT_CHAT_TEMPLATES;