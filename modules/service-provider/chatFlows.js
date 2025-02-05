const CHAT_TEMPLATES = {
  TASK_OVERVIEW: (data) => `
📊 *Task Overview*
Total Tasks: ${data.total}
Pending: ${data.Pending}
Completed: ${data.Completed}
Cancelled: ${data.Cancelled}

What would you like to do?
- View pending tasks
- View completed tasks
- View cancelled tasks
- View task details`,

  TASK_LIST: (tasks) => {
    if (!tasks.length) return "No tasks found in this category.";

    return tasks
      .map(
        (task, index) => `
${index + 1}. Task ID: ${task.id}
📝 Service: ${task.service.title}
📍 Location: ${task.address.physicalAddress}
📅 Created: ${new Date(task.createdAt).toLocaleDateString()}
Status: ${task.status}
------------------`
      )
      .join("\n");
  },

  PROFILE_VIEW: (profile) => `
👤 *Profile Information*
Name: ${profile.firstName} ${profile.lastName}
Phone: ${profile.phone}
Gender: ${profile.gender}
City: ${profile.provider.city}
Service: ${profile.provider.service.title}
Rating: ⭐${profile.provider.rating}

What would you like to edit?
- Name
- City
- Service Description and so on (e.g Please update my city to Mutare)`,

  SUBSCRIPTION_INFO: (data) => `
💳 *Current Subscription*
Plan: ${data.currentPlan.plan}
Status: ${data.currentPlan.active ? "✅ Active" : "❌ Inactive"}
Price: $${data.currentPlan.price}/month

Features:
${data.currentPlan.features.map((f) => `• ${f}`).join("\n")}
`,
};

module.exports = CHAT_TEMPLATES;
