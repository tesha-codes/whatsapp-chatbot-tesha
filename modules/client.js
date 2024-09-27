const clientModule = {
  messages: {
    WELCOME_MESSAGE: `
*Introducing Tesha!* 🎉

Tesha is a convenient WhatsApp-based platform designed to seamlessly connect clients with service providers. Whether you need to book a handyman, maid, or any other professional, Tesha simplifies the process for you. Our services are fully accessible through WhatsApp, allowing you to interact with the platform by sending commands, making bookings, and managing your requests.

Key features of Tesha:
• *WhatsApp Bot Service:* Handles user requests, connects clients and service providers, and ensures smooth communication.
• *Booking Service:* Allows you to book available service providers based on their ratings and hourly rates.
• *Notifications:* Keeps you informed with booking updates, payment notifications, and service change alerts.

    `,
    WELCOME_TERMS: `
We're excited to have you here! Before handling your requests, please review and accept our terms and conditions.

To continue, please reply with:

*Yes*, to accept our terms and conditions and start interacting with the platform.
*No*, to decline and cancel the process.

You can also visit our website at *tesha.co.zw/legal* to read the terms and conditions.
`,

    DECLINE_TERMS:
      "You've declined the *Terms and Conditions*. If you change your mind, feel free to reach out to us anytime. Thank you for considering Tesha! 😊",

    ACCEPTED_TERMS: `
*Fantastic!* 🎉

You've accepted the terms and conditions, and you're all set to explore Tesha’s services.

At Tesha, we connect you with trusted professionals for a wide range of services, including:

*Household* help like cleaning and handyman tasks
*Yard and outdoor* maintenance
*Errands, shopping, and deliveries*
*Skilled tasks like plumbing, electrical work, and more.*
We’ve got you covered for all your daily needs and more! 🚀

For a full list of our services, feel free to visit tesha.co.zw/services.
`,

    PROVIDER_HOME:
      "Welcome, Service Provider! 👋 Let’s help you connect with new clients and grow your business. What would you like to do today?",

    CLIENT_HOME:
      "Welcome, valued Client! 👋 We're here to help you find the right services. How can we assist you today?",

    USER_OR_PROVIDER: `
Welcome to Tesha's main menu! Please let us know who you are:
1. Client - Looking for services
2. Service Provider - Offering services`,
  },
};

module.exports = clientModule;
