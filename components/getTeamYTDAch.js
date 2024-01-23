const moment = require("moment");
const UserTarget = require("../models/UserTarget");
const { default: mongoose } = require("mongoose");
const BusinessUsers = require("../models/BusinessUsers");
const ProductTarget = require("../models/ProductTarget");

const getTeamYTDAch = async (userId, startMonth, endMonth, year) => {
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

  const businesses = await BusinessUsers.find({ userId: userId });
  const businessIds = businesses.map((business) => business.businessId);

  const teamAchievements = await ProductTarget.aggregate([
    {
      $match: {
        businessId: { $in: businessIds },
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
      $unwind: "$target.yearTarget",
    },
    {
      $match: {
        "target.yearTarget.month": {
          $in: getMonthsInRange(monthOfStart, monthOfEnd),
        },
      },
    },
    {
      $group: {
        _id: "$_id",
        totalTargetUnits: { $sum: "$target.yearTarget.targetUnits" },
        totalTargetValue: { $sum: "$target.yearTarget.targetValue" },
        productId: { $first: "$productId" },
        businessId: { $first: "$businessId" },
        currencySymbol: { $first: "$currencySymbol" },
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
        from: "usersales",
        let: {
          business_id: "$businessId",
          product_id: "$productId",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$businessId", "$$business_id"] },
                  { $gte: ["$startDate", startDate] },
                  { $lte: ["$endDate", endDate] },
                ],
              },
            },
          },
          {
            $match: { isFinal: true },
          },
          {
            $unwind: "$salesData",
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
            $match: {
              $expr: {
                $and: [{ $eq: ["$salesData.product", "$$product_id"] }],
              },
            },
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
        as: "sales",
      },
    },
    {
      $project: {
        _id: 1,
        totalTargetUnits: 1,
        totalTargetValue: 1,
        productId: 1,
        businessId: 1,
        currencySymbol: 1,
        productNickName: { $arrayElemAt: ["$product.productNickName", 0] },
        productImage: { $arrayElemAt: ["$product.imageURL", 0] },
        businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
        businessName: { $arrayElemAt: ["$business.businessName", 0] },
        productSalesValue: {
          $sum: {
            $map: { input: "$sales", as: "sale", in: "$$sale.salesValue" },
          },
        },
        soldQuantity: {
          $sum: {
            $map: { input: "$sales", as: "sale", in: "$$sale.soldQuantity" },
          },
        },
        price: { $first: "$sales.price" },
        productAchievement: {
          $cond: {
            if: { $eq: ["$totalTargetUnits", 0] },
            then: 0,
            else: {
              $divide: [
                {
                  $multiply: [
                    {
                      $sum: {
                        $map: {
                          input: "$sales",
                          as: "sale",
                          in: "$$sale.salesValue",
                        },
                      },
                    },
                    100,
                  ],
                },
                "$totalTargetValue",
              ],
            },
          },
        },
      },
    },
    {
      $group: {
        _id: "$businessId",
        businessId: { $first: "$businessId" },
        businessLogo: { $first: "$businessLogo" },
        businessName: { $first: "$businessName" },
        currencySymbol: { $first: "$currencySymbol" },
        totalBusinessTargetValue: { $sum: "$totalTargetValue" },
        totalBusinessSalesValue: { $sum: "$productSalesValue" },
        products: {
          $push: {
            productId: "$productId",
            productNickName: "$productNickName",
            productImage: "$productImage",
            productSalesValue: "$productSalesValue",
            ProductTargetValue: "$totalTargetValue",
            soldQuantity: "$soldQuantity",
            price: "$price",
            productAchievement: "$productAchievement",
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        businessId: 1,
        businessLogo: 1,
        businessName: 1,
        currencySymbol: 1,
        totalBusinessTargetValue: 1,
        totalBusinessSalesValue: 1,
        products: 1,
        businessAchievement: {
          $cond: {
            if: { $eq: ["$totalBusinessTargetValue", 0] },
            then: 0,
            else: {
              $divide: [
                {
                  $multiply: ["$totalBusinessSalesValue", 100],
                },
                "$totalBusinessTargetValue",
              ],
            },
          },
        },
      },
    },
  ]);

  return teamAchievements;
};

module.exports = { getTeamYTDAch };
