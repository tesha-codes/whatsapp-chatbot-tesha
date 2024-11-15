const mongoose = require("mongoose");

const templateUsageSchema = new mongoose.Schema({
  templateName: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  usageByPhone: [
    {
      phoneNumber: String,
      templateIds: [
        {
          id: String,
          lastUsedAt: Date,
        },
      ],
    },
  ],
});

module.exports = mongoose.model("TemplateUsage", templateUsageSchema);
