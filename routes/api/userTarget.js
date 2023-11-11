const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const UserTarget = require("../../models/UserTarget");

// @route   GET api/userTarget
// @desc    Get all userTargets
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const userTargets = await UserTarget.find({ user: req.user.id }).sort({
      date: -1,
    });
    res.json(userTargets);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   POST api/userTarget
// @desc    Add new userTarget
// @access  Private
router.post("/", auth, async (req, res) => {
  const { userTargetData, year } = req.body;

  try {
    for (let data of userTargetData) {
      const newUserTarget = new UserTarget({
        userId: data._id,
        businessId: data.businessId,
        productsTargets: {
          year: year,
          target: {
            productId: data.productId,
            targetUnits: data.targetUnits,
            targetValue: data.targetValue,
          },
        },
      });
      await UserTarget.insertMany(newUserTarget);
    }

    return res.status(200).send({ message: "User Target Added Successfully" });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something Went wrong, please try again later",
    });
  }
});
