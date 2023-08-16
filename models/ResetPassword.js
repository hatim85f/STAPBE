const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ResetPasswordSchema = Schema({
  resetCode: String,
  resetCodeExpiration: Date,
});

module.exports = ResetPassword = mongoose.model(
  "resetPassword",
  ResetPasswordSchema
);
