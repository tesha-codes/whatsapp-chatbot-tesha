const clientModule = {
  messages: {
    WELCOME_TERMS: `
Hello there, you've reached TeshaBot.s
You have to accept the terms and conditions before
proceeding to the next step.

*Reply with:*
1. *Yes* - to accept terms and conditions. *Visit* https://tesha.co.zw/legal to view terms and conditions.
2. *No* - to cancel the whole process.`,
    DECLINE_TERMS:
      "You have declined the *terms* and *conditons*. If you change your mind feel free to contact us again. Thank you!",
    ACCEPTED_TERMS:
      "Great! You've accepted the terms and conditions. Let's start the registration process. We will send you the registration form soon. Thank you!🙂",
    PROVIDER_HOME: "Welcome home service providers....",
    CLIENT_HOME: "Welcome home client....",
    USER_OR_PROVIDER: `
Welcome to the main menu. Are you?
1. User
2. Service Provider`,
  },
};

module.exports = clientModule;
