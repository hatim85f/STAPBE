const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BusinessUsersSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  userId: {
    type: mongoose.Types.ObjectId,
    required: true,
  },
  isBusinessOwner: {
    type: Boolean,
    default: false,
  },
});

module.exports = BusinessUsers = mongoose.model(
  "businessUsers",
  BusinessUsersSchema
);
