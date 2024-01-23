const moment = require("moment");
const BusinessUsers = require("../models/BusinessUsers");
const UserTarget = require("../models/UserTarget");
const ProductTarget = require("../models/ProductTarget");

const getMonthlyValues = async (startMonth, endMonth, year, userId) => {
  const startDate = new Date(year, startMonth - 1, 1);
  const endDate = new Date(year, endMonth, 0);

  const monthOfStart = moment(new Date(year, startMonth - 1, 1)).format("MMMM");
  const monthOfEnd = moment(new Date(year, endMonth, 0)).format("MMMM");

  const getMonthsInRange = (start, end) => {
    const startMonthIndex = moment().month(start).month();
    const endMonthIndex = moment().month(end).month();

    const months = [];
    for (let i = startMonthIndex; i <= endMonthIndex; i++) {
      months.push(moment().month(i).format("MMMM"));
    }

    return months;
  };

  const businesses = await BusinessUsers.find({ userId: userId });
  const businessIds = businesses.map((business) => business.businessId);

  const monthlyData = await ProductTarget.aggregate([
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
      $unwind: "$target.yearTarget",
    },
    {
      $match: {
        "target.yearTarget.month": {
          $in: getMonthsInRange(monthOfStart, monthOfEnd),
        },
      },
    },
    {
      $group: {
        _id: "$target.yearTarget.month",
        totalTargetValue: { $sum: "$target.yearTarget.targetValue" },
      },
    },
    {
      $project: {
        month: "$_id",
        totalTargetValue: 1,
        _id: 0,
      },
    },
  ]);

  const monthOrder = [
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

  return monthlyData.sort(
    (a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
  );
};

module.exports = { getMonthlyValues };
