const OnboardingDraft = require('./../models/onBoardingDraft.model')
exports.saveDraft = async function ({ userId, accountType, phone, step, payload }) {
    return OnboardingDraft.findOneAndUpdate(
        { user: userId, completed: false },
        { accountType, lastStep: step, lastPayload: payload, phone },
        { upsert: true, new: true }
    );
}

exports.markStatusAsComplete = async function ({ userId ,phone}) {
    return OnboardingDraft.findOneAndUpdate(
        { user: userId, completed: false, phone },
        { completed: true },
        { new: true }
    );
}
