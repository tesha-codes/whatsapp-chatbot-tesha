const { registerNewUser } = require("./../Controllers/User.controllers");
const router = require('express').Router();

router.route("/user/registration").get(registerNewUser)

module.exports = router