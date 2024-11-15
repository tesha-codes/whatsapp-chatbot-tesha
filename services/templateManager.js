const TemplateUsage = require("../models/templateUsage.model");
const WHATSAPP_TEMPLATES = require("../config/templates");

class TemplateManager {
  constructor() {
    this.COOLDOWN_HOURS = 24;
    this.templates = WHATSAPP_TEMPLATES;
  }

  async getAvailableTemplateId(templateName, phoneNumber) {
    try {
      const templateConfig = this.templates[templateName];
      if (!templateConfig) {
        throw new Error(
          `Template configuration not found for: ${templateName}`
        );
      }

      const templateUsage = await TemplateUsage.findOne({
        templateName: templateConfig.name,
      });

      if (!templateUsage) {
        throw new Error(`Template usage data not found for: ${templateName}`);
      }

      const now = new Date();
      const cooldownTime = new Date(now - this.COOLDOWN_HOURS * 60 * 60 * 1000);

      let userTemplateData = templateUsage.usageByPhone.find(
        (data) => data.phoneNumber === phoneNumber
      );

      if (!userTemplateData) {
        userTemplateData = {
          phoneNumber: phoneNumber,
          templateIds: templateConfig.ids.map((id) => ({
            id,
            lastUsedAt: new Date(0),
          })),
        };
        await TemplateUsage.updateOne(
          { templateName: templateConfig.name },
          { $push: { usageByPhone: userTemplateData } }
        );
        return templateConfig.ids[0];
      }

      const availableTemplate = userTemplateData.templateIds
        .sort((a, b) => a.lastUsedAt - b.lastUsedAt)
        .find((template) => template.lastUsedAt < cooldownTime);

      if (!availableTemplate) {
        return null;
      }

      await TemplateUsage.updateOne(
        {
          templateName: templateConfig.name,
          "usageByPhone.phoneNumber": phoneNumber,
        },
        {
          $set: {
            "usageByPhone.$.templateIds.$[elem].lastUsedAt": now,
          },
        },
        {
          arrayFilters: [{ "elem.id": availableTemplate.id }],
        }
      );

      return availableTemplate.id;
    } catch (error) {
      console.error("Error getting available template:", error);
      throw error;
    }
  }
}

module.exports = new TemplateManager();
