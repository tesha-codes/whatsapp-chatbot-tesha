const User =  require("./../../models/user.model")
class UserProfileManager {
    constructor(userId) {
        this.userId = userId;
    }

    async getProfile() {
        try {
            
            return {
                name: "Jane Doe",
                phone: "+263 71 123 4567",
                email: "jane.doe@example.com",
                address: "45 Park Avenue, Harare",
                defaultLocation: "Harare Central",
                memberSince: "January 2023"
            };
        } catch (error) {
            console.error("Error fetching user profile:", error);
            throw new Error("Failed to fetch user profile");
        }
    }

    async updateProfile(field, value) {
        try {
            const validFields = ["name", "phone", "email", "address", "defaultLocation"];
            if (!validFields.includes(field)) {
                throw new Error(`Invalid field: ${field}`);
            }

            console.log(`Updating user ${this.userId} profile field ${field} to ${value}`);

            await User.updateOne({
                id: this.userId,
                [field]: value
            });

            return {
                field,
                value,
                success: true
            };
        } catch (error) {
            console.error("Error updating user profile:", error);
            throw new Error(`Failed to update user profile: ${error.message}`);
        }
    }
}

module.exports = UserProfileManager;