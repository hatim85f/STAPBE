const moment = require("moment");
const UserSales = require("../models/UserSales");
const BusinessUsers = require("../models/BusinessUsers");

const getMonthlySalesValues = async (startMonth, endMonth, year, userId) => {
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

  let monthlySalesValues = [];

  for (let i = 0; i < getMonthsInRange(monthOfStart, monthOfEnd).length; i++) {
    const startDate = new Date(year, i - 1, 1);
    const endDate = new Date(year, i, 0);
    const monthlyData = await UserSales.aggregate([
      {
        $match: {
          businessId: { $in: businessIds },
          startDate: { $gte: startDate },
          endDate: { $lte: endDate },
        },
      },
      {
        $unwind: "$salesData",
      },
      {
        $project: {
          salesValue: {
            $multiply: ["$salesData.quantity", "$salesData.price"],
          },
        },
      },
      {
        $group: {
          _id: 0,
          totalSalesValue: { $sum: "$salesValue" },
        },
      },
      {
        $project: {
          _id: null,
          totalSalesValue: { $round: ["$totalSalesValue", 2] },
        },
      },
    ]);

    const totalSalesValue =
      monthlyData.length > 0 ? monthlyData[0].totalSalesValue : 0;

    monthlySalesValues.push({
      month: getMonthsInRange(monthOfStart, monthOfEnd)[i],
      salesValues: totalSalesValue,
    });
  }

  return monthlySalesValues;
};
// 341961.05
module.exports = {
  getMonthlySalesValues,
};
