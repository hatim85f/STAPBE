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
router.get("/:userId/:startDate/:endDate", auth, async (req, res) => {
  const { userId, startDate, endDate } = req.params;
  const userBunsiess = await BusinessUsers.find({ userId });

  const user = await User.findOne({ _id: userId });
  try {
    const businessIds = userBunsiess.map((business) => business.businessId);

    const orders = await Orders.aggregate([
      {
        $match: {
          businessId: { $in: businessIds },
          timeStamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
        },
      },
      {
        $unwind: "$details",
      },
      {
        $lookup: {
          from: "clients",
          localField: "clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      {
        $unwind: "$client",
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $lookup: {
          from: "orderproducts",
          localField: "details",
          pipeline: [
            {
              $match: { businessId: { $in: businessIds } },
            },
          ],
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
          userName: { $first: "$user.userName" },
          userProfilePicture: { $first: "$user.profilePicture" },
          designation: { $first: "$user.designation" },
          details: {
            $push: {
              orderId: "$orderProducts._id",
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
              businessId: "$orderProducts.businessId",
              mainOrderId: "$_id",
            },
          },
          client: { $first: "$client" },
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
          client: 1,
          userName: 1,
          userProfilePicture: 1,
          designation: 1,
        },
      },
    ]);

    return res.status(200).send({ orders });
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
    const newOrder = new Orders({
      _id: new mongoose.Types.ObjectId(),
      userId,
      clientId,
      totalValue: 0,
      details: [],
      businessId: [],
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
      businessId,
    });

    await OrderProducts.insertMany(newOrderProduct);

    await Orders.updateMany(
      { _id: orderId },
      {
        $inc: { totalValue: totalValue },
        $push: { details: newOrderProduct._id },
        $set: { timeStamp: Date.now() },
        $addToSet: { businessId },
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

router.put("/order_product/:orderProductId", auth, async (req, res) => {
  const { orderProductId } = req.params;
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
    const orderProduct = await OrderProducts.findOne({ _id: orderProductId });

    await OrderProducts.updateOne(
      { _id: orderProductId },
      {
        $set: {
          productId,
          quantity,
          discount,
          discountType,
          bonusUnits,
          productPrice,
          totalValue,
          businessId,
          timeStamp: orderProduct.timeStamp,
          updatedIn: Date.now(),
        },
      }
    );

    return res.status(200).send({ message: `Order updated sucessfully` });
  } catch (error) {
    return res.status(500).send({
      error: "Error !",
      message: "Error in updating your item, Try again later",
    });
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

router.delete("/order_product/:orderProductId", auth, async (req, res) => {
  const { orderProductId } = req.params;

  try {
    const orderProduct = await OrderProducts.findOne({ _id: orderProductId });
    const orderValue = orderProduct.totalValue;
    await OrderProducts.deleteOne({ _id: orderProductId });

    await Orders.updateMany(
      {
        details: { $in: new mongoose.Types.ObjectId(orderProductId) },
      },
      {
        $pull: { details: new mongoose.Types.ObjectId(orderProductId) },
      },
      {
        $inc: { totalValue: -orderValue },
      }
    );

    return res
      .status(200)
      .send({ message: `Order product deleted sucessfully` });
  } catch (error) {
    return res
      .status(500)
      .send({ error: "Error !", message: "Error in deleting order product" });
  }
});

module.exports = router;
