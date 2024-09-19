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

app.post("/bot", async (req, res) => {
  const userResponse = req.body.payload;
  //
  console.log(userResponse);

  if (userResponse && userResponse.source) {
    // extract user whatsapp message/query from data object
    const phoneNumber = userResponse.sender.phone;
    const username = userResponse.sender.name;
    const country = userResponse.sender.country_code;
    const message = userResponse.payload?.text || "";
    const originalChatId = userResponse.id;
    // Additional code to handle user interactions and store data in the database
    //...
    const botResponse = "You said: " + message;
    await sendTextMessage(phoneNumber, botResponse);
    return res.status(200).json({
      type: "text",
      text: botResponse,
    });
  }
  // acknowledge callback requests, do not remove:)
  return res.status(StatusCodes.ACCEPTED).send("Callback received:)");
});


// app.post("/bot", async (req, res) => {
//   try {
//     const userResponse = req.body.payload;
//     console.log('User response: ', userResponse);

//     if (userResponse && userResponse.source) {
//       const phone = userResponse.sender.phone;
//       const message = userResponse.payload?.text || "";
//       const username = userResponse.sender.name;
//       const user = await User.findOne({ phone },
//         {
//           createdAt: 1,
//           phone: 1,
//           termsAndConditionsAccepted: 1
//         });

//       if (user && user.termsAndConditionsAccepted) {
//         //Continue with session
//       } else {
//         console.log('Creating new user now');
//         const newUser = new User.create({
//           _id: new mongoose.Types.ObjectId(),
//           phone,
//           username
//         });
//         await newUser.save();
//         const message = "Hello there, you've reached TeshaBot. How do I help?"

//         await sendTextMessage(phone, message);
//         return res.status(StatusCodes.OK).json({ response })
//       }
//     }
//   } catch (error) {
//     res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error)
//   }
// })



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
