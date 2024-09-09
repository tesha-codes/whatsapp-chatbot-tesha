require("dotenv").config()
const express = require("express");
const bodyParser = require('body-parser');
const { StatusCodes } = require("http-status-codes");
const morgan = require('morgan');
const connectDb = require("./database/Connect.database");
const renderNotFound = require("./Helpers/notFound.helper");
const UserRoutes = require("./Routes/User.routes");
const errorWrapperMiddleware = require("./Middlewares/Error.middleware");


const app = express();
const PORT = process.env.PORT || 3002;

app.use(morgan("combined"))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.get('/api/version-01/test/route', async (request, response) => {
    response.status(StatusCodes.OK).json({ message: 'Successfully served you sir 😘😘😘' });
});

app.use("/api/version-01/auth", UserRoutes)
app.use(renderNotFound);
app.use(errorWrapperMiddleware)

app.listen(PORT, function () {
    console.log(`Warming up the server 🔥🔥...`);
    connectDb(process.env.MONGO_URL + process.env.MONGO_DATABASE_NAME).then(response => {
        console.log(`Successfully connected to ${response.db.databaseName} ✅✅`);
        console.log(`Server now running on port ${PORT} 👍👌😁😁`);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
});




