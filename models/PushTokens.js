const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PushTokenSchema = Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  token: {
    type: Array,
    required: true,
  },
});

module.exports = PushToken = mongoose.model("pushToken", PushTokenSchema);
