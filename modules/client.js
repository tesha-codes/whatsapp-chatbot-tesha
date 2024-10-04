const clientModule = {
  messages: {
    WELCOME_MESSAGE: `
🎉*Welcome to Tesha!*

*Tesha* is a WhatsApp-based platform that connects you with service providers like handymen, maids, and more—all through WhatsApp!

*Key Features:* 

🔧 *Service Requests:* Book handymen, maids, and other professionals. 
📅 *Bookings:* Choose based on ratings and hourly rates. 
🔔 *Notifications:* Get booking updates and payment alerts.

Please respond with either(Yes/No): 

👍 *Yes:* to accept the terms and start using Tesha. 
❌ *No:* to cancel the process.

You can also visit our website at tesha.co.zw/legal for full terms.

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

🏠 Household services
🌳 Yard and outdoor maintenance
🛍️ Errands and deliveries
🛠️ Skilled tasks like plumbing and electrical work
🚚 Moving and hauling services
🐾 Pet care
👵 Senior care
🏡 Home maintenance

Are you joining us as a *Client* looking to hire services, or a *Service Provider* looking to offer your skills?

*Please respond with:*

1️⃣ Client
2️⃣ Service Provider
`,

    PROVIDER_HOME:
      "Welcome, Service Provider! 👋 Let’s help you connect with new clients and grow your business. What would you like to do today?",

    CLIENT_HOME:
      "Welcome, valued Client! 👋 We're here to help you find the right services. How can we assist you today?",

    USER_OR_PROVIDER: `
Welcome to Tesha's main menu! Please let us know who you are:
1. Client - Looking for services
2. Service Provider - Offering services`,
    CLIENT_WELCOME_MESSAGE: ` 
*What can we help you with today?*

Please select a category by replying with the corresponding number:
  
  🏠 *Household Services*
  1. Cleaning, Laundry, Home Organization, Handyman tasks, etc.
  
  🌳 *Yard & Outdoor Services*
  2. Lawn care, Gardening, Yard cleanup, Pool maintenance, etc.
  
  🛍 *Errands & Shopping*
  3. Grocery shopping, Dog walking, Household item pickups, etc.
  
  🛠 *Skilled Tasks*
  4. Plumbing, Electrical work, Painting, Carpentry, etc.
  
  🚚 *Moving & Hauling*
  5. Local moving, Junk removal, Donation pickups, etc.
  
  🐾 *Pet Care*
  6. Dog walking, Pet sitting, Pet grooming, etc.
  
  👵 *Senior Care*
  7. Companion care, Personal care, Transportation, etc.
  
  🏡 *Home Maintenance*
  8. HVAC maintenance, Pest control, Appliance repair, etc.

  Type the number of the category you're interested in, and I'll show you the available services! 😊`,

    GET_USER_INFORMATION: `
📃*Personal Information*

To proceed, we'll need a few details from you. Please provide the following information.

-*Full Name:* e.g., John Doe 
-*National ID Number:* e.g., 63-1234567-Z-63
-*National Address:* e.g., 123 Main Street, Harare
    `,

    GET_FULL_NAME: `
*📋 Please enter your full name*
Make sure to provide your first name first and surname second.
Example: John Doe`,

    GET_NATIONAL_ID: `
*🆔 Please enter your National ID number*
Example: 63-1234567-Z-63`,
    GET_ADDRESS: `

*🏡 Please enter your full residential address*
Example: 123 Main Street, Harare`,

    GET_LOCATION:
      "📍 Please send your current location. You can use the 'Share Location' feature in your messaging app.",
    GET_CITY: "🏙️ Please enter the name of your city or town.",
    CHOOSE_CATEGORY:
      "🗂️ Please choose a business category from the following options:",
    CHOOSE_SERVICE:
      "🛠️ Based on your category, please choose a specific service:",
    GET_DESCRIPTION:
      "📝 Please provide a brief description of your services (maximum 200 characters).",
    CHOOSE_SUBSCRIPTION:
      "🎉 Good news! You're eligible for a free 3-month subscription. Choose your plan:\n1. Basic\n2. Standard\n3. Premium\nReply with the number of your choice.",
    UPLOAD_ID_IMAGE:
      "📸 Please upload a clear image of your National ID. This will be used for verification purposes.",
    PROFILE_COMPLETE:
      "✅ Congratulations! Your profile is now complete. Your account will be active for 3 months and you'll start receiving tasks once verified. Thank you for joining our platform! 🎊",
    UNAVAILABLE_SERVICE_PROVIDER:`
    Thank you for your request! Unfortunately, the service provider for [requested service] is currently unavailable. We apologize for the inconvenience and are working to find a suitable provider for you. We’ll notify you as soon as we have an update.

    Thank you for your patience!"`
  },
};

module.exports = clientModule;
