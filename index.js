require("dotenv").config()
const express = require("express");
const bodyParser = require('body-parser');
const { StatusCodes } = require("http-status-codes");
const morgan = require('morgan');
const connectDb = require("./database/Connect.database");
// const renderNotFound = require("./Helpers/notFound.helper");
// const UserRoutes = require("./Routes/User.routes");
// const errorWrapperMiddleware = require("./Middlewares/Error.middleware");


const app = express();
const PORT = process.env.PORT || 3002;

app.use(morgan("combined"))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.get('/api/version-01/test/route', async (request, response) => {
    response.status(StatusCodes.OK).json({ message: 'Successfully served you sir 😘😘😘' });
});

// app.use("/api/version-01/auth", UserRoutes)
// app.use(renderNotFound);
// app.use(errorWrapperMiddleware)

app.post('/bot', async (req, res) => {
    const response = req.body.payload;

    if (response && response.source) {
        // Variables
        const phoneNumber = response.sender.phone;
        const username = response.sender.name;
        const country = response.sender.country_code;
        const message = response.payload?.text || "";  // Optional chaining for text
        const balance = process.env.STARTER_BAL;
        const cacheKey = response.id;

        // Handle further processing
       return res.status(200).json({ message: "Chat received", phoneNumber, username, country, message, balance, cacheKey });
    } else {
        res.status(200).json({ error: "Invalid payload" });
    }
});

app.listen(PORT, function () {
    console.log(`Warming up the server 🔥🔥...`);
    connectDb(process.env.MONGO_URL).then(response => {
        console.log(`Successfully connected to ${response.db.databaseName} ✅✅`);
        console.log(`Server now running on port ${PORT} 👍👌😁😁`);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
});




