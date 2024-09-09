
const asyncWrapperMiddleware = (func) => {
    return async function (request, response, next) {
        try {
            await func(request, response, next);
        } catch (error) {
            next(error)
        }
    }
}

module.exports = asyncWrapperMiddleware