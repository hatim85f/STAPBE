const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PartnerSchema = Schema({
  business: {
    type: mongoose.Types.ObjectId,
    ref: "business",
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  DOB: {
    type: Date,
    required: true,
  },
  idDetails: [
    {
      idType: {
        type: String,
        required: true,
        enum: ["Passport", "National ID"],
      },
      idImage: {
        type: String,
        required: true,
      },
      idNumber: {
        type: String,
        required: true,
      },
      idExpire: {
        type: Date,
        required: true,
      },
    },
  ],
  bankDetails: [
    {
      bankName: {
        type: String,
        required: true,
      },

      bankIBAN: {
        type: String,
        required: true,
      },
    },
  ],
  percentage: {
    type: Number,
    required: true,
  },
  investementAmount: {
    type: Number,
    required: true,
  },
  dateOfStart: {
    type: Date,
    required: true,
    default: Date.now,
  },
  responsibilities: {
    type: Array,
  },
});

module.exports = Partner = mongoose.model("partner", PartnerSchema);
