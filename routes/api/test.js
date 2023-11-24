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

router.get("/teamTarget/:userId/:year", auth, async (req, res) => {
  const { userId, year } = req.params;

  try {
    const userTeam = await BusinessUsers.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isBusinessOwner: true,
        },
      },
      {
        $lookup: {
          from: "businessusers",
          localField: "businessId",
          foreignField: "businessId",
          as: "businessUsers",
        },
      },
      {
        $unwind: "$businessUsers",
      },
      {
        $match: {
          "businessUsers.isBusinessOwner": false,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "businessUsers.userId",
          foreignField: "_id",
          as: "users",
        },
      },
      {
        $unwind: "$users",
      },
      {
        $lookup: {
          from: "usertargets",
          localField: "users._id",
          foreignField: "userId",
          as: "userTarget",
        },
      },
      {
        $unwind: "$userTarget",
      },
      {
        $unwind: "$userTarget.productsTargets",
      },
      {
        $match: {
          "userTarget.productsTargets.year": parseInt(year),
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "userTarget.productsTargets.target.productId",
          foreignField: "_id",
          as: "products",
        },
      },
      {
        $lookup: {
          from: "producttargets",
          localField: "userTarget.productsTargets.target.productId",
          foreignField: "productId",
          as: "productTarget",
        },
      },
      {
        $unwind: "$productTarget",
      },
      {
        $unwind: "$productTarget.target",
      },
      {
        $match: {
          "productTarget.target.year": parseInt(year),
        },
      },
      {
        $project: {
          _id: "$users._id",
          userName: "$users.userName",
          profilePicture: "$users.profilePicture",
          userType: "$users.userType",
          businessId: "$businessUsers.businessId",
          target: {
            currencyName: { $arrayElemAt: ["$products.currencyName", 0] },
            currencyCode: { $arrayElemAt: ["$products.currencyCode", 0] },
            currencySymbol: { $arrayElemAt: ["$products.currencySymbol", 0] },
            totalValue: {
              $reduce: {
                input: "$userTarget.productsTargets.target",
                initialValue: 0,
                in: {
                  $sum: ["$$value", "$$this.targetValue"],
                },
              },
            },
            productsTarget: {
              $map: {
                input: "$userTarget.productsTargets.target",
                as: "target",
                in: {
                  productId: "$$target.productId",
                  productNickName: {
                    $arrayElemAt: [
                      "$products.productNickName",
                      {
                        $indexOfArray: ["$products._id", "$$target.productId"],
                      },
                    ],
                  },
                  totalUnits: "$$target.targetUnits",
                  totalValue: "$$target.targetValue",
                  costPrice: {
                    $arrayElemAt: [
                      "$products.costPrice",
                      {
                        $indexOfArray: ["$products._id", "$$target.productId"],
                      },
                    ],
                  },
                  retailPrice: {
                    $arrayElemAt: [
                      "$products.retailPrice",
                      {
                        $indexOfArray: ["$products._id", "$$target.productId"],
                      },
                    ],
                  },
                  startPeriod: {
                    $arrayElemAt: [
                      "$productTarget.target.yearTarget.startPeriod",
                      {
                        $indexOfArray: [
                          "$productTarget.target.yearTarget.month",
                          "$$target.monthName",
                        ],
                      },
                    ],
                  },
                  endPeriod: {
                    $arrayElemAt: [
                      "$productTarget.target.yearTarget.endPeriod",
                      {
                        $indexOfArray: [
                          "$productTarget.target.yearTarget.month",
                          "$$target.monthName",
                        ],
                      },
                    ],
                  },
                  addedIn: {
                    $arrayElemAt: [
                      "$productTarget.target.yearTarget.addedIn",
                      {
                        $indexOfArray: [
                          "$productTarget.target.yearTarget.month",
                          "$$target.monthName",
                        ],
                      },
                    ],
                  },
                  updatedIn: {
                    $arrayElemAt: [
                      "$productTarget.target.yearTarget.updatedIn",
                      {
                        $indexOfArray: [
                          "$productTarget.target.yearTarget.month",
                          "$$target.monthName",
                        ],
                      },
                    ],
                  },
                  target: {
                    $map: {
                      input: "$productTarget.target.yearTarget",
                      as: "yearTarget",
                      in: {
                        monthName: "$$yearTarget.month",
                        targetUnits: {
                          $multiply: [
                            "$$target.targetUnits",
                            {
                              $divide: [
                                {
                                  $toDouble: {
                                    $replaceOne: {
                                      input: "$$yearTarget.targetPhases",
                                      find: "%",
                                      replacement: "",
                                    },
                                  },
                                },
                                100,
                              ],
                            },
                          ],
                        },
                        targetValue: {
                          $trunc: {
                            $multiply: [
                              "$$target.targetValue",
                              {
                                $divide: [
                                  {
                                    $toDouble: {
                                      $replaceOne: {
                                        input: "$$yearTarget.targetPhases",
                                        find: "%",
                                        replacement: "",
                                      },
                                    },
                                  },
                                  100,
                                ],
                              },
                            ],
                          },
                        },
                        monthPhasing: "$$yearTarget.targetPhases",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      {
        $group: {
          _id: "$_id",
          userName: { $first: "$userName" },
          profilePicture: { $first: "$profilePicture" },
          userType: { $first: "$userType" },
          businessId: { $first: "$businessId" },
          target: {
            $first: "$target",
          },
        },
      },
    ]);

    // let finalTeam = [];
    // for (let data of userTeam) {
    //   const prodcutsTarget = data.target.map((a) => a.productsTarget).flat(1);

    //   finalTeam.push({
    //     _id: data._id,
    //     userName: data.userName,
    //     profilePicture: data.profilePicture,
    //     userType: data.userType,
    //     businessId: data.businessId,
    //     target: {
    //       currencyName: data.target[0].currencyName,
    //       currencyCode: data.target[0].currencyCode,
    //       currencySymbol: data.target[0].currencySymbol,
    //       totalValue: prodcutsTarget.reduce((a, b) => a + b.totalValue, 0),
    //       productsTarget: prodcutsTarget,
    //     },
    //   });
    // }

    return res.status(200).json({
      userTeam: userTeam.sort(
        (a, b) => a.target.totalValue - b.target.totalValue
      ),
    });
  } catch (error) {
    return res
      .status(500)
      .send({ error: "Error in server", message: error.message });
  }
});

module.exports = router;
