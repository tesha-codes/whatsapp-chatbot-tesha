const User = require("../../models/user.model");
const ServiceProvider = require("../../models/serviceProvider.model");

class AccountManager {
  constructor(userId) {
    this.userId = userId;
  }

  async getProfile() {
    try {
      const [user, provider] = await Promise.all([
        User.findById(this.userId),
        ServiceProvider.findOne({ user: this.userId })
          .populate("category")
          .populate("service")
          .populate("subscription"),
      ]);

      if (!user || !provider) {
        throw new Error("Profile not found");
      }

      return {
        ...user.toObject(),
        provider: provider.toObject(),
      };
    } catch (error) {
      console.error("Error getting profile:", error);
      throw error;
    }
  }

  async updateProfile(field, value) {
    try {
      const restrictedFields = ["phone", "verified", "accountStatus"];
      if (restrictedFields.includes(field)) {
        throw new Error("Cannot update restricted field");
      }

      const updates = {};
      updates[field] = value;

      const user = await User.findByIdAndUpdate(
        this.userId,
        { $set: updates },
        { new: true }
      );

      if (!user) {
        throw new Error("User not found");
      }

      return user;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  }

  async deleteAccount(reason) {
    try {
      // Start a session for transaction
      const session = await User.startSession();
      session.startTransaction();

      try {
        // Delete service provider record
        await ServiceProvider.findOneAndDelete(
          { user: this.userId },
          { session }
        );

        // Delete user record
        await User.findByIdAndDelete(this.userId, { session });

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

module.exports = AccountManager;
