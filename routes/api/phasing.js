const express = require("express");
const router = express.Router();
const Phasing = require("../../models/Phasing");
const auth = require("../../middleware/auth");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const BusinessUsers = require("../../models/BusinessUsers");
const { default: mongoose } = require("mongoose");
const User = require("../../models/User");
const SupportCase = require("../../models/SupportCase");

router.get("/:userId", auth, async (req, res) => {
  const userId = req.params.userId;

  try {
    // const business = await BusinessUsers.find({ userId });

    // const businessIds = business.map((business) => business.businessId);

    // const phasing = await Phasing.find({ businessId: { $in: businessIds } });

    const phasing = await BusinessUsers.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "phasings",
          localField: "businessId",
          foreignField: "businessId",
          as: "phasing",
        },
      },
      {
        $unwind: "$phasing",
      },
      {
        $lookup: {
          from: "businesses",
          localField: "businessId",
          foreignField: "_id",
          as: "business",
        },
      },
      {
        $unwind: "$business",
      },
      {
        $project: {
          _id: "$phasing._id",
          businessId: "$business._id",
          phasingPercentage: "$phasing.phasingPercentage",
          businessName: "$business.businessName",
          addedIn: "$phasing.addedIn",
          updatedIn: "$phasing.updatedIn",
          businessLogo: "$business.businessLogo",
          phasingName: "$phasing.name",
        },
      },
    ]);

    if (!phasing) {
      return res
        .status(400)
        .json({ error: "Error", message: "No phasing data found" });
    }

    return res.status(200).json({ phasing });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: "Server error" });
  }
});

router.post("/", auth, isCompanyAdmin, async (req, res) => {
  const { userId, phasingData, name } = req.body;

  const business = await BusinessUsers.findOne({
    userId,
    isBusinessOwner: true,
  });

  try {
    if (!phasingData) {
      return res
        .status(400)
        .json({ error: "Error", message: "Missing Phasing Details" });
    }

    const newPhasing = new Phasing({
      businessId: business.businessId,
      phasingPercentage: phasingData,
      name,
    });

    await Phasing.insertMany(newPhasing);

    return res.status(200).json({ message: "Phasing data added successfully" });
  } catch (error) {
    const user = await User.findOne({ _id: userId });
    const newSupportCase = new SupportCase({
      userId,
      email: user.email,
      businessId: business.businessId,
      subject: "Error Creating Phasing Data",
      message: error.message,
    });

    await SupportCase.insertMany(newSupportCase);
    return res.status(500).json({
      error: "Error",
      message: "Something Went Wrong, Please try again later",
    });
  }
});

router.delete("/", auth, async (req, res) => {
  const { phasingId } = req.body;

  try {
    await Phasing.deleteOne({ _id: phasingId });

    return res
      .status(200)
      .send({ message: "Phasing data deleted successfully" });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: "Server error" });
  }
});

module.exports = router;
