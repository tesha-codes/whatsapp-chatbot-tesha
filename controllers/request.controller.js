const Request = require('./../models/request.model')


const onGetRequestHandler = async (id) => {
    const request = await Request.findById(id)
    if (!request) return null
    return request
}


module.exports = { onGetRequestHandler }