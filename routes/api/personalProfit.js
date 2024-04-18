const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const UserSales = require("../../models/UserSales");
const { default: mongoose } = require("mongoose");
const moment = require("moment");

// @route GET api/personalProfit/personal/:userId/:startMonth/:endMonth/:year
// @desc Get personal profit data
// @access Private

router.get("/:userId/:startMonth/:endMonth/:year", auth, async (req, res) => {
  const { userId, startMonth, endMonth, year } = req.params;

  const startDate = new Date(year, startMonth - 1, 1);
  const endDate = new Date(year, endMonth, 0);

  const startMonthName = moment(startDate).format("MMMM");
  const endMonthName = moment(endDate).format("MMMM");

  const monthsList = [];

  for (let i = startMonth; i <= endMonth; i++) {
    monthsList.push(moment(new Date(year, i - 1, 1)).format("MMMM"));
  }

  // return res.status(200).send({ startDate, endDate });

  try {
    const personalAchievement = await UserSales.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          startDate: { $gte: startDate },
          endDate: { $lte: endDate },
        },
      },
      {
        $unwind: "$salesData", // Decomposes the salesData array
      },
      {
        $replaceRoot: { newRoot: "$salesData" }, // Promotes salesData objects to the top level
      },
      {
        $group: {
          _id: "$product",
          quantity: { $sum: "$quantity" },
          price: { $first: "$price" }, // Assumes price remains constant for each product
        },
      },
      {
        $project: {
          _id: 0,
          product: "$_id",
          quantity: 1,
          price: 1,
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",

          as: "productDetails",
        },
      },
      {
        $project: {
          productId: { $arrayElemAt: ["$productDetails._id", 0] },
          quantity: 1,
          price: 1,
          productName: {
            $arrayElemAt: ["$productDetails.productName", 0],
          },
          productNickName: {
            $arrayElemAt: ["$productDetails.productNickName", 0],
          },
          businessId: { $arrayElemAt: ["$productDetails.businessId", 0] },
          costPrice: { $arrayElemAt: ["$productDetails.costPrice", 0] },
          sellingPrice: {
            $arrayElemAt: ["$productDetails.sellingPrice", 0],
          },
          retailPrice: {
            $arrayElemAt: ["$productDetails.retailPrice", 0],
          },
          imageURL: { $arrayElemAt: ["$productDetails.imageURL", 0] },
          currencySymbol: {
            $arrayElemAt: ["$productDetails.currencySymbol", 0],
          },
          inventory: { $arrayElemAt: ["$productDetails.quantity", 0] },
          salesValue: { $multiply: ["$quantity", "$price"] },
        },
      },
      {
        $lookup: {
          from: "usertargets",
          let: { productId: "$productId" }, // Defining local variable for use in the pipeline
          pipeline: [
            { $unwind: "$productsTargets" }, // Unwind the first array
            { $unwind: "$productsTargets.target" }, // Unwind the nested array
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }, // Match user ID
                    {
                      $eq: ["$productsTargets.target.productId", "$$productId"],
                    }, // Match product ID
                  ],
                },
              },
            },
          ],
          as: "userTarget",
        },
      },
      {
        $unwind: { path: "$userTarget", preserveNullAndEmptyArrays: true }, // Unwind the results array
      },
      {
        $lookup: {
          from: "producttargets",
          localField: "productId",
          foreignField: "productId",
          let: {
            itemTargetUnits: "$userTarget.productsTargets.target.targetUnits",
            itemTargetValue: "$userTarget.productsTargets.target.targetValue",
          },
          pipeline: [
            {
              $unwind: "$target",
            },
            {
              $match: {
                "target.year": parseInt(year),
              },
            },
            {
              $unwind: "$target.yearTarget",
            },
            {
              $match: {
                "target.yearTarget.month": { $in: monthsList },
              },
            },
            {
              $addFields: {
                "target.yearTarget.monthTargetUnits": {
                  $multiply: [
                    {
                      $divide: [
                        {
                          $toDouble: {
                            $trim: {
                              input: "$target.yearTarget.targetPhases",
                              chars: "%", // Remove the percent sign
                            },
                          },
                        },
                        100,
                      ],
                    },
                    "$$itemTargetUnits",
                  ],
                },
                "target.yearTarget.monthTargetValue": {
                  $multiply: [
                    {
                      $divide: [
                        {
                          $toDouble: {
                            $trim: {
                              input: "$target.yearTarget.targetPhases",
                              chars: "%", // Remove the percent sign
                            },
                          },
                        },
                        100,
                      ],
                    },
                    "$$itemTargetValue",
                  ],
                },
              },
            },
            {
              $project: {
                monthTargetUnits: "$target.yearTarget.monthTargetUnits",
                monthTargetValue: "$target.yearTarget.monthTargetValue",
              },
            },
            {
              $group: {
                _id: null,
                targetUnits: { $sum: "$monthTargetUnits" },
                targetValue: { $sum: "$monthTargetValue" },
              },
            },
          ],
          as: "productTarget",
        },
      },

      {
        $project: {
          quantity: 1,
          price: 1,
          productId: 1,
          productName: 1,
          productNickName: 1,
          businessId: 1,
          costPrice: 1,
          sellingPrice: 1,
          retailPrice: 1,
          imageURL: 1,
          currencySymbol: 1,
          inventory: 1,
          salesValue: 1,
          itemTargetUnits: "$userTarget.productsTargets.target.targetUnits",
          itemTargetValue: "$userTarget.productsTargets.target.targetValue",
          productTargetUnits: {
            $arrayElemAt: ["$productTarget.targetUnits", 0],
          },
          productTargetValue: {
            $arrayElemAt: ["$productTarget.targetValue", 0],
          },
          productAchievementUnits: {
            $cond: {
              if: {
                $eq: [{ $arrayElemAt: ["$productTarget.targetUnits", 0] }, 0],
              }, // Check if productTargetUnits is 0
              then: 0, // Set to 0 if productTargetUnits is 0
              else: {
                $multiply: [
                  // Example calculation, adjust as needed
                  {
                    $divide: [
                      "$quantity",
                      { $arrayElemAt: ["$productTarget.targetUnits", 0] },
                    ],
                  },
                  100, // Convert to percentage
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSalesValue: { $sum: "$salesValue" },
          totalProductTargetValue: { $sum: "$productTargetValue" },
          performanceData: {
            $push: {
              productId: "$productId",
              productName: "$productName",
              productNickName: "$productNickName",
              businessId: "$businessId",
              costPrice: "$costPrice",
              sellingPrice: "$sellingPrice",
              retailPrice: "$retailPrice",
              imageURL: "$imageURL",
              currencySymbol: "$currencySymbol",
              inventory: "$inventory",
              salesValue: "$salesValue",
              itemTargetUnits: "$itemTargetUnits",
              itemTargetValue: "$itemTargetValue",
              productTargetUnits: "$productTargetUnits",
              productTargetValue: "$productTargetValue",
              productAchievementUnits: "$productAchievementUnits",
            },
          },
        },
      },
      {
        $project: {
          totalSalesValue: 1,
          totalProductTargetValue: 1,
          startMonth: moment(new Date(year, startMonth - 1, 1)).format("MMMM"),
          endMonth: moment(new Date(year, endMonth, 0)).format("MMMM"),
          year: year,
          totalAchievement: {
            $cond: {
              if: { $gt: ["$totalProductTargetValue", 0] },
              then: {
                $multiply: [
                  { $divide: ["$totalSalesValue", "$totalProductTargetValue"] },
                  100,
                ],
              },
              else: 0,
            },
          },
          performanceData: 1,
        },
      },
    ]);

    return res.status(200).json({ personalAchievement });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;