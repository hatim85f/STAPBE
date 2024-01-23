const express = require("express");
const router = express.Router();
const UserSales = require("../../models/UserSales");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const SupportCase = require("../../models/SupportCase");
const auth = require("../../middleware/auth");
const Sales = require("../../models/Sales");
const Products = require("../../models/Products");
const moment = require("moment");
const { default: mongoose } = require("mongoose");
const UserTarget = require("../../models/UserTarget");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const {
  getFinalUserAchievement,
} = require("../../components/getUserAchievement");
const { getYTDAchivement } = require("../../components/getYTDAchivement");
const { getMonthlySales } = require("../../components/getMonthlySales");
const { getSalesVersions } = require("../../components/getSalesVersions");
const { getTeamYTDAch } = require("../../components/getTeamYTDAch");
const { getMonthlyValues } = require("../../components/getMonthlyValue");
const {
  getMonthlySalesValues,
} = require("../../components/getMonthlySalesValues");

router.get("/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const salesVersions = await getSalesVersions(userId, month, year, res);

    // return res.status(200).json({ salesVersions: salesVersions[0] });

    if (salesVersions.length === 0) {
      return res.status(500).send({
        error: "Oops",
        message: "No Sales Data Found for the specified dates",
      });
    }

    const finalData = salesVersions.reduce((acc, data) => {
      const found = acc.find((a) => a.versionName === data.versionName);

      let salesDetails = data.sales.salesData;
      const uniqueSales = salesDetails.reduce((item, curr) => {
        const itemFound = item.find((a) => a.product === curr.product);

        if (!itemFound) {
          item.push(curr);
        } else {
          // return without pushing to return unique array
          return item;
        }

        return item;
      }, []);

      if (!found) {
        acc.push({
          versionName: data.versionName,
          businessId: data.businessId,
          businessLogo: data.businessLogo,
          businessName: data.businessName,
          addingUser: data.addingUser,
          addedBy: data.addedBy,
          addedByDesignation: data.addedByDesignation,
          addedByProfilePicture: data.addedByProfilePicture,
          addedIn: data.addedIn,
          updatedIn: data.updatedIn,
          sales: [
            {
              salesData: uniqueSales,
              userName: data.sales.userName,
              designation: data.sales.designation,
              profilePicture: data.sales.profilePicture,
              userId: data.sales.userId,
              userSalesId: data.sales.userSalesId,
              isFinal: data.sales.isFinal,
            },
          ],
          totalSalesValue: data.totalSalesValue,
          totalTargetValue: data.totalTargetValue,
          totalAchievement: data.totalAchievement,
          isFinal: data.isFinal,
          startDate: data.startDate,
          endDate: data.endDate,
          currencyName: data.currencyName,
          currencyCode: data.currencyCode,
          currencySymbol: data.currencySymbol,
        });
      } else {
        found.sales.push({
          salesData: uniqueSales,
          userName: data.sales.userName,
          designation: data.sales.designation,
          profilePicture: data.sales.profilePicture,
          userId: data.sales.userId,
          userSalesId: data.sales.userSalesId,
          isFinal: data.sales.isFinal,
        });
        found.totalSalesValue += data.totalSalesValue;
        found.totalTargetValue += data.totalTargetValue;
        found.totalAchievement =
          (found.totalSalesValue / found.totalTargetValue) * 100;
      }

      return acc;
    }, []);

    return res.status(200).json({ salesVersions: finalData });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: error.message,
    });
  }
});

// get user achievement
// for same user
// for managers of the teams and business admins
router.get("/ach/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const monthlySales = await getMonthlySales(userId, month, year, res);

    if (monthlySales.length === 0) {
      return res.status(500).send({
        error: "Oops",
        message: "No Sales or Targets Data Found for the specified dates",
      });
    }

    return res.status(200).send({
      monthlySales,
    });
  } catch (error) {
    return res.status(500).send({
      error: "Error",
      message: "Something went wrong, Please try again later",
    });
  }
});

