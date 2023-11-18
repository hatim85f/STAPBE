const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const User = require("../../models/User");
const UserTarget = require("../../models/UserTarget");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const { default: mongoose } = require("mongoose");

// @route   GET api/userTarget
// @desc    Get all userTargets
// @access  Private
router.get("/:userId/:year", auth, async (req, res) => {
  const { userId, year } = req.params;

  try {
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
      {
        $lookup: {
          from: "producttargets",
          localField: "productsTargets.target.productId",
          foreignField: "productId",
          as: "product_target_details",
        },
      },
      {
        $unwind: "$product_target_details",
      },
      {
        $unwind: "$product_target_details.target",
      },
      {
        $match: {
          "product_target_details.target.year": parseInt(year),
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product_target_details.productId",
          foreignField: "_id",
          as: "product_details",
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          businessId: 1,
          productNickName: {
            $arrayElemAt: ["$product_details.productNickName", 0],
          },
          costPrice: {
            $arrayElemAt: [
              "$product_target_details.target.yearTarget.productPrice",
              0,
            ],
          },
          retailPrice: { $arrayElemAt: ["$product_details.retailPrice", 0] },
          currencyName: "$product_target_details.currencyName",
          currencyCode: "$product_target_details.currencyCode",
          currencySymbol: "$product_target_details.currencySymbol",
          monthName: "$product_target_details.target.yearTarget.month",
          // targetUnits: {
          //   $multiply: [
          //     "$productsTargets.target.targetUnits",
          //     "$product_target_details.target.yearTarget.targetUnits",
          //   ],
          // },
          // targetValue: {
          //   $multiply: [
          //     "$productsTargets.target.targetValue",
          //     "$product_target_details.target.yearTarget.targetValue",
          //   ],
          // },
          // monthPhasing:
          //   "$product_target_details.target.yearTarget.targetPhases",
        },
      },
      // {
      //   $group: {
      //     _id: {
      //       _id: "$_id",
      //       userId: "$userId",
      //       businessId: "$businessId",
      //       productNickName: "$productNickName",
      //       costPrice: "$costPrice",
      //       retailPrice: "$retailPrice",
      //       currencyName: "$currencyName",
      //       currencyCode: "$currencyCode",
      //       currencySymbol: "$currencySymbol",
      //     },
      //     productsTarget: {
      //       $push: {
      //         monthName: "$monthName",
      //         target: {
      //           monthName: "$monthName",
      //           targetUnits: "$targetUnits",
      //           targetValue: "$targetValue",
      //           monthPhasing: "$monthPhasing",
      //         },
      //       },
      //     },
      //   },
      // },
      // {
      //   $group: {
      //     _id: {
      //       userId: "$_id.userId",
      //       businessId: "$_id.businessId",
      //     },
      //     userTarget: {
      //       $push: {
      //         _id: "$_id._id",
      //         userId: "$_id.userId",
      //         businessId: "$_id.businessId",
      //         productsTarget: "$productsTarget",
      //       },
      //     },
      //   },
      // },
    ]);

    if (!userTarget) {
      return res.status(404).send({ error: "No target found" });
    }

    return res.status(200).send({ userTarget });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
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
