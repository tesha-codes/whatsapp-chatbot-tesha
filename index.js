require("dotenv").config();
const express = require("express");
const {
  getTemplatesList,
  markBulkOptIn,
  markUserOptIn,
  sendMediaImageMessage,
  sendMediaVideoMessage,
  sendTextMessage,
  sendTemplateMessage,
} = require("./services/whatsappService");
const bodyParser = require("body-parser");
const { StatusCodes } = require("http-status-codes");
const morgan = require("morgan");
const connectDb = require("./database/Connect.database");
const User = require('./Models/User.model');
const { default: mongoose } = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.get("/😂😂😂", async (request, response) => {
  response
    .status(StatusCodes.OK)
    .json({ message: "Successfully laughed, its working..." });
});

// app.use("/api/version-01/auth", UserRoutes)
// app.use(renderNotFound);
// app.use(errorWrapperMiddleware)

// app.post("/bot", async (req, res) => {
//   const userResponse = req.body.payload;
//   //
//   console.log(userResponse);

//   if (userResponse && userResponse.source) {
//     // extract user whatsapp message/query from data object
//     const phoneNumber = userResponse.sender.phone;
//     const username = userResponse.sender.name;
//     const country = userResponse.sender.country_code;
//     // const message = userResponse.payload?.text || "";
//     const originalChatId = userResponse.id;
//     // Additional code to handle user interactions and store data in the database
//     //...

//     const message = `
// Hello there, you've reached TeshaBot.
// You have to accept the terms and conditions before
// proceeding to the next step.

// Type
// 1. Yes - to accept terms and conditions. Visit https://tesha.co.zw/legal to view terms and conditions.
// 2. No - to cancel the whole process.
//   `;
//     const botResponse = "You said: " + message;
//     await sendTextMessage(phoneNumber, botResponse);
//     return res.status(200).json({
//       type: "text",
//       text: botResponse,
//     });
//   }
//   // acknowledge callback requests, do not remove:)
//   return res.status(StatusCodes.ACCEPTED).send("Callback received:)");
// });

let sessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000;//30

const steps = {
  TERMS_AND_CONDITIONS: 'TERMS_AND_CONDITIONS',
  NEW_USER: 'NEW_USER',
  REGISTRATION: 'REGISTRATION',
  TERMINATE_SESSION: 'TERMINATE_SESSION',
  MAIN_MENU: 'MAIN_MENU'
}

function getSession(phone) {
  return sessions.get(phone)
}

function setSession(phone, data) {
  sessions.set(phone, { ...data, lActivity: Date.now() })
  setTimeout(() => {
    if (sessions.has(phone)) {
      let curSession = sessions.get(phone);
      if (Date.now() - curSession >= SESSION_TIMEOUT) {
        sessions.delete(phone)
      }
    }
  }, SESSION_TIMEOUT);
}

function updateSession(phone, data) {
  const curSession = sessions.get(phone);
  sessions.set(phone, { ...curSession, ...data })
}

app.post("/bot", async (req, res) => {

  const userResponse = req.body.payload;
  console.log('User response: ', userResponse);

  if (userResponse && userResponse.source) {
    const phone = userResponse.sender.phone;
    const message = userResponse.payload?.text || "";
    const username = userResponse.sender.name;

    let session = sessions.get(phone);
    if (!session) {
      const user = await User.findOne({ phone },
        {
          createdAt: 1,
          phone: 1,
          termsAndConditionsAccepted: 1
        });

      if (user) {
        if (!user.termsAndConditionsAccepted) {
          session = { user, state: steps.TERMS_AND_CONDITIONS }
          setSession(phone, session)
          await sendMessage(phone)
        }
        else {
          session = { user, state: steps.MAIN_MENU }
          setSession(phone, session);
          await saySomething()
        }
      } else {
        session = { state: steps.NEW_USER }
        setSession(phone, session)
        const newUser = new User({
          _id: new mongoose.Types.ObjectId(),
          phone,
          username
        });
        await newUser.save();
        await sendMessage(phone)
        updateSession(phone, { state: steps.TERMS_AND_CONDITIONS })
      }
    }


    switch (session.state) {
      case steps.TERMS_AND_CONDITIONS:
        await acceptTermsAndConditons(phone, message);
        // updateSession(phone, { state: steps.REGISTRATION });
        break;

      case steps.REGISTRATION:
        await saySomething()
        // updateSession(phone, { state: steps.TERMINATE_SESSION });
        break;

      case steps.MAIN_MENU:
        await sendMainMenu(phone)
        break;
      default:
        console.log('Soon to be determined state');
        break;

    }
    return res.status(StatusCodes.OK).send('Proceed')
  }
})


async function sendMessage(phone) {
  const botMessage = `
Hello there, you've reached TeshaBot.
You have to accept the terms and conditions before
proceeding to the next step.

*Reply with:*
1. *Yes* - to accept terms and conditions. *Visit* https://tesha.co.zw/legal to view terms and conditions.
2. *No* - to cancel the whole process.`
  await sendTextMessage(phone, botMessage);
}

async function acceptTermsAndConditons(phone, message) {
  if (message.toLowerCase() === 'yes') {
    await User.findOneAndUpdate({ phone }, { termsAndConditionsAccepted: true }, { new: true });
    updateSession(phone, { state: steps.REGISTRATION })
    await saySomething(phone)
  }
  else if (message.toLowerCase() === 'no') {
    updateSession(phone, { state: steps.TERMINATE_SESSION })
    let declineMessage = `You have declined the *terms* and *conditons*. If you change your mind feel free to contact us again. Thank you!`
    await sendTextMessage(phone, declineMessage)
  }
  else {
    let invalidMessage = `You have provided an invalid response. Please type 'Yes' or 'No'to proceed.`
    await sendTextMessage(phone, invalidMessage)
  }
}

async function saySomething(phone) {
  const message = `
Great! You've accepted the terms and conditions. Let's start the registration process. We will send you the registration form soon. Thank you!🙂
  `;
  await sendTextMessage(phone, message);
}

async function sendMainMenu(phone) {
  const message = `
Welcome to the main menu. What would you like to do?
1. Option 1
2. Option 2
3. Option 3`;
  await sendTextMessage(phone, message);
}


app.listen(PORT, function () {
  console.log(`Warming up the server 🔥🔥...`);
  connectDb(process.env.MONGO_URL)
    .then((response) => {
      console.log(`Successfully connected to ${response.db.databaseName} ✅✅`);
      console.log(`Server now running on port ${PORT} 👍👌😁😁`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});
