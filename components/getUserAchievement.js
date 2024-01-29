const { default: mongoose } = require("mongoose");
const UserSales = require("../models/UserSales");
const moment = require("moment");

const getFinalUserAchievement = async (userId, month, year, res) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const selectedMonth = moment(startDate).format("MMMM");

  const userAchievement = await UserSales.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        startDate: {
          $gte: startDate,
          $lte: endDate,
        },
        endDate: {
          $gte: startDate,
          $lte: endDate,
        },
        isFinal: true,
      },
    },
    {
      $unwind: "$salesData",
    },
    {
      $lookup: {
        from: "usertargets",
        let: { product_id: "$salesData.product" },
        localField: "user",
        foreignField: "userId",
        pipeline: [
          {
            $unwind: "$productsTargets",
          },
          {
            $unwind: "$productsTargets.target",
          },
          {
            $match: {
              $expr: {
                $eq: ["$productsTargets.target.productId", "$$product_id"],
              },
            },
          },
        ],
        as: "userTarget",
      },
    },
    {
      $unwind: "$userTarget", // Unwind the matchedTargets array
    },
    {
      $match: {
        "userTarget.productsTargets.year": parseInt(year),
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
      $unwind: "$productTarget.target.yearTarget",
    },
    {
      $match: {
        "productTarget.target.yearTarget.month":
          moment(startDate).format("MMMM"),
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "salesData.product",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $unwind: "$product",
    },
    {
      $addFields: {
        salesData: {
          $mergeObjects: [
            "$salesData",
            {
              productNickName: "$product.productNickName",
              productImage: "$product.imageURL",
              salesValue: {
                $round: [
                  {
                    $multiply: ["$salesData.quantity", "$salesData.price"],
                  },
                  2, // Number of decimal places
                ],
              },
              salesUnits: "$salesData.quantity",
              targetUnits: {
                $multiply: [
                  "$userTarget.productsTargets.target.targetUnits",
                  {
                    $divide: [
                      {
                        $toDouble: {
                          $replaceOne: {
                            input:
                              "$productTarget.target.yearTarget.targetPhases",
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
                $round: [
                  {
                    $multiply: [
                      {
                        $multiply: [
                          "$userTarget.productsTargets.target.targetUnits",
                          {
                            $divide: [
                              {
                                $toDouble: {
                                  $replaceOne: {
                                    input:
                                      "$productTarget.target.yearTarget.targetPhases",
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
                      "$salesData.price",
                    ],
                  },
                  2, // Number of decimal places
                ],
              },
              achievement: {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $multiply: [
                              "$salesData.quantity",
                              "$salesData.price",
                            ],
                          },
                          {
                            $multiply: [
                              "$userTarget.productsTargets.target.targetValue",
                              {
                                $divide: [
                                  {
                                    $toDouble: {
                                      $replaceOne: {
                                        input:
                                          "$productTarget.target.yearTarget.targetPhases",
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
                        ],
                      },
                      100,
                    ],
                  },
                  2, // Number of decimal places
                ],
              },
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user_details",
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
        _id: 1,
        businessId: 1,
        businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
        businessName: { $arrayElemAt: ["$business.businessName", 0] },
        addingUser: { $arrayElemAt: ["$addingUser_details._id", 0] },
        salesData: 1,
        totalSalesValue: { $sum: "$salesData.salesValue" },
        totalTargetValue: { $sum: "$salesData.targetValue" },
        userName: { $arrayElemAt: ["$user_details.userName", 0] },
        designation: { $arrayElemAt: ["$user_details.designation", 0] },
        profilePicture: { $arrayElemAt: ["$user_details.profilePicture", 0] },
        userId: { $arrayElemAt: ["$user_details._id", 0] },
        userSalesId: "$_id",
        isFinal: 1,
        startDate: 1,
        endDate: 1,
        currencyName: "$product.currencyName",
        currencyCode: "$product.currencyCode",
        currencySymbol: "$product.currencySymbol",
        month: selectedMonth,
        year: year,
      },
    },
    {
      $group: {
        _id: {
          businessId: "$businessId",
          businessLogo: "$businessLogo",
          businessName: "$businessName",
          userName: "$userName",
          userSalesId: "$userSalesId",
          designation: "$designation",
          profilePicture: "$profilePicture",
          userId: "$userId",
          startDate: "$startDate",
          endDate: "$endDate",
          isFinal: "$isFinal",
          currencyName: "$currencyName",
          currencyCode: "$currencyCode",
          currencySymbol: "$currencySymbol",
          month: "$month",
          year: "$year",
        },
        salesData: { $push: "$salesData" },
        totalSalesValue: { $sum: "$salesData.salesValue" },
        totalTargetValue: { $sum: "$salesData.targetValue" },
      },
    },
    {
      $project: {
        _id: 0,
        businessId: "$_id.businessId",
        businessLogo: "$_id.businessLogo",
        businessName: "$_id.businessName",
        salesData: "$salesData",
        userName: "$_id.userName",
        designation: "$_id.designation",
        profilePicture: "$_id.profilePicture",
        userId: "$_id.userId",
        userSalesId: "$_id.userSalesId",
        isFinal: "$_id.isFinal",
        month: "$_id.month",
        year: "$_id.year",
        totalSalesValue: { $round: ["$totalSalesValue", 2] },
        totalTargetValue: { $round: ["$totalTargetValue", 2] },
        totalAchievement: {
          $round: [
            {
              $multiply: [
                {
                  $divide: ["$totalSalesValue", "$totalTargetValue"],
                },
                100,
              ],
            },
            2,
          ],
        },
        currencyName: "$_id.currencyName",
        currencyCode: "$_id.currencyCode",
        currencySymbol: "$_id.currencySymbol",
      },
    },
  ]);

  return userAchievement;
};

module.exports = { getFinalUserAchievement };
