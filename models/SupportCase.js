const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SupportCaseSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  userId: {
    type: mongoose.Types.ObjectId,
    required: true,
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
  },
  subject: {
    type: String,
    required: true,
  },
  message: {
    type: String,
  },
  status: {
    type: String,
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = SupportCase = mongoose.model("support", SupportCaseSchema);
