const mongoose = require("mongoose");

module.exports = function (connectionURL) {
    return mongoose.connect(connectionURL).then((response) => {
        return response.connection
    }).catch((error) => {
        throw error;
    })
}