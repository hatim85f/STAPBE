const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const PushToken = require("../../models/PushTokens");
const auth = require("../../middleware/auth");

router.post("/", auth, async (req, res) => {
  const { userId, token } = req.body;

  try {
    const newPushToken = await new PushToken({
      user: userId,
      token: token,
    });

    return res.status(200).send({
      message:
        "Your device has been registered to receive push notifications, if you don't want to receive notifications, please disable it in the settings.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
