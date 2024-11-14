require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { StatusCodes } = require("http-status-codes");
const morgan = require("morgan");
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const connectDb = require("./database/connect.database");
const { getSession } = require("./utils/redis");
const { getUser } = require("./controllers/user.controllers");
const { messages } = require("./modules/client");
const serviceRouter = require("./routes/service.routes");
const Category = require("./models/category.model");
const ServiceProvider = require("./modules/provider");
const Onboarding = require("./modules/onboarding");
const Client = require("./modules/request-services");
const { serviceProviderQueue } = require("./jobs/service-provider.job");
const initializeTemplates = require("./services/initializeTemplates");

const app = express();
const PORT = process.env.PORT || 3000;

const steps = {
  ACCEPTED_TERMS: "ACCEPTED_TERMS",
  ACCEPT_TERMS: "ACCEPT_TERMS",
  BOOK_SERVICE: "BOOK_SERVICE",
  CLIENT_WELCOME_MESSAGE: "CLIENT_WELCOME_MESSAGE",
  CLIENT_MENU_SERVICE_CATEGORIES: "CLIENT_MENU_SERVICE_CATEGORIES",
  USER_OR_PROVIDER: "USER_OR_PROVIDER",
  CLIENT_HOME: "CLIENT_HOME",
  PROVIDER_PROMPT_ACCOUNT: "PROVIDER_PROMPT_ACCOUNT",
  SELECT_SERVICE_PROVIDER: "SELECT_SERVICE_PROVIDER",
  GET_USER_INFORMATION: "GET_USER_INFORMATION",
  SAVE_USER_PROFILE_INFOR: "SAVE_USER_PROFILE_INFOR",
  USER_DETAILS_CONFIRMATION: "USER_DETAILS_CONFIRMATION",
  COLLECT_USER_FULL_NAME: "COLLECT_USER_FULL_NAME",
  COLLECT_USER_ID: "COLLECT_USER_ID",
  COLLECT_USER_ADDRESS: "COLLECT_USER_ADDRESS",
  COLLECT_USER_LOCATION: "COLLECT_USER_LOCATION",
  SELECT_SERVICE_CATEGORY: "SELECT_SERVICE_CATEGORY",
  PROFILE_CONFIRMATION: "PROFILE_CONFIRMATION",
  SELECT_MENU_ACTION: "SELECT_MENU_ACTION",
  SETUP_CLIENT_PROFILE: "SETUP_CLIENT_PROFILE",
  DEFAULT_CLIENT_STATE: "DEFAULT_CLIENT_STATE",
  CONFIRM_ADDRESS_AND_LOCATION: "CONFIRM_ADDRESS_AND_LOCATION",
  SELECT_SERVICE: "SELECT_SERVICE",
  COLLECT_PROVIDER_FULL_NAME: "COLLECT_PROVIDER_FULL_NAME",
  PROVIDER_COLLECT_LOCATION: "PROVIDER_COLLECT_LOCATION",
  PROVIDER_COLLECT_CITY: "PROVIDER_COLLECT_CITY",
  PROVIDER_COLLECT_CATEGORY: "PROVIDER_COLLECT_CATEGORY",
  PROVIDER_COLLECT_SERVICE: "PROVIDER_COLLECT_SERVICE",
  PROVIDER_COLLECT_DESCRIPTION: "PROVIDER_COLLECT_DESCRIPTION",
  PROVIDER_COLLECT_SUBSCRIPTION: "PROVIDER_COLLECT_SUBSCRIPTION",
  PROVIDER_COLLECT_ID_IMAGE: "PROVIDER_COLLECT_ID_IMAGE",
  PROVIDER_PROFILE_COMPLETE: "PROVIDER_PROFILE_COMPLETE",
};

app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

// Express adapter for BullBoard
const serverAdapter = new ExpressAdapter();

// Create Bull Board
createBullBoard({
  queues: [new BullMQAdapter(serviceProviderQueue)],
  serverAdapter: serverAdapter,
});

// Use the serverAdapter's middleware
serverAdapter.setBasePath("/admin/queues");
app.use("/admin/queues", serverAdapter.getRouter());

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
  try {
    const userResponse = req.body.payload;
    console.log("User response: ", userResponse);
    if (userResponse && userResponse.source) {
      const phone = userResponse.sender.phone;
      // get session
      const session = await getSession(phone);
      // get user info
      const user = await getUser(phone);
      // create onboarding instance
      const onboard = new Onboarding(
        res,
        userResponse,
        session,
        user,
        steps,
        messages
      );
      // check user
      if (!user) {
        // new user
        return await onboard.createNewUser();
      } else {
        // existing users without session
        if (!session) {
          return await onboard.existingUserWithoutSession();
        }
        // existing users with session with account type
        if (session?.accountType) {
          // client
          if (session.accountType === "Client") {
            console.log("Client session: ", session);
            const client = new Client(
              res,
              userResponse,
              session,
              user,
              steps,
              messages
            );
            return await client.mainEntry();
          } else {
            // service provider
            const provider = new ServiceProvider(
              res,
              userResponse,
              session,
              user,
              steps,
              messages
            );
            return await provider.mainEntry();
          }
        } else {
          // existing users with session without account type
          return await onboard.acceptTermsAndChooseAccountType();
        }
      }
    }

    // Acknowledge callback requests
    return res.status(StatusCodes.OK).send("Callback received:)");
  } catch (error) {
    console.error("Error in /bot route:", error);
    return res
      .status(StatusCodes.OK)
      .json("Something went wrong. Please try again later.");
  }
});

app.listen(PORT, function () {
  console.log(`Warming up the server 🔥🔥...`);
  connectDb(process.env.MONGO_URL)
    .then(async (response) => {
      console.log(`Successfully connected to ${response.db.databaseName} ✅✅`);
      console.log(`Server now running on port ${PORT} 👍👌😁😁`);
      // initalize templates
      await initializeTemplates();
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
});

process.on("SIGTERM", async () => {
  await serviceProviderQueue.close();
  process.exit(0);
});
process.on("SIGINT", async () => {
  console.log("Received SIGINT signal. Starting graceful shutdown...");
  await shutdown();
  process.exit(0);
});
