const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    username: {
      type: String,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    accountType: {
      type: String,
      enum: ["Client", "ServiceProvider"],
    },
    dob: {
      type: Date,
    },
    address: {
      physicalAddress: {
        type: String,
      },
      coordinates: {
        type: [Number],
      },
    },
    verified: {
      type: Boolean,
      default: false,
    },
    preferredLanguage: {
      type: String,
      enum: ["English", "Shona", "Ndebele"],
      default: "English",
    },
    termsAndConditionsAccepted: {
      type: Boolean,
      default: false,
    },
    nationalId: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

UserSchema.index({
  phone: 1,
  termsAndConditionsAccepted: 1
});

module.exports = mongoose.model("User", UserSchema);
