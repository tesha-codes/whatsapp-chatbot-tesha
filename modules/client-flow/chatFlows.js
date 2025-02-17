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

    LOCATION_PROMPT: `📍 *Service Location*  
  1. Use saved address: ${userAddress}  
  2. 📎 Send new location  
  3. Type custom address  

  Reply with number or full address`,

    BOOKING_CONFIRMATION: (booking) => `📋 *Booking Summary*  
  Service: ${booking.service}  
  Date: ${booking.date}  
  Location: ${booking.location}  
  Provider: ${booking.provider.name} ⭐${booking.provider.rating}  

  Confirm with ✅ YES or ❌ NO`,

    // Bookings Management
    BOOKING_LIST: (bookings) => {
        if (!bookings.length) return `📭 No upcoming bookings found. Start with 'Book Service'!`;

        return `📅 *Your Bookings*  
    ${bookings.map((b, i) => `
    ${i + 1}. ${b.service}  
    📆 ${b.date} | 🕒 ${b.time}  
    👷 ${b.provider} | ${getStatusEmoji(b.status)} ${b.status}`).join('\n')}`;
    },

    BOOKING_EMPTY: `📭 No bookings found. Start with 'Book Service'!`,

    // Profile Management
    PROFILE_VIEW: (user) => `👤 *Your Profile*  
  Name: ${user.firstName} ${user.lastName}  
  Phone: ${user.phone}  
  Address: ${user.address}  

  To update, type:  
  "Change name to..."  
  "Update address to..."`,

    PROFILE_UPDATE_SUCCESS: (field, value) => `✅ Successfully updated:  
  ${field}: ${value}  

  View profile to see changes`,

    // Account Deletion
    DELETE_CONFIRMATION: `⚠️ *Confirm Account Deletion*  
  This will permanently:  
  1. ❌ Remove all bookings  
  2. ❌ Delete your profile  
  3. ❌ Erase payment info  

  Type "CONFIRM DELETE ${Math.random().toString(36).substr(2, 4).toUpperCase()}" to proceed`,

    // System Messages
    BOOKING_SUCCESS: (bookingId) => `🎉 *Booking Confirmed!*  
  ID: ${bookingId}  
  Our provider will contact you within 15 minutes.  

  View bookings anytime with "My Bookings"`,

    ERROR_GENERIC: `⚠️ Temporary System Issue  
  Please:  
  1. Try again in 2 minutes  
  2. Check your input format  
  3. Contact support if unresolved`,

    ERROR_BOOKING_CONFLICT: `⏰ Time Slot Unavailable  
  Existing booking at this time:  
  ${conflictingBooking.service} with ${conflictingBooking.provider}  

  Please choose another time or cancel existing booking.`,
};

// Shared helper
const getStatusEmoji = (status) => ({
    pending: '🕒',
    confirmed: '✅',
    in_progress: '👷♂️',
    completed: '🎉',
    cancelled: '❌'
}[status.toLowerCase()] || '📌');

module.exports = CLIENT_CHAT_TEMPLATES;