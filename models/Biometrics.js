const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const BiometricSchema = Schema({
  _id: {
    type: mongoose.Types.ObjectId,
  },
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "user",
    unique: true,
  },
  biometricReference: {
    type: String,
  },
});

module.exports = Biometric = mongoose.model("biometric", BiometricSchema);
