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
      // Validation rules
      const validations = {
        firstName: (val) =>
          val.length >= 2 ? null : "First name must be at least 2 characters",
        lastName: (val) =>
          val.length >= 2 ? null : "Last name must be at least 2 characters",
        description: (val) =>
          val.length >= 10
            ? null
            : "Description must be at least 10 characters",
        city: (val) =>
          val.length >= 2 ? null : "City must be at least 2 characters",
        "address.physicalAddress": (val) =>
          val.length >= 10 ? null : "Address must be at least 10 characters",
      };

      // Validate field name
      if (!validations.hasOwnProperty(field)) {
        throw new Error("Invalid field name");
      }

      // Validate field value
      const validationError = validations[field](value);
      if (validationError) {
        throw new Error(validationError);
      }

      // Prepare updates based on field
      let userUpdate = {};
      let serviceProviderUpdate = {};

      switch (field) {
        case "firstName":
        case "lastName":
          userUpdate[field] = value;
          break;
        case "description":
        case "city":
          serviceProviderUpdate[field] = value;
          break;
        case "address.physicalAddress":
          userUpdate["address.physicalAddress"] = value;
          // Add to location history
          userUpdate.$push = {
            locationHistory: {
              physicalAddress: value,
              timestamp: new Date(),
            },
          };
          break;
      }
      // Update user if needed
      if (Object.keys(userUpdate).length > 0) {
        const user = await User.findByIdAndUpdate(this.userId, userUpdate, {
          new: true,
        });
        if (!user) throw new Error("User not found");
      }

      // Update service provider if needed
      if (Object.keys(serviceProviderUpdate).length > 0) {
        const serviceProvider = await ServiceProvider.findOneAndUpdate(
          { user: this.userId },
          serviceProviderUpdate,
          { new: true }
        );
        if (!serviceProvider) throw new Error("Service provider not found");
      }

      return {
        field,
        value,
        message: "Profile updated successfully",
      };
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

module.exports = AccountManager;
