const TemplateUsage = require("../models/templateUsage.model");
const WHATSAPP_TEMPLATES = require("../config/templates");

async function initializeTemplates() {
  try {
    console.log("Starting template initialization...");
    for (const [key, template] of Object.entries(WHATSAPP_TEMPLATES)) {
      const existingTemplate = await TemplateUsage.findOne({
        templateName: template.name,
      });

      if (!existingTemplate) {
        await TemplateUsage.create({
          templateName: template.name,
          usageByPhone: [],
        });
        console.log(`Initialized template: ${template.name}`);
      } else {
        // Check if we need to add new template IDs to existing documents
        const existingIds = new Set(
          existingTemplate.usageByPhone.flatMap((usage) =>
            usage.templateIds.map((t) => t.id)
          )
        );
        const newIds = template.ids.filter((id) => !existingIds.has(id));
        if (newIds.length > 0) {
          const newTemplateIds = newIds.map((id) => ({
            id,
            lastUsedAt: new Date(0),
          }));
          await TemplateUsage.updateOne(
            { templateName: template.name },
            {
              $push: {
                "usageByPhone.$[].templateIds": { $each: newTemplateIds },
              },
            }
          );
        }
      }
    }
    console.log("Template initialization completed successfully");
  } catch (error) {
    console.error("Error initializing templates:", error);
    throw error;
  }
}

module.exports = initializeTemplates;
