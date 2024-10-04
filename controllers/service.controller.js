
const mongoose = require('mongoose')
const Service = require('./../models/services.model');
const { StatusCodes } = require('http-status-codes');

const onCreateService = async (request, response) => {
    try {
        const {
            title,
            category,
            description,
            serviceType,
            unitPrice,
            code
        } = request.body;
        const service = await Service.create({
            _id: new mongoose.Types.ObjectId(),
            title,
            category,
            description,
            serviceType,
            unitPrice,
            code
        })
        await service.save();
        response.status(StatusCodes.CREATED).json(service)
    } catch (error) {
        response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
    }
}

const onInsertMany = async (request, response) => {
    try {
        const { data:services} = request.body;
        const result = await Service.insertMany(services)
        response.status(StatusCodes.CREATED).json(result)
    } catch (error) {
        response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
    }
}



module.exports = { onCreateService, onInsertMany }