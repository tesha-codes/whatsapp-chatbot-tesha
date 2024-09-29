const User = require("../models/user.model");
// create user
const createUser = async (data) => {
  try {
    const user = await User.findOne({ phone: data.phone });
    if (!user) {
      const newUser = new User(data);
      await newUser.save();
      return newUser;
    }
    return user;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};
// get user
const getUser = async (phone) => {
  try {
    const user = await User.findOne(
      { phone },
      { phone: 1, termsAndConditionsAccepted: 1, accountType: 1 }
    );
    return user;
  } catch (error) {
    console.error("Error getting user:", error);
    throw error;
  }
};
// update user
const updateUser = async (data) => {
  try {
    const updatedUser = await User.findOneAndUpdate(
      { phone: data.phone },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!updatedUser) {
      throw new Error("User not found");
    }
    return updatedUser;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
};

const onGetUserByPhone = 

module.exports = {
  createUser,
  getUser,
  updateUser,
};
