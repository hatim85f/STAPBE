const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const Business = require("../../models/Business");
const { default: mongoose } = require("mongoose");
const Products = require("../../models/Products");
const config = require("config");
const createStripeSignatureHeader = require("../../modules/createStripeSignatureHeader");
const bodyParser = require("body-parser");
const Package = require("../../models/Package");
const moment = require("moment");
const Subscription = require("../../models/Subscription");
const MemberShip = require("../../models/MemberShip");
const Payment = require("../../models/Payment");
const Client = require("../../models/Client");
const UserTarget = require("../../models/UserTarget");
const ProductTarget = require("../../models/ProductTarget");

router.get("/:businessId/:year", auth, async (req, res) => {
  const { businessId, year } = req.params;

  try {
    const businessTarget = await ProductTarget.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
        },
      },
      {
        $unwind: "$target",
      },
      {
        $match: {
          "target.year": parseInt(year),
        },
      },
      {
        $project: {
          value: "$target.totalValue",
        },
      },
    ]);

    const businessTargetValue = businessTarget
      .map((a) => a.value)
      .reduce((a, b) => a + b, 0);

    return res.status(200).json(businessTarget);
  } catch (error) {
    return res.status(500).json({ msg: "Server Error" });
  }
});

router.get("/userTarget/:userId/:year", auth, async (req, res) => {
  const { userId, year } = req.params;

  try {
    const userTarget = await UserTarget.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $unwind: "$productsTargets",
      },
      {
        $match: {
          "productsTargets.year": parseInt(year),
        },
      },
      {
        $project: {
          value: "$productsTargets.target.targetValue",
        },
      },
    ]);

    const repValue = userTarget[0]?.value.reduce((a, b) => a + b, 0);

    const business = await BusinessUsers.findOne({ userId });

    const productsTarget = await ProductTarget.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(business.businessId),
        },
      },
      {
        $unwind: "$target",
      },
      {
        $match: {
          "target.year": parseInt(year),
        },
      },
      {
        $project: {
          value: "$target.totalValue",
        },
      },
    ]);

    const businessValue = productsTarget
      .map((a) => a.value)
      .reduce((a, b) => a + b, 0);

    const targetForRep = businessValue * 0.28;
    const difference = targetForRep - repValue;

    const percent = (repValue / businessValue) * 100;

    return res.status(200).json({
      repValue,
      businessValue,
      // targetForRep,
      difference,
      percent,
      // businessId: business.businessId,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/:businessId", auth, async (req, res) => {
  const { businessId } = req.params;

  try {
    await UserTarget.deleteMany({
      businessId: new mongoose.Types.ObjectId(businessId),
    });

    return res
      .status(200)
      .json({ message: "User targets deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
