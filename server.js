const express = require("express");
const connectDB = require("./config/db");
var cors = require("cors");

const app = express();

connectDB();
app.use(express.json());
app.use(cors());

app.use("/api/auth", require("./routes/api/auth"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`STAP Server started on port ${PORT}`));
