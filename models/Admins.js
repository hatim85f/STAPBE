const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// schema for admins creation, edit, delete
// need to add authority for admin as per role

const AdminsSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    lowercase: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: "Viewer",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = Admins = mongoose.model("admins", AdminsSchema);
