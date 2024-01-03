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

router.get("/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const businessUser = await BusinessUsers.find({ userId: userId });
    const businessIds = businessUser.map((business) => business.businessId);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

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

    if (salesVersions.length === 0) {
      return res.status(500).send({
        error: "Oops",
        message: "No Sales Data Found for the specified dates",
      });
    }

    const finalData = salesVersions.reduce((acc, data) => {
      const found = acc.find((a) => a.versionName === data.versionName);

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
          sales: [data.sales],
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
        found.sales.push(data.sales);
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

const getUserAchievement = async (userId, month, year, res) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const selectedMonth = moment(startDate).format("MMMM");

  const userAhc = await UserTarget.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $unwind: "$productsTargets",
    },
    {
      $match: {
        "productsTargets.year": parseInt(year),
      },
    },
    {
      $unwind: "$productsTargets.target",
    },
    {
      $lookup: {
        from: "products",
        foreignField: "_id",
        localField: "productsTargets.target.productId",
        as: "userTargetProduct",
      },
    },
    {
      $lookup: {
        from: "usersales",
        foreignField: "user",
        pipeline: [
          {
            $match: {
              startDate: { $gte: startDate, $lte: endDate },
              endDate: { $gte: startDate, $lte: endDate },
            },
          },
        ],
        localField: "userId",
        as: "sales",
      },
    },
    {
      $addFields: {
        sales: {
          $cond: {
            if: { $eq: [{ $size: "$sales" }, 0] },
            then: [
              {
                salesData: [
                  {
                    product: "$productsTargets.target.productId",
                    quantity: 0,
                    price: 0,
                  },
                ],
              },
            ],
            else: "$sales",
          },
        },
      },
    },
    {
      $unwind: "$sales",
    },
    {
      $unwind: "$sales.salesData",
    },
    {
      $lookup: {
        from: "producttargets",
        foreignField: "productId",
        localField: "productsTargets.target.productId",
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
        "productTarget.target.yearTarget.month": selectedMonth,
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "userId",
        as: "user",
      },
    },
    {
      $lookup: {
        from: "businesses",
        foreignField: "_id",
        localField: "businessId",
        as: "business",
      },
    },
    {
      $group: {
        _id: {
          _id: "$_id",
          businessId: "$businessId",
          businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
          businessName: { $arrayElemAt: ["$business.businessName", 0] },
          currencyCode: {
            $arrayElemAt: ["$userTargetProduct.currencyCode", 0],
          },
          currencyName: {
            $arrayElemAt: ["$userTargetProduct.currencyName", 0],
          },
          currencySymbol: {
            $arrayElemAt: ["$userTargetProduct.currencySymbol", 0],
          },
          userName: { $arrayElemAt: ["$user.userName", 0] },
          designation: { $arrayElemAt: ["$user.designation", 0] },
          email: { $arrayElemAt: ["$user.email", 0] },
          phone: { $arrayElemAt: ["$user.phone", 0] },
          profilePicture: { $arrayElemAt: ["$user.profilePicture", 0] },
        },
        achievement: {
          $push: {
            productId: "$productsTargets.target.productId",
            salesProductId: "$sales.salesData.product",
            salesQuantity: "$sales.salesData.quantity",
            productPrice: "$sales.salesData.price",
            targetUnits: "$productTarget.target.yearTarget.targetUnits",
            targetValue: "$productTarget.target.yearTarget.targetValue",
            targetPhases: "$productTarget.target.yearTarget.targetPhases",
            salesValue: {
              $multiply: [
                "$sales.salesData.quantity",
                "$sales.salesData.price",
              ],
            },
            productName: {
              $arrayElemAt: ["$userTargetProduct.productName", 0],
            },
            productImage: { $arrayElemAt: ["$userTargetProduct.imageURL", 0] },
            costPrice: { $arrayElemAt: ["$userTargetProduct.costPrice", 0] },
            sellingPrice: {
              $arrayElemAt: ["$userTargetProduct.sellingPrice", 0],
            },
            category: { $arrayElemAt: ["$userTargetProduct.category", 0] },
            achievementPercentage: {
              $multiply: [
                {
                  $divide: [
                    "$sales.salesData.quantity",
                    "$productTarget.target.yearTarget.targetUnits",
                  ],
                },
                100,
              ],
            },
          },
        },
      },
    },
    {
      $project: {
        _id: "$_id._id",
        businessId: "$_id.businessId",
        businessLogo: "$_id.businessLogo",
        businessName: "$_id.businessName",
        currencyCode: "$_id.currencyCode",
        currencyName: "$_id.currencyName",
        currencySymbol: "$_id.currencySymbol",
        userName: "$_id.userName",
        designation: "$_id.designation",
        email: "$_id.email",
        phone: "$_id.phone",
        profilePicture: "$_id.profilePicture",
        achievement: 1,
        totalSales: {
          $sum: "$achievement.salesValue",
        },
        totalTargets: {
          $sum: "$achievement.targetValue",
        },
      },
    },
    {
      $project: {
        _id: 1,
        businessId: 1,
        businessLogo: 1,
        businessName: 1,
        currencyCode: 1,
        currencyName: 1,
        currencySymbol: 1,
        userName: 1,
        designation: 1,
        email: 1,
        phone: 1,
        profilePicture: 1,
        achievement: 1,
        totalSales: 1,
        totalTargets: 1,
        // Calculate totalAchievement based on totalSales and totalTargets
        totalAchievement: {
          $multiply: [
            {
              $divide: ["$totalSales", "$totalTargets"],
            },
            100,
          ],
        },
      },
    },
  ]);

  return userAhc;
};

