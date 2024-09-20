require("dotenv").config();
const express = require("express");
const { sendTextMessage } = require("./services/whatsappService");
const bodyParser = require("body-parser");
const { StatusCodes } = require("http-status-codes");
const morgan = require("morgan");
const connectDb = require("./database/Connect.database");
const User = require("./models/user.model");
const { getSession, setSession, deleteSession } = require("./utils/redis");
const { createUser, getUser } = require("./controllers/user.controllers");
const { messages } = require("./modules/client");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", async (request, response) => {
  response
    .status(StatusCodes.OK)
    .json({ message: "Never stray from the way." });
});

let sessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; //30

const steps = {
  TERMS_AND_CONDITIONS: "TERMS_AND_CONDITIONS",
  NEW_USER: "NEW_USER",
  REGISTRATION: "REGISTRATION",
  TERMINATE_SESSION: "TERMINATE_SESSION",
  MAIN_MENU: "MAIN_MENU",
};

function setSessionByMapByMap(phone, data) {
  sessions.set(phone, { ...data, lActivity: Date.now() });
  setTimeout(() => {
    if (sessions.has(phone)) {
      let curSession = sessions.get(phone);
      if (Date.now() - curSession >= SESSION_TIMEOUT) {
        sessions.delete(phone);
      }
    }
  }, SESSION_TIMEOUT);
}

function updateSession(phone, data) {
  const curSession = sessions.get(phone);
  sessions.set(phone, { ...curSession, ...data });
}

app.post("/bot", async (req, res) => {
  const userResponse = req.body.payload;
  console.log("User response: ", userResponse);

  if (userResponse && userResponse.source) {
    const phone = userResponse.sender.phone;
    const message = userResponse.payload?.text || "";
    const username = userResponse.sender.name;

    // const SESSION_TEMPLATE = {
    //   phone,
    //   role,
    //   step,
    //   message,
    //   lActivity: Date.now(),
    // };

    const session = getSession(phone);
    const user = await getUser(phone);
    const lActivity = Date.now();

    if (!user) {
      // : new user
      await createUser(userResponse.source);
      await sendTextMessage(phone, messages.WELCOME_TERMS);
      setSession(phone, {
        step: "ACCEPT_TERMS",
        message,
        lActivity,
      });
      return res.status(StatusCodes.ACCEPTED).json({});
    } else {
      // check session
      if (!session) {
        if (user.termsAndConditionsAccepted && user.accountType) {
          // client.accountType
          if (user.accountType === "Client") {
            setSession(phone, {
              role: "Client",
              step: "ACCEPTED_TERMS",
              message,
              lActivity,
            });
            await sendTextMessage(phone, messages.CLIENT_HOME);
            return res.status(StatusCodes.ACCEPTED).json({});
          }
          // provider.accountType
          if (user.accountType === "ServiceProvider") {
            setSession(phone, {
              role: "ServiceProvider",
              step: "ACCEPTED_TERMS",
              message,
              lActivity,
            });
            await sendTextMessage(phone, messages.PROVIDER_HOME);
            return res.status(StatusCodes.ACCEPTED).json({});
          }
        } else {
          // no session and no terms were accepted
          await sendTextMessage(phone, messages.WELCOME_TERMS);
          setSession(phone, {
            step: "ACCEPT_TERMS",
            message,
            lActivity,
          });
          return res.status(StatusCodes.ACCEPTED).json({});
        }
      }

      if (session?.role) {
        // : are already user or service provider
        // : check they user or service provider
        if (session.role === "user") {
          // : user
          //  request service
          // list services
          // : acknlowledge request
        } else {
          // : service provider
          // : register service
          // : continue ...
        }
      } else {
        // 1 .
        // : accept terms and conditions
        if (session.step === "ACCEPT_TERMS") {
          if (message.toLowerCase() === "yes") {
            await sendTextMessage(phone, messages.ACCEPTED_TERMS);
            setSession(phone, {
              step: "ACCEPTED_TERMS",
              message,
              lActivity,
            });
            return res.status(StatusCodes.ACCEPTED).json({});
          } else if (message.toLowerCase() === "no") {
            await sendTextMessage(phone, messages.DECLINE_TERMS);
            setSession(phone, {
              step: "ACCEPT_TERMS",
              message,
              lActivity,
            });
            return res.status(StatusCodes.ACCEPTED).json({});
          } else {
            const invalidMessage = `You have provided an invalid response. Please type 'Yes' or 'No'to proceed.`;
            await sendTextMessage(phone, invalidMessage);
            return res.status(StatusCodes.ACCEPTED).json({});
          }
        } else if (session.step === "ACCEPTED_TERMS") {
          await sendTextMessage(phone, messages.USER_OR_PROVIDER);
          setSession(phone, {
            step: "USER_OR_PROVIDER",
            message,
            lActivity,
          });
          return res.status(StatusCodes.ACCEPTED).json({});
        } else if (session.step === "USER_OR_PROVIDER") {
          if (message.toLowerCase() === "1") {
            await sendTextMessage(phone, messages.CLIENT_HOME);
            setSession(phone, {
              role: "Client",
              step: "CLIENT_HOME",
              message,
              lActivity,
            });
            return res.status(StatusCodes.ACCEPTED).json({});
          } else if (message.toLowerCase() === "2") {
            await sendTextMessage(phone, messages.PROVIDER_HOME);
            setSession(phone, {
              role: "ServiceProvider",
              step: "PROVIDER_HOME",
              message,
              lActivity,
            });
            return res.status(StatusCodes.ACCEPTED).json({});
          } else {
            const invalidMessage = `You have provided an invalid response. Please type '1' or '2' to proceed.`;
            await sendTextMessage(phone, invalidMessage);
            return res.status(StatusCodes.ACCEPTED).json({});
          }
        }
        // / : update user
        // : update session
        // : send welcome message for terms acceptance, prompt if they user or service provider or decline
        // : acknlowledge request
        // 2 . they choose a role and  continue
      }
    }
    r;
  }
  // acknowledge callback requests, do not remove:)
  return res.status(StatusCodes.ACCEPTED).send("Callback received:)");
});

// async function sendMessage(phone) {
//   const botMessage = ;
//   await sendTextMessage(phone, botMessage);
// }

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
