const mongoose = require("mongoose");
require('./user.model');
const { Schema } = mongoose;

const OnboardingDraftSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountType: {
        type: String,
        enum: ["Client", "ServiceProvider"],
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    lastStep: { type: String, required: true },
    lastPayload: { type: Schema.Types.Mixed, default: {} },
    completed: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("OnboardingDraft", OnboardingDraftSchema);
