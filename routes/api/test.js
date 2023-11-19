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

const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : config.get("STRIPE_SECRET_KEY");

const endpointSecret =
  process.env.NODE_ENV === "production"
    ? process.env.WEBHOOK_SECRET
    : config.get("DEVELOPMENT_WEBHOOK_SECRET");

const stripePublishableKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_PUBLISHABLE_KEY
    : config.get("STRIPE_PUBLISHABLE_KEY");

const stripe = require("stripe")(stripeSecretKey);

router.get("/", auth, async (req, res) => {
  res.status(200).send("API Running");
});

router.get("/:userId/:year", auth, async (req, res) => {
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
        $lookup: {
          from: "products",
          localField: "productsTargets.target.productId",
          foreignField: "_id",
          as: "product_details",
        },
      },
      {
        $unwind: "$product_details",
      },
      {
        $lookup: {
          from: "producttargets",
          localField: "product_details._id",
          foreignField: "productId",
          as: "product_target_details",
        },
      },
      {
        $unwind: "$product_target_details",
      },
      {
        $unwind: "$product_target_details.target.yearTarget",
      },
      {
        $match: {
          "product_target_details.target.year": parseInt(year),
        },
      },
      {
        $group: {
          _id: {
            userId: "$userId",
            businessId: "$businessId",
            productId: "$product_details._id",
          },
          currencyName: { $first: "$product_details.currencyName" },
          currencyCode: { $first: "$product_details.currencyCode" },
          currencySymbol: { $first: "$product_details.currencySymbol" },
          productsTarget: {
            $push: {
              productNickName: "$product_details.productNickName",
              costPrice: {
                $cond: {
                  if: {
                    $isArray: [
                      "$product_target_details.target.yearTarget.productPrice",
                    ],
                  },
                  then: {
                    $ifNull: [
                      {
                        $arrayElemAt: [
                          "$product_target_details.target.yearTarget.productPrice",
                          0,
                        ],
                      },
                      0,
                    ],
                  },
                  else: 0,
                },
              },
              retailPrice: "$product_details.retailPrice",
              target: {
                $map: {
                  input: "$product_target_details.target.yearTarget.month",
                  as: "month",
                  in: {
                    monthName: "$$month",
                    targetUnits: {
                      $cond: {
                        if: {
                          $isArray: ["$productsTargets.target.targetUnits"],
                        },
                        then: {
                          $multiply: [
                            {
                              $arrayElemAt: [
                                "$productsTargets.target.targetUnits",
                                0,
                              ],
                            },
                            "$product_target_details.target.yearTarget.targetPhases",
                            0.01,
                          ],
                        },
                        else: 0,
                      },
                    },
                    targetValue: {
                      $cond: {
                        if: {
                          $isArray: ["$productsTargets.target.targetValue"],
                        },
                        then: {
                          $multiply: [
                            {
                              $arrayElemAt: [
                                "$productsTargets.target.targetValue",
                                0,
                              ],
                            },
                            "$product_target_details.target.yearTarget.targetPhases",
                            0.01,
                          ],
                        },
                        else: 0,
                      },
                    },
                    monthPhasing:
                      "$product_target_details.target.yearTarget.targetPhases",
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          userId: "$_id.userId",
          businessId: "$_id.businessId",
          currencyName: 1,
          currencyCode: 1,
          currencySymbol: 1,
          productsTarget: 1,
        },
      },
    ]);

    if (!userTarget || userTarget.length === 0) {
      return res.status(404).send({ error: "No target found" });
    }

    return res.status(200).send({ userTarget });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
