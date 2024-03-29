const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const BusinessUsers = require("../../models/BusinessUsers");
const { default: mongoose } = require("mongoose");

router.get(
  "/:userId/:startMonth/:endMonth/:year/:productId",
  auth,
  async (req, res) => {
    const { userId, startMonth, endMonth, year, productId } = req.params;

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
            from: "products",
            localField: "businessId",
            foreignField: "businessId",
            pipeline: productId
              ? [
                  {
                    $match: {
                      _id: new mongoose.Types.ObjectId(productId),
                    },
                  },
                  {
                    $project: {
                      productNickName: 1,
                      currencyCode: 1,
                      currencySymbol: 1,
                      productName: 1,
                      imageURL: 1,
                      category: 1,
                      productType: 1,
                      inventory: "$quantity",
                      imageURL: 1,
                    },
                  },
                ]
              : [
                  {
                    $project: {
                      productNickName: 1,
                      currencyCode: 1,
                      currencySymbol: 1,
                      productName: 1,
                      imageURL: 1,
                      category: 1,
                      productType: 1,
                      inventory: "$quantity",
                      imageURL: 1,
                    },
                  },
                ],
            as: "products",
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
                $project: {
                  salesData: 1,
                  _id: 0,
                },
              },
              {
                $unwind: "$salesData",
              },
              {
                $group: {
                  _id: "$salesData.productId",
                  quantity: { $sum: "$salesData.quantity" },
                  quantityWithBonus: { $sum: "$salesData.totalQuantity" },
                  salesValue: { $sum: "$salesData.itemValue" },
                  productPrice: { $first: "$salesData.productPrice" },
                  sellingPrice: { $first: "$salesData.sellingPrice" },
                  discount: { $first: "$salesData.discount" },
                  discountType: { $first: "$salesData.discountType" },
                  productName: { $first: "$salesData.productName" },
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
              {
                $group: {
                  _id: "$requestAgainst",
                  marketingExpenses: { $sum: "$amount" },
                },
              },
            ],
            as: "marketingExpenses",
          },
        },
        {
          $addFields: {
            products: {
              $map: {
                input: "$products",
                as: "product",
                in: {
                  $mergeObjects: [
                    "$$product",
                    {
                      $let: {
                        vars: {
                          saleData: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$sales",
                                  as: "sale",
                                  cond: {
                                    $eq: ["$$sale._id", "$$product._id"],
                                  },
                                },
                              },
                              0,
                            ],
                          },
                          matchedExpense: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$marketingExpenses",
                                  as: "m",
                                  cond: {
                                    $eq: ["$$m._id", "$$product._id"],
                                  },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: {
                          quantity: { $ifNull: ["$$saleData.quantity", 0] },
                          quantityWithBonus: {
                            $ifNull: ["$$saleData.quantityWithBonus", 0],
                          },
                          salesValue: { $ifNull: ["$$saleData.salesValue", 0] },
                          productPrice: {
                            $ifNull: ["$$saleData.productPrice", 0],
                          },
                          sellingPrice: {
                            $ifNull: ["$$saleData.sellingPrice", 0],
                          },
                          discount: { $ifNull: ["$$saleData.discount", 0] },
                          discountType: {
                            $ifNull: ["$$saleData.discountType", ""],
                          },
                          marketingExpenses: {
                            $ifNull: ["$$matchedExpense.marketingExpenses", 0],
                          },
                          totalCostPrice: {
                            $ifNull: [
                              {
                                $multiply: [
                                  { $ifNull: ["$$saleData.quantity", 0] },
                                  { $ifNull: ["$$saleData.productPrice", 0] },
                                ],
                              },
                              0,
                            ],
                          },
                        },
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
              {
                $group: {
                  _id: 0,
                  totalFixedExpenses: { $sum: "$amount" },
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
              {
                $group: {
                  _id: 0,
                  totalVariableExpenses: { $sum: "$amount" },
                },
              },
            ],
            as: "variableExpenses",
          },
        },
        {
          $lookup: {
            from: "partners",
            localField: "businessId",
            foreignField: "business",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  name: 1,
                  email: 1,
                  phone: 1,
                  profileImage: 1,
                  percentage: 1,
                },
              },
            ],
            as: "partners",
          },
        },
        {
          $project: {
            _id: 0,
            businessId: 1,
            products: 1,
            totalFixedExpenses: {
              $ifNull: [
                { $arrayElemAt: ["$fixedExpenses.totalFixedExpenses", 0] },
                0,
              ], // Return 0 if totalFixedExpenses is null
            },
            variableExpenses: {
              $ifNull: [
                {
                  $arrayElemAt: ["$variableExpenses.totalVariableExpenses", 0],
                },
                0,
              ], // Return 0 if totalVariableExpenses is null
            },
            totalSalesValue: { $sum: "$products.salesValue" },
            totalMarketing: { $sum: "$products.marketingExpenses" },
            totalProductCost: { $sum: "$products.totalCostPrice" }, // Summing totalCostPrice for all products
            totalProfit: {
              $subtract: [
                { $sum: "$products.salesValue" }, // Total sales value
                {
                  $add: [
                    { $sum: "$products.marketingExpenses" }, // Total marketing expenses
                    {
                      $ifNull: [
                        {
                          $arrayElemAt: [
                            "$fixedExpenses.totalFixedExpenses",
                            0,
                          ],
                        },
                        0,
                      ], // Return 0 if totalFixedExpenses is null
                    }, // Total fixed expenses
                    {
                      $ifNull: [
                        {
                          $arrayElemAt: [
                            "$variableExpenses.totalVariableExpenses",
                            0,
                          ],
                        },
                        0,
                      ], // Return 0 if totalVariableExpenses is null
                    }, // Total variable expenses
                    { $sum: "$products.totalCostPrice" }, // Total product cost
                  ],
                },
              ],
            },
            partners: 1,
            startMonth: startMonth,
            endMonth: endMonth,
          },
        },
      ]);

      return res.status(200).json({ businessesProfit });
    } catch (error) {
      return res.status(500).send({ message: error.message });
    }
  }
);

module.exports = router;
// {
//   $lookup: {
//     from: "sales",
//     localField: "businessId",
//     foreignField: "businessId",
//     pipeline: [
//       {
//         $match: {
//           $or: [
//             {
//               startPeriod: {
//                 $gte: startOfPeriod,
//                 $lte: endOfPeriod,
//               },
//             },
//             {
//               endPeriod: {
//                 $gte: startOfPeriod,
//                 $lte: endOfPeriod,
//               },
//             },
//           ],
//           isFinal: true,
//           "salesData.status": "Completed",
//         },
//       },
//       {
//         $unwind: "$salesData",
//       },
//       {
//         $project: {
//           _id: 0,
//           productId: "$salesData.productId",
//           quantity: "$salesData.quantity",
//           quantityWithBonus: "$salesData.totalQuantity",
//           salesValue: "$salesData.itemValue",
//           productPrice: "$salesData.productPrice",
//           date: "$salesData.date",
//           productName: "$salesData.productName",
//           sellingPrice: "$salesData.sellingPrice",
//         },
//       },
//       {
//         $group: {
//           _id: "$productId",
//           quantity: { $sum: "$quantity" },
//           quantityWithBonus: { $sum: "$quantityWithBonus" },
//           salesValue: { $sum: "$salesValue" },
//           productPrice: { $first: "$productPrice" },
//           date: { $first: "$date" },
//           productName: { $first: "$productName" },
//           productId: { $first: "$productId" },
//           sellingPrice: { $first: "$sellingPrice" },
//         },
//       },
//     ],
//     as: "sales",
//   },
// },
// {
//   $lookup: {
//     from: "marketingexpenses",
//     localField: "businessId",
//     foreignField: "businessId",
//     pipeline: [
//       {
//         $match: {
//           dueIn: {
//             $gte: startOfPeriod,
//             $lte: endOfPeriod,
//           },
//           status: "Approved",
//         },
//       },
//       {
//         $project: {
//           requestAgainst: 1,
//           amount: 1,
//         },
//       },
//     ],
//     as: "marketingExpenses",
//   },
// },
// {
//   $addFields: {
//     sales: {
//       $map: {
//         input: "$sales",
//         as: "sale",
//         in: {
//           $mergeObjects: [
//             "$$sale",
//             {
//               marketingExpense: {
//                 $ifNull: [
//                   {
//                     $reduce: {
//                       input: {
//                         $filter: {
//                           input: "$marketingExpenses",
//                           as: "m",
//                           cond: {
//                             $eq: [
//                               "$$m.requestAgainst",
//                               "$$sale.productId",
//                             ],
//                           },
//                         },
//                       },
//                       initialValue: 0,
//                       in: { $add: ["$$value", "$$this.amount"] },
//                     },
//                   },
//                   0, // Default to 0 if there are no matching marketing expenses
//                 ],
//               },
//             },
//           ],
//         },
//       },
//     },
//   },
// },

// {
//   $lookup: {
//     from: "products",
//     localField: "sales.productId",
//     foreignField: "_id",
//     as: "product",
//   },
// },
// {
//   $addFields: {
//     sales: {
//       $map: {
//         input: "$sales",
//         as: "sale",
//         in: {
//           $let: {
//             vars: {
//               productDetails: {
//                 $arrayElemAt: [
//                   {
//                     $filter: {
//                       input: "$product",
//                       as: "p",
//                       cond: { $eq: ["$$p._id", "$$sale.productId"] },
//                     },
//                   },
//                   0, // Get the first (and should be the only) matching product
//                 ],
//               },
//             },
//             in: {
//               $mergeObjects: [
//                 "$$sale",
//                 {
//                   productNickName: "$$productDetails.productNickName", // Directly access the property
//                   costPrice: "$$productDetails.costPrice", // Directly access the property
//                   currencyCode: "$$productDetails.currencyCode", // Directly access the property
//                   currencySymbol: "$$productDetails.currencySymbol", // Directly access the property
//                   productName: "$$productDetails.productName", // Directly access the property
//                   imageURL: "$$productDetails.imageURL", // Directly access the property
//                   category: "$$productDetails.category", // Directly access the property
//                   productType: "$$productDetails.productType", // Directly access the property
//                   inventory: "$$productDetails.quantity", // Directly access the property
//                 },
//               ],
//             },
//           },
//         },
//       },
//     },
//   },
// },
// {
//   $addFields: {
//     sales: {
//       $map: {
//         input: "$sales",
//         as: "sale",
//         in: {
//           $mergeObjects: [
//             "$$sale",
//             {
//               totalCostPrice: {
//                 $multiply: ["$$sale.quantity", "$$sale.costPrice"],
//               },

//               totalProfit: {
//                 $subtract: [
//                   "$$sale.salesValue", // Assuming salesValue is the total sales amount for the sale
//                   {
//                     $add: [
//                       {
//                         $multiply: [
//                           "$$sale.quantity",
//                           "$$sale.costPrice",
//                         ],
//                       },
//                       "$$sale.marketingExpense", // Assuming marketingExpense is already the total for the sale
//                     ],
//                   },
//                 ],
//               },
//             },
//           ],
//         },
//       },
//     },
//   },
// },
// {
//   $lookup: {
//     from: "fixedexpenses",
//     localField: "businessId",
//     foreignField: "businessId",
//     pipeline: [
//       {
//         $match: {
//           dueIn: {
//             $gte: startOfPeriod,
//             $lte: endOfPeriod,
//           },
//         },
//       },
//     ],
//     as: "fixedExpenses",
//   },
// },
// {
//   $lookup: {
//     from: "variableexpenses",
//     localField: "businessId",
//     foreignField: "businessId",
//     pipeline: [
//       {
//         $match: {
//           expenseDate: {
//             $gte: startOfPeriod,
//             $lte: endOfPeriod,
//           },
//         },
//       },
//     ],
//     as: "variableExpenses",
//   },
// },
// {
//   $project: {
//     _id: 0,
//     businessId: 1,
//     sales: 1,
//     fixedExpenses: { $sum: "$fixedExpenses.amount" },
//     variableExpenses: { $sum: "$variableExpenses.amount" },
//     totalSalesValue: { $sum: "$sales.salesValue" },
//     totalMarketing: { $sum: "$sales.marketingExpense" },
//     totalBusinessProfit: { $sum: "$sales.totalProfit" },
//   },
// },
