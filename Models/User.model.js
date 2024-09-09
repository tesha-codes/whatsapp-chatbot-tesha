const mongoose = require("mongoose");
const { fieldEncryption } = require("mongoose-field-encryption");
const crypto = require("node:crypto")

const UserSchema = new mongoose.Schema({
    _id: mongoose.Types.ObjectId,
    phone: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    gender: {
        type: String,
        enum: ["Male", "Female", "Other"],
        required: true
    },
    accountType: {
        isClient: {
            type: Boolean,
            require: true,
            default: true
        },
        isServiceProvider: {
            type: Boolean,
            require: true,
            default: false
        }
    },
    dob: {
        type: Date,
        required: true
    },
    address: {
        physicalAddress: {
            type: String,
        },
        coordinates: {
            type: [Number]
        }
    },
    verified: {
        type: Boolean,
        require: true,
        default: false
    },
    preferredLanguage: {
        type: String,
        required: true,
        enum: ["English", "Shona", "Ndebele"],
        default: "English"
    },
    termsAndConditionsAccepted: {
        type: Boolean,
        required: true,
        default: false
    }
}, { timestamps: true }).index(
    {
        "address.coordinates": "2dsphere"
        , "serviceProvider": "text"
    })

UserSchema.plugin(fieldEncryption, {
    fields: ['phone', 'firstName', 'lastName', 'accountType', 'dob', 'address.physicalAddress', 'address.coordinates', 'profile',],
    secret: process.env.MONGO_SECRET_ENCRYPTION_KEY,
    saltGenerator: function (secret) {
        const salt = crypto.randomBytes(16).toString("hex").slice(0, 16);
        return salt;
    }
})
module.exports = mongoose.model("User", UserSchema);

