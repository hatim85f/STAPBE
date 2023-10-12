const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ChecksSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  checkType: {
    type: String,
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  checkStatus: {
    type: String,
    required: true,
  },
  timeTaken: {
    type: Number,
    required: true,
  },
  haveUpadated: {
    type: Boolean,
    required: true,
  },
  numberOfUpdates: {
    type: Number,
    required: true,
  },
});

module.exports = Checks = mongoose.model("checks", ChecksSchema);
