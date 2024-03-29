const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const isCompanyAdmin = require("../../middleware/isCompanyAdmin");
const ProductTarget = require("../../models/ProductTarget");
const Phasing = require("../../models/Phasing");
const BusinessCurrency = require("../../models/BusinessCurrency");
const Business = require("../../models/Business");
const Products = require("../../models/Products");
const moment = require("moment");
const c = require("config");
const User = require("../../models/User");
const BusinessUsers = require("../../models/BusinessUsers");
const SupportCase = require("../../models/SupportCase");
const { default: mongoose } = require("mongoose");
const UserTarget = require("../../models/UserTarget");

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// @route   GET api/target
// @desc    Get all targets
// @access  Private
// Getting the target for all the business for only business Owner
router.get("/:userId/:year", auth, async (req, res) => {
  try {
    const { userId, year } = req.params;
    const businessUser = await BusinessUsers.find({ userId });

    const businessIds = businessUser.map((item) => item.businessId);

    const target = await ProductTarget.aggregate([
      {
        $match: {
          businessId: { $in: businessIds },
        },
      },
      {
        $unwind: "$target",
      },
      {
        $match: {
          "target.year": parseInt(year),
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          productId: 1,
          businessId: 1,
          target: 1,
          currencyCode: 1,
          currencyName: 1,
          currencySymbol: 1,
          productName: { $arrayElemAt: ["$product.productName", 0] },
          productNickName: { $arrayElemAt: ["$product.productNickName", 0] },
          costPrice: {
            $arrayElemAt: ["$target.yearTarget.productPrice", 0],
          },
          retailPrice: { $arrayElemAt: ["$product.retailPrice", 0] },
          sellingPrice: { $arrayElemAt: ["$product.sellingPrice", 0] },
          imageURL: { $arrayElemAt: ["$product.imageURL", 0] },
          category: { $arrayElemAt: ["$product.category", 0] },
        },
      },
    ]);

    if (target.length === 0) {
      return res
        .status(500)
        .send({ error: "Error !", message: `No target found for ${year}` });
    }

    const modifiedTarget = target.map((item) => {
      const sortedYearTarget = item.target.yearTarget.sort((a, b) =>
        months.indexOf(a.month) > months.indexOf(b.month) ? 1 : -1
      );
      const startMonth = sortedYearTarget[0].month;
      const endMonth = sortedYearTarget[sortedYearTarget.length - 1].month;

      return {
        ...item,
        target: {
          ...item.target,
          yearTarget: sortedYearTarget,
        },
        startMonth,
        endMonth,
      };
    });

    return res.status(200).send({ target: modifiedTarget });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

const separateTargetDetails = (target) => {
  const separatedTarget = target.reduce((acc, curr) => {
    const found = acc.find((x) => x.year === curr.year);

    if (!found) {
      acc.push({
        year: curr.year,
        yearTarget: [curr],
        totalUnits: curr.targetUnits,
        totalValue: curr.targetValue,
      });
    } else {
      found.yearTarget.push(curr);
      found.totalUnits += curr.targetUnits;
      found.totalValue += curr.targetValue;
    }

    return acc;
  }, []);

  return separatedTarget;
};

const addNewTarget = async (
  productId,
  businessId,
  phasing,
  startDate,
  endDate,
  numberOfMonths,
  targetUnits,
  targetValue,
  phasingData,
  productPrice,
  currencyCode,
  currencyName,
  currencySymbol,
  productNickName,
  isPrevious,
  targetType,
  res
) => {
  let productTarget = [];

  if (!phasing) {
    for (let i = 0; i <= numberOfMonths - 1; i++) {
      productTarget.push({
        month: moment(startDate).add(i, "months").format("MMMM"),
        year: moment(startDate).add(i, "months").format("YYYY"),
        targetUnits: Math.round(targetUnits / numberOfMonths) + 1,
        productPrice: productPrice,
        targetValue: Math.round(parseFloat(targetValue) / numberOfMonths),
        phasing: phasing,
        phasingData: null,
        targetPhases: `${(1 / numberOfMonths) * 100}%`,
        startPeriod: startDate,
        endPeriod: endDate,
        targetType: targetType,
      });
    }
  } else {
    const phasingDetails = await Phasing.findOne({ _id: phasingData });
    const phasingPercentage = phasingDetails.phasingPercentage;

    for (let i = 0; i <= numberOfMonths - 1; i++) {
      const targetMonth = moment(startDate).add(i, "months").format("MMMM");
      productTarget.push({
        month: moment(startDate).add(i, "months").format("MMMM"),
        year: moment(startDate).add(i, "months").format("YYYY"),
        targetUnits: Math.round(
          targetUnits *
            phasingPercentage.find((obj) => obj[targetMonth] !== undefined)[
              targetMonth
            ]
        ),
        productPrice: productPrice,
        targetValue: parseFloat(
          Math.round(
            targetValue *
              phasingPercentage.find((obj) => obj[targetMonth] !== undefined)[
                targetMonth
              ]
          )
        ),
        phasing: phasing,
        phasingData: phasingData,
        targetPhases: `${parseFloat(
          phasingPercentage.find((obj) => obj[targetMonth] !== undefined)[
            targetMonth
          ] * 100
        ).toFixed(0)}%`,
        startPeriod: startDate,
        endPeriod: endDate,
        targetType: targetType,
      });
    }
  }

  const separatedTarget = separateTargetDetails(productTarget);

  const newTarget = new ProductTarget({
    productId,
    businessId,
    target: separatedTarget,
    currencyCode,
    currencyName,
    currencySymbol,
  });

  await ProductTarget.insertMany(newTarget);

  const years = separatedTarget.map((item) => item.year);

  return res.status(200).send({
    message: `Target for ${productNickName} for ${
      years.length > 1 ? years.join(", ") : years
    } created successfully`,
  });
};

const updatePreviousTarget = async (
  productId,
  businessId,
  phasing,
  startDate,
  endDate,
  numberOfMonths,
  targetUnits,
  targetValue,
  phasingData,
  productPrice,
  currencyCode,
  currencyName,
  currencySymbol,
  productNickName,
  actualMonths,
  replace,
  targetType,
  res
) => {
  let productTarget = [];

  if (!phasing) {
    for (let i = 0; i <= numberOfMonths - 1; i++) {
      productTarget.push({
        month: moment(startDate).add(i, "months").format("MMMM"),
        year: moment(startDate).add(i, "months").format("YYYY"),
        targetUnits: Math.floor(targetUnits / numberOfMonths) + 1,
        productPrice: productPrice,
        targetValue: parseFloat(targetValue) / numberOfMonths,
        phasing: phasing,
        phasingData: null,
        targetPhases: `${(1 / numberOfMonths) * 100}%`,
        startPeriod: startDate,
        endPeriod: endDate,
        targetType: targetType,
      });
    }
  } else {
    const phasingDetails = await Phasing.findOne({ _id: phasingData });
    const phasingPercentage = phasingDetails.phasingPercentage;

    for (let i = 0; i <= numberOfMonths - 1; i++) {
      const targetMonth = moment(startDate).add(i, "months").format("MMMM");
      productTarget.push({
        month: moment(startDate).add(i, "months").format("MMMM"),
        year: moment(startDate).add(i, "months").format("YYYY"),
        targetUnits: Math.round(
          targetUnits *
            phasingPercentage.find((obj) => obj[targetMonth] !== undefined)[
              targetMonth
            ]
        ),
        productPrice: productPrice,
        targetValue: Math.round(
          targetValue *
            phasingPercentage.find((obj) => obj[targetMonth] !== undefined)[
              targetMonth
            ]
        ),
        phasing: phasing,
        phasingData: phasingData,
        targetPhases: `${parseFloat(
          phasingPercentage.find((obj) => obj[targetMonth] !== undefined)[
            targetMonth
          ] * 100
        ).toFixed(0)}%`,
        startPeriod: startDate,
        endPeriod: endDate,
        targetType: targetType,
      });
    }
  }

  const separatedTarget = separateTargetDetails(productTarget);

  const filteredSeparatedTarget = separatedTarget
    .map((yearTarget) => {
      const filteredYearTarget = yearTarget.yearTarget.filter((monthTarget) => {
        return actualMonths.some((actualMonth) => {
          return (
            parseInt(yearTarget.year) === actualMonth.year &&
            monthTarget.month === actualMonth.month
          );
        });
      });

      const totalUnits = filteredYearTarget.reduce(
        (total, monthTarget) => total + monthTarget.targetUnits,
        0
      );

      const totalValue = filteredYearTarget.reduce(
        (total, monthTarget) => total + monthTarget.targetValue,
        0
      );

      return {
        year: yearTarget.year,
        yearTarget: filteredYearTarget,
        totalUnits: totalUnits,
        totalValue: totalValue,
      };
    })
    .filter((yearTarget) => yearTarget.yearTarget.length > 0);

  const previousTarget = await ProductTarget.findOne({
    productId: productId,
    businessId: businessId,
  });

  const target = previousTarget.target;

  let newTarget;

  if (replace) {
    const targetIndex = target.findIndex(
      (item) => item.year === startDate.getFullYear()
    );

    target[targetIndex] = filteredSeparatedTarget[0];

    newTarget = target;
  } else {
    newTarget = target.concat(filteredSeparatedTarget);
  }

  let modifiedTarget = [];

  for (let data of newTarget) {
    for (let details of data.yearTarget) {
      modifiedTarget.push({
        year: parseInt(data.year),
        month: details.month,
        targetUnits: details.targetUnits,
        productPrice: details.productPrice,
        targetValue: details.targetValue,
        phasing: details.phasing,
        phasingData: details.phasingData,
        targetPhases: details.targetPhases,
        startPeriod: details.startPeriod,
        endPeriod: details.endPeriod,
        addedIn: details.addedIn ? details.addedIn : new Date(),
        updatedIn: details.updatedIn ? details.updatedIn : new Date(),
        targetType: details.targetType,
      });
    }
  }

  const finalUpdated = separateTargetDetails(modifiedTarget);

  await ProductTarget.updateMany(
    { _id: previousTarget._id },
    {
      $set: {
        target: finalUpdated,
      },
    }
  );

  const years = [...new Set(actualMonths.map((item) => item.year))];

  return res.status(200).send({
    message: `Target for ${productNickName} for ${
      years.length > 1 ? years.join(", ") : years
    } updated successfully`,
  });
};

// @route   POST api/target
// @desc    Create a target
// @access  Private
router.post("/", auth, isCompanyAdmin, async (req, res) => {
  const userId = req.header("user_id");
  const {
    productId,
    businessId,
    targetUnits,
    productPrice,
    targetType,
    phasing,
    phasingData,
    startPeriod,
  } = req.body;

  try {
    const product = await Products.findOne({ _id: productId });
    const business = await Business.findOne({ _id: businessId });
    const { currencyCode, currencyName, currencySymbol } = business;

    const targetValue = targetUnits * productPrice;

    if (!startPeriod) {
      return res
        .status(400)
        .send({ error: "Error", message: "Start Period is required" });
    }

    // Check if the same product has a target added
    const previousTarget = await ProductTarget.findOne({
      productId: productId,
      businessId: businessId,
    });

    const startDate = new Date(startPeriod);
    const endDate = new Date(startDate);

    let isBulk = false;

    switch (targetType) {
      case "Yearly":
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setDate(0);
        break;
      case "Quarterly":
        endDate.setMonth(endDate.getMonth() + 3);
        endDate.setDate(0);
        break;
      case "Monthly":
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        break;
      case "Bulk":
        isBulk = true;
        break;
      default:
        break;
    }

    // Calculate the number of months
    const numberOfMonths =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) +
      1;

    if (previousTarget) {
      const target = previousTarget.target;
      const oldTarget = [];

      for (const items of target) {
        for (const item of items.yearTarget) {
          oldTarget.push({
            year: items.year,
            month: item.month,
          });
        }
      }

      const newTarget = [];

      if (isBulk) {
        const startYear = parseInt(moment(startDate).format("YYYY"));

        const yearIndex = target.findIndex((item) => item.year === startYear);

        if (yearIndex === -1) {
          target.push({
            year: startYear,
            yearTarget: [
              {
                month: startYear,
                targetUnits: targetUnits,
                productPrice: productPrice,
                targetValue: targetValue,
                phasing: false,
                phasingData: null,
                targetPhases: "100%",
                startPeriod: startDate,
                endPeriod: endDate,
                addedIn: new Date(),
                updatedIn: new Date(),
                targetType: targetType,
              },
            ],
            totalUnits: targetUnits,
            totalValue: targetValue,
          });
        } else {
          target[yearIndex].yearTarget = [
            {
              month: startYear,
              targetUnits: targetUnits,
              productPrice: productPrice,
              targetValue: targetValue,
              phasing: false,
              phasingData: null,
              targetPhases: "100%",
              startPeriod: startDate,
              endPeriod: endDate,
              addedIn: new Date(),
              updatedIn: new Date(),
              targetType: targetType,
            },
          ];

          target[yearIndex].totalUnits = targetUnits;
          target[yearIndex].totalValue = targetValue;
        }

        await ProductTarget.updateOne(
          { _id: previousTarget._id },
          {
            $set: {
              target: target,
            },
          }
        );

        return res.status(200).send({ message: "Target updated successfully" });
      }

      for (let i = 0; i <= numberOfMonths - 1; i++) {
        newTarget.push({
          year: parseInt(moment(startDate).add(i, "months").format("YYYY")),
          month: moment(startDate).add(i, "months").format("MMMM"),
        });
      }

      // Find the difference between the two arrays
      const difference = newTarget.filter(
        (x) => !oldTarget.some((y) => y.year === x.year && y.month === x.month)
      );

      if (difference.length > 0) {
        const startYear = difference[0].year;
        const startMonth = difference[0].month;
        const endYear = difference[difference.length - 1].year;
        const endMonth = difference[difference.length - 1].month;

        const newStartDate = new Date(
          `${startYear}-${months.findIndex((a) => a === startMonth) + 1}-01`
        );
        const newEndDate = new Date(
          moment(
            new Date(endYear, months.findIndex((a) => a === endMonth) + 1, 0)
          ).format("YYYY-MM-DD")
        );

        // Use the existing updatePreviousTarget function to update the target
        await updatePreviousTarget(
          productId,
          businessId,
          phasing,
          newStartDate,
          newEndDate,
          numberOfMonths,
          targetUnits,
          targetValue,
          phasingData,
          productPrice,
          currencyCode,
          currencyName,
          currencySymbol,
          product.productNickName,
          difference,
          false,
          targetType,
          res
        );
      } else {
        const monthsTarget = target
          .find((item) => item.year === startDate.getFullYear())
          .yearTarget.map((item) => item.month);

        const actualMonths = [];

        for (let i = 0; i <= numberOfMonths - 1; i++) {
          const month = moment(startDate).add(i, "months").format("MMMM");
          if (monthsTarget.includes(month)) {
            actualMonths.push({
              year: parseInt(moment(startDate).add(i, "months").format("YYYY")),
              month: month,
            });
          }
        }

        await updatePreviousTarget(
          productId,
          businessId,
          phasing,
          startDate,
          endDate,
          numberOfMonths,
          targetUnits,
          targetValue,
          phasingData,
          productPrice,
          currencyCode,
          currencyName,
          currencySymbol,
          product.productNickName,
          actualMonths,
          true,
          targetType,
          res
        );
      }
    } else {
      if (isBulk) {
        const startYear = parseInt(moment(startDate).format("YYYY"));

        const newProductTarget = new ProductTarget({
          productId,
          businessId,
          target: [
            {
              year: startYear,
              yearTarget: [
                {
                  month: startYear,
                  targetUnits: targetUnits,
                  productPrice: productPrice,
                  targetValue: targetValue,
                  phasing: false,
                  phasingData: null,
                  targetPhases: "100%",
                  startPeriod: startDate,
                  endPeriod: endDate,
                  addedIn: new Date(),
                  updatedIn: new Date(),
                  targetType: targetType,
                },
              ],
              totalUnits: targetUnits,
              totalValue: targetValue,
            },
          ],
          currencyCode,
          currencyName,
          currencySymbol,
        });

        await ProductTarget.insertMany(newProductTarget);
        return res.status(200).send({ message: "Target added successfully" });
      }
      // Use the existing addNewTarget function to add a new target
      await addNewTarget(
        productId,
        businessId,
        phasing,
        startDate,
        endDate,
        numberOfMonths,
        targetUnits,
        targetValue,
        phasingData,
        productPrice,
        currencyCode,
        currencyName,
        currencySymbol,
        product.productNickName,
        false,
        targetType,
        res
      );
    }

    return; // The response is handled within the addNewTarget or updatePreviousTarget functions
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

router.delete("/:id/:year", isCompanyAdmin, auth, async (req, res) => {
  const { id, year } = req.params;

  try {
    const productTarget = await ProductTarget.findOne({ productId: id });
    const target = productTarget.target;

    const targetIndex = target.findIndex(
      (item) => item.year === parseInt(year)
    );

    if (targetIndex === -1) {
      return res.status(400).send({
        error: "Error",
        message: "Target not found for selected Year",
      });
    }

    target.splice(targetIndex, 1);

    await ProductTarget.updateOne(
      { productId: id },
      {
        $set: {
          target: target,
        },
      }
    );

    const usersTargets = await UserTarget.find({
      "productsTargets.year": parseInt(year),
      "productsTargets.target.productId": id,
    });

    for (let data of usersTargets) {
      const productsTargets = data.productsTargets;
      const yearIndex = productsTargets.findIndex(
        (item) => item.year === parseInt(year)
      );

      if (yearIndex === -1) {
        return res.status(400).send({
          error: "Error",
          message:
            "Target not found for selected Year for one or all of team Members",
        });
      }

      const target = productsTargets[yearIndex].target;

      const targetIndex = target.findIndex(
        (item) => item.productId.toString() === id
      );

      if (targetIndex === -1) {
        return res.status(400).send({
          error: "Error",
          message:
            "Target not found for selected Product for one or all of team Members",
        });
      }

      target.splice(targetIndex, 1);
      await UserTarget.updateOne(
        { _id: data._id },
        {
          $set: {
            productsTargets: productsTargets,
          },
        }
      );
    }

    const product = await Products.findOne({ _id: id });

    return res.status(200).send({
      message: `Targe for ${product.productNickName} for ${year} deleted successfully, and the target for the users has been updated`,
    });
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
