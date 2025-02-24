const clientFunctions = [
    {
        type: "function",
        function: {
            name: "request_service",
            description: "Create a new service request for a client",
            parameters: {
                type: "object",
                properties: {
                    serviceType: {
                        type: "string",
                        description: "Type of service requested (e.g., plumbing, electrical, cleaning)",
                    },
                    description: {
                        type: "string",
                        description: "Detailed description of the service needed",
                    },
                    location: {
                        type: "string",
                        description: "Address or location where the service is needed",
                    },
                    preferredDate: {
                        type: "string",
                        description: "Preferred date for the service (YYYY-MM-DD format)",
                    },
                    preferredTime: {
                        type: "string",
                        description: "Preferred time for the service (HH:MM format)",
                    },
                },
                required: ["serviceType", "description", "location"],
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
            },
        },
    },
    {
        type: "function",
        function: {
            name: "view_service_providers",
            description: "Get a list of service providers based on service type and location",
            parameters: {
                type: "object",
                properties: {
                    serviceType: {
                        type: "string",
                        description: "Type of service (e.g., plumbing, electrical, cleaning)",
                    },
                    location: {
                        type: "string",
                        description: "Location or area where service is needed",
                    },
                },
                required: ["serviceType"],
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
            },
        },
    },
    {
        type: "function",
        function: {
            name: "schedule_booking",
            description: "Schedule a new service booking",
            parameters: {
                type: "object",
                properties: {
                    serviceProviderId: {
                        type: "string",
                        description: "ID of the selected service provider",
                    },
                    serviceType: {
                        type: "string",
                        description: "Type of service requested",
                    },
                    date: {
                        type: "string",
                        description: "Date for the booking (YYYY-MM-DD format)",
                    },
                    time: {
                        type: "string",
                        description: "Time for the booking (HH:MM format)",
                    },
                    location: {
                        type: "string",
                        description: "Address where service is needed",
                    },
                    description: {
                        type: "string",
                        description: "Description of the service needed",
                    },
                },
                required: ["serviceProviderId", "serviceType", "date", "time", "location"],
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
                        description: "Field to update (name, phone, email, address)",
                    },
                    value: {
                        type: "string",
                        description: "New value for the field",
                    },
                },
                required: ["field", "value"],
            },
        },
    },
];

module.exports = clientFunctions;