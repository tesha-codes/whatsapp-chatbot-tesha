const User = require("./../../models/user.model");
class UserProfileManager {
  constructor(userId) {
    this.userId = userId;
  }

  async getProfile() {
    try {
      const user = await User.findById(this.userId);
      if (!user) {
        throw new Error("User not found");
      }
      console.log('Retrieved user: ', user._id);
      
      return user;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw new Error("Failed to fetch user profile");
    }
  }
  //  update user profile
  async updateProfile(field, value) {
    try {
      const validations = {
        firstName: (val) =>
          val.length >= 2 ? null : "First name must be at least 2 characters",
        lastName: (val) =>
          val.length >= 2 ? null : "Last name must be at least 2 characters",
        "address.physicalAddress": (val) =>
          val.length >= 10 ? null : "Address must be at least 10 characters",
      };

      if (!validations[field]) {
        throw new Error("Invalid field name");
      }

      const validationError = validations[field](value);
      if (validationError) {
        throw new Error(validationError);
      }

      const userUpdate = {
        [field]: value,
      };

      if (field === "address.physicalAddress") {
        userUpdate.$push = {
          locationHistory: {
            physicalAddress: value,
            timestamp: new Date(),
          },
        };
      }
      const user = await User.findByIdAndUpdate(this.userId, userUpdate, {
        new: true,
      });
      if (!user) throw new Error("User not found");
      return {
        field,
        value,
        message: "Profile updated successfully",
      };
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  }
  //   delete user profile
  async deleteAccount(reason) {
    try {
      // Start a session for transaction
      const session = await User.startSession();
      session.startTransaction();
      try {
        // Delete user record
        await User.findByIdAndDelete(this.userId, { session });
        // TODO: delete all user records in redis cache
        // Commit transaction
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

      return true;
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  }
}

module.exports = UserProfileManager;
