const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const verifyEmail = Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "user",
  },
  verifyCode: String,
  verifyCodeExpiration: Date,
});

module.exports = verify = mongoose.model("verify", verifyEmail);
