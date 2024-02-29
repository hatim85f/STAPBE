const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const auth = require("../../middleware/auth");

router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const notifications = await Notification.aggregate([
      {
        $match: {
          to: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "from",
          foreignField: "_id",
          as: "from",
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          message: 1,
          route: 1,
          webRoute: 1,
          isOpened: 1,
          from: { $arrayElemAt: ["$from.userName", 0] },
        },
      },
    ]);

    return res.status(200).json({ notifications });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// save user notification push token to user document

router.post("/", auth, async (req, res) => {
  const { to, title, message, route, webRoute, from } = req.body;
  try {
    const newNotication = new Notification({
      to,
      title,
      message,
      route,
      webRoute,
      from,
    });

    await Notification.insertMany(newNotication);

    return res.status(200).json({ message: "Notification sent" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/:notificationId", auth, async (req, res) => {
  const { notificationId } = req.params;
  try {
    await Notification.updateOne({ _id: notificationId }, { isOpened: true });

    return res.status(200).json({ message: "Notification opened" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/:notificationId", auth, async (req, res) => {
  const { notificationId } = req.params;
  try {
    await Notification.deleteOne({ _id: notificationId });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
