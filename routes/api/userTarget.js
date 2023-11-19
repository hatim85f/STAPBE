const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const UserTarget = require("../../models/UserTarget");
const ProductTarget = require("../../models/ProductTarget");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const { default: mongoose } = require("mongoose");
const Product = require("../../models/Products");
const BusinessUsers = require("../../models/BusinessUsers");

const getTarget = async (userId, year, res) => {
  const userTarget = await UserTarget.aggregate([
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
  ]);

  if (!userTarget || userTarget.length === 0) {
    errorMessage = "No target found for the specified year";
    return;
  }

  let currencyCode;
  let currencySymbol;
  let currencyName;

  const userTargetData = {
    userId,
    year,
    businessId: userTarget[0].businessId,
    currencyName,
    currencyCode,
    currencySymbol,
    productsTarget: [],
  };

  for (let data of userTarget) {
    const productsTarget = data.productsTargets.target;

    for (let details of productsTarget) {
      const product = await Product.findOne({ _id: details.productId });

      userTargetData.currencyCode = product.currencyCode;
      userTargetData.currencySymbol = product.currencySymbol;
      userTargetData.currencyName = product.currencyName;

      const productTarget = await ProductTarget.findOne({
        productId: product._id,
      });

      const neededTarget = productTarget.target.find(
        (x) => x.year === parseInt(year)
      );

      let target = [];

      // return;

      for (let targets of neededTarget.yearTarget) {
        target.push({
          monthName: targets.month,
          targetUnits:
            (details.targetUnits * parseInt(targets.targetPhases)) / 100,

          targetValue:
            (details.targetValue * parseInt(targets.targetPhases)) / 100,
          monthPhasing: targets.targetPhases,
        });
      }

      userTargetData.productsTarget.push({
        productId: product._id,
        productNickName: product.productNickName,
        costPrice: neededTarget.yearTarget[0].productPrice,
        retailPrice: product.retailPrice,
        startPeriod: neededTarget.yearTarget[0].startPeriod,
        endPeriod: neededTarget.yearTarget[0].endPeriod,
        addedIn: neededTarget.yearTarget[0].addedIn,
        updatedIn: neededTarget.yearTarget[0].updatedIn,
        totalUnits: +target
          .map((a) => a.targetUnits)
          .reduce((a, b) => a + b, 0)
          .toFixed(0),
        totalValue: +target
          .map((a) => a.targetValue)
          .reduce((a, b) => a + b, 0)
          .toFixed(2),
        target: target,
      });
    }
  }

  return userTargetData;
};

// @route   GET api/userTarget
// @desc    Get all userTargets
// @access  Private
router.get("/:userId/:year", auth, async (req, res) => {
  const { userId, year } = req.params;

  try {
    const userTargetData = await getTarget(userId, year, res);

    if (!userTargetData) {
      return res.status(400).send({
        error: "Error",
        message: "No target found for the specified year",
      });
    }

    return res.status(200).send({ userTargetData });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.get("/teamTarget/:userId/:year", auth, async (req, res) => {
  const { userId, year } = req.params;

  try {
    const userTeam = await BusinessUsers.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isBusinessOwner: true,
        },
      },
      {
        $lookup: {
          from: "businessusers",
          localField: "businessId",
          foreignField: "businessId",
          as: "businessUsers",
        },
      },
      {
        $unwind: "$businessUsers",
      },
      {
        $match: {
          "businessUsers.isBusinessOwner": false,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "businessUsers.userId",
          foreignField: "_id",
          as: "users",
        },
      },
      {
        $unwind: "$users",
      },

      {
        $project: {
          _id: "$users._id",
          userName: "$users.userName",
          businessId: "$businessId",
          profilePicture: "$users.profilePicture",
          userType: "$users.userType",
        },
      },
    ]);

    let usersTarget = [];

    for (let data of userTeam) {
      const userTargetData = await getTarget(data._id, year, res);

      // if (!userTargetData) {
      //   return res.status(400).send({
      //     error: "Error",
      //     message: "No target found for the specified year",
      //   });
      // }

      usersTarget.push({
        _id: data._id,
        userName: data.userName,
        businessId: data.businessId,
        profilePicture: data.profilePicture,
        userType: data.userType,

        target: userTargetData,
      });
    }

    return res.status(200).send({ usersTarget });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// @route   POST api/userTarget
// @desc    Add new userTarget
// @access  Private only admin or business owner
router.post("/", auth, isCompanyAdmin, async (req, res) => {
  const { userTargetData, year } = req.body;

  let message = [];
  let tailMessage;

  try {
    for (let data of userTargetData) {
      const isUserTarget = await UserTarget.findOne({ userId: data._id });

      if (isUserTarget) {
        const sameYearIndex = isUserTarget.productsTargets.findIndex(
          (target) => target.year === year
        );

        if (sameYearIndex !== -1) {
          const sameYearTarget =
            isUserTarget.productsTargets[sameYearIndex].target;

          const sameProductIndex = sameYearTarget.findIndex(
            (prod) => prod.productId.toString() === data.productId
          );

          if (sameProductIndex !== -1) {
            // Product exists for the specified year, update the target
            await UserTarget.updateOne(
              {
                userId: data._id,
                "productsTargets.year": year,
              },
              {
                $set: {
                  "productsTargets.$[yearFilter].target.$[productFilter].targetUnits":
                    data.targetUnits,
                  "productsTargets.$[yearFilter].target.$[productFilter].targetValue":
                    data.targetValue,
                },
              },
              {
                arrayFilters: [
                  { "yearFilter.year": year },
                  { "productFilter.productId": data.productId },
                ],
              }
            );
            message.push(`${data.userName}`);
            tailMessage = "updated Successfully";
          } else {
            await UserTarget.updateOne(
              { userId: data._id, "productsTargets.year": year },
              {
                $push: {
                  "productsTargets.$.target": {
                    productId: data.productId,
                    targetUnits: data.targetUnits,
                    targetValue: data.targetValue,
                  },
                },
              }
            );
            message.push(`${data.userName}`);
            tailMessage = "added Successfully";
          }
        } else {
          // Year doesn't exist, add a new object with the target
          await UserTarget.updateMany(
            {
              userId: data._id,
            },
            {
              $push: {
                productsTargets: {
                  year: year,
                  target: [
                    {
                      productId: data.productId,
                      targetUnits: data.targetUnits,
                      targetValue: data.targetValue,
                    },
                  ],
                },
              },
            }
          );
          message.push(`${data.userName}`);
          tailMessage = `for ${year} added sucessfully`;
        }
      } else {
        // User doesn't have any targets, create a new document
        const newUserTarget = new UserTarget({
          userId: data._id,
          businessId: data.businessId,
          productsTargets: [
            {
              year: year,
              target: [
                {
                  productId: data.productId,
                  targetUnits: data.targetUnits,
                  targetValue: data.targetValue,
                },
              ],
            },
          ],
        });

        await UserTarget.insertMany(newUserTarget);

        message.push(`${data.userName}`);
        tailMessage = `for ${year} has been created successfully`;
      }
    }

    return res.status(200).send({
      message: `Target for ${message.join(", ")} ${tailMessage}`,
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong, please try again later",
    });
  }
});

module.exports = router;

// _id: 1,
// userId: 1,
// businessId: 1,
// productsTargets: 1,
// product_target_details: {
//   $filter: {
//     input: "$product_target_details.target",
//     as: "product_target",
//     cond: {
//       $eq: ["$$product_target.year", parseInt(year)],
//     },
//   },
// },
