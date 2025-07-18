const mongoose = require('mongoose')
const Request = require('./../models/request.model')
const User = require('../models/user.model')
const Service = require('../models/services.model')
const NotificationUtil = require('../utils/notificationUtil')

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

    const savedRequest = await request.save();

    // Create notification for service request
    try {
        const service = await Service.findById(serviceId);
        if (service) {
            await NotificationUtil.createServiceRequestNotification(
                savedRequest,
                user,
                service,
                city
            );
        }
    } catch (error) {
        console.error("Error creating service request notification:", error);
    }

    return savedRequest;
}
