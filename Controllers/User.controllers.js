const User = require("../models/user.model");
// create user
const createUser = async (data) => {
  const user = await User.findOne({ phone: data.phone });
  if (!user) {
    const newUser = new User({ ...data });
    await newUser.save();
  }
};
// get user
const getUser = async (phone) => {
  return await User.findOne(
    { phone },
    { phone: 1, termsAndConditionsAccepted: 1, accountType: 1 }
  );
};

module.exports = {
  createUser,
  getUser,
};
