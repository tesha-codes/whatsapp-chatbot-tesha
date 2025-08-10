const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");
const { getSession, setSession } = require("../utils/redis");
const { getUser } = require("../controllers/user.controllers");
const Onboarding = require("../modules/onboarding");
const ServiceProvider = require("../modules/service-provider/entry");
const DynamicClient = require("../modules/client-flow/entry");
const UserStateManager = require("./userStateManager");
const { sendTextMessage } = require("./whatsappService");

class MessageProcessor {
  constructor() {
    this.connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue("message-processing", {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 50, // Keep 50 completed jobs for monitoring
        removeOnFail: 100, // Keep 100 failed jobs for debugging
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });

    this.worker = null;
    this.userStateManager = new UserStateManager();
  }

  async initialize() {
    this.worker = new Worker(
      "message-processing",
      async (job) => {
        return await this.handleMessage(job.data);
      },
      {
        connection: this.connection,
        concurrency: 10, // Process 10 messages concurrently
      }
    );

    this.worker.on("completed", (job) => {
      console.log(
        `Message processed for ${job.data.userResponse?.sender?.phone}`
      );
    });

    this.worker.on("failed", (job, err) => {
      console.error(`Failed to process message:`, err);
      // Send error message to user
      this.sendErrorMessage(job.data.userResponse?.sender?.phone);
    });

    console.log("Message processor initialized");
  }

  async processMessage(data) {
    try {
      // Add message to queue for processing
      await this.queue.add("process-message", data, {
        // Set priority based on user state
        priority: await this.getPriority(data.userResponse?.sender?.phone),
      });
    } catch (error) {
      console.error("Error adding message to queue:", error);
      // Send error message directly
      await this.sendErrorMessage(data.userResponse?.sender?.phone);
    }
  }

  async handleMessage(data) {
    const { userResponse, steps, messages } = data;
    const phone = userResponse.sender.phone;

    try {
      // Get or create session with recovery
      const session = await this.userStateManager.getOrRecoverSession(phone);

      // Get user with verification
      const user = await getUser(phone);

      // Create mock response object for compatibility
      const mockRes = this.createMockResponse();

      // Determine user state and route accordingly
      const userState = await this.userStateManager.determineUserState(
        user,
        session,
        phone
      );

      console.log(
        `Processing message for ${phone} in state: ${userState.state}`
      );

      switch (userState.state) {
        case "NEW_USER":
          await this.handleNewUser(
            mockRes,
            userResponse,
            session,
            user,
            steps,
            messages
          );
          break;

        case "INCOMPLETE_REGISTRATION":
          await this.handleIncompleteRegistration(
            mockRes,
            userResponse,
            session,
            user,
            steps,
            messages,
            userState
          );
          break;

        case "COMPLETE_CLIENT":
          await this.handleCompleteClient(
            mockRes,
            userResponse,
            session,
            user,
            steps,
            messages
          );
          break;

        case "COMPLETE_PROVIDER":
          await this.handleCompleteProvider(
            mockRes,
            userResponse,
            session,
            user,
            steps,
            messages
          );
          break;

        case "NEEDS_VERIFICATION":
          await this.handleNeedsVerification(phone, user);
          break;

        case "SUSPENDED":
          await this.handleSuspended(phone);
          break;

        case "INACTIVE":
          await this.handleInactive(phone);
          break;

        default:
          await this.handleUnknownState(phone);
      }
    } catch (error) {
      console.error(`Error processing message for ${phone}:`, error);
      await this.sendErrorMessage(phone);
    }
  }

  async handleNewUser(res, userResponse, session, user, steps, messages) {
    const onboard = new Onboarding(
      res,
      userResponse,
      session,
      user,
      steps,
      messages
    );
    await onboard.createNewUser();
  }