// get user achievement
// for same user
// for managers of the teams and business admins
router.get("/ach/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const monthlySales = await getUserAchievement(userId, month, year, res);

    if (monthlySales.length === 0) {
      return res.status(500).send({
        error: "Oops",
        message: "No Sales or Targets Data Found for the specified dates",
      });
    }

    return res.status(200).send({
      monthlySales,
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something Went wrong, please try again later",
    });
  }
});

// get team achievement
// for same team members
// for managers of the teams and business admins
router.get("/team/ach/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const business = await BusinessUsers.find({ userId: userId });
    const businessIds = business.map((business) => business.businessId);

    const teamData = await BusinessUsers.find({
      businessId: { $in: businessIds },
      isBusinessOwner: false,
    });
    const usersIds = teamData.map((user) => user.userId);

    let teamSales = [];

    for (let i = 0; i < usersIds.length; i++) {
      const userSales = await getUserAchievement(usersIds[i], month, year, res);
      teamSales.push(userSales);
    }

    if (teamSales.length === 0) {
      return res.status(500).send({
        error: "Oops",
        message: "No Sales or Targets Data Found for the specified dates",
      });
    }

    const teamSalesFlat = teamSales.flat();

    const teamSalesGrouped = teamSalesFlat.reduce((acc, curr) => {
      const found = acc.find(
        (a) => a.businessId.toString() === curr.businessId.toString()
      );

      const value = {
        achievement: curr.achievement,
        designation: curr.designation,
        email: curr.email,
        phone: curr.phone,
        profilePicture: curr.profilePicture,
        userName: curr.userName,
        totalSales: curr.totalSales,
        totalTargets: curr.totalTargets,
        totalAchievement: curr.totalAchievement,
        currencyCode: curr.currencyCode,
        currencyName: curr.currencyName,
        currencySymbol: curr.currencySymbol,
      };

      if (!found) {
        acc.push({
          businessId: curr.businessId,
          businessLogo: curr.businessLogo,
          currencyCode: curr.currencyCode,
          currencyName: curr.currencyName,
          currencySymbol: curr.currencySymbol,
          totalSales: curr.totalSales,
          totalTargets: curr.totalTargets,
          teamData: [value],
        });
      } else {
        found.totalSales += curr.totalSales;
        found.totalTargets += curr.totalTargets;
        found.teamAchievement = (found.totalSales / found.totalTargets) * 100;
        found.teamData.push(value);
      }

      return acc;
    }, []);

    return res.status(200).send({
      teamSales: teamSalesGrouped,
    });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.post("/", auth, async (req, res) => {
  const { userId, startDate, endDate, salesData, addingUser, versionName } =
    req.body;

  const existingSales = await UserSales.findOne({
    user: userId,
    versionName: versionName,
    startDate: startDate,
    endDate: endDate,
  });

  if (existingSales) {
    return res.status(400).send({
      error: "DuplicateData",
      message: "Duplicate data already exists.",
    });
  }

  const productId = salesData[0].product;
  const product = await Products.findOne({ _id: productId });
  const businessId = product.businessId;

  const userAdding = await User.findOne({ _id: addingUser });
  try {
    const newSales = new UserSales({
      user: userId,
      versionName: versionName,
      businessId: businessId,
      salesData: salesData,
      startDate: startDate,
      endDate: endDate,
      addedIn: Date.now(),
      updatedIn: Date.now(),
      addingUser: addingUser,
      isFinal: false,
    });

    await UserSales.insertMany(newSales);

    return res.status(200).send({ message: "Users Sales Added Successfully" });
  } catch (error) {
    const newSupportCase = new SupportCase({
      userId: addingUser,
      businessId: businessIds,
      userName: userAdding.userName,
      email: userAdding.email,
      phone: userAdding.phone,
      subject: "Error Adding User Sales",
      message: error.message,
    });

    await SupportCase.insertMany(newSupportCase);
    return res
      .status(500)
      .send({ error: "Error", message: "Error Adding Users Sales" });
  }
});

// change user sales status isFinal
router.put("/isFinal", auth, isCompanyAdmin, async (req, res) => {
  const { userSalesIds, userIds } = req.body;

  try {
    // check if user sales has any isFinal true with the same start and end date
    // Iterate through userSalesIds and userIds arrays
    for (let i = 0; i < userSalesIds.length; i++) {
      const currentSalesId = userSalesIds[i];
      const currentUserId = userIds[i];

      // check if user sales has any isFinal true with the same start and end date
      const userSales = await UserSales.findOne({ _id: currentSalesId });
      const startDate = userSales.startDate;
      const endDate = userSales.endDate;
      const addedIn = userSales.addedIn;

      const existingUserSales = await UserSales.findOne({
        user: currentUserId,
        startDate: { $gte: startDate, $lte: endDate },
        endDate: { $gte: startDate, $lte: endDate },
        isFinal: true,
      });

      // change all isFinal to false
      if (existingUserSales) {
        await UserSales.updateMany(
          {
            user: currentUserId,
            startDate: {
              $gte: startDate,
              $lte: endDate,
            },
            endDate: { $gte: startDate, $lte: endDate },
          },
          {
            $set: { isFinal: false, addedIn: addedIn, updatedIn: Date.now() },
          }
        );
      }

      // change selected userSales isFinal to true
      await UserSales.updateOne(
        { _id: currentSalesId },
        { $set: { isFinal: true, updatedIn: Date.now() } }
      );
    }

    return res
      .status(200)
      .send({ message: "User Sales Status Changed Successfully" });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
