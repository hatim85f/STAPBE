const express = require("express");
const auth = require("../../middleware/auth");
const UserSales = require("../../models/UserSales");
const BusinessUsers = require("../../models/BusinessUsers");
const UserTarget = require("../../models/UserTarget");
const router = express.Router();
const moment = require("moment");

router.get("/:user_id/:month/:year", auth, async (req, res) => {
  const { user_id, month, year } = req.params;

  const businessUser = await BusinessUsers.find({ userId: user_id });

  if (businessUser.length === 0) {
    return res.status(400).send({ error: "No business found" });
  }
  const businessIds = businessUser.map((business) => business.businessId);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  try {
    const salesVersions = await UserSales.aggregate([
      {
        $match: {
          businessId: { $in: businessIds },
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
          totalSalesValue: { $sum: "$salesData.salesValue" },
          totalTargetValie: { $sum: "$salesData.targetValue" },
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
          isFinal: 1,
          startDate: 1,
          endDate: 1,
        },
      },
      {
        $group: {
          _id: {
            _id: "$_id",
            versionName: "$versionName",
            businessId: "$businessId",
            businessLogo: "$businessLogo",
            businessName: "$businessName",
            addingUser: "$addingUser",
            addedBy: "$addedBy",
            addedByDesignation: "$addedByDesignation",
            addedByProfilePicture: "$addedByProfilePicture",
            addedIn: "$addedIn",
            userName: "$userName",
            designation: "$designation",
            profilePicture: "$profilePicture",
            isFinal: "$isFinal",
            userId: "$userId",
            startDate: "$startDate",
            endDate: "$endDate",
          },
          salesData: { $addToSet: "$salesData" },
          totalSalesValue: { $sum: "$salesData.salesValue" },
          totalTargetValie: { $sum: "$salesData.targetValue" },
          totalAchievement: { $first: "$totalAchievement" },
        },
      },
      {
        $project: {
          _id: "$_id._id",
          versionName: "$_id.versionName",
          businessId: "$_id.businessId",
          businessLogo: "$_id.businessLogo",
          businessName: "$_id.businessName",
          addingUser: "$_id.addingUser",
          addedBy: "$_id.addedBy",
          addedByDesignation: "$_id.addedByDesignation",
          addedByProfilePicture: "$_id.addedByProfilePicture",
          addedIn: "$_id.addedIn",
          startDate: "$_id.startDate",
          endDate: "$_id.endDate",
          sales: {
            salesData: "$salesData",
            userName: "$_id.userName",
            designation: "$_id.designation",
            profilePicture: "$_id.profilePicture",
            userId: "$_id.userId",
          },
          totalSalesValue: "$totalSalesValue",
          totalTargetValie: "$totalTargetValie",
          totalAchievement: "$totalAchievement",
          isFinal: "$_id.isFinal",
        },
      },
    ]);

    return res.status(200).json({ salesVersions });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