  async handleIncompleteRegistration(
    res,
    userResponse,
    session,
    user,
    steps,
    messages,
    userState
  ) {
    // Handle incomplete registration flow with proper routing
    const phone = userResponse.sender.phone;

    // Route to onboarding for terms and account type selection
    if (!user.termsAndConditionsAccepted || !user.accountType) {
      const onboard = new Onboarding(
        res,
        userResponse,
        session,
        user,
        steps,
        messages
      );
      return await onboard.acceptTermsAndChooseAccountType();
    }

    // Handle Client profile completion
    if (user.accountType === "Client" && (!user.firstName || !user.lastName)) {
      const clientFlow = new DynamicClient(
        res,
        userResponse,
        session,
        user,
        steps,
        messages
      );
      return await clientFlow.mainEntry();
    }

    // Handle ServiceProvider profile completion
    if (user.accountType === "ServiceProvider") {
      const ServiceProviderModel = require("../models/serviceProvider.model");
      const providerProfile = await ServiceProviderModel.findOne({ user: user._id });

      if (!user.firstName || !user.lastName || !providerProfile || !providerProfile.isProfileCompleted) {
        const providerFlow = new ServiceProvider(
          res,
          userResponse,
          session,
          user,
          steps,
          messages
        );
        return await providerFlow.mainEntry();
      }
    }

    // If we reach here, registration is actually complete, route appropriately
    if (user.accountType === "Client") {
      return this.handleCompleteClient(res, userResponse, session, user, steps, messages);
    } else if (user.accountType === "ServiceProvider") {
      return this.handleCompleteProvider(res, userResponse, session, user, steps, messages);
    }
  }

  async handleCompleteClient(
    res,
    userResponse,
    session,
    user,
    steps,
    messages
  ) {
    // Ensure session has correct state
    if (!session || !session.step) {
      await setSession(userResponse.sender.phone, {
        step: steps.CLIENT_MAIN_MENU,
        message: userResponse.payload?.text || "",
        lActivity: new Date().toISOString(),
        accountType: "Client",
      });
      session = await getSession(userResponse.sender.phone);
    }

    const client = new DynamicClient(
      res,
      userResponse,
      session,
      user,
      steps,
      messages
    );
    await client.mainEntry();
  }

  async handleCompleteProvider(
    res,
    userResponse,
    session,
    user,
    steps,
    messages
  ) {
    // Ensure session has correct state
    if (!session || !session.step) {
      await setSession(userResponse.sender.phone, {
        step: steps.SERVICE_PROVIDER_MAIN_MENU,
        message: userResponse.payload?.text || "",
        lActivity: new Date().toISOString(),
        accountType: "ServiceProvider",
      });
      session = await getSession(userResponse.sender.phone);
    }

    const provider = new ServiceProvider(
      res,
      userResponse,
      session,
      user,
      steps,
      messages
    );
    await provider.mainEntry();
  }

  async handleNeedsVerification(phone, user) {
    const message = `🔄 Your account verification is in progress. This typically takes 1-24 hours. 

We'll notify you as soon as verification is complete. If you have urgent queries, please contact support at 071-360-3012.

Your account type: ${user.accountType || "Not set"}
Registration status: ${user.verified ? "Verified" : "Pending verification"}`;

    await sendTextMessage(phone, message);
  }

  async handleSuspended(phone) {
    const message = `⚠️ Your account is currently suspended. 

This means you won't be able to receive new requests or accept new clients at the moment. 

If you believe this is an error or need assistance, please contact our support team at 📞 071-360-3012 or email support@tesha.co.zw`;

    await sendTextMessage(phone, message);
  }

  async handleInactive(phone) {
    const message = `📋 Your account is currently inactive. 

To reactivate your account and start receiving requests again:
1. Reply "ACTIVATE" to reactivate your account
2. Contact support at 📞 071-360-3012 for assistance

We're here to help get you back up and running!`;

    await sendTextMessage(phone, message);
  }

  async handleUnknownState(phone) {
    const message = `👋 Welcome back to Tesha!

We're having trouble determining your account status. Please help us by replying with one of the following:

1️⃣ "NEW" - If you're new to Tesha
2️⃣ "CLIENT" - If you're a registered client
3️⃣ "PROVIDER" - If you're a service provider

Or contact support at 📞 071-360-3012 for immediate assistance.`;

    await sendTextMessage(phone, message);
  }

  async sendErrorMessage(phone) {
    if (!phone) return;

    const message = `😕 Oops! Something went wrong while processing your request. 

Please try again in a moment. If the issue persists, please contact our support team at 📞 071-360-3012.

We apologize for the inconvenience!`;

    try {
      await sendTextMessage(phone, message);
    } catch (error) {
      console.error("Failed to send error message:", error);
    }
  }

  async getPriority(phone) {
    // Prioritize based on user state
    const user = await getUser(phone);
    if (!user) return 1; // New users get priority
    if (!user.verified) return 2; // Unverified users
    if (user.accountType === "ServiceProvider") return 3; // Providers
    return 4; // Regular clients
  }

  createMockResponse() {
    return {
      status: () => ({
        send: () => {},
        json: () => {},
      }),
      headersSent: false,
    };
  }

  async shutdown() {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
    await this.connection.quit();
    console.log("Message processor shut down gracefully");
  }
}

module.exports = MessageProcessor;
