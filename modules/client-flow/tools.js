const tools = [
    {
        type: "function",
        function: {
            name: "create_service_request",
            description: "Create a new service request with detailed requirements",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    service_description: {
                        type: "string",
                        description: "Detailed description of the required service"
                    },
                    category: {
                        type: "string",
                        enum: ["Plumbing", "Electrical", "Cleaning", "Repairs", "Other"],
                        description: "Category of the service needed"
                    }
                },
                required: ["service_description", "category"], // ✅ Correct
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "view_booking_requests",
            description: "View all service requests and their current statuses",
            strict: true,
            parameters: {
                type: "object",
                properties: {}, // No parameters needed
                required: [], // ✅ Correct for optional filter
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_client_profile",
            description: "Update client's profile information",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    field: {
                        type: "string",
                        enum: ["firstName", "lastName", "address.physicalAddress"],
                        description: "Field to update"
                    },
                    value: {
                        type: "string",
                        description: "New value for the field"
                    }
                },
                required: ["field", "value"], // ✅ Correct
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_client_account",
            description: "Permanently delete client account",
            strict: true,
            parameters: {
                type: "object",
                properties: {
                    reason: {
                        type: "string",
                        description: "Reason for deletion (minimum 10 characters)"
                    },
                    confirmation: {
                        type: "boolean",
                        description: "Final confirmation of deletion"
                    }
                },
                required: ["reason", "confirmation"], // ✅ Correct
                additionalProperties: false
            }
        }
    }
];