const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = Schema({
  userName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },

  profilePicture: {
    type: String,
    default: "https://i.imgur.com/2WZtV3H.png",
  },
  DOB: {
    type: String,
  },
  joiningDate: {
    type: String,
  },
  userType: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  password: {
    type: String,
    required: true,
  },
  biometricEnabled: {
    type: Boolean,
    default: false,
  },
  designation: {
    type: String,
    required: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  isAuthorized: {
    type: Boolean,
    default: false,
  },
  authority: {
    type: Array,
  },
  isActivated: {
    type: Boolean,
    default: false,
  },
});

module.exports = User = mongoose.model("user", UserSchema);
