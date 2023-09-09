const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const Business = require("../../models/Business");
const { default: mongoose } = require("mongoose");
const Products = require("../../models/Products");

router.get("/", auth, async (req, res) => {
  res.status(200).send("API Running");
});

router.get("/business", auth, async (req, res) => {
  try {
    let userObjId = new mongoose.Types.ObjectId(req.query.userId);

    console.log(userObjId);
    const userBusiness = await BusinessUsers.aggregate([
      {
        $match: {
          userId: userObjId,
          isBusinessOwner: true,
        },
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
        $project: {
          business: 1,
        },
      },
    ]);

    return res.status(200).send({ userBusiness });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.put("/", async (req, res) => {
  const users = await User.updateMany({}, { $set: { isActivated: true } });

  return res.status(200).send({ users });
});

router.put("/business", async (req, res) => {
  const { businessId, currencyCode, currencyName, currencySymbol } = req.body;

  try {
    // check and find the product under the same businessId
    // $set the currencyCode, currencyName, currencySymbol

    const business = await Business.findOne({ _id: businessId });

    const product = await Products.find({ businessId: businessId });

    // coming products are array of products

    const updatedProducts = await Products.updateMany(
      { businessId: businessId },
      {
        $set: {
          currencyCode: business.currencyCode,
          currencyName: business.currencyName,
          currencySymbol: business.currencySymbol,
        },
      }
    );
    return res.status(200).send({ updatedProducts });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
