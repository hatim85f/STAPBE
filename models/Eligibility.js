const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const EligibilitySchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  userId: {
    type: mongoose.Types.ObjectId,
    required: true,
  },
  businesses: {
    type: Number,
    required: true,
  },
  teamMembers: {
    type: Number,
    required: true,
  },
  admins: {
    type: Number,
    required: true,
  },
  products: {
    type: Number,
    required: true,
  },
  clients: {
    type: Number,
    required: true,
  },
});

module.exports = Eligibility = mongoose.model("eligibility", EligibilitySchema);