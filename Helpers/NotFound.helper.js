const { StatusCodes, ReasonPhrases } = require('http-status-codes')
const renderNotFound = (request, response, next) => {
    return response.status(StatusCodes.NOT_FOUND).send(
        `${request.url} ${ReasonPhrases.NOT_FOUND}`)
}

module.exports = renderNotFound;