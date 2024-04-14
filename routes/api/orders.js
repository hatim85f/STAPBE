const express = require("express");
const router = express.Router();
const Client = require("../../models/Client");
const Orders = require("../../models/Orders");
const OrderProducts = require("../../models/OrderProduct");
const auth = require("../../middleware/auth");
const BusinessUsers = require("../../models/BusinessUsers");
const { default: mongoose, version } = require("mongoose");
const SupportCase = require("../../models/SupportCase");
const User = require("../../models/User");
const UserSales = require("../../models/UserSales");
const Sales = require("../../models/Sales");

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

    await Products;

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

// change order status
router.put("/status/:orderId", auth, async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const order = await Orders.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(orderId),
        },
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
        $lookup: {
          from: "clients",
          localField: "clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      {
        $group: {
          _id: "$_id",
          businessId: { $first: "$orderProducts.businessId" },
          userId: { $first: "$userId" },
          clientId: { $first: "$clientId" },
          totalValue: { $first: "$totalValue" },
          status: { $first: "$status" },
          timeStamp: { $first: "$timeStamp" },
          details: {
            $push: {
              product: "$orderProducts.productId",
              quantity: "$orderProducts.quantity",
              price: "$orderProducts.productPrice",
              productName: { $arrayElemAt: ["$product.productName", 0] },
              productPrice: { $arrayElemAt: ["$product.costPrice", 0] },
              discount: "$orderProducts.discount",
              discountType: "$orderProducts.discountType",
              clientName: { $arrayElemAt: ["$client.clientName", 0] },
              itemValue: "$orderProducts.totalValue",
            },
          },
          client: { $first: "$client" },
        },
      },
      {
        $project: {
          user: "$userId",
          versionName: {
            $concat: [
              "Order for ",
              { $arrayElemAt: ["$client.clientName", 0] },
            ],
          },
          businessId: "$businessId",
          addingUser: "$userId",
          salesData: "$details",
          timeStamp: "$timeStamp",
        },
      },
    ]);

    const currentDate = new Date(order[0].timeStamp);
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Get the first day of the month
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);

    // Get the last day of the month
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Format dates to ISO strings
    const firstDayISO = firstDayOfMonth.toISOString();
    const lastDayISO = lastDayOfMonth.toISOString();

    const isFinalData = status === "Completed" ? true : false;

    order[0].startDate = firstDayISO;
    order[0].endDate = lastDayISO;
    order[0].isFinal = isFinalData;

    const isExistingUserSales = await UserSales.findOne({
      user: order[0].user,
      businessId: order[0].businessId,
      startDate: firstDayISO,
      endDate: lastDayISO,
      salesData: {
        $elemMatch: {
          $eq: order[0].salesData,
        },
      },
    });

    if (isExistingUserSales) {
      await UserSales.updateOne(
        {
          user: order[0].user,
          businessId: order[0].businessId,
          startDate: firstDayISO,
          endDate: lastDayISO,
        },
        {
          $set: {
            salesData: order[0].salesData,
            updatedIn: Date.now(),
            isFinal: isFinalData,
          },
        }
      );
    } else {
      const newUserSales = new UserSales({
        user: order[0].user,
        versionName: order[0].versionName,
        businessId: order[0].businessId,
        addingUser: order[0].addingUser,
        salesData: order[0].salesData,
        startDate: firstDayISO,
        endDate: lastDayISO,
        isFinal: isFinalData,
      });

      await UserSales.insertMany(newUserSales);
    }

    await Orders.updateOne(
      { _id: orderId },
      {
        $set: { status },
      }
    );

    const value = [];

    const salesData = order[0].salesData.map((data) => {
      value.push(data.itemValue);

      return {
        productId: data.product,
        productName: data.productName,
        date: order[0].timeStamp,
        status: status,
        quantity: data.quantity,
        totalQuantity: data.quantity,
        productPrice: data.productPrice,
        sellingPrice: data.price,
        discount: data.discount,
        discountType: data.discountType,
        itemValue: data.itemValue,
        clientName: data.clientName,
      };
    });

    const totalValue = value.reduce((a, b) => a + b, 0);

    const sales = new Sales({
      businessId: order[0].businessId,
      version: order[0].versionName,
      startPeriod: firstDayISO,
      endPeriod: lastDayISO,
      salesData: salesData,
      addedBy: order[0].addingUser,
      totalValue: totalValue,
      isFinal: true,
    });

    await Sales.insertMany(sales);

    return res
      .status(200)
      .send({ message: "Order status updated sucessfully" });
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
