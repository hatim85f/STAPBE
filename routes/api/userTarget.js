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
const SupportCase = require("../../models/SupportCase");
const Business = require("../../models/Business");

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
    totalValue: 0,
    productsTarget: [],
  };

  for (let data of userTarget) {
    const productsTarget = data.productsTargets.target;

    const totalTargetValue = productsTarget
      .map((a) => a.targetValue)
      .reduce((a, b) => a + b, 0);

    for (let details of productsTarget) {
      const product = await Product.findOne({ _id: details.productId });

      userTargetData.currencyCode = product.currencyCode;
      userTargetData.currencySymbol = product.currencySymbol;
      userTargetData.currencyName = product.currencyName;
      userTargetData.totalValue = totalTargetValue;

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
  const business = await BusinessUsers.findOne({
    userId,
  });

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
    const user = await User.findOne({ _id: userId });

    const newSupportCase = new SupportCase({
      userId,
      userName: user.userName,
      businessId: business.businessId,
      email: user.email,
      phone: user.phone,
      subject: "Error in getting user target",
      message: err.message,
    });

    await SupportCase.insertMany(newSupportCase);
    console.error(err.message);
    res.status(500).send({
      error: "Error",
      message: "Something went wrong, please try again later",
    });
  }
});

router.get("/teamTarget/:userId/:year", auth, async (req, res) => {
  const { userId, year } = req.params;

  const business = await BusinessUsers.findOne({
    userId,
  });

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
        $lookup: {
          from: "usertargets",
          localField: "users._id",
          foreignField: "userId",
          as: "userTarget",
        },
      },
      {
        $unwind: "$userTarget",
      },
      {
        $unwind: "$userTarget.productsTargets",
      },
      {
        $match: {
          "userTarget.productsTargets.year": parseInt(year),
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "userTarget.productsTargets.target.productId",
          foreignField: "_id",
          as: "products",
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
        $project: {
          _id: "$users._id",
          userName: "$users.userName",
          profilePicture: "$users.profilePicture",
          userType: "$users.userType",
          businessId: "$businessUsers.businessId",
          target: {
            currencyName: { $arrayElemAt: ["$products.currencyName", 0] },
            currencyCode: { $arrayElemAt: ["$products.currencyCode", 0] },
            currencySymbol: { $arrayElemAt: ["$products.currencySymbol", 0] },
            totalValue: {
              $reduce: {
                input: "$userTarget.productsTargets.target",
                initialValue: 0,
                in: {
                  $sum: ["$$value", "$$this.targetValue"],
                },
              },
            },
            productsTarget: {
              $map: {
                input: "$userTarget.productsTargets.target",
                as: "target",
                in: {
                  productId: "$$target.productId",
                  productNickName: {
                    $arrayElemAt: [
                      "$products.productNickName",
                      {
                        $indexOfArray: ["$products._id", "$$target.productId"],
                      },
                    ],
                  },
                  totalUnits: "$$target.targetUnits",
                  totalValue: "$$target.targetValue",
                  costPrice: {
                    $arrayElemAt: [
                      "$products.costPrice",
                      {
                        $indexOfArray: ["$products._id", "$$target.productId"],
                      },
                    ],
                  },
                  retailPrice: {
                    $arrayElemAt: [
                      "$products.retailPrice",
                      {
                        $indexOfArray: ["$products._id", "$$target.productId"],
                      },
                    ],
                  },
                  startPeriod: {
                    $arrayElemAt: [
                      "$productTarget.target.yearTarget.startPeriod",
                      {
                        $indexOfArray: [
                          "$productTarget.target.yearTarget.month",
                          "$$target.monthName",
                        ],
                      },
                    ],
                  },
                  endPeriod: {
                    $arrayElemAt: [
                      "$productTarget.target.yearTarget.endPeriod",
                      {
                        $indexOfArray: [
                          "$productTarget.target.yearTarget.month",
                          "$$target.monthName",
                        ],
                      },
                    ],
                  },
                  addedIn: {
                    $arrayElemAt: [
                      "$productTarget.target.yearTarget.addedIn",
                      {
                        $indexOfArray: [
                          "$productTarget.target.yearTarget.month",
                          "$$target.monthName",
                        ],
                      },
                    ],
                  },
                  updatedIn: {
                    $arrayElemAt: [
                      "$productTarget.target.yearTarget.updatedIn",
                      {
                        $indexOfArray: [
                          "$productTarget.target.yearTarget.month",
                          "$$target.monthName",
                        ],
                      },
                    ],
                  },
                  target: {
                    $map: {
                      input: "$productTarget.target.yearTarget",
                      as: "yearTarget",
                      in: {
                        monthName: "$$yearTarget.month",
                        targetUnits: {
                          $multiply: [
                            "$$target.targetUnits",
                            {
                              $divide: [
                                {
                                  $toDouble: {
                                    $replaceOne: {
                                      input: "$$yearTarget.targetPhases",
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
                          $trunc: {
                            $multiply: [
                              "$$target.targetValue",
                              {
                                $divide: [
                                  {
                                    $toDouble: {
                                      $replaceOne: {
                                        input: "$$yearTarget.targetPhases",
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
                        },
                        monthPhasing: "$$yearTarget.targetPhases",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      {
        $group: {
          _id: "$_id",
          userName: { $first: "$userName" },
          profilePicture: { $first: "$profilePicture" },
          userType: { $first: "$userType" },
          businessId: { $first: "$businessId" },
          target: {
            $first: "$target",
          },
        },
      },
    ]);

    return res.status(200).send({
      usersTarget: userTeam.sort(
        (a, b) => a.target.totalValue - b.target.totalValue
      ),
    });
  } catch (error) {
    const user = await User.findOne({ _id: userId });

    const newSupportCase = new SupportCase({
      userId,
      userName: user.userName,
      email: user.email,
      businessId: business.businessId,
      phone: user.phone,
      subject: "Error in getting team target",
      message: error.message,
    });

    await SupportCase.insertMany(newSupportCase);
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong, please try again later",
    });
  }
});

// get business target values and details of business
// priveate route
router.get("/business-target/:userId/:year", auth, async (req, res) => {
  const { userId, year } = req.params;

  try {
    // Get business details for the user
    const userBusiness = await BusinessUsers.find({
      userId: userId,
      isBusinessOwner: true,
    });

    // Extract businessIds from userBusiness
    const businessesIds = userBusiness.map((business) => business.businessId);

    // Aggregate business targets for the specified year
    const businessTargets = await ProductTarget.aggregate([
      {
        $match: {
          businessId: { $in: businessesIds },
          "target.year": parseInt(year),
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
        $group: {
          _id: "$businessId",
          targetValue: { $sum: "$target.totalValue" },
        },
      },
    ]);

    // Get business details for the aggregated businessIds
    const businessDetails = await Business.find({
      _id: { $in: businessesIds },
    });

    // Combine business details with aggregated target values
    const finalBusinessTarget = businessDetails.map((business) => {
      const targetValue = businessTargets.find(
        (target) => target._id.toString() === business._id.toString()
      );

      return {
        _id: business._id,
        businessName: business.businessName,
        businessLogo: business.businessLogo,
        currencyCode: business.currencyCode,
        currencySymbol: business.currencySymbol,
        currencyName: business.currencyName,
        targetValue: targetValue ? targetValue.targetValue : 0,
      };
    });

    return res.status(200).send({ finalBusinessTarget });
  } catch (error) {
    // Handle errors and log them
    const user = await User.findOne({ _id: userId });
    const business = await BusinessUsers.findOne({ userId });
    const newSupportCase = new SupportCase({
      userId,
      userName: user.userName,
      email: user.email,
      businessId: business.businessId,
      phone: user.phone,
      subject: `Error in getting business target details for userId ${userId}`,
      message: error.message,
    });

    await SupportCase.insertMany(newSupportCase);

    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// get business target values and details of business
// priveate route
router.get(
  "/single-business-target/:businessId/:year",
  auth,
  async (req, res) => {
    const { businessId, year } = req.params;

    try {
      const businessTarget = await ProductTarget.aggregate([
        {
          $match: {
            businessId: new mongoose.Types.ObjectId(businessId),
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
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "productDetails",
          },
        },

        {
          $project: {
            _id: 1,
            productId: 1,
            businessId: 1,
            productNickName: {
              $arrayElemAt: ["$productDetails.productNickName", 0],
            },
            costPrice: { $arrayElemAt: ["$productDetails.costPrice", 0] },
            retailPrice: { $arrayElemAt: ["$productDetails.retailPrice", 0] },
            productImage: { $arrayElemAt: ["$productDetails.imageURL", 0] },
            currencyName: { $arrayElemAt: ["$productDetails.currencyName", 0] },
            quantity: { $arrayElemAt: ["$productDetails.quantity", 0] },
            category: { $arrayElemAt: ["$productDetails.category", 0] },
            target: 1,
          },
        },
      ]);

      const businessData = await Business.findOne({
        _id: businessId,
      });

      const finalBusinessDetails = {
        businessName: businessData.businessName,
        businessLogo: businessData.businessLogo,
        currencyCode: businessData.currencyCode,
        currencySymbol: businessData.currencySymbol,
        currencyName: businessData.currencyName,
        businessTarget,
      };

      return res.status(200).json({ businessTarget: finalBusinessDetails });
    } catch (error) {
      return res.status(500).send({
        error: "Error",
        message: error.message,
      });
    }
  }
);

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
