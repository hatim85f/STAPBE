const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CurrencySchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
  },
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "user",
  },
  currency: {
    type: String,
    required: true,
  },
});

module.exports = Currency = mongoose.model("currency", CurrencySchema);
