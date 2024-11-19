const { registerNewUser } = require("../models/user.model");
const router = require('express').Router();

router.route("/user/registration").get(registerNewUser);

module.exports = router