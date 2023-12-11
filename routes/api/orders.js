const express = require("express");
const router = express.Router();
const Client = require("../../models/Client");
const Orders = require("../../models/Orders");
const OrderProducts = require("../../models/OrderProduct");
const auth = require("../../middleware/auth");
const BusinessUsers = require("../../models/BusinessUsers");
const { default: mongoose } = require("mongoose");
const SupportCase = require("../../models/SupportCase");
const User = require("../../models/User");

// @route GET api/clients/test
// @description tests clients route
// @access Private
router.get("/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  const userBunsiess = await BusinessUsers.find({ userId });

  const user = await User.findOne({ _id: userId });
  try {
    const businessIds = userBunsiess.map((business) => business.businessId);

    const orders = await Orders.aggregate([
      {
        $match: { businessId: { $in: businessIds } },
      },
      {
        $unwind: "$details",
      },
      {
        $lookup: {
          from: "orderproducts",
          localField: "details",
          foreignField: "_id",
          as: "orderProducts",
        },
      },
      {
        $unwind: "$orderProducts",
      },
      {
        $lookup: {
          from: "products",
          localField: "orderProducts.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: "$product",
      },
      {
        $group: {
          _id: "$_id",
          businessId: { $first: "$businessId" },
          userId: { $first: "$userId" },
          clientId: { $first: "$clientId" },
          totalValue: { $sum: "$totalValue" },
          status: { $first: "$status" },
          timeStamp: { $first: "$timeStamp" },
          details: {
            $push: {
              productId: "$orderProducts.productId",
              quantity: "$orderProducts.quantity",
              discount: "$orderProducts.discount",
              discountType: "$orderProducts.discountType",
              bonusUnits: "$orderProducts.bonusUnits",
              productPrice: "$orderProducts.productPrice",
              totalValue: "$orderProducts.totalValue",
              productNickName: "$product.productNickName",
              productImage: "$product.imageURL",
              productName: "$product.productName",
              productCategory: "$product.category",
              productType: "$product.productType",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          businessId: 1,
          userId: 1,
          clientId: 1,
          totalValue: 1,
          status: 1,
          timeStamp: 1,
          details: 1,
        },
      },
    ]);

    return res.status(200).send({ orders, length: orders.length });
  } catch (error) {
    const newSupportCase = new SupportCase({
      userId,
      userName: user.userName,
      email: user.email,
      phone: user.phone,
      businessId: userBunsiess.map((business) => business.businessId),
      subject: "Error in placing order",
      message: error.message,
    });
    await SupportCase.insertMany(newSupportCase);

    return res.status(500).send({ error: "Error !", message: error.message });
  }
});

router.post("/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  const { clientId } = req.body;

  try {
    const userBusiness = await BusinessUsers.findOne({ userId });

    const newOrder = new Orders({
      _id: new mongoose.Types.ObjectId(),
      businessId: details[0].businessId,
      userId,
      clientId,
      totalValue: 0,
      details: [],
    });

    await Orders.insertMany(newOrder);

    return res.status(200).send({ orderId: newOrder._id });
  } catch (error) {
    return res.status(500).send({ error: "Error !", message: error.message });
  }
});

router.post("/add_order/:orderId", auth, async (req, res) => {
  const { orderId } = req.params;
  const {
    productId,
    quantity,
    discount,
    discountType,
    bonusUnits,
    productPrice,
    totalValue,
    userId,
    businessId,
  } = req.body;

  try {
    const newOrderProduct = new OrderProducts({
      _id: new mongoose.Types.ObjectId(),
      orderId,
      productId,
      quantity,
      discount,
      discountType,
      bonusUnits,
      productPrice,
      totalValue,
    });

    await OrderProducts.insertMany(newOrderProduct);

    await Orders.updateMany(
      { _id: orderId },
      {
        $inc: { totalValue: totalValue },
        $push: { details: newOrderProduct._id },
        $set: { timeStamp: Date.now() },
      }
    );

    return res.status(200).send({ message: `Order added sucessfully` });
  } catch (error) {
    const user = await User.findOne({ _id: userId });
    const newSupportCase = new SupportCase({
      userId,
      userName: user.userName,
      email: user.email,
      phone: user.phone,
      businessId,
      subject: "Error in placing order",
      message: error.message,
    });

    await SupportCase.insertMany(newSupportCase);

    return res.status(500).send({ error: "Error !", message: error.message });
  }
});

router.delete("/", auth, async (req, res) => {
  const { orderId } = req.body;

  try {
    await OrderProducts.deleteMany({ orderId });
    await Orders.deleteOne({ _id: orderId });

    return res.status(200).send({ message: `Order deleted sucessfully` });
  } catch (error) {
    return res.status(500).send({ error: "Error !", message: error.message });
  }
});

module.exports = router;
