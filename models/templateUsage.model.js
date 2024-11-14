const mongoose = require("mongoose");

const templateUsageSchema = new mongoose.Schema({
  templateName: {
    type: String,
    required: true,
    unque: true,
    index: true,
  },
  templateIds: [
    {
      id: String,
      lastUsedAt: Date,
    },
  ],
});

module.exports = mongoose.model("TemplateUsage", templateUsageSchema);
