const mongoose = require("mongoose");;
const { StatusCodes, ReasonPhrases } = require("http-status-codes");
const Profile = require('../models/profile.model');


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