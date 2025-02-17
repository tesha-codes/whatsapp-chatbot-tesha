const Request = require('./../models/request.model');
const mongoose = require('mongoose')
const ServiceRequest = require('../models/serviceRequest.model');
const Service = require('../models/services.model');
const User = require('../models/user.model');
const { v4: uuidv4 } = require('uuid');

const onGetRequestHandler = async (id) => {
    const request = await Request.findById(id)
    if (!request) return null
    return request
}

const onServiceRequestUpdate = async (requestId, updates) => {
    try {
        let updatesQueryObject = {}
        for (const update in updates) {
            if (update !== 'coordinates' || update !== 'physicalAddress') {
                updatesQueryObject[update] = updates[update]
            } else {
                updatesQueryObject.address = {
                    update: updates[update]
                }
            }
        };

        const request = await Request.findOneAndUpdate({ _id: mongoose.Types.ObjectId(requestId) }, updatesQueryObject, { new: true });
        return request;
    } catch (error) {
        console.error(error);
        return error
    }

}



const createServiceRequest = async (reqBody) => {
    try {
        // Validate required fields
        const { userId, description, category } = reqBody;
        if (!userId || !description || !category) {
            throw new Error('Missing required fields');
        }

        // Get user information
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Find matching service
        const service = await Service.findOne({
            $or: [
                { title: category },
                { code: category }
            ]
        });

        if (!service) {
            throw new Error('Service category not found');
        }

        // Create service request
        const newRequest = new ServiceRequest({
            service: service._id,
            requester: userId,
            status: 'Pending',
            city: user.city,
            address: {
                physicalAddress: user.address.physicalAddress,
                coordinates: user.address.coordinates
            },
            id: uuidv4(), // Generate unique ID
            notes: description,
            useSavedLocation: true // Assuming user wants to use saved location
        });

        await newRequest.save();

        return {
            _id: newRequest._id,
            id: newRequest.id,
            status: newRequest.status,
            service: service.title,
            createdAt: newRequest.createdAt
        };

    } catch (error) {
        console.error('Error creating service request:', error);
        throw new Error(error.message || 'Failed to create service request');
    }
};

const getBookings = async (userId, statusFilter) => {
    try {
        const query = { requester: userId };

        if (statusFilter) {
            query.status = statusFilter;
        }

        const bookings = await ServiceRequest.find(query)
            .populate('service', 'title code')
            .sort('-createdAt')
            .lean();

        return bookings.map(booking => ({
            _id: booking._id,
            id: booking.id,
            service: booking.service.title,
            status: booking.status,
            created: booking.createdAt,
            address: booking.address.physicalAddress,
            notes: booking.notes
        }));

    } catch (error) {
        console.error('Error fetching bookings:', error);
        throw new Error('Failed to retrieve bookings');
    }
};



module.exports = {
    onGetRequestHandler, onServiceRequestUpdate, createServiceRequest,
    getBookings
}