const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const PurchaseOrder = require("../../models/PurchaseOrder");
const Supplier = require("../../models/Suppliers");
const BusinessUsers = require("../../models/BusinessUsers");
const Products = require("../../models/Products");

// @route   GET api/purchaseOrder
// @desc    Get all purchase orders
// @access  Private
router.get("/:userId/:startMonth/:endMonth/:year", auth, async (req, res) => {
  const { userId, startMonth, endMonth, year } = req.params;

  const businessUser = await BusinessUsers.find({ userId: userId });
  const businessIds = businessUser.map((business) => business.businessId);

  const startOfPeriod = new Date(year, startMonth - 1, 1);
  const endOfPeriod = new Date(year, endMonth, 0, 23, 59, 59);

  try {
    const purchaseOrders = await PurchaseOrder.find({
      businessIds: { $in: businessIds },
      purchaseDate: { $gte: startOfPeriod, $lte: endOfPeriod },
    });
    return res.status(200).json({ purchaseOrders });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// @route   POST api/purchaseOrder
// @desc    Create a new purchase order
// @access  Private
router.post("/", auth, async (req, res) => {
  const { order, supplier, totalBill, userId } = req.body;

  const businessUser = await BusinessUsers.find({ userId: userId });
  const businessIds = businessUser.map((business) => business.businessId);

  try {
    let newOrder = [];
    for (let key of order) {
      const product = await Products.findOne({ _id: key.product });

      newOrder.push({
        ...key,
        previousStocks: product.quantity,
      });
    }

    const newPurchaseOrder = new PurchaseOrder({
      order: newOrder,
      supplier,
      totalBill,
      businessIds,
    });

    await Supplier.updateOne(
      { _id: supplier },
      { $push: { purchaseOrders: newPurchaseOrder._id } },
      { $set: { lastOrder: new Date() } }
    );

    await PurchaseOrder.insertMany(newPurchaseOrder);

    return res.status(200).json({
      purchase: newPurchaseOrder,
      message: "Your New Purchase added Successfully",
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// @route   PUT api/purchaseOrder/:purchaseOrderId
// @desc    Update a purchase order
// @access  Private
router.put("/:purchaseOrderId", auth, async (req, res) => {
  const { purchaseOrderId } = req.params;
  const { order, supplier, totalBill } = req.body;

  try {
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    purchaseOrder.order = order;
    purchaseOrder.supplier = supplier;
    purchaseOrder.totalBill = totalBill;

    await purchaseOrder.save();
    res.json(purchaseOrder);
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// @route   DELETE api/purchaseOrder/:purchaseOrderId
// @desc    Delete a purchase order
// @access  Private
router.delete("/:purchaseOrderId", auth, async (req, res) => {
  const { purchaseOrderId } = req.params;

  try {
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    await Supplier.updateOne(
      { _id: purchaseOrder.supplier },
      { $pull: { purchaseOrders: purchaseOrderId } }
    );

    await purchaseOrder.remove();
    res.json({ message: "Purchase order deleted successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

module.exports = router;
