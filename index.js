require("dotenv").config();
const express = require("express");
const {
  sendTextMessage,
  sendChooseAccountTypeTemplate,
  registerClientTemplate,
  clientMainMenuTemplate
} = require("./services/whatsappService");
const bodyParser = require("body-parser");
const { StatusCodes } = require("http-status-codes");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const morgan = require("morgan");
const connectDb = require("./database/connect.database");
const { getSession, setSession } = require("./utils/redis");
const {
  createUser,
  updateUser,
  getUser,
} = require("./controllers/user.controllers");
const { messages } = require("./modules/client");
const serviceRouter = require("./routes/service.routes");
const Category = require("./models/category.model");
const Service = require("./models/services.model");
const ServiceRequest = require("./models/request.model");
const User = require("./models/user.model");

const app = express();
const PORT = process.env.PORT || 3000;

const steps = {
  ACCEPTED_TERMS: "ACCEPTED_TERMS",
  ACCEPT_TERMS: "ACCEPT_TERMS",
  BOOK_SERVICE: "BOOK_SERVICE",
  CLIENT_WELCOME_MESSAGE: 'CLIENT_WELCOME_MESSAGE',
  CLIENT_MENU_SERVICE_CATEGORIES: 'CLIENT_MENU_SERVICE_CATEGORIES',
  USER_OR_PROVIDER: 'USER_OR_PROVIDER',
  CLIENT_HOME: 'CLIENT_HOME',
  PROVIDER_HOME: 'PROVIDER_HOME',
  SELECT_SERVICE_PROVIDER: 'SELECT_SERVICE_PROVIDER',
  GET_USER_INFORMATION: 'GET_USER_INFORMATION',
  SAVE_USER_PROFILE_INFOR: 'SAVE_USER_PROFILE_INFOR',
  USER_DETAILS_CONFIRMATION: 'USER_DETAILS_CONFIRMATION',
  COLLECT_USER_FULL_NAME: 'COLLECT_USER_FULL_NAME',
  COLLECT_USER_ID: 'COLLECT_USER_ID',
  COLLECT_USER_ADDRESS: 'COLLECT_USER_ADDRESS',
  SELECT_SERVICE_CATEGORY: 'SELECT_SERVICE_CATEGORY',
  PROFILE_CONFIRMATION: 'PROFILE_CONFIRMATION',
  SELECT_MENU_ACTION: 'SELECT_MENU_ACTION',
  SETUP_CLIENT_PROFILE:'SETUP_CLIENT_PROFILE',
  DEFAULT_CLIENT_STATE:"DEFAULT_CLIENT_STATE",
  SELECT_SERVICE:"SELECT_SERVICE",

}


app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", async (request, response) => {
  response
    .status(StatusCodes.OK)
    .json({ message: "Never stray from the way." });
});

