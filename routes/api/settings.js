const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessCurrency = require("../../models/BusinessCurrency");
const { default: mongoose } = require("mongoose");
const BusinessUsers = require("../../models/BusinessUsers");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// @Post api/settings
// @desc update business currency
// @access Private
router.post("/", auth, async (req, res) => {
  const { userId, currencyDetails } = req.body;

  const { currencyCode, currencySymbol, currencyName } = currencyDetails;

  try {
    const userBusiness = await BusinessUsers.find({ userId: userId });

    // loop through the business array and update the currency
    // save the currency in businessCurrency collection

    for (let i = 0; i < userBusiness.length; i++) {
      const businessId = userBusiness[i].businessId;

      // check if has the same BusinessCurrency already exists update, else create new
      const businessCurrency = await BusinessCurrency.findOne({
        businessId: businessId,
      });

      if (businessCurrency) {
        businessCurrency.currency = currencyName;
        businessCurrency.currencySymbol = currencySymbol;
        businessCurrency.currencyCode = currencyCode;
        await businessCurrency.save();
      } else {
        const newBusinessCurrency = new BusinessCurrency({
          _id: new mongoose.Types.ObjectId(),
          businessId: businessId,
          userId: userId,
          currency: currencyName,
          currencySymbol: currencySymbol,
          currencyCode: currencyCode,
        });
        await newBusinessCurrency.insertMany(newBusinessCurrency);
      }
    }

    return res.status(200).send({ message: "Currency updated successfully" });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// @Put api/settings
// @desc update user password
// @access Private
router.put("/", auth, async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res
        .status(500)
        .send({ error: "Error", message: "User not found" });
    }

    // check if old password is correct
    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res
        .status(500)
        .send({ error: "Error", message: "Old password is incorrect" });
    }

    // hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // update password
    user.password = hashedPassword;
    await user.save();

    return res.status(200).send({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// @Put api/settings
// deactivated user account
// @access Private
router.put("/deactivate", auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res
        .status(500)
        .send({ error: "Error", message: "User not found" });
    }

    // deactivate user by changing the isActivated to false

    user.isActivated = false;
    await user.save();

    return res
      .status(200)
      .send({
        message:
          "We are sorry to see you leaving, user deactivated successfully",
      });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
