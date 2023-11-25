const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PhasingSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "business",
  },
  phasingPercentage: {
    type: Array,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  addedIn: {
    type: Date,
    default: Date.now,
  },
  updatedIn: {
    type: Date,
    default: Date.now,
  },
});

module.exports = Phasing = mongoose.model("phasing", PhasingSchema);
