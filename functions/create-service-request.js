const mongoose = require('mongoose')
const Request = require('./../models/request.model')
const User = require('../models/user.model')

module.exports = async (
    phone,
    street,
    coordinates,
    city,
    notes,
    serviceId
) => {

    const user = await User.findOne({ phone }, { address, verified });
    if (!user) {
        return // To be determined
    }
    const request = await Request.create({
        _id: new mongoose.Types.ObjectId(),
        service: new mongoose.Types.ObjectId(serviceId),
        requester: user._id,
        address: {
            physicalAddress: street,
            coordinates
        },
        city,
        notes
    });

    return await request.save()
}
