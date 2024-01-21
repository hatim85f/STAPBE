const moment = require("moment");
const { default: mongoose } = require("mongoose");
const UserTarget = require("../models/UserTarget");
const UserSales = require("../models/UserSales");

// sefarin cao target units shuld be 884 + 884 + 442 = 2210

const getYTDAchivement = async (userId, startMonth, endMonth, year) => {
  const startDate = new Date(year, startMonth - 1, 1);
  const endDate = new Date(year, endMonth, 0);

  const monthOfStart = moment(new Date(year, startMonth - 1, 1)).format("MMMM");
  const monthOfEnd = moment(new Date(year, endMonth, 0)).format("MMMM");

  const getMonthsInRange = (start, end) => {
    const startMonthIndex = moment().month(start).month();
    const endMonthIndex = moment().month(end).month();

    const months = [];
    for (let i = startMonthIndex; i <= endMonthIndex; i++) {
      months.push(moment().month(i).format("MMMM"));
    }

    return months;
  };

  const userAchievement = await UserTarget.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $unwind: "$productsTargets",
    },
    {
      $unwind: "$productsTargets.target",
    },
    {
      $match: {
        "productsTargets.year": parseInt(year),
      },
    },
    {
      $project: {
        _id: 1,
        targetUnits: "$productsTargets.target.targetUnits",
        targetValue: "$productsTargets.target.targetValue",
        productId: "$productsTargets.target.productId",
        userId: 1,
        businessId: 1,
      },
    },
    {
      $lookup: {
        from: "producttargets",
        let: { product_id: "$productId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$productId", "$$product_id"],
              },
            },
          },
          {
            $unwind: "$target",
          },
          {
            $match: {
              $expr: {
                $eq: ["$target.year", parseInt(year)],
              },
            },
          },
          {
            $unwind: "$target.yearTarget",
          },
          {
            $match: {
              $expr: {
                $in: [
                  "$target.yearTarget.month",
                  getMonthsInRange(monthOfStart, monthOfEnd),
                ],
              },
            },
          },
          {
            $project: {
              targetPhases: "$target.yearTarget.targetPhases",
              targetPercentage: {
                $divide: [
                  {
                    $toDouble: {
                      $replaceOne: {
                        input: "$target.yearTarget.targetPhases",
                        find: "%",
                        replacement: "",
                      },
                    },
                  },
                  100,
                ],
              },
              month: "$target.yearTarget.month",
              productId: "$productId",
            },
          },
        ],
        as: "productTarget",
      },
    },
    {
      $lookup: {
        from: "usersales",
        let: {
          product_id: "$productId",
          user_id: new mongoose.Types.ObjectId(userId),
          productTarget: "$productTarget",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$user_id"] }, // Adjust based on your data structure
                  { $gte: ["$startDate", startDate] },
                  { $lte: ["$endDate", endDate] },
                  { isFinal: true },
                ],
              },
            },
          },
          {
            $unwind: "$salesData",
          },
          {
            $match: {
              $expr: {
                $eq: ["$salesData.product", "$$product_id"],
              },
            },
          },
          {
            $group: {
              _id: "$_id",
              salesData: { $push: "$salesData" },
            },
          },

          {
            $unwind: "$salesData",
          },

          {
            $group: {
              _id: "$_id",
              soldQuantity: { $sum: "$salesData.quantity" },
              salesValue: {
                $sum: {
                  $multiply: ["$salesData.price", "$salesData.quantity"],
                },
              },
              price: { $first: "$salesData.price" },
              productId: { $first: "$salesData.product" },
            },
          },
          {
            $project: {
              _id: 1,
              soldQuantity: 1,
              salesValue: 1,
              price: 1,
              productId: 1,
            },
          },
        ],
        as: "userSales",
      },
    },
    {
      $addFields: {
        mergedData: {
          $map: {
            input: { $range: [0, { $size: "$productTarget" }] },
            as: "index",
            in: {
              $mergeObjects: [
                { $arrayElemAt: ["$productTarget", "$$index"] },
                { $arrayElemAt: ["$userSales", "$$index"] },
                {
                  soldQuantity: {
                    $ifNull: [
                      {
                        $arrayElemAt: ["$userSales.soldQuantity", "$$index"],
                      },
                      0,
                    ],
                  },
                  salesValue: {
                    $ifNull: [
                      {
                        $arrayElemAt: ["$userSales.salesValue", "$$index"],
                      },
                      0,
                    ],
                  },
                  price: {
                    $ifNull: [
                      {
                        $arrayElemAt: ["$userSales.price", "$$index"],
                      },
                      0,
                    ],
                  },
                  targetUnits: {
                    $multiply: [
                      "$targetUnits",
                      {
                        $arrayElemAt: [
                          "$productTarget.targetPercentage",
                          "$$index",
                        ],
                      },
                    ],
                  },
                  targetValue: {
                    $multiply: [
                      "$targetValue",
                      {
                        $arrayElemAt: [
                          "$productTarget.targetPercentage",
                          "$$index",
                        ],
                      },
                    ],
                  },
                  achievement: {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $ifNull: [
                              {
                                $arrayElemAt: [
                                  "$userSales.salesValue",
                                  "$$index",
                                ],
                              },
                              0,
                            ],
                          },
                          {
                            $ifNull: [
                              {
                                $multiply: [
                                  "$targetValue",
                                  {
                                    $arrayElemAt: [
                                      "$productTarget.targetPercentage",
                                      "$$index",
                                    ],
                                  },
                                ],
                              },
                              1, // Avoid division by zero
                            ],
                          },
                        ],
                      },
                      100,
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
        localField: "productId",
        foreignField: "_id",
        as: "product",
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
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        userName: { $arrayElemAt: ["$user.userName", 0] },
        profilePicture: { $arrayElemAt: ["$user.profilePicture", 0] },
        designation: { $arrayElemAt: ["$user.designation", 0] },
        businessId: 1,
        businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
        businessName: { $arrayElemAt: ["$business.businessName", 0] },
        productNickName: { $arrayElemAt: ["$product.productNickName", 0] },
        productImage: { $arrayElemAt: ["$product.imageURL", 0] },
        targetUnits: 1,
        currencySymbol: { $arrayElemAt: ["$business.currencySymbol", 0] },
        targetValue: { $sum: "$mergedData.targetValue" },
        salesValue: { $sum: "$mergedData.salesValue" },
        productAchievement: {
          $multiply: [
            {
              $divide: [
                { $sum: "$mergedData.salesValue" },
                { $sum: "$mergedData.targetValue" },
              ],
            },
            100,
          ],
        },
        userAchievement: "$mergedData",
      },
    },
    {
      $group: {
        _id: {
          userId: "$userId",
          userName: "$userName",
          profilePicture: "$profilePicture",
          designation: "$designation",
          businessId: "$businessId",
          businessLogo: "$businessLogo",
          businessName: "$businessName",
          currencySymbol: "$currencySymbol",
        },
        product: {
          $push: {
            productNickName: "$productNickName",
            productImage: "$productImage",
            totalTargetUnits: "$targetUnits",
            totalTargetValue: "$targetValue",
            totalSalesValue: "$salesValue",
            productAchievement: "$productAchievement",
            userAchievement: "$userAchievement",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        userId: "$_id.userId",
        userName: "$_id.userName",
        profilePicture: "$_id.profilePicture",
        designation: "$_id.designation",
        businessId: "$_id.businessId",
        businessLogo: "$_id.businessLogo",
        businessName: "$_id.businessName",
        currencySymbol: "$_id.currencySymbol",
        product: 1,
        totalTargetValue: { $sum: "$product.totalTargetValue" },
        totalSalesValue: { $sum: "$product.totalSalesValue" },
        totalAchievement: {
          $multiply: [
            {
              $divide: [
                { $sum: "$product.totalSalesValue" },
                { $sum: "$product.totalTargetValue" },
              ],
            },
            100,
          ],
        },
      },
    },
  ]);

  return userAchievement;
};

module.exports = { getYTDAchivement };
