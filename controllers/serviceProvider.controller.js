const ServiceProvider = require("../models/serviceProvider.model");
const User = require("../models/user.model");

// Create service provider
const createServiceProvider = async (data) => {
  try {
    const user = await User.findById(data.user);
    if (!user) {
      throw new Error("User not found");
    }

    const existingProfile = await ServiceProvider.findOne({ user: data.user });
    if (existingProfile) {
      throw new Error("Service provider profile already exists for this user");
    }

    const newServiceProvider = new ServiceProvider(data);
    await newServiceProvider.save();
    return newServiceProvider;
  } catch (error) {
    console.error("Error creating service provider:", error);
    throw error;
  }
};

// Update service provider
const updateProvider = async (userId, data) => {
  try {
    const updatedProvider = await ServiceProvider.findOneAndUpdate(
      { user: userId },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!updatedProvider) {
      throw new Error("Service provider not found");
    }
    return updatedProvider;
  } catch (error) {
    console.error("Error updating service provider:", error);
    throw error;
  }
};

// Get provider
const getProvider = async (userId) => {
  try {
    const provider = await ServiceProvider.findOne({ user: userId })
      .populate("user", "phone firstName lastName")
      .populate("category", "name")
      .populate("service", "name")
      .populate("subscription", "name");

    if (!provider) {
      return { exists: false, profile: null };
    }
    return { exists: true, profile: provider };
  } catch (error) {
    console.error("Error getting service provider:", error);
    throw error;
  }
};

module.exports = {
  createServiceProvider,
  updateProvider,
  getProvider,
};
