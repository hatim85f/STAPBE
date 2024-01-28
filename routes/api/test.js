const express = require("express");
const auth = require("../../middleware/auth");
const UserSales = require("../../models/UserSales");
const BusinessUsers = require("../../models/BusinessUsers");
const UserTarget = require("../../models/UserTarget");
const router = express.Router();
const moment = require("moment");
const User = require("../../models/User");
const { getUSerAchievement } = require("../../components/getUserAchievement");
const { default: mongoose } = require("mongoose");
const { getTeamYTDAch } = require("../../components/getTeamYTDAch");
const { getMonthlyValues } = require("../../components/getMonthlyValue");
const {
  getMonthlySalesValues,
} = require("../../components/getMonthlySalesValues");
const ProductTarget = require("../../models/ProductTarget");

router.get("/:userId/:startMonth/:endMonth/:year", auth, async (req, res) => {
  const { userId, startMonth, endMonth, year } = req.params;
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

  try {
    const userAchievment = await UserTarget.aggregate([
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
                productPrice: "$target.yearTarget.productPrice",
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
                  ],
                },
                isFinal: true,
              },
            },
            {
              $addFields: {
                salesData: {
                  $map: {
                    input: "$salesData",
                    as: "data",
                    in: {
                      $mergeObjects: [
                        "$$data",
                        {
                          month: {
                            $let: {
                              vars: {
                                monthString: {
                                  $dateToString: {
                                    date: "$startDate",
                                    format: "%m",
                                  },
                                },
                              },
                              in: {
                                $switch: {
                                  branches: [
                                    {
                                      case: { $eq: ["$$monthString", "12"] },
                                      then: "January",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "01"] },
                                      then: "February",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "02"] },
                                      then: "March",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "03"] },
                                      then: "April",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "04"] },
                                      then: "May",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "05"] },
                                      then: "June",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "06"] },
                                      then: "July",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "07"] },
                                      then: "August",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "08"] },
                                      then: "September",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "09"] },
                                      then: "October",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "10"] },
                                      then: "November",
                                    },
                                    {
                                      case: { $eq: ["$$monthString", "11"] },
                                      then: "December",
                                    },
                                  ],
                                  default: "Unknown",
                                },
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
                month: { $first: "$salesData.month" },
                price: { $first: "$salesData.price" },
                productId: { $first: "$salesData.product" },
              },
            },
            {
              $project: {
                _id: 1,
                soldQuantity: 1,
                salesValue: 1,
                month: 1,
                price: 1,
                productId: 1,
              },
            },
          ],
          as: "userSales",
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
      // add new field called mergedData merge userSales and productTarget based on month
      {
        $addFields: {
          mergedData: {
            $map: {
              input: "$productTarget",
              as: "target",
              in: {
                $mergeObjects: [
                  "$$target",
                  {
                    soldQuantity: {
                      $ifNull: [
                        {
                          $arrayElemAt: [
                            {
                              $map: {
                                input: {
                                  $filter: {
                                    input: "$userSales",
                                    as: "sales",
                                    cond: {
                                      $eq: ["$$sales.month", "$$target.month"],
                                    },
                                  },
                                },
                                as: "sales",
                                in: "$$sales.soldQuantity",
                              },
                            },
                            0,
                          ],
                        },
                        0,
                      ],
                    },
                    salesValue: {
                      $ifNull: [
                        {
                          $arrayElemAt: [
                            {
                              $map: {
                                input: {
                                  $filter: {
                                    input: "$userSales",
                                    as: "sales",
                                    cond: {
                                      $eq: ["$$sales.month", "$$target.month"],
                                    },
                                  },
                                },
                                as: "sales",
                                in: "$$sales.salesValue",
                              },
                            },
                            0,
                          ],
                        },
                        0,
                      ],
                    },
                    price: {
                      $ifNull: [
                        {
                          $arrayElemAt: [
                            {
                              $map: {
                                input: {
                                  $filter: {
                                    input: "$userSales",
                                    as: "sales",
                                    cond: {
                                      $eq: ["$$sales.month", "$$target.month"],
                                    },
                                  },
                                },
                                as: "sales",
                                in: "$$sales.price",
                              },
                            },
                            0,
                          ],
                        },
                        "$$target.productPrice",
                      ],
                    },
                    productNickName: {
                      $arrayElemAt: ["$product.productNickName", 0],
                    },
                    productImage: {
                      $arrayElemAt: ["$product.imageURL", 0],
                    },
                    targetUnits: {
                      $multiply: ["$$target.targetPercentage", "$targetUnits"],
                    },
                    targetValue: {
                      $multiply: ["$$target.targetPercentage", "$targetValue"],
                    },
                    achievement: {
                      $multiply: [
                        {
                          $divide: [
                            {
                              $ifNull: [
                                {
                                  $arrayElemAt: [
                                    {
                                      $map: {
                                        input: {
                                          $filter: {
                                            input: "$userSales",
                                            as: "sales",
                                            cond: {
                                              $eq: [
                                                "$$sales.month",
                                                "$$target.month",
                                              ],
                                            },
                                          },
                                        },
                                        as: "sales",
                                        in: "$$sales.salesValue",
                                      },
                                    },
                                    0,
                                  ],
                                },
                                0,
                              ],
                            },
                            {
                              $multiply: [
                                "$$target.targetPercentage",
                                "$targetValue",
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
          firstName: { $arrayElemAt: ["$user.firstName", 0] },
          profilePicture: { $arrayElemAt: ["$user.profilePicture", 0] },
          designation: { $arrayElemAt: ["$user.designation", 0] },
          firstMonth: monthOfStart,
          lastMonth: monthOfEnd,
          year: year,
          businessId: 1,
          businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
          businessName: { $arrayElemAt: ["$business.businessName", 0] },
          productNickName: { $arrayElemAt: ["$product.productNickName", 0] },
          productImage: { $arrayElemAt: ["$product.imageURL", 0] },
          targetUnits: { $sum: "$mergedData.targetUnits" },
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
            firstName: "$firstName",
            profilePicture: "$profilePicture",
            designation: "$designation",
            firstMonth: "$firstMonth",
            lastMonth: "$lastMonth",
            year: "$year",
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
          firstName: "$_id.firstName",
          profilePicture: "$_id.profilePicture",
          designation: "$_id.designation",
          firstMonth: "$_id.firstMonth",
          lastMonth: "$_id.lastMonth",
          year: "$_id.year",
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
    return res.status(200).send(userAchievment);
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

router.get(
  "/user-sales/:userId/:startMonth/:endMonth/:year",
  auth,
  async (req, res) => {
    const { userId, startMonth, endMonth, year } = req.params;

    try {
      const start = new Date(year, startMonth - 1, 1);
      const endDate = new Date(year, endMonth, 0);

      const userSales = await UserSales.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
            startDate: { $gte: start },
            endDate: { $lte: endDate },
            isFinal: true,
          },
        },
        {
          $addFields: {
            salesData: {
              $map: {
                input: "$salesData",
                as: "data",
                in: {
                  $mergeObjects: [
                    "$$data",
                    {
                      month: {
                        $let: {
                          vars: {
                            monthString: {
                              $dateToString: {
                                date: "$startDate",
                                format: "%m",
                              },
                            },
                          },
                          in: {
                            $switch: {
                              branches: [
                                {
                                  case: { $eq: ["$$monthString", "12"] },
                                  then: "January",
                                },
                                {
                                  case: { $eq: ["$$monthString", "01"] },
                                  then: "February",
                                },
                                {
                                  case: { $eq: ["$$monthString", "02"] },
                                  then: "March",
                                },
                                {
                                  case: { $eq: ["$$monthString", "03"] },
                                  then: "April",
                                },
                                {
                                  case: { $eq: ["$$monthString", "04"] },
                                  then: "May",
                                },
                                {
                                  case: { $eq: ["$$monthString", "05"] },
                                  then: "June",
                                },
                                {
                                  case: { $eq: ["$$monthString", "06"] },
                                  then: "July",
                                },
                                {
                                  case: { $eq: ["$$monthString", "07"] },
                                  then: "August",
                                },
                                {
                                  case: { $eq: ["$$monthString", "08"] },
                                  then: "September",
                                },
                                {
                                  case: { $eq: ["$$monthString", "09"] },
                                  then: "October",
                                },
                                {
                                  case: { $eq: ["$$monthString", "10"] },
                                  then: "November",
                                },
                                {
                                  case: { $eq: ["$$monthString", "11"] },
                                  then: "December",
                                },
                              ],
                              default: "Unknown",
                            },
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
          $unwind: "$salesData",
        },

        {
          $lookup: {
            from: "products",
            let: { product_id: "$salesData.product" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$product_id"],
                  },
                },
              },
            ],
            as: "product",
          },
        },
        {
          $addFields: {
            salesData: {
              $mergeObjects: [
                "$salesData",
                {
                  salesValue: {
                    $multiply: ["$salesData.quantity", "$salesData.price"],
                  },
                  productNickName: {
                    $arrayElemAt: ["$product.productNickName", 0],
                  },
                  // add field month name depnds on salesData.month in format January, February, March, April, May, June, July, August, September, October, November, December
                },
              ],
            },
          },
        },

        // Replace the root with the "salesData" field
        {
          $replaceRoot: { newRoot: "$salesData" },
        },
      ]);

      const salesData = userSales.reduce((acc, data) => {
        const found = acc.find((item) => item.month === data.month);

        if (!found) {
          acc.push({
            month: data.month,
            salesValue: data.salesValue,
          });
        } else {
          found.salesValue += data.salesValue;
        }

        return acc;
      }, []);

      return res.status(200).send(salesData);
    } catch (error) {
      return res.status(500).send({ error: error.message });
    }
  }
);

module.exports = router;
