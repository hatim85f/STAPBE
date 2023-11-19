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

module.exports = router;
