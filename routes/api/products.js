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
router.get("/", auth, async (req, res) => {
  const { businessId } = req.query;

  try {
    const products = await Products.find({
      businessId,
    });
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
    // check if product with the same name is already exists under the same business

    // check user eligibility to create new product
    const userEligibilty = await Eligibility.findOne({ userId });
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
      category,
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
    costPrice,
    retailPrice,
    sellingPrice,
    description,
    imageURL,
    minimumDiscount,
    maximumDiscount,
    category,
    productType,
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
    const product = await Products.deleteOne({ _id: productId });

    const businessId = product.businessId;
    const businessUser = await BusinessUsers.findOne({ businessId });
    const userId = businessUser.userId;
    await Eligibility.updateOne({ userId }, { $inc: { products: 1 } });

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

module.exports = router;
