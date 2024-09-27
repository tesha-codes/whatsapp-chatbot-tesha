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
const serviceRouter = require('./routes/service.routes');
const Category = require("./models/category.model");
const Service = require("./models/services.model");

const app = express();
const PORT = process.env.PORT || 3000;

const steps = {
  ACCEPTED_TERMS: 'ACCEPTED_TERMS',
  ACCEPT_TERMS:'ACCEPT_TERMS',
  CLIENT_WELCOME_MESSAGE:'CLIENT_WELCOME_MESSAGE',
  CLIENT_MENU_SERVICE_CATEGORIES:'CLIENT_MENU_SERVICE_CATEGORIES',
  USER_OR_PROVIDER:'USER_OR_PROVIDER',
  CLIENT_HOME:'CLIENT_HOME',
  PROVIDER_HOME:'PROVIDER_HOME'
}


app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", async (request, response) => {
  response
    .status(StatusCodes.OK)
    .json({ message: "Never stray from the way." });
});

app.use('/services', serviceRouter)
app.post('/add/categories', async (request, response) => {
  try {
    const { data: categories } = request.body;
    const result = await Category.insertMany(categories)
    response.status(StatusCodes.CREATED).json(result)
  } catch (error) {
    response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
  }
})

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

      await setSession(phone, {
        step: steps.ACCEPT_TERMS,
        message,
        lActivity,
      });
      await sendTextMessage(phone, messages.WELCOME_MESSAGE);
      return res.status(StatusCodes.OK).send(messages.WELCOME_TERMS)
    } else {
      // check session
      if (!session) {
        if (user.termsAndConditionsAccepted && user.accountType) {
          // client.accountType
          if (user.accountType === "Client") {
            await setSession(phone, {
              accountType: "Client",
              step: steps.ACCEPTED_TERMS,
              message,
              lActivity,
            });
     
            return res.status(StatusCodes.OK).send( messages.CLIENT_HOME)
          }
          // provider.accountType
          if (user.accountType === "ServiceProvider") {
            await setSession(phone, {
              accountType: "ServiceProvider",
              step: steps.ACCEPTED_TERMS,
              message,
              lActivity,
            });

            return res.status(StatusCodes.OK).send( messages.PROVIDER_HOME)
          }
        } else {
          // no session and no terms were accepted

          await setSession(phone, {
            step: steps.ACCEPTED_TERMS,
            message,
            lActivity,
          });
          return res.status(StatusCodes.OK).send( messages.WELCOME_TERMS)
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
          if (session.step === steps.CLIENT_WELCOME_MESSAGE) {
    
            await setSession(phone, {
              step: steps.CLIENT_MENU_SERVICE_CATEGORIES,
              message,
              lActivity,
            });
            return res.status(StatusCodes.OK).send(messages.CLIENT_WELCOME_MESSAGE)
          } else if (session.step === steps.CLIENT_MENU_SERVICE_CATEGORIES) {
            const category = await Category.findOne(
              { code: +message.toLowerCase() },
              { _id: 1, name: 1 }
            );
            const services = await Service.find({ category: category._id });
            let responseMessage = `
            *${category.name}*
            which of the following services do you wish to hire service for?
            ${services.map((s, index) => ` *${index + 1} ${s.title}* - ${s.description}`).join('\n')}
            `
            return res.status(StatusCodes.OK).send(responseMessage)
          }
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
        if (session.step === steps.ACCEPT_TERMS) {
          if (message.toLowerCase() === "yes") {
            await updateUser({ phone, termsAndConditionsAccepted: true });
            await setSession(phone, {
              step: steps.ACCEPTED_TERMS,
              message,
              lActivity,
            });
            return res.status(StatusCodes.OK).send(messages.ACCEPTED_TERMS)
          } else if (message.toLowerCase() === "no") {
            await setSession(phone, {
              step: steps.ACCEPTED_TERMS,
              message,
              lActivity,
            });
            return res.status(StatusCodes.OK).send(message.DECLINE_TERMS)
          } else {
            const invalidMessage = `You have provided an invalid response. Please type 'Yes' or 'No'to proceed.`;
            return res.status(StatusCodes.OK).send(invalidMessage)
          }

        } else if (session.step === steps.ACCEPTED_TERMS) {
          await setSession(phone, {
            step: steps.USER_OR_PROVIDER,
            message,
            lActivity,
          });
          return res.status(StatusCodes.OK).send(messages.USER_OR_PROVIDER)

        } else if (session.step === steps.USER_OR_PROVIDER) {
          if (message.toLowerCase() === "1") {

            await updateUser({ phone, accountType: "Client" });
            await setSession(phone, {
              accountType: "Client",
              step: steps.CLIENT_HOME,
              message,
              lActivity,
            });
            return res.status(StatusCodes.OK).send(messages.CLIENT_HOME)
          } else if (message.toLowerCase() === "2") {

            await updateUser({ phone, accountType: "ServiceProvider" });
            await setSession(phone, {
              accountType: "ServiceProvider",
              step: steps.PROVIDER_HOME,
              message,
              lActivity,
            });
            return res.status(StatusCodes.OK).send(messages.PROVIDER_HOME)
          } else {
            const invalidMessage = `You have provided an invalid response. Please type '1' or '2' to proceed.`;
            return res.status(StatusCodes.OK).send(invalidMessage)
          }
        }
      }
    }
  }
  // acknowledge callback requests, do not remove:);
  return res.status(StatusCodes.OK).send("Callback received:)");
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