app.use("/services", serviceRouter);
app.post("/add/categories", async (request, response) => {
  try {
    const { data: categories } = request.body;
    const result = await Category.insertMany(categories);
    response.status(StatusCodes.CREATED).json(result);
  } catch (error) {
    response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
  }
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

      await setSession(phone, {
        step: steps.ACCEPT_TERMS,
        message,
        lActivity,
      });
      //
      return res.status(StatusCodes.OK).send(messages.WELCOME_MESSAGE);
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

            return res.status(StatusCodes.OK).send(messages.CLIENT_HOME);
          }
          // provider.accountType
          if (user.accountType === "ServiceProvider") {
            await setSession(phone, {
              accountType: "ServiceProvider",
              step: steps.ACCEPTED_TERMS,
              message,
              lActivity,
            });

            return res.status(StatusCodes.OK).send(messages.PROVIDER_HOME);
          }
        } else {
          // no session and no terms were accepted

          await setSession(phone, {
            step: steps.ACCEPTED_TERMS,
            message,
            lActivity,
          });
          return res.status(StatusCodes.OK).send(messages.WELCOME_TERMS);
        }

      }

      if (session?.accountType) {
        // : are already user or service provider
        // : check they user or service provider
        console.log("The sessions here: ", session);
        if (session.accountType === "Client") {
          // : user
          //  request service
          // list services
          // : acknlowledge request
          if (session.step === steps.SETUP_CLIENT_PROFILE) {
            if (message.toString().toLowerCase() === 'create account') {
              await setSession(phone, {
                step: steps.COLLECT_USER_FULL_NAME,
                message,
                lActivity,
              });
              return res
                .status(StatusCodes.OK)
                .send(messages.GET_FULL_NAME);
            }else{
              await setSession(phone, {
                step: steps.DEFAULT_CLIENT_STATE,
                message,
                lActivity,
              });
              return res
                .status(StatusCodes.OK)
                .send("❌ You have cancelled creating profile. You need to have a profile to be able to request services. ");
            }

          }

          else if (session.step === steps.COLLECT_USER_ID) {
            await setSession(phone, {
              step: steps.COLLECT_USER_ADDRESS,
              message,
              lActivity,
            });
            return res
              .status(StatusCodes.OK)
              .send(messages.GET_NATIONAL_ID);

          }
          else if (session.step === steps.COLLECT_USER_FULL_NAME) {
            await setSession(phone, {
              step: steps.COLLECT_USER_ID,
              message,
              lActivity,
            });
            return res
              .status(StatusCodes.OK)
              .send(messages.GET_NATIONAL_ID);

          }
          else if (session.step === steps.COLLECT_USER_ID) {
            await setSession(phone, {
              step: steps.COLLECT_USER_ADDRESS,
              message,
              lActivity,
            });
            return res
              .status(StatusCodes.OK)
              .send(messages.GET_ADDRESS);

          }
          else if (session.step === steps.COLLECT_USER_ADDRESS) {
            await setSession(phone, {
              step: steps.PROFILE_CONFIRMATION,
              message,
              lActivity,
            });
            return res
              .status(StatusCodes.OK)
              .send(messages.GET_ADDRESS);

          }
          else if (session.step === steps.PROFILE_CONFIRMATION) {
            await setSession(phone, {
              step: steps.SELECT_SERVICE_CATEGORY,
              message,
              lActivity,
            });
            let confirmation = `
*Profile Setup Confirmation*

✅ Thank you! Your profile has been successfully set up.
You’re all set! If you need any further assistance, feel free to reach out. 😊
`

            setTimeout(async () => {
              await clientMainMenuTemplate(phone);
            }, 0);
            return res
              .status(StatusCodes.OK)
              .send(confirmation);

          }
          else if (session.step === steps.SELECT_SERVICE_CATEGORY && message.toString().toLowerCase() === 'request service') {
            await setSession(phone, {
              step: steps.SELECT_SERVICE,
              message,
              lActivity,
            });

            return res
              .status(StatusCodes.OK)
              .send(messages.CLIENT_WELCOME_MESSAGE);

          }
          else if (session.step === steps.SELECT_SERVICE) {
            const category = await Category.findOne(
              { code: +message.toLowerCase() },
              { _id: 1, name: 1 }
            );

            let queryId = new mongoose.Types.ObjectId(category._id);
            const services = await Service.find({ category: queryId });


            let responseMessage = `

*${category.name}* 
Please select a service from the list below:
${services.map((s, index) => `${index + 1}. *${s.title}*\n${s.description}`)
                .join("\n\n")}

Reply with the number of the service you'd like to hire.
            `;
            await setSession(phone, {
              step: steps.BOOK_SERVICE,
              message,
              lActivity,
              categoryId: category._id.toString(),
            });
            return res.status(StatusCodes.OK).send(responseMessage);
          } else if (
            session.step === steps.BOOK_SERVICE &&
            session.categoryId
          ) {
            const service = await Service.findOne({
              code: +message,
              category: session.categoryId,
            });
            const user = await User.findOne({ phone });
            console.log(user);

            const reqID =
              "REQ" + crypto.randomBytes(3).toString("hex").toUpperCase();
            const request = await ServiceRequest.create({
              _id: new mongoose.Types.ObjectId(),
              city: "Harare",
              requester: user._id,
              service: service._id,
              address: {
                physicalAddress: "801 New Prospect, Harare.",
              },
              notes: "Service booking is still in dev",
              id: reqID,
            });

            await request.save();
            setSession(phone, {
              step: steps.SELECT_SERVICE_PROVIDER,
              message,
              lActivity,
              serviceId: service.toString(),
              requestId: request._id.toString(),
            });

            const responseMessage = `

📃 Thank you, *${user.username}*! 

Your request for the service  has been successfully created. 

📝 Your request ID is: *${reqID}*. 
📍 Location: *${request.address.physicalAddress}*

Our team will connect you with a service provider shortly. 
 Please wait...`;
            return res.status(StatusCodes.OK).send(responseMessage);
          }
          console.log("Client session: ", session);
        } else {
          // : service provider
          // : register service
          // : continue ...
          await sendTextMessage(phone, 'Mukuda basa here mudhara?');
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
            // send choose account type template
            await sendChooseAccountTypeTemplate(phone);
            return res.status(StatusCodes.OK).send("");
          } else if (message.toLowerCase() === "no") {
            await setSession(phone, {
              step: steps.ACCEPTED_TERMS,
              message,
              lActivity,
            });
            return res.status(StatusCodes.OK).send(message.DECLINE_TERMS);
          } else {
            const invalidMessage = `You have provided an invalid response. Please type 'Yes' or 'No'to proceed.`;
            return res.status(StatusCodes.OK).send(invalidMessage);
          }
        }
        // else if (session.step === steps.ACCEPTED_TERMS) {
        //   await setSession(phone, {
        //     step: steps.USER_OR_PROVIDER,
        //     message,
        //     lActivity,
        //   });
        //   return res.(StatusCodstatuses.OK).send(messages.USER_OR_PROVIDER)
        // } 
        else if (session.step === steps.ACCEPTED_TERMS) {
          if (message.toLowerCase() === "client") {
            await updateUser({ phone, accountType: "Client" });
            await setSession(phone, {
              accountType: "Client",
              step: steps.SETUP_CLIENT_PROFILE,
              message,
              lActivity,
            });
            await registerClientTemplate(phone)
            return res.status(StatusCodes.OK).send("");
          } else if (message.toLowerCase() === "2") {
            //Check if user has a valid profile , if not register them and then proceed to menu, else go straight to menu
            await updateUser({ phone, accountType: "ServiceProvider" });
            await setSession(phone, {
              accountType: "ServiceProvider",
              step: steps.PROVIDER_HOME,
              message,
              lActivity,
            });
            return res.status(StatusCodes.OK).send(messages.PROVIDER_HOME);
          } else {
            const invalidMessage = `You have provided an invalid response. Please reply with 'Client' or 'Service Provider' to proceed.`;
            return res.status(StatusCodes.OK).send(invalidMessage);
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
