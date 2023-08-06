const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BusinessSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  businessLogo: {
    type: String,
    required: true,
  },
  businessName: {
    type: String,
    required: true,
  },
  businessType: {
    type: String,
    required: true,
  },
  businessDescription: {
    type: String,
    required: true,
  },
  officeLocation: {
    type: String,
    required: true,
  },
  contactPerson: {
    type: String,
    required: true,
  },
  contactPersonEmail: {
    type: String,
    required: true,
  },
  contactNumber: {
    type: String,
    required: true,
  },
  businessOwner: {
    type: mongoose.Types.ObjectId,
    ref: "user",
  },
});

module.exports = Business = mongoose.model("business", BusinessSchema);
