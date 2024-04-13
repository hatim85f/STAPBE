const express = require("express");
const auth = require("../../middleware/auth");
const Products = require("../../models/Products");
const { default: mongoose } = require("mongoose");
const Business = require("../../models/Business");
const Eligibility = require("../../models/Eligibility");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const router = express.Router();

// @route   GET api/products
// @desc    Get all products for the business
// @access  Private
router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;

  try {
    const businessUser = await BusinessUsers.find({ userId });

    const businessIds = businessUser.map((business) => business.businessId);

    const products = await Products.aggregate([
      {
        $match: {
          businessId: { $in: businessIds },
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
          productName: 1,
          productNickName: 1,
          costPrice: 1,
          retailPrice: 1,
          sellingPrice: 1,
          description: 1,
          imageURL: 1,
          minimumDiscount: 1,
          maximumDiscount: 1,
          category: 1,
          productType: 1,
          currencyCode: 1,
          currencyName: 1,
          currencySymbol: 1,
          quantity: 1,
          businessName: { $arrayElemAt: ["$business.businessName", 0] },
          businessLogo: { $arrayElemAt: ["$business.businessLogo", 0] },
        },
      },
    ]);

    return res.status(200).json({ products });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

// @route   POST api/products
// @desc    Create a new product
// @access  Private
router.post("/", auth, async (req, res) => {
  const {
    userId,
    businessId,
    productName,
    productNickName,
    costPrice,
    retailPrice,
    sellingPrice,
    description,
    imageURL,
    minimumDiscount,
    maximumDiscount,
    category,
    productType,
    quantity,
  } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    let targeted_user_id = userId;

    if (
      user.userType !== "Business Owner" &&
      user.userType === "Business Admin"
    ) {
      const businessOwner = await BusinessUsers.findOne({
        businessId,
        isBusinessOwner: true,
      });
      targeted_user_id = businessOwner.userId;
    }

    // check if product with the same name is already exists under the same business

    // check user eligibility to create new product
    const userEligibilty = await Eligibility.findOne({
      userId: targeted_user_id,
    });
    const productsEligibility = userEligibilty.products;

    if (productsEligibility === 0) {
      return res.status(500).json({
        error: "Error",
        message:
          "You are not eligible to add new product, Kindly check your package details. You can upgrade your package from the packages page",
      });
    }

    const product = await Products.findOne({
      businessId,
      productName,
    });

    if (product) {
      return res.status(500).json({
        error: "Error",
        message: `Product ${productName} already exists under this business`,
      });
    }

    const business = await Business.findOne({ _id: businessId });

    const newProduct = new Products({
      businessId,
      productName,
      productNickName,
      costPrice,
      retailPrice,
      sellingPrice,
      description,
      imageURL,
      minimumDiscount,
      maximumDiscount,
      category: category.trim(),
      productType,
      currencyCode: business.currencyCode,
      currencyName: business.currencyName,
      currencySymbol: business.currencySymbol,
      quantity,
    });

    // return res.status(200).send({ newProduct });

    await Products.insertMany(newProduct);

    await Eligibility.updateOne({ userId }, { $inc: { products: -1 } });

    return res.status(200).json({
      newProduct,
      message: `Product ${productNickName} created Successfully`,
    });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

// @route   PUT api/products
// @desc    Update a product
// @access  Private
router.put("/", auth, async (req, res) => {
  const {
    productId,
    productName,
    productNickName,
    productType,
    costPrice,
    retailPrice,
    sellingPrice,
    description,
    imageURL,
    minimumDiscount,
    maximumDiscount,
    category,
    quantity,
  } = req.body;

  try {
    const product = await Products.updateOne(
      { _id: productId },
      {
        $set: {
          productName,
          productNickName,
          costPrice,
          retailPrice,
          sellingPrice,
          description,
          imageURL,
          minimumDiscount,
          maximumDiscount,
          category,
          productType,
          quantity,
        },
      }
    );

    return res.status(200).json({
      product,
      message: `Product ${productNickName} updated Successfully`,
    });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

// @route   DELETE api/products
// @desc    Delete a product
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  const productId = req.params.id;

  // aggregate by taking businessId in product to get the id of the business
  // then aggregate to get the userId of the businessusers
  // then update products in eligibility of the user

  try {
    const product = await Products.findOne({ _id: productId });

    const businessId = product.businessId;
    const businessUser = await BusinessUsers.findOne({ businessId });
    const userId = businessUser.userId;
    await Products.deleteOne({ _id: productId });
    await Eligibility.updateOne({ userId }, { $inc: { products: 1 } });

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

module.exports = router;
