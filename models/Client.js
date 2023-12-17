const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ClientSchema = new Schema({
  _id: mongoose.Types.ObjectId,
  clientName: {
    type: String,
    required: true,
  },
  businessId: {
    type: mongoose.Types.ObjectId,
    ref: "business",
    required: true,
  },
  clientType: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  contactPerson: {
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
  },
  logoURL: {
    type: String,
    default:
      "https://img.freepik.com/premium-vector/client-concept-2-colored-icon-simple-blue-element-illustration-client-concept-symbol-design-can-be-used-web-mobile-ui-ux_159242-4118.jpg", // Optional field for client logo URL
  },
  personInHandleId: {
    type: mongoose.Types.ObjectId,
    ref: "user",
  },
  personInHandle: {
    type: String,
    required: true,
  },
  // Additional fields as needed
});

module.exports = Client = mongoose.model("client", ClientSchema);
