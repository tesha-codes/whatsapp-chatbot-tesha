const openai = require('./../../config/openai')
const { StatusCodes } = require("http-status-codes");
const ClientTools = require("./tools");
const { getBookings, createServiceRequest } = require("../../controllers/request.controller");
const { updateUser, deleteUser } = require("../../controllers/user.controllers");

class ClientChatHandler {
    constructor(phone, userId, session) {
        this.phone = phone;
        this.userId = userId;
        this.session = session;
        this.openai = openai
        this.tools = ClientTools;
    }

    async processMessage(message) {
        try {
            const runner = this.openai.beta.chat.completions.runTools({
                model: "gpt-4-1106-preview",
                messages: [{
                    role: "system",
                    content: `You are a service request assistant. Current user: ${this.userId}. ` +
                        "Handle: service creation (category must match exactly), profile updates, " +
                        "booking views, and account deletion. Be concise and professional."
                }, {
                    role: "user",
                    content: message
                }],
                tools: this.tools,
                tool_choice: "auto"
            });

            let finalResponse = null;

            for await (const step of runner) {
                if (step.event === "toolCall") {
                    const toolCall = step.data;
                    try {
                        // Fix: Parse arguments properly
                        const args = JSON.parse(toolCall.function.arguments); // 🚨 Was missing!

                        switch (toolCall.function.name) {
                            case 'create_service_request':
                                response = await this.handleCreateServiceRequest(args);
                                break;
                            case 'view_booking_requests':
                                response = await this.handleViewBookings(args);
                                break;
                            case 'update_client_profile':
                                response = await this.handleProfileUpdate(args);
                                break;
                            case 'delete_client_account':
                                response = await this.handleAccountDeletion(args);
                                break;
                        }
                    } catch (error) {
                        console.error(`Tool ${toolCall.function.name} error:`, error);
                        response = this._formatError("Invalid request format");
                    }
                }
            }
            return finalResponse || this._formatResponse(
                StatusCodes.OK,
                await runner.finalContent(),
                null
            );

        } catch (error) {
            console.error("Chat processing error:", error);
            return this._formatError("Internal server error");
        }
    }

    async handleCreateServiceRequest(args) {
        try {
            if (!args.service_description || args.service_description.length < 10) {
                return this._formatError(
                    "Service description must be at least 10 characters",
                    StatusCodes.BAD_REQUEST
                );
            }

            if (!ClientTools[0].function.parameters.properties.category.enum.includes(args.category)) {
                return this._formatError(
                    "Invalid service category. Please choose from: " +
                    ClientTools[0].function.parameters.properties.category.enum.join(", "),
                    StatusCodes.BAD_REQUEST
                );
            }

            const booking = await createServiceRequest({
                userId: this.userId,
                description: args.service_description,
                category: args.category
            });

            return this._formatResponse(
                StatusCodes.CREATED,
                "Service request created successfully! 🎉",
                {
                    bookingId: booking._id,
                    status: booking.status,
                    category: booking.category
                }
            );

        } catch (error) {
            console.error("Service request error:", error);
            return this._formatError("Failed to create service request");
        }
    }

    async handleViewBookings(args) {
        try {
            const validStatuses = ClientTools[1].function.parameters.properties.status.enum;
            const statusFilter = validStatuses.includes(args?.status) ? args.status : undefined;

            const bookings = await getBookings(this.userId, statusFilter);

            return this._formatResponse(
                StatusCodes.OK,
                bookings.length ? "Your bookings:" : "No bookings found",
                bookings.map(b => ({
                    id: b._id,
                    description: b.description,
                    status: b.status,
                    created: b.createdAt
                }))
            );

        } catch (error) {
            console.error("Booking retrieval error:", error);
            return this._formatError("Failed to retrieve bookings");
        }
    }

    async handleProfileUpdate(args) {
        try {
            const allowedFields = ClientTools[2].function.parameters.properties.field.enum;

            if (!allowedFields.includes(args.field)) {
                return this._formatError(
                    `Invalid field. Allowed fields: ${allowedFields.join(", ")}`,
                    StatusCodes.BAD_REQUEST
                );
            }

            if (args.value.length > 100) {
                return this._formatError(
                    "Field value too long (max 100 characters)",
                    StatusCodes.BAD_REQUEST
                );
            }

            await updateUser(
                { _id: this.userId },
                { [args.field]: args.value }
            );

            return this._formatResponse(
                StatusCodes.OK,
                "Profile updated successfully! ✅",
                { [args.field]: args.value }
            );

        } catch (error) {
            console.error("Profile update error:", error);
            return this._formatError("Failed to update profile");
        }
    }

    async handleAccountDeletion(args) {
        try {
            if (!this.session.confirmingDeletion) {
                // First step - request confirmation
                await setSession(this.phone, {
                    ...this.session,
                    confirmingDeletion: true
                });
                return this._formatResponse(
                    StatusCodes.OK,
                    "⚠️ Are you sure you want to delete your account? This cannot be undone. " +
                    "Please confirm by typing 'CONFIRM DELETE ACCOUNT'."
                );
            }

            if (!args.confirmation || args.reason?.length < 10) {
                await setSession(this.phone, {
                    ...this.session,
                    confirmingDeletion: false
                });
                return this._formatError(
                    "Deletion cancelled. Reason must be at least 10 characters.",
                    StatusCodes.BAD_REQUEST
                );
            }

            await deleteUser(this.userId);
            return this._formatResponse(
                StatusCodes.OK,
                "Account deleted successfully. We're sorry to see you go 😢",
                { reason: args.reason }
            );

        } catch (error) {
            console.error("Account deletion error:", error);
            return this._formatError("Failed to delete account");
        }
    }

    _formatResponse(status, message, data) {
        return {
            status,
            message,
            data,
            timestamp: new Date().toISOString()
        };
    }

    _formatError(errorMessage, status = StatusCodes.INTERNAL_SERVER_ERROR) {
        return this._formatResponse(
            status,
            `⚠️ Error: ${errorMessage}`,
            null
        );
    }
}

module.exports = ClientChatHandler;