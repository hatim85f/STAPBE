const express = require("express");
const connectDB = require("./config/db");
var cors = require("cors");
const {
  updateMemberships,
  createSummaryReport,
} = require("./routes/scheduled/updateMembership");
const { scheduleJob, RecurrenceRule } = require("node-schedule");
const Checks = require("./models/Checks");

const app = express();

connectDB();

const rule = new RecurrenceRule();
rule.hour = 19; // Set to the current hour
rule.minute = 59; // Set to the current minute

const job = scheduleJob(rule, async () => {
  console.log("Scheduled task started...");
  const startTime = new Date();

  // Initialize the count
  let numberOfUpdates = 0;

  // Perform the task
  try {
    numberOfUpdates = await updateMemberships(); // Get the actual number of updates
    const endTime = new Date();
    const timeTaken = (endTime - startTime) / 1000 + " sec"; // Calculate time taken
    const jobDone = numberOfUpdates > 0; // Use boolean value

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
    await Checks.insertMany(summaryReport);
  } catch (error) {
    console.error("Error updating memberships:", error);

    // Handle errors and set numberOfUpdates accordingly
    numberOfUpdates = -1;

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

    await Checks.insertMany(summaryReport);
  }
});

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.status(200).send("API Running");
});

app.use("/api/auth", require("./routes/api/auth"));
app.use("/api/profile", require("./routes/api/profile"));
app.use("/api/business", require("./routes/api/business"));
app.use("/api/products", require("./routes/api/products"));
app.use("/api/team", require("./routes/api/team"));
app.use("/api/settings", require("./routes/api/settings"));
app.use("/api/pricing", require("./routes/api/pricing"));
app.use("/api/mails", require("./routes/api/demo"));
app.use("/api/admins", require("./routes/api/admins"));
app.use("/api/packages", require("./routes/api/packages"));
app.use("/api/membership", require("./routes/api/membership"));
app.use("/api/clients", require("./routes/api/clients"));
app.use("/api/targets", require("./routes/api/target"));
app.use("/api/phasing", require("./routes/api/phasing"));
app.use("/api/userTarget", require("./routes/api/userTarget"));
app.use("/api/orders", require("./routes/api/orders"));
app.use("/api/sales", require("./routes/api/sales"));
app.use("/api/user-sales", require("./routes/api/userSales"));
app.use("/api/member-sales", require("./routes/api/memberSales"));
app.use("/api/fixed-expenses", require("./routes/api/fixedExpenses"));
app.use("/api/variable-expenses", require("./routes/api/variableExpenses"));
app.use("/api/marketing-expenses", require("./routes/api/marketingExpenses"));
app.use("/api/notifications", require("./routes/api/notifications"));
app.user("/api/pushToken", require("./routes/api/pushToken"));
app.use("/api/test", require("./routes/api/test"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`STAP Server started on port ${PORT}`);
});
