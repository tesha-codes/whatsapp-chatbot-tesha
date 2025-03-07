const mongoose = require("mongoose");
const ServiceReferenceSchema = new mongoose.Schema(
  {
    _id: mongoose.Types.ObjectId,
    title: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    serviceType: {
      type: [String],
      enum: [
        "Household",
        "Skilled Task",
        "Yard Work",
        "Moving",
        "Pet Care",
        "Senior Care",
        "Home Maintenance",
        "Errands & Shopping",
      ],
      required: true,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    code: {
      type: Number,
      require: true,
      trim: true,
    },
  },
  { timestamps: true }
);

ServiceReferenceSchema.index(
  {
    title: "text",
    description: "text",
    serviceType: "text",
  },
  {
    weights: {
      title: 5,
      description: 3,
      serviceType: 1,
    },
  }
);

const Service = mongoose.model("Service", ServiceReferenceSchema);

module.exports = Service;
