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
router.get("/", auth, async (req, res) => {
  try {
    const targets = await ProductTarget.find();
    res.json(targets);
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
        targetValue: Math.round(targetValue / numberOfMonths),
        phasing: phasing,
        phasingData: null,
        targetPhases: `${(1 / numberOfMonths) * 100}%`,
        startPeriod: startDate,
        endPeriod: endDate,
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
        phasingData: null,
        targetPhases: `${parseFloat(
          phasingPercentage.find((obj) => obj[targetMonth] !== undefined)[
            targetMonth
          ] * 100
        ).toFixed(0)}%`,
        startPeriod: startDate,
        endPeriod: endDate,
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
        targetValue: Math.floor(targetValue / numberOfMonths),
        phasing: phasing,
        phasingData: null,
        targetPhases: `${(1 / numberOfMonths) * 100}%`,
        startPeriod: startDate,
        endPeriod: endDate,
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
        phasingData: null,
        targetPhases: `${parseFloat(
          phasingPercentage.find((obj) => obj[targetMonth] !== undefined)[
            targetMonth
          ] * 100
        ).toFixed(0)}%`,
        startPeriod: startDate,
        endPeriod: endDate,
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

  const newTarget = target.concat(filteredSeparatedTarget);
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

    // check if the same product has a target added
    const previousTarget = await ProductTarget.findOne({
      productId: productId,
      businessId: businessId,
    });

    const startDate = new Date(startPeriod);
    const endDate = new Date(startDate);

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
      default:
        break;
    }

    // getting number of months

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
      for (let i = 0; i <= numberOfMonths - 1; i++) {
        newTarget.push({
          year: parseInt(moment(startDate).add(i, "months").format("YYYY")),
          month: moment(startDate).add(i, "months").format("MMMM"),
        });
      }

      // find the difference between the two arrays
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
          res
        );
      } else {
        return res.status(400).send({
          error: "Error",
          message: `Target for ${product.productNickName} already exist for the selected period, if you want you edit the target from Editing Section `,
        });
      }
    } else {
      addNewTarget(
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
        res
      );
    }
  } catch (error) {
    return res.status(500).send({ error: "Error", message: error.message });
  }
});

module.exports = router;
