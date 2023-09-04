const express = require("express");
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const { default: mongoose } = require("mongoose");
const router = express.Router();

// @route   GET api/profile
// @desc    Test route
// @access  Public

// get user profile
// userName, phone, email, designation, phoneVerified, mailVerified, from users collection
// number of businesses, and details of businesses from businesses collection
// number of team members, from businessUsers collection
router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const userProfile = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "businessusers",
          localField: "_id",
          foreignField: "userId",
          as: "user_business",
        },
      },
      {
        $lookup: {
          from: "businesses",
          localField: "user_business.businessId",
          foreignField: "_id",
          as: "business",
        },
      },

      {
        $project: {
          _id: 1,
          userName: 1,
          profilePicture: 1,
          phone: 1,
          email: 1,
          designation: 1,
          phoneVerified: 1,
          emailVerified: 1,
          business: 1,
          numberOfBusinesses: { $size: "$business" },
        },
      },
    ]);

    return res.status(200).json({ userProfile });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
