const schedule = require("node-schedule");
const MemberShip = require("../../models/MemberShip");
const Subscription = require("../../models/Subscription");
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
      }
    }
    console.log("Memberships updated successfully");
  } catch (error) {
    console.error("Error updating memberships:", error);
  }
};

// Schedule the task to run every 24 hours (at midnight)
const rule = new schedule.RecurrenceRule();
rule.hour = 3; // 0-23 (midnight)
rule.minute = 0; // 0-59

const job = schedule.scheduleJob(rule, async () => {
  console.log("Scheduled task started...");
  const startTime = new Date();
  let numberOfUpdates = 0; // Initialize the count

  // Perform the task
  try {
    numberOfUpdates = await updateMemberships(); // Get the actual number of updates
    const endTime = new Date();
    const timeTaken = (endTime - startTime) / 1000 + " sec"; // Calculate time taken
    const jobDone = numberOfUpdates > 0 ? true : false;

    // Create a summary report
    const summaryReport = createSummaryReport(
      "Success",
      timeTaken,
      jobDone,
      numberOfUpdates
    );
    summaryReport.endTime = endTime;

    // Log or send the summary report as needed
    console.log("Scheduled task completed. Summary Report:", summaryReport);
  } catch (error) {
    console.error("Error updating memberships:", error);

    // Create a summary report for a failed task
    const endTime = new Date();
    const timeTaken = (endTime - startTime) / 1000 + " sec"; // Calculate time taken
    const summaryReport = createSummaryReport(
      "Failed due to an error",
      timeTaken,
      false,
      numberOfUpdates
    );
    summaryReport.endTime = endTime;

    // Log or send the summary report for the failed task
    console.log(
      "Scheduled task completed with errors. Summary Report:",
      summaryReport
    );
  }
});
