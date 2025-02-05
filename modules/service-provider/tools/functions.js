const tools = [
  {
    type: "function",
    function: {
      name: "view_tasks_overview",
      description: "Get an overview of all tasks with their counts by status",
      strict: true,
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_tasks_by_status",
      description: "View tasks filtered by their status",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["Pending", "Completed", "Cancelled"],
            description: "Status of tasks to filter (case-sensitive)",
          },
        },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_task_details",
      description: "Get detailed information about a specific task",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            format: "uuid",
            description: "Unique identifier of the task",
          },
        },
        required: ["taskId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task_status",
      description: "Update the status of a pending task",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            format: "uuid",
            description: "ID of the task to update",
          },
          newStatus: {
            type: "string",
            enum: ["Completed", "Cancelled"],
            description: "New status for the task (cannot revert to Pending)",
          },
        },
        required: ["taskId", "newStatus"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_profile",
      description: "View service provider's profile information",
      strict: true,
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_profile",
      description: "Update service provider's profile information",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["firstName", "lastName", "gender", "description", "address"],
            description: "Field to update (case-sensitive)",
          },
          value: {
            type: "string",
            maxLength: 255,
            description: "New value for the field",
          },
        },
        required: ["field", "value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_account",
      description: "Delete service provider's account",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            minLength: 10,
            description: "Reason for account deletion (minimum 10 characters)",
          },
          confirmation: {
            type: "boolean",
            description: "Final confirmation of deletion action",
          },
        },
        required: ["reason", "confirmation"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_billing_history",
      description: "View billing and payment history",
      strict: true,
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
];

module.exports = tools;
