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
const ServiceProvider = require("./modules/service-provider/entry");
const RequestProvider = require("./models/serviceProvider.model");
const Onboarding = require("./modules/onboarding");
const DynamicClient = require("./modules/client-flow/entry");
const { serviceProviderQueue } = require("./jobs/service-provider.job");
const initializeTemplates = require("./services/initializeTemplates");
const { onServiceRequestUpdate } = require("./controllers/request.controller");
const User = require("./models/user.model");

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
  CONFIRMED_LOC_ADDRESS: "CONFIRMED_LOC_&_ADDRESS",
  WAITING_NEW_LOCATION: "WAITING_NEW_LOCATION",
  AWAITING_PROVIDER: "AWAITING_PROVIDER",
  PROVIDER_CONFIRMATION: "PROVIDER_CONFIRMATION",
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
  WAITING_FOR_VERIFICATION: "WAITING_FOR_VERIFICATION",
  ACCOUNT_STATUS_INACTIVE: "ACCOUNT_STATUS_INACTIVE",
  ACCOUNT_STATUS_SUSPENDED: "ACCOUNT_STATUS_SUSPENDED",
  SERVICE_PROVIDER_MAIN_MENU: "SERVICE_PROVIDER_MAIN_MENU",
  CLIENT_ACCEPT_TERMS: "CLIENT_ACCEPT_TERMS",
  SETUP_CLIENT_PROFILE: "SETUP_CLIENT_PROFILE",
  COLLECT_CLIENT_FULL_NAME: "COLLECT_CLIENT_FULL_NAME",
  COLLECT_CLIENT_NATIONAL_ID: "COLLECT_CLIENT_NATIONAL_ID",
  COLLECT_CLIENT_ID_IMAGE: "COLLECT_CLIENT_ID_IMAGE",
  COLLECT_CLIENT_ADDRESS: "COLLECT_CLIENT_ADDRESS",
  COLLECT_CLIENT_LOCATION: "COLLECT_CLIENT_LOCATION",
  CLIENT_REGISTRATION_COMPLETE: "CLIENT_REGISTRATION_COMPLETE",
  CLIENT_MAIN_MENU:"CLIENT_MAIN_MENU"
};



app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));
// Add to your Express config
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
  limit: '10kb'
}));
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
  console.log("Served");
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

app.post("/request/update/:requestId", async (request, response, next) => {
  try {
    const _id = request.params.requestId;
    const serviceRequest = await onServiceRequestUpdate(_id, request.body);
    response.status(StatusCodes.ACCEPTED).json({ serviceRequest });
  } catch (error) {
    response.status(StatusCodes.BAD_GATEWAY).json({ error });
  }
});

app.post("/insert/service/providers", async (request, response) => {
  try {
    const results = await RequestProvider.insertMany(request.body);
    response.status(StatusCodes.ACCEPTED).json({ results });
  } catch (error) {
    response.status(StatusCodes.BAD_GATEWAY).json({ error });
  }
});

app.post("/insert/users", async (request, response) => {
  try {
    console.log(request.body);
    const results = await User.insertMany(request.body);
    response.status(StatusCodes.ACCEPTED).json({ results });
  } catch (error) {
    response.status(StatusCodes.BAD_GATEWAY).json({ error });
  }
});

// health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: Date.now(),
  });
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
        if (Object.keys(session).length === 0) {
          console.log("No sessions found.....");
          return await onboard.existingUserWithoutSession();
        }

        // existing users with session with account type
        if (session?.accountType) {
          // client
          if (session.accountType === "Client") {
            // console.log("Client session: ", session);
            // const client = new Client(
            //   res,
            //   userResponse,
            //   session,
            //   user,
            //   steps,
            //   messages
            // );
            // return await client.mainEntry();

            const dynamicClient = new DynamicClient(
              res,
              userResponse,
              session,
              user,
              steps,
              messages
            );

            return await dynamicClient.mainEntry();
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
      .send(
        "😕 Oops! Something went wrong. Please try again a bit later. If the issue persists, feel free to call us at 📞 071-360-3012. Thank you for your patience! 🙏"
      );
  }
});

app.listen(PORT, function () {
  console.log(`Warming up the server 🔥🔥...`);
  connectDb(process.env.MONGO_URL)
    .then(async () => {
      console.log(`Database connection successfully established ✅✅`);
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
