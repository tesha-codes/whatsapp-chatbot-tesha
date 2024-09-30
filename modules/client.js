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

-*First Name:* e.g., John
-*Last Name:* e.g., Doe
-*Alternative Phone Number:* Include country code (e.g., +263 712345678)
-*National ID Number:* e.g., 63-1234567-Z-63
-*National Address:* e.g., 123 Main Street, Harare
    `,
    GET_FULL_NAME: `
*Request Full Name*

📋 Please enter your full name:
Make sure to provide your first name first and surname second.
Example: John Doe`

  },
  GET_NATIONAL_ID:`
*Request National ID Number*

🆔 Please enter your National ID number:
Example: 63-1234567-Z-63`,
GET_ADDRESS:`
*Request Address*

🏡 Please enter your full residential address:
Example: 123 Main Street, Harare*`

};

module.exports = clientModule;
