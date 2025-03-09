const clientFunctions = [
  {
    type: "function",
    function: {
      name: "handle_provider_selection",
      description:
        "Schedule a booking using the selection number of a provider from the displayed list",
      parameters: {
        type: "object",
        properties: {
          selectionNumber: {
            type: "string",
            description:
              "The number selection for the provider (1, 2, 3, etc.)",
          },
          serviceType: {
            type: "string",
            description: "Type of service requested",
          },
          date: {
            type: "string",
            description: "Date for the service (YYYY-MM-DD)",
          },
          time: {
            type: "string",
            description: "Time for the service (HH:MM)",
          },
          location: {
            type: "string",
            description: "Location where service is needed",
          },
          description: {
            type: "string",
            description: "Description of what needs to be done",
          },
          confirmation: {
            type: "boolean",
            description: "Final confirmation of service request",
          },
        },
        required: [
          "selectionNumber",
          "serviceType",
          "date",
          "time",
          "location",
          "confirmation"
        ],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_available_services",
      description: "Get a list of all available service types on the platform",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_service_providers",
      description:
        "Get a list of service providers based on service type and location",
      parameters: {
        type: "object",
        properties: {
          serviceType: {
            type: "string",
            description:
              "Type of service (e.g., plumbing, electrical, cleaning)",
          },
          location: {
            type: "string",
            description: "Location or area where service is needed",
          },
        },
        required: ["serviceType"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_bookings_history",
      description: "Get a list of all bookings made by the client",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_booking_details",
      description: "Get detailed information about a specific booking",
      parameters: {
        type: "object",
        properties: {
          bookingId: {
            type: "string",
            description: "Unique ID of the booking",
          },
        },
        required: ["bookingId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_booking",
      description: "Reschedule an existing booking to a new date and time",
      parameters: {
        type: "object",
        properties: {
          bookingId: {
            type: "string",
            description: "Unique ID of the booking to reschedule",
          },
          newDate: {
            type: "string",
            description: "New date for the booking (YYYY-MM-DD format)",
          },
          newTime: {
            type: "string",
            description: "New time for the booking (HH:MM format)",
          },
        },
        required: ["bookingId", "newDate", "newTime"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_booking",
      description: "Cancel an existing booking",
      parameters: {
        type: "object",
        properties: {
          bookingId: {
            type: "string",
            description: "Unique ID of the booking to cancel",
          },
          reason: {
            type: "string",
            description: "Reason for cancellation",
          },
        },
        required: ["bookingId", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_user_profile",
      description: "Get the client's profile information",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_user_profile",
      description: "Update a field in the client's profile",
      parameters: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: ["firstName", "lastName", "address.physicalAddress"],
            description: "Field to update (case-sensitive)",
          },
          value: {
            type: "string",
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
];

module.exports = clientFunctions;
