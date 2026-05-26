import cors from "cors";
import rateLimit from "express-rate-limit";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import analyticsRoutes from "./routes/analytics.js";
import managerAnalyticsRoutes from "./routes/managerAnalytics.js";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import purchaseRoutes from "./routes/purchases.js";
import { errorHandler } from "./middleware/errors.js";

const app = express();

app.set("trust proxy", config.trustProxy);
app.disable("x-powered-by");

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Sem Origin (curl, healthcheck) - libera; Origin conhecida - libera; demais - sem header CORS
      if (!origin) return cb(null, true);
      if (config.appOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (_req, res) => res.json({ ok: true, env: config.nodeEnv }));
app.use("/auth", authRoutes);
app.use("/catalog", catalogRoutes);
app.use("/purchases", purchaseRoutes);
app.use("/", analyticsRoutes);
app.use("/", managerAnalyticsRoutes);
app.use(errorHandler);

export default app;
