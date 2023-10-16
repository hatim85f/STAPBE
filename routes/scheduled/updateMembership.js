const schedule = require("node-schedule");
const MemberShip = require("../../models/MemberShip");
const Subscription = require("../../models/Subscription");
const Checks = require("../../models/Checks");
const config = require("config");
const stripeSecretKey =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_SECRET_KEY
    : config.get("STRIPE_SECRET_KEY");

const stripe = require("stripe")(stripeSecretKey);

// Function to create a summary report object
const createSummaryReport = (
  checkStatus,
  timeTaken,
  haveUpdates,
  numberOfUpdates
) => {
  const report = {
    checkType: "Membership updates",
    startTime: new Date(),
    endTime: null, // Will be set after the task completion
    checkStatus: checkStatus,
    timeTaken: timeTaken,
    haveUpdates: haveUpdates,
    numberOfUpdates: numberOfUpdates,
  };
  return report;
};

const updateMemberships = async () => {
  try {
    let numberOfUpdates = 0; // Initialize the count
    // get all the active subscriptions from stripe
    const activeMemberships = await MemberShip.find({ isActive: true }).exec();

    for (let membership of activeMemberships) {
      const subscription = await Subscription.findOne({
        _id: membership.subscriptionId,
      }).exec();

      if (!subscription) {
        console.log("No subscription found");
        continue;
      }

      // Retrieve the subscription from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.subscriptionId
      );

      // If the subscription is not active, update the database
      if (stripeSubscription.status !== "active") {
        await MemberShip.updateMany(
          { _id: membership._id },
          { $set: { isActive: false } }
        );
        numberOfUpdates++; // Increment the count of updates
      }
    }
    console.log("Memberships updated successfully");
    return numberOfUpdates;
  } catch (error) {
    console.error("Error updating memberships:", error);
  }
};

module.exports = {
  updateMemberships,
  createSummaryReport,
};
