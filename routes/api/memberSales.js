const express = require("express");
const router = express.Router();
const UserSales = require("../../models/UserSales");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const SupportCase = require("../../models/SupportCase");
const auth = require("../../middleware/auth");
const Sales = require("../../models/Sales");
const Products = require("../../models/Products");
const moment = require("moment");
const { default: mongoose } = require("mongoose");
const UserTarget = require("../../models/UserTarget");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");

// @route   GET api/memberSales
router.get("/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    console.log(startDate, endDate);

    const salesVersions = await UserSales.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          startDate: { $gte: startDate, $lte: endDate },
          endDate: { $gte: startDate, $lte: endDate },
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
                  $multiply: ["$salesData.quantity", "$salesData.price"],
                },
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
                achievement: {
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
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "addingUser",
          foreignField: "_id",
          as: "addingUser_details",
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
          versionName: 1,
          businessId: 1,
          businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
          businessName: { $arrayElemAt: ["$business.businessName", 0] },
          addingUser: { $arrayElemAt: ["$addingUser_details._id", 0] },
          addedBy: { $arrayElemAt: ["$addingUser_details.userName", 0] },
          addedByDesignation: {
            $arrayElemAt: ["$addingUser_details.designation", 0],
          },
          addedByProfilePicture: {
            $arrayElemAt: ["$addingUser_details.profilePicture", 0],
          },
          salesData: 1,
          addedIn: 1,
          updatedIn: 1,
          totalSalesValue: { $sum: "$salesData.salesValue" },
          totalTargetValue: { $sum: "$salesData.targetValue" },
          totalAchievement: {
            $multiply: [
              {
                $divide: [
                  {
                    $sum: "$salesData.salesValue",
                  },
                  {
                    $sum: "$salesData.targetValue",
                  },
                ],
              },
              100,
            ],
          },
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
        },
      },
      {
        $group: {
          _id: {
            versionName: "$versionName",
            businessId: "$businessId",
            businessLogo: "$businessLogo",
            businessName: "$businessName",
            addingUser: "$addingUser",
            addedBy: "$addedBy",
            addedByDesignation: "$addedByDesignation",
            addedByProfilePicture: "$addedByProfilePicture",
            addedIn: "$addedIn",
            updatedIn: "$updatedIn",
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
          },
          salesData: { $addToSet: "$salesData" },
          totalSalesValue: { $sum: "$salesData.salesValue" },
          totalTargetValue: { $sum: "$salesData.targetValue" },
          totalAchievement: { $first: "$totalAchievement" },
        },
      },
      {
        $project: {
          versionName: "$_id.versionName",
          businessId: "$_id.businessId",
          businessLogo: "$_id.businessLogo",
          businessName: "$_id.businessName",
          addingUser: "$_id.addingUser",
          addedBy: "$_id.addedBy",
          addedByDesignation: "$_id.addedByDesignation",
          addedByProfilePicture: "$_id.addedByProfilePicture",
          addedIn: "$_id.addedIn",
          updatedIn: "$_id.updatedIn",
          startDate: "$_id.startDate",
          endDate: "$_id.endDate",
          sales: {
            salesData: "$salesData",
            userName: "$_id.userName",
            designation: "$_id.designation",
            profilePicture: "$_id.profilePicture",
            userId: "$_id.userId",
            userSalesId: "$_id.userSalesId",
            isFinal: "$_id.isFinal",
          },
          totalSalesValue: "$totalSalesValue",
          totalTargetValue: "$totalTargetValue",
          totalAchievement: "$totalAchievement",
          currencyName: "$_id.currencyName",
          currencyCode: "$_id.currencyCode",
          currencySymbol: "$_id.currencySymbol",
        },
      },
    ]);

    // return res.status(200).json({ salesVersions: salesVersions[0] });

    if (salesVersions.length === 0) {
      return res.status(500).send({
        error: "Oops",
        message: "No Sales Data Found for the specified dates",
      });
    }

    const finalData = salesVersions.reduce((acc, data) => {
      const found = acc.find((a) => a.versionName === data.versionName);

      let salesDetails = data.sales.salesData;
      const uniqueSales = salesDetails.reduce((item, curr) => {
        const itemFound = item.find((a) => a.product === curr.product);

        if (!itemFound) {
          item.push(curr);
        } else {
          // return without pushing to return unique array
          return item;
        }

        return item;
      }, []);

      if (!found) {
        acc.push({
          versionName: data.versionName,
          businessId: data.businessId,
          businessLogo: data.businessLogo,
          businessName: data.businessName,
          addingUser: data.addingUser,
          addedBy: data.addedBy,
          addedByDesignation: data.addedByDesignation,
          addedByProfilePicture: data.addedByProfilePicture,
          addedIn: data.addedIn,
          updatedIn: data.updatedIn,
          sales: [
            {
              salesData: uniqueSales,
              userName: data.sales.userName,
              designation: data.sales.designation,
              profilePicture: data.sales.profilePicture,
              userId: data.sales.userId,
              userSalesId: data.sales.userSalesId,
              isFinal: data.sales.isFinal,
            },
          ],
          totalSalesValue: data.totalSalesValue,
          totalTargetValue: data.totalTargetValue,
          totalAchievement: data.totalAchievement,
          isFinal: data.isFinal,
          startDate: data.startDate,
          endDate: data.endDate,
          currencyName: data.currencyName,
          currencyCode: data.currencyCode,
          currencySymbol: data.currencySymbol,
        });
      } else {
        found.sales.push({
          salesData: uniqueSales,
          userName: data.sales.userName,
          designation: data.sales.designation,
          profilePicture: data.sales.profilePicture,
          userId: data.sales.userId,
          userSalesId: data.sales.userSalesId,
          isFinal: data.sales.isFinal,
        });
        found.totalSalesValue += data.totalSalesValue;
        found.totalTargetValue += data.totalTargetValue;
        found.totalAchievement =
          (found.totalSalesValue / found.totalTargetValue) * 100;
      }

      return acc;
    }, []);

    return res.status(200).json({ salesVersions: finalData });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

module.exports = router;
