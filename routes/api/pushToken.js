const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const PushToken = require("../../models/PushTokens");
const auth = require("../../middleware/auth");

router.post("/", auth, async (req, res) => {
  const { userId, token } = req.body;

  try {
    // check if the user has a push token reigestered
    const userToken = await PushToken.findOne({ user: userId });

    if (userToken) {
      await PushToken.updateMany(
        { user: userId },
        {
          $addToSet: {
            token: token,
          },
        }
      );
    } else {
      const newPushToken = await new PushToken({
        user: userId,
        token: token,
      });

      await PushToken.insertMany(newPushToken);
    }

    return res.status(200).send({
      message:
        "Your device has been registered to receive push notifications, if you don't want to receive notifications, please disable it in the settings.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
