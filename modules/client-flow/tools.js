module.exports = [
    {
        type: "function",
        function: {
            name: "create_service_request",
            description: "Initiate service booking process",
            parameters: {
                type: "object",
                properties: {
                    service_type: {
                        type: "string",
                        enum: ["cleaning", "handyman", "childcare", "moving"],
                        description: "Type of service requested"
                    },
                    description: {
                        type: "string",
                        description: "Detailed service requirements"
                    },
                    coordinates: {
                        type: "object",
                        description: "Location coordinates"
                    },
                    address: {
                        type: "string",
                        description: "Physical service address"
                    },
                    confirmation: {
                        type: "boolean",
                        description: "Booking confirmation"
                    }
                },
                required: [],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "view_booking_requests",
            description: "View client service bookings",
            parameters: {
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        enum: ["pending", "confirmed", "completed", "cancelled"]
                    }
                },
                required: [],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "update_client_profile",
            description: "Update client profile information",
            parameters: {
                type: "object",
                properties: {
                    field: {
                        type: "string",
                        enum: ["firstName", "lastName", "address"]
                    },
                    value: {
                        type: "string"
                    }
                },
                required: ["field", "value"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_client_account",
            description: "Delete client account",
            parameters: {
                type: "object",
                properties: {
                    confirmation: {
                        type: "boolean"
                    },
                    reason: {
                        type: "string"
                    }
                },
                required: ["confirmation"],
                additionalProperties: false
            }
        }
    }
];