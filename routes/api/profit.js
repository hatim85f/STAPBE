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
          $or: [
            {
              isBusinessOwner: true,
            },
            {
              isBusinessAdmin: true,
            },
            {
              isBusinessPartner: true,
            },
          ],
        },
      },
      {
        $project: {
          businessId: 1,
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
        $lookup: {
          from: "products",
          localField: "businessId",
          foreignField: "businessId",
          pipeline: [
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
                costPrice: 1,
                sellingPrice: 1,
                productId: "$_id",
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
                                cond: { $eq: ["$$sale._id", "$$product._id"] },
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
                          $ifNull: [
                            "$$saleData.productPrice",
                            "$$product.costPrice",
                          ],
                        },
                        sellingPrice: {
                          $ifNull: [
                            "$$saleData.sellingPrice",
                            "$$product.sellingPrice",
                          ],
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
                        productProfit: {
                          $subtract: [
                            { $ifNull: ["$$saleData.salesValue", 0] },
                            {
                              $add: [
                                {
                                  $ifNull: [
                                    {
                                      $multiply: [
                                        { $ifNull: ["$$saleData.quantity", 0] },
                                        {
                                          $ifNull: [
                                            "$$saleData.productPrice",
                                            0,
                                          ],
                                        },
                                      ],
                                    },
                                    0,
                                  ],
                                },
                                {
                                  $ifNull: [
                                    "$$matchedExpense.marketingExpenses",
                                    0,
                                  ],
                                },
                              ],
                            },
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
        $addFields: {
          partners: {
            $map: {
              input: "$partners",
              as: "partner",
              in: {
                $mergeObjects: [
                  "$$partner",
                  {
                    partnerProfit: {
                      $multiply: [
                        {
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
                                  ],
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
                                  ],
                                }, // Total variable expenses
                                { $sum: "$products.totalCostPrice" }, // Total product cost
                              ],
                            },
                          ],
                        },
                        "$$partner.percentage",
                      ],
                    },
                    currencyCode: {
                      $arrayElemAt: ["$business.currencySymbol", 0],
                    },
                  },
                ],
              },
            },
          },
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
              { $arrayElemAt: ["$variableExpenses.totalVariableExpenses", 0] },
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
                        $arrayElemAt: ["$fixedExpenses.totalFixedExpenses", 0],
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
          currencySymbol: { $arrayElemAt: ["$business.currencySymbol", 0] },
        },
      },
    ]);

    return res.status(200).json({ businessesProfit });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

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
            from: "businesses",
            localField: "businessId",
            foreignField: "_id",
            as: "business",
          },
        },
        {
          $lookup: {
            from: "products",
            localField: "businessId",
            foreignField: "businessId",
            pipeline: [
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
                  costPrice: 1,
                  sellingPrice: 1,
                  productId: "$_id",
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
                            $ifNull: [
                              "$$saleData.productPrice",
                              "$$product.costPrice",
                            ],
                          },
                          sellingPrice: {
                            $ifNull: [
                              "$$saleData.sellingPrice",
                              "$$product.sellingPrice",
                            ],
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
                          productProfit: {
                            $subtract: [
                              { $ifNull: ["$$saleData.salesValue", 0] },
                              {
                                $add: [
                                  {
                                    $ifNull: [
                                      {
                                        $multiply: [
                                          {
                                            $ifNull: ["$$saleData.quantity", 0],
                                          },
                                          {
                                            $ifNull: [
                                              "$$saleData.productPrice",
                                              0,
                                            ],
                                          },
                                        ],
                                      },
                                      0,
                                    ],
                                  },
                                  {
                                    $ifNull: [
                                      "$$matchedExpense.marketingExpenses",
                                      0,
                                    ],
                                  },
                                ],
                              },
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
          $addFields: {
            partners: {
              $map: {
                input: "$partners",
                as: "partner",
                in: {
                  $mergeObjects: [
                    "$$partner",
                    {
                      partnerProfit: {
                        $multiply: [
                          {
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
                                    ],
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
                                    ],
                                  }, // Total variable expenses
                                  { $sum: "$products.totalCostPrice" }, // Total product cost
                                ],
                              },
                            ],
                          },
                          "$$partner.percentage",
                        ],
                      },
                      currencyCode: {
                        $arrayElemAt: ["$business.currencySymbol", 0],
                      },
                    },
                  ],
                },
              },
            },
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
            currencySymbol: { $arrayElemAt: ["$business.currencySymbol", 0] },
          },
        },
      ]);

      return res.status(200).json({ businessesProfit });
    } catch (error) {
      return res.status(500).send({ message: error.message });
    }
  }
);

router.get(
  "/business_profit/:userId/:businessId/:startMonth/:endMonth/:year",
  auth,
  async (req, res) => {
    const { businessId, startMonth, endMonth, year } = req.params;

    try {
      const startOfPeriod = new Date(year, startMonth - 1, 1);
      const endOfPeriod = new Date(year, endMonth, 0, 23, 59, 59);

      const businessesProfit = await BusinessUsers.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
            $or: [
              {
                isBusinessOwner: true,
              },
              {
                isBusinessAdmin: true,
              },
              {
                isBusinessPartner: true,
              },
            ],
          },
        },
        {
          $project: {
            businessId: 1,
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
          $lookup: {
            from: "products",
            localField: "businessId",
            foreignField: "businessId",
            pipeline: [
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
                  costPrice: 1,
                  sellingPrice: 1,
                  productId: "$_id",
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
                            $ifNull: [
                              "$$saleData.productPrice",
                              "$$product.costPrice",
                            ],
                          },
                          sellingPrice: {
                            $ifNull: [
                              "$$saleData.sellingPrice",
                              "$$product.sellingPrice",
                            ],
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
                          productProfit: {
                            $subtract: [
                              { $ifNull: ["$$saleData.salesValue", 0] },
                              {
                                $add: [
                                  {
                                    $ifNull: [
                                      {
                                        $multiply: [
                                          {
                                            $ifNull: ["$$saleData.quantity", 0],
                                          },
                                          {
                                            $ifNull: [
                                              "$$saleData.productPrice",
                                              0,
                                            ],
                                          },
                                        ],
                                      },
                                      0,
                                    ],
                                  },
                                  {
                                    $ifNull: [
                                      "$$matchedExpense.marketingExpenses",
                                      0,
                                    ],
                                  },
                                ],
                              },
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
          $addFields: {
            partners: {
              $map: {
                input: "$partners",
                as: "partner",
                in: {
                  $mergeObjects: [
                    "$$partner",
                    {
                      partnerProfit: {
                        $multiply: [
                          {
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
                                    ],
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
                                    ],
                                  }, // Total variable expenses
                                  { $sum: "$products.totalCostPrice" }, // Total product cost
                                ],
                              },
                            ],
                          },
                          "$$partner.percentage",
                        ],
                      },
                      currencyCode: {
                        $arrayElemAt: ["$business.currencySymbol", 0],
                      },
                    },
                  ],
                },
              },
            },
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
            currencySymbol: { $arrayElemAt: ["$business.currencySymbol", 0] },
          },
        },
      ]);

      return res.status(200).json({ businessesProfit: businessesProfit[0] });
    } catch (error) {
      return res.status(500).send({ message: error.message });
    }
  }
);

module.exports = router;
