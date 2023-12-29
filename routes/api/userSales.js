const express = require("express");
const router = express.Router();
const UserSales = require("../../models/UserSales");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const SupportCase = require("../../models/SupportCase");
const auth = require("../../middleware/auth");
const Sales = require("../../models/Sales");
const moment = require("moment");
const { default: mongoose } = require("mongoose");
const UserTarget = require("../../models/UserTarget");

// router.get("/", auth, async (req, res) => {
//   return res.status(200).json({ msg: "User Sales Route" });
// });

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
      $unwind: "$sales",
    },
    {
      $set: {
        "sales.salesData": {
          $filter: {
            input: "$sales.salesData",
            as: "sale",
            cond: {
              $eq: ["$$sale.product", "$productsTargets.target.productId"],
            },
          },
        },
      },
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
      $group: {
        _id: {
          _id: "$_id",
          businessId: "$businessId",
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
        currencyCode: "$_id.currencyCode",
        currencyName: "$_id.currencyName",
        currencySymbol: "$_id.currencySymbol",
        userName: "$_id.userName",
        designation: "$_id.designation",
        email: "$_id.email",
        phone: "$_id.phone",
        profilePicture: "$_id.profilePicture",
        achievement: 1,
      },
    },
  ]);

  // Continue with any additional pipeline stages or handling of results...

  return userAhc;
};

router.get("/ach/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const userSales = await getUserAchievement(userId, month, year, res);

    if (userSales.length === 0) {
      return res.status(500).send({
        error: "Oops",
        message: "No Sales or Targets Data Found for the specified dates",
      });
    }

    const userAchievement = userSales[0].achievement;
    const targetValues = userAchievement
      .map((target) => target.targetValue)
      .reduce((a, b) => a + b, 0);
    const salesValues = userAchievement
      .map((target) => target.salesQuantity * target.productPrice)
      .reduce((a, b) => a + b, 0);
    const targetAch = (salesValues / targetValues) * 100;

    if (userSales.length === 0) {
      return res.status(500).send({
        error: "Oops",
        message: "No Sales or Targets Data Found for the specified dates",
      });
    }

    return res.status(200).send({ userSales, targetAch });
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

  const business = await BusinessUsers.find({ userId: addingUser });
  const businessIds = business.map((business) => business.businessId);

  const userAdding = await User.findOne({ _id: addingUser });
  try {
    const newSales = new UserSales({
      user: userId,
      versionName: versionName,
      businessId: businessIds,
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

module.exports = router;
