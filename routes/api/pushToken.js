const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const PushToken = require("../../models/PushTokens");
const auth = require("../../middleware/auth");

router.post("/", auth, async (req, res) => {
  const { userId, token } = req.body;

  try {
    // check if the user has a push token registered
    const userToken = await PushToken.findOne({ user: userId });

    if (userToken) {
      if (userToken.token === token) {
        // Token already exists, no need to update
        return res.status(200).end(); // Send an empty response
      } else {
        // Add the new token to the user's list of tokens
        await PushToken.updateMany(
          { user: userId },
          {
            $addToSet: {
              token: token,
            },
          }
        );
        return res.status(200).send({
          message:
            "Your new device has been registered to receive push notifications. If you don't want to receive notifications, please disable it in the settings.",
        });
      }
    } else {
      // Create a new PushToken document for the user
      const newPushToken = await new PushToken({
        user: userId,
        token: token,
      });

      // Insert the new PushToken document
      await PushToken.insertMany([newPushToken]);
      return res.status(200).send({
        message:
          "Your device has been registered to receive push notifications. If you don't want to receive notifications, please disable it in the settings.",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
