const express = require("express");
const cors = require("cors");

const app = express();

const router = require('./routes/index');

const allowedOrigins = [
  'http://localhost:3000', 
  process.env.FRONTEND_WEB_URL 
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Akses ditolak oleh CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
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
