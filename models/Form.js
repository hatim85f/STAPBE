const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FormSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Types.ObjectId,
    ref: "users",
  },
});

module.exports = Form = mongoose.model("from", FormSchema);
