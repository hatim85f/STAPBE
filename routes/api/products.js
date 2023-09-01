const express = require("express");
const auth = require("../../middleware/auth");
const Products = require("../../models/Products");
const { default: mongoose } = require("mongoose");
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
  } = req.body;

  try {
    // check if product with the same name is already exists under the same business

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
    });

    await Products.insertMany(newProduct);
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

  try {
    await Products.deleteOne({ _id: productId });
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Error", message: error.message });
  }
});

module.exports = router;
