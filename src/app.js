const express = require("express");
const cors = require("cors");

const app = express();

const router = require('./routes/index');

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} request ke ${req.url}`);
  next(); 
});

// base route
app.get("/", (req, res) => {
  res.send({
    status: "success",
    message: "Backend Server is Running...",
    timestamp: new Date(),
  });
});

// routes
app.use("/api/v1", router);

app.use((req, res) => {
  res.status(404).json({
    status: false,
    message: "Route not found",
  });
});

module.exports = app;
