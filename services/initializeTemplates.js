const TemplateUsage = require("../models/templateUsage.model");
const WHATSAPP_TEMPLATES = require("../config/templates");

async function initializeTemplates() {
  try {
    console.log("Starting template initialization...");

    for (const [key, template] of Object.entries(WHATSAPP_TEMPLATES)) {
      // Check if template already exists
      const existingTemplate = await TemplateUsage.findOne({
        templateName: template.name,
      });

      if (!existingTemplate) {
        // Create new template usage document
        await TemplateUsage.create({
          templateName: template.name,
          templateIds: template.ids.map((id) => ({
            id,
            lastUsedAt: new Date(0), // Set to epoch time initially
          })),
        });
        console.log(`Initialized template: ${template.name}`);
      } else {
        // Optionally update existing template with new IDs
        const existingIds = existingTemplate.templateIds.map((t) => t.id);
        const newIds = template.ids.filter((id) => !existingIds.includes(id));

        if (newIds.length > 0) {
          const newTemplateIds = newIds.map((id) => ({
            id,
            lastUsedAt: new Date(0),
          }));

          await TemplateUsage.updateOne(
            { templateName: template.name },
            { $push: { templateIds: { $each: newTemplateIds } } }
          );
          console.log(`Updated template: ${template.name} with new IDs`);
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
