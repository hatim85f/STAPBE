const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const NotificationSchema = {
  to: {
    type: Schema.Types.ObjectId,
    ref: "user",
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  route: {
    type: String,
  },
  webRoute: {
    type: String,
  },
  from: {
    type: Schema.Types.ObjectId,
    ref: "user",
  },
  isOpened: {
    type: Boolean,
    default: false,
  },
};

module.exports = Notification = mongoose.model(
  "notification",
  NotificationSchema
);
