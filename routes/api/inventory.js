const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const BusinessUsers = require("../../models/BusinessUsers");
const Products = require("../../models/Products");
const User = require("../../models/User");
const { default: mongoose } = require("mongoose");
const moment = require("moment");

router.get("/:userId/:startMonth/:endMonth/:year", auth, async (req, res) => {
  const { userId, startMonth, endMonth, year } = req.params;

  const startOfPeriod = new Date(year, startMonth - 1, 1);
  const endOfPeriod = new Date(year, endMonth, 0, 23, 59, 59);

  try {
    const inventory = await BusinessUsers.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $project: {
          _id: 1,
          businessId: 1,
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
          businessName: { $arrayElemAt: ["$business.businessName", 0] },
          businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
          businessType: { $arrayElemAt: ["$business.businessType", 0] },
          currencySymbol: { $arrayElemAt: ["$business.currencySymbol", 0] },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "businessId",
          foreignField: "businessId",
          pipeline: [
            {
              $project: {
                _id: 0,
                productId: "$_id",
                productName: 1,
                productNickName: 1,
                costPrice: 1,
                retailPrice: 1,
                sellingPrice: 1,
                productType: 1,
                quantity: {
                  $cond: {
                    if: { $eq: ["$productType", "Physical"] },
                    then: "$quantity",
                    else: "N/A",
                  },
                },
                productImage: "$imageURL",
                currencySymbol: 1,
              },
            },
          ],
          as: "products",
        },
      },
      {
        $lookup: {
          from: "sales",
          localField: "businessId",
          foreignField: "businessId",
          pipeline: [
            {
              $match: {
                $or: [
                  {
                    startPeriod: {
                      $gte: startOfPeriod,
                      $lte: endOfPeriod,
                    },
                  },
                  {
                    endPeriod: {
                      $gte: startOfPeriod,
                      $lte: endOfPeriod,
                    },
                  },
                ],
                isFinal: true,
                "salesData.status": "Completed",
              },
            },
            {
              $project: {
                salesData: 1,
                _id: 0,
              },
            },
            {
              $unwind: "$salesData",
            },
            {
              $group: {
                _id: "$salesData.productId",
                soldQuantity: { $sum: "$salesData.quantity" },
                soldQuantityWithBonus: { $sum: "$salesData.totalQuantity" },
                salesValue: { $sum: "$salesData.itemValue" },
                productId: { $first: "$salesData.productId" },
              },
            },
          ],
          as: "sales",
        },
      },
      {
        $addFields: {
          products: {
            $map: {
              input: "$products",
              as: "product",
              in: {
                $mergeObjects: [
                  "$$product",
                  {
                    $let: {
                      vars: {
                        saleItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$sales",
                                as: "sale",
                                cond: {
                                  $eq: [
                                    "$$sale.productId",
                                    "$$product.productId",
                                  ],
                                },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: {
                        soldQuantity: {
                          $ifNull: ["$$saleItem.soldQuantity", 0],
                        },
                        soldQuantityWithBonus: {
                          $ifNull: ["$$saleItem.soldQuantityWithBonus", 0],
                        },
                        salesValue: { $ifNull: ["$$saleItem.salesValue", 0] },
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
        $project: {
          _id: 0,
          businessId: 1,
          businessName: 1,
          businessLogo: 1,
          businessType: 1,
          currencySymbol: 1,
          products: 1,
        },
      },
    ]);

    return res.status(200).json({ inventory });
  } catch (error) {
    return res.status(500).send({
      message: error.message,
    });
  }
});

router.put("/:businessId", async (req, res) => {
  const { businessId } = req.params;

  try {
    await Products.updateMany(
      { businessId: businessId },
      {
        $set: {
          productType: "Physical",
        },
      }
    );

    return res.status(200).json({
      message: "All products updated to physical",
    });
  } catch (error) {
    return res.status(500).send({
      message: error.message,
    });
  }
});

module.exports = router;
