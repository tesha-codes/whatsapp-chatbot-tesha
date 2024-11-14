const TemplateUsage = require("../models/templateUsage.model");
const WHATSAPP_TEMPLATES = require("../config/templates");

class TemplateManager {
  constructor() {
    this.COOLDOWN_HOURS = 24;
    this.templates = WHATSAPP_TEMPLATES;
  }

  async getAvailableTemplateId(templateName) {
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

      // Sort by lastUsedAt and find the first available template
      const availableTemplate = templateUsage.templateIds
        .sort((a, b) => a.lastUsedAt - b.lastUsedAt)
        .find((template) => template.lastUsedAt < cooldownTime);

      if (!availableTemplate) {
        return null;
      }

      // Update last used time
      await TemplateUsage.updateOne(
        {
          templateName: templateConfig.name,
          "templateIds.id": availableTemplate.id,
        },
        {
          $set: { "templateIds.$.lastUsedAt": now },
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
