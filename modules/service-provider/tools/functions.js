const functions = [
  {
    name: "view_tasks_overview",
    description: "Get an overview of all tasks with their counts by status",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "view_tasks_by_status",
    description: "View tasks filtered by their status",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["Pending", "Completed", "Cancelled"],
          description: "Status of tasks to filter",
        },
      },
      required: ["status"],
    },
  },
  {
    name: "view_task_details",
    description: "Get detailed information about a specific task",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "ID of the task to view",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "update_task_status",
    description: "Update the status of a pending task",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "ID of the task to update",
        },
        newStatus: {
          type: "string",
          enum: ["Completed", "Cancelled"],
          description: "New status for the task",
        },
      },
      required: ["taskId", "newStatus"],
    },
  },
  {
    name: "view_profile",
    description: "View service provider's profile information",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "update_profile",
    description: "Update service provider's profile information",
    parameters: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: ["firstName", "lastName", "gender", "description", "address"],
          description: "Field to update",
        },
        value: {
          type: "string",
          description: "New value for the field",
        },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "delete_account",
    description: "Delete service provider's account",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for account deletion",
        },
        confirmation: {
          type: "boolean",
          description: "Confirmation of deletion",
        },
      },
      required: ["reason", "confirmation"],
    },
  },
  {
    name: "view_billing_history",
    description: "View billing and payment history",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

module.exports = functions;
