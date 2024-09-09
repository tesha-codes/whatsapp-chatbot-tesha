const mongoose = require("mongoose");
const asyncWrapperMiddleware = require("../Middlewares/Async.middleware");
const { StatusCodes, ReasonPhrases } = require("http-status-codes");
const Profile = require('./../Models/Profile.model');
const { createCustomError } = require("../Errors/CustomAPIError.error");

const registerNewUser = asyncWrapperMiddleware(async (request, response, next) => {
    const { whatsAppAccountId } = request.params;
    const profile = await Profile.findOne({ whatsAppAccountId }, '_id user');
    if (!profile) {
        return next(createCustomError('No profile found!', StatusCodes.NOT_FOUND))
    }
    return response.status(StatusCodes.ACCEPTED).send(ReasonPhrases.ACCEPTED)
});


module.exports = {
    registerNewUser
}