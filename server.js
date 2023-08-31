const express = require("express");
const connectDB = require("./config/db");
var cors = require("cors");

const app = express();

connectDB();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.status(200).send("API Running");
});

app.use("/api/auth", require("./routes/api/auth"));
app.use("/api/business", require("./routes/api/business"));
app.use("/api/products", require("./routes/api/products"));
app.use("/api/test", require("./routes/api/test"));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`STAP Server started on port ${PORT}`));
