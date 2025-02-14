const express = require("express");
const { connectDatabase } = require("./database");
const rootRouter = require("./routes");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const { config } = require("./config");
const app = express();


app.use(
  cors({
    origin: config.UI_BASE_URL,
    credentials: true,
  })
);

connectDatabase();
app.use(cookieParser())
app.use(express.json());
app.use(rootRouter);

app.get("/", (req, res) => {
  res.send("Node.js is now integrated!");
});

const PORT = config.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
