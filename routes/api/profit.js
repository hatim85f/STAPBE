const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const BusinessUsers = require("../../models/BusinessUsers");
const { default: mongoose } = require("mongoose");

router.get("/:userId/:startMonth/:endMonth/:year", auth, async (req, res) => {
  const { userId, startMonth, endMonth, year } = req.params;

  try {
    const startOfPeriod = new Date(year, startMonth - 1, 1);
    const endOfPeriod = new Date(year, endMonth, 0, 23, 59, 59);

    const businessesProfit = await BusinessUsers.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isBusinessOwner: true,
        },
      },
      {
        $project: {
          businessId: 1,
        },
      },
      {
        $lookup: {
          from: "sales",
          localField: "businessId",
          foreignField: "businessId",
          pipeline: [
            {
              $match: {
                $or: [
                  {
                    startPeriod: {
                      $gte: startOfPeriod,
                      $lte: endOfPeriod,
                    },
                  },
                  {
                    endPeriod: {
                      $gte: startOfPeriod,
                      $lte: endOfPeriod,
                    },
                  },
                ],
                isFinal: true,
                "salesData.status": "Completed",
              },
            },
            {
              $unwind: "$salesData",
            },
            {
              $project: {
                _id: 0,
                productId: "$salesData.productId",
                quantity: "$salesData.quantity",
                quantityWithBonus: "$salesData.totalQuantity",
                salesValue: "$salesData.itemValue",
                productPrice: "$salesData.productPrice",
                date: "$salesData.date",
                productName: "$salesData.productName",
              },
            },
            {
              $group: {
                _id: "$productId",
                quantity: { $sum: "$quantity" },
                quantityWithBonus: { $sum: "$quantityWithBonus" },
                salesValue: { $sum: "$salesValue" },
                productPrice: { $first: "$productPrice" },
                date: { $first: "$date" },
                productName: { $first: "$productName" },
                productId: { $first: "$productId" },
              },
            },
          ],
          as: "sales",
        },
      },
      {
        $lookup: {
          from: "marketingexpenses",
          localField: "businessId",
          foreignField: "businessId",
          pipeline: [
            {
              $match: {
                dueIn: {
                  $gte: startOfPeriod,
                  $lte: endOfPeriod,
                },
                status: "Approved",
              },
            },
            {
              $project: {
                requestAgainst: 1,
                amount: 1,
              },
            },
          ],
          as: "marketingExpenses",
        },
      },
      {
        $addFields: {
          sales: {
            $map: {
              input: "$sales",
              as: "sale",
              in: {
                $mergeObjects: [
                  "$$sale",
                  {
                    marketingExpense: {
                      $ifNull: [
                        {
                          $reduce: {
                            input: {
                              $filter: {
                                input: "$marketingExpenses",
                                as: "m",
                                cond: {
                                  $eq: [
                                    "$$m.requestAgainst",
                                    "$$sale.productId",
                                  ],
                                },
                              },
                            },
                            initialValue: 0,
                            in: { $add: ["$$value", "$$this.amount"] },
                          },
                        },
                        0, // Default to 0 if there are no matching marketing expenses
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },

      {
        $lookup: {
          from: "products",
          localField: "sales.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $addFields: {
          sales: {
            $map: {
              input: "$sales",
              as: "sale",
              in: {
                $let: {
                  vars: {
                    productDetails: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$product",
                            as: "p",
                            cond: { $eq: ["$$p._id", "$$sale.productId"] },
                          },
                        },
                        0, // Get the first (and should be the only) matching product
                      ],
                    },
                  },
                  in: {
                    $mergeObjects: [
                      "$$sale",
                      {
                        productNickName: "$$productDetails.productNickName", // Directly access the property
                        costPrice: "$$productDetails.costPrice", // Directly access the property
                        currencyCode: "$$productDetails.currencyCode", // Directly access the property
                        currencySymbol: "$$productDetails.currencySymbol", // Directly access the property
                        productName: "$$productDetails.productName", // Directly access the property
                        imageURL: "$$productDetails.imageURL", // Directly access the property
                        category: "$$productDetails.category", // Directly access the property
                        productType: "$$productDetails.productType", // Directly access the property
                        inventory: "$$productDetails.quantity", // Directly access the property
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          sales: {
            $map: {
              input: "$sales",
              as: "sale",
              in: {
                $mergeObjects: [
                  "$$sale",
                  {
                    totalCostPrice: {
                      $multiply: ["$$sale.quantity", "$$sale.costPrice"],
                    },

                    totalProfit: {
                      $subtract: [
                        "$$sale.salesValue", // Assuming salesValue is the total sales amount for the sale
                        {
                          $add: [
                            {
                              $multiply: [
                                "$$sale.quantity",
                                "$$sale.costPrice",
                              ],
                            },
                            "$$sale.marketingExpense", // Assuming marketingExpense is already the total for the sale
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "fixedexpenses",
          localField: "businessId",
          foreignField: "businessId",
          pipeline: [
            {
              $match: {
                dueIn: {
                  $gte: startOfPeriod,
                  $lte: endOfPeriod,
                },
              },
            },
          ],
          as: "fixedExpenses",
        },
      },
      {
        $lookup: {
          from: "variableexpenses",
          localField: "businessId",
          foreignField: "businessId",
          pipeline: [
            {
              $match: {
                expenseDate: {
                  $gte: startOfPeriod,
                  $lte: endOfPeriod,
                },
              },
            },
          ],
          as: "variableExpenses",
        },
      },
      {
        $project: {
          _id: 0,
          businessId: 1,
          sales: 1,
          fixedExpenses: { $sum: "$fixedExpenses.amount" },
          variableExpenses: { $sum: "$variableExpenses.amount" },
        },
      },
    ]);

    return res.status(200).send(businessesProfit);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

module.exports = router;

// {
//     $addFields: {
//       sales: {
//         $map: {
//           input: "$sales",
//           as: "sale",
//           let: {
//             vars: {
//               marketingExpense: {
//                 $arrayElemAt: [
//                   {
//                     $filter: {
//                       input: "$marketingExpenses",
//                       as: "m",
//                       cond: {
//                         $eq: ["$$m.requestAgainst", "$$sale.productId"],
//                       },
//                     },
//                   },
//                   0,
//                 ],
//               },
//             },
//             in: {
//               $mergeObjects: [
//                 "$$sale",
//                 {
//                   marketingExpense: "$$marketingExpense",
//                 },
//               ],
//             },
//           },
//         },
//       },
//     },
//   },