// get the achievement of final sales of sinlge user
// for same user
router.get("/final_ach/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const userAchievement = await getFinalUserAchievement(userId, month, year);

    return res.status(200).json({ userAchievement });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// get team achievement
// for same team members
// for managers of the teams and business admins
router.get("/team/ach/:userId/:month/:year", auth, async (req, res) => {
  const { userId, month, year } = req.params;

  try {
    const business = await BusinessUsers.find({ userId: userId });
    const businessIds = business.map((business) => business.businessId);

    const teamData = await BusinessUsers.find({
      businessId: { $in: businessIds },
      isBusinessOwner: false,
    });
    const usersIds = teamData.map((user) => user.userId);

    let teamSales = [];

    for (let i = 0; i < usersIds.length; i++) {
      const userSales = await getFinalUserAchievement(
        usersIds[i],
        month,
        year,
        res
      );

      teamSales.push(userSales);
    }

    if (teamSales.length === 0) {
      return res.status(500).send({
        error: "Oops",
        message: "No Sales or Targets Data Found for the specified dates",
      });
    }

    const teamSalesFlat = teamSales.flat();

    const teamSalesGrouped = teamSalesFlat.reduce((acc, data) => {
      const found = acc.find(
        (a) => a.businessId.toString() === data.businessId.toString()
      );

      if (!found) {
        acc.push({
          businessId: data.businessId,
          businessLogo: data.businessLogo,
          businessName: data.businessName,
          currencyCode: data.currencyCode,
          currencyName: data.currencyName,
          currencySymbol: data.currencySymbol,
          totalSalesValue: data.totalSalesValue,
          totalTargetValue: data.totalTargetValue,
          salesData: data.salesData,
        });
      } else {
        data.salesData.forEach((item) => {
          const foundItem = found.salesData.find(
            (x) => x.product.toString() === item.product.toString()
          );

          if (!foundItem) {
            found.salesData.push({
              product: item.product,
              quantity: item.quantity,
              price: item.price,
              _id: item._id,
              productNickName: item.productNickName,
              productImage: item.productImage,
              salesValue: item.salesValue.toFixed(0),
              targetUnits: item.targetUnits,
              targetValue: item.targetValue.toFixed(0),
              achievement: parseInt(item.achievement).toFixed(0),
            });
          } else {
            foundItem.quantity += item.quantity;
            foundItem.salesValue += item.salesValue;
            foundItem.targetValue += item.targetValue;
            foundItem.targetUnits += item.targetUnits;
            foundItem.achievement =
              (foundItem.salesValue / foundItem.targetValue) * 100;
          }
        });

        found.totalSalesValue += data.totalSalesValue;
        found.totalTargetValue += data.totalTargetValue;
        found.totalAchievement = +(
          (found.totalSalesValue / found.totalTargetValue) *
          100
        ).toFixed(2);
      }

      return acc;
    }, []);

    return res.status(200).json({ teamSales: teamSalesGrouped });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// get personal YTD achievement
// user achievement for personal YTD
router.get(
  "/ytd_ach/:userId/:startMonth/:endMonth/:year",
  auth,
  async (req, res) => {
    const { userId, startMonth, endMonth, year } = req.params;

    try {
      const data = await getYTDAchivement(userId, startMonth, endMonth, year);

      return res.status(200).json({ data });
    } catch (error) {
      return res.status(500).send({ error: "Error", message: error.message });
    }
  }
);

// get team YTD achievement
// team achievement for team YTD
router.get(
  "/team_ytd_ach/:userId/:startMonth/:endMonth/:year",
  auth,
  async (req, res) => {
    const { userId, startMonth, endMonth, year } = req.params;

    try {
      const teamAchievement = await getTeamYTDAch(
        userId,
        startMonth,
        endMonth,
        year
      );

      const monthlyData = await getMonthlyValues(
        startMonth,
        endMonth,
        year,
        userId
      );

      const monthlySales = await getMonthlySalesValues(
        startMonth,
        endMonth,
        year,
        userId
      );

      return res.status(200).json({ monthlyData });
    } catch (error) {
      return res.status(500).send({ error: "Error", message: error.message });
    }
  }
);

router.post("/", auth, async (req, res) => {
  const { userId, startDate, endDate, salesData, addingUser, versionName } =
    req.body;

  const businesses = await BusinessUsers.find({ userId: userId });
  const businessIds = businesses.map((business) => business.businessId);

  const existingSales = await UserSales.findOne({
    user: userId,
    versionName: versionName,
    startDate: startDate,
    endDate: endDate,
  });

  if (existingSales) {
    return res.status(400).send({
      error: "DuplicateData",
      message: "Duplicate data already exists.",
    });
  }

  const productId = salesData[0].product;
  const product = await Products.findOne({ _id: productId });
  const businessId = product.businessId;

  const userAdding = await User.findOne({ _id: addingUser });
  try {
    const newSales = new UserSales({
      user: userId,
      versionName: versionName,
      businessId: businessId,
      salesData: salesData,
      startDate: startDate,
      endDate: endDate,
      addedIn: Date.now(),
      updatedIn: Date.now(),
      addingUser: addingUser,
      isFinal: false,
    });

    await UserSales.insertMany(newSales);

    return res.status(200).send({ message: "Users Sales Added Successfully" });
  } catch (error) {
    const newSupportCase = new SupportCase({
      userId: addingUser,
      businessId: businessIds,
      userName: userAdding.userName,
      email: userAdding.email,
      phone: userAdding.phone,
      subject: "Error Adding User Sales",
      message: error.message,
    });

    await SupportCase.insertMany(newSupportCase);
    return res
      .status(500)
      .send({ error: "Error", message: "Error Adding Users Sales" });
  }
});

// change user sales status isFinal
router.put("/isFinal", auth, isCompanyAdmin, async (req, res) => {
  const { userSalesIds, userIds } = req.body;

  try {
    // check if user sales has any isFinal true with the same start and end date
    // Iterate through userSalesIds and userIds arrays
    for (let i = 0; i < userSalesIds.length; i++) {
      const currentSalesId = userSalesIds[i];
      const currentUserId = userIds[i];

      // check if user sales has any isFinal true with the same start and end date
      const userSales = await UserSales.findOne({ _id: currentSalesId });
      const startDate = userSales.startDate;
      const endDate = userSales.endDate;
      const addedIn = userSales.addedIn;

      const existingUserSales = await UserSales.findOne({
        user: currentUserId,
        startDate: { $gte: startDate, $lte: endDate },
        endDate: { $gte: startDate, $lte: endDate },
        isFinal: true,
      });

      // change all isFinal to false
      if (existingUserSales) {
        await UserSales.updateMany(
          {
            user: currentUserId,
            startDate: {
              $gte: startDate,
              $lte: endDate,
            },
            endDate: { $gte: startDate, $lte: endDate },
          },
          {
            $set: { isFinal: false, addedIn: addedIn, updatedIn: Date.now() },
          }
        );

        // loop into userSales and increase the quantity of the products
        for (let i = 0; i < userSales.length; i++) {
          const salesData = userSales[i].salesData;

          for (let product in salesData) {
            await Products.updateOne(
              { _id: salesData[product].product },
              // increase the quantity of the product
              { $inc: { quantity: salesData[product].quantity } }
            );
          }
        }
      }

      // change selected userSales isFinal to true
      await UserSales.updateOne(
        { _id: currentSalesId },
        { $set: { isFinal: true, updatedIn: Date.now() } }
      );

      const neededUserSales = await UserSales.findOne({ _id: currentSalesId });
      const salesData = neededUserSales.salesData;

      for (let product in salesData) {
        await Products.updateOne(
          { _id: salesData[product].product },
          // decrease the quantity of the product
          { $inc: { quantity: -salesData[product].quantity } }
        );
      }
    }

    return res
      .status(200)
      .send({ message: "User Sales Status Changed Successfully" });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.put("/single_isFinal", auth, isCompanyAdmin, async (req, res) => {
  const { salesId, userId, month, year } = req.body;

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const userSales = await UserSales.find({
      user: userId,
      isFinal: true,
      startDate: { $gte: startDate, $lte: endDate },
      endDate: { $gte: startDate, $lte: endDate },
    });

    if (userSales.length > 0) {
      await UserSales.updateMany(
        { user: userId },
        { $set: { isFinal: false } }
      );

      // loop into userSales and increase the quantity of the products
      for (let i = 0; i < userSales.length; i++) {
        const salesData = userSales[i].salesData;

        for (let product in salesData) {
          await Products.updateOne(
            { _id: salesData[product].product },
            // increase the quantity of the product
            { $inc: { quantity: salesData[product].quantity } }
          );
        }
      }
    } else {
      await UserSales.updateOne({ _id: salesId }, { $set: { isFinal: true } });

      const neededUserSales = await UserSales.findOne({ _id: salesId });
      const salesData = neededUserSales.salesData;

      for (let product in salesData) {
        await Products.updateOne(
          { _id: salesData[product].product },
          // decrease the quantity of the product
          { $inc: { quantity: -salesData[product].quantity } }
        );
      }
    }

    return res
      .status(200)
      .send({ message: "User Sales Status Changed Successfully" });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

// editing user sales data by admin
// for user sales
router.put("/edit/:userSalesId", auth, isCompanyAdmin, async (req, res) => {
  const { userSalesId } = req.params;
  const { salesDetails } = req.body;

  try {
    await UserSales.updateOne(
      { _id: userSalesId },
      {
        $set: {
          salesData: salesDetails.salesData,
          updatedIn: Date.now(),
        },
      }
    );

    return res.status(200).send({
      message: `Sales for ${salesDetails.userName} updated successfully`,
    });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.delete("/", auth, isCompanyAdmin, async (req, res) => {
  const { salesIds } = req.body;

  try {
    await UserSales.deleteMany({ _id: { $in: salesIds } });

    return res
      .status(200)
      .send({ message: "Users Sales Deleted Successfully" });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
