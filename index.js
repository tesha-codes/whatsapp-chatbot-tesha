require("dotenv").config();
const express = require("express");
const { sendTextMessage } = require("./services/whatsappService");
const bodyParser = require("body-parser");
const { StatusCodes } = require("http-status-codes");
const morgan = require("morgan");
const connectDb = require("./database/connect.database");
const { getSession, setSession } = require("./utils/redis");
const {
  createUser,
  updateUser,
  getUser,
} = require("./controllers/user.controllers");
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

app.post("/bot", async (req, res) => {
  const userResponse = req.body.payload;
  console.log("User response: ", userResponse);

  if (userResponse && userResponse.source) {
    const phone = userResponse.sender.phone;
    const message = userResponse.payload?.text || "";
    const username = userResponse.sender.name;
    // const SESSION_TEMPLATE = {
    //   phone,
    //   accountType,
    //   step,
    //   message,
    //   lActivity: Date.now(),
    // };

    const session = await getSession(phone);
    console.log("session: ", session);

    const user = await getUser(phone);
    const lActivity = Date.now();

    if (!user) {
      // : new user
      await createUser({ phone, username });

      await sendTextMessage(phone, messages.WELCOME_MESSAGE);
      await sendTextMessage(phone, messages.WELCOME_TERMS);
      await setSession(phone, {
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
            await setSession(phone, {
              accountType: "Client",
              step: "ACCEPTED_TERMS",
              message,
              lActivity,
            });
            await sendTextMessage(phone, messages.CLIENT_HOME);
            return res.status(StatusCodes.ACCEPTED).json({});
          }
          // provider.accountType
          if (user.accountType === "ServiceProvider") {
            await setSession(phone, {
              accountType: "ServiceProvider",
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
          await setSession(phone, {
            step: "ACCEPT_TERMS",
            message,
            lActivity,
          });
          return res.status(StatusCodes.ACCEPTED).json({});
        }
      }

      if (session?.accountType) {
        // : are already user or service provider
        // : check they user or service provider
        console.log('The sessions here: ', session);
        if (session.accountType === "Client") {
          // : user
          //  request service
          // list services
          // : acknlowledge request
          await sendTextMessage(phone, 'Ukuda kubatsira nei ? ')
          console.log('Client session: ', session);
        } else {
          // : service provider
          // : register service
          // : continue ...
          await sendTextMessage(phone, 'Mukuda basa here mudhara?')
          console.log('Client session: ', session);
        }
      } else {
        // 1 .
        // : accept terms and conditions
        if (session.step === "ACCEPT_TERMS") {
          if (message.toLowerCase() === "yes") {
            await sendTextMessage(phone, messages.ACCEPTED_TERMS);
            await updateUser({ phone, termsAndConditionsAccepted: true });
            await setSession(phone, {
              step: "ACCEPTED_TERMS",
              message,
              lActivity,
            });
            return res.status(StatusCodes.ACCEPTED).json({});
          } else if (message.toLowerCase() === "no") {
            await sendTextMessage(phone, messages.DECLINE_TERMS);
            await setSession(phone, {
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
          await setSession(phone, {
            step: "USER_OR_PROVIDER",
            message,
            lActivity,
          });
          return res.status(StatusCodes.ACCEPTED).json({});
        } else if (session.step === "USER_OR_PROVIDER") {
          if (message.toLowerCase() === "1") {
            await sendTextMessage(phone, messages.CLIENT_HOME);
            await updateUser({ phone, accountType: "Client" });
            await setSession(phone, {
              accountType: "Client",
              step: "CLIENT_HOME",
              message,
              lActivity,
            });
            return res.status(StatusCodes.ACCEPTED).json({});
          } else if (message.toLowerCase() === "2") {
            await sendTextMessage(phone, messages.PROVIDER_HOME);
            await updateUser({ phone, accountType: "ServiceProvider" });
            await setSession(phone, {
              accountType: "ServiceProvider",
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
      }
    }
  }
  // acknowledge callback requests, do not remove:);
  return res.status(StatusCodes.ACCEPTED).send("Callback received:)");
});

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
