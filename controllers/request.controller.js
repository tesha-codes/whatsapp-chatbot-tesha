const Request = require('./../models/request.model');
const mongoose = require('mongoose')

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


module.exports = { onGetRequestHandler, onServiceRequestUpdate }