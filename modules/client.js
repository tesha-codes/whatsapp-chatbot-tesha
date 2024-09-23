const clientModule = {
  messages: {
    WELCOME_TERMS: `
Hello and welcome to TeshaBot! 🎉
Before we proceed, please review and accept our terms and conditions to continue.

*Reply with:*
*Yes* - to accept the terms and conditions. You can also *Visit* https://tesha.co.zw/legal to view the full terms.
*No* - if you wish to decline and cancel the process.`,

    DECLINE_TERMS:
      "You've declined the *Terms and Conditions*. If you change your mind, feel free to reach out to us anytime. Thank you for considering Tesha! 😊",

    ACCEPTED_TERMS:
      "Awesome! 🎉 You've accepted the terms and conditions. We're excited to get started! We'll send over the registration form shortly. Thanks for joining Tesha! 🙂",

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
