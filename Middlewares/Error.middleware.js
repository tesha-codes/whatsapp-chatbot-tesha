const { StatusCodes } = require("http-status-codes");
const { CustomAPIError } = require("../Errors/CustomAPIError.error");

const errorWrapperMiddleware = (err, request, response, next) => {

    if (err instanceof CustomAPIError) {
        return response.status(err.statusCode).json({ message: err.message })
    }
    return response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: err.message,
    })
}

module.exports = errorWrapperMiddleware;