import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./middleware/auth.js";
import { analyzeRoute } from "./routes/analyze.js";
import { testRoute } from "./routes/test.js";
import { gradeRoute } from "./routes/grade.js";
import { analyzeResultsRoute } from "./routes/analyze-results.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.use(rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/api/analyze-note", requireAuth, analyzeRoute());
app.post("/api/generate-test", requireAuth, testRoute());
app.post("/api/grade-written", requireAuth, gradeRoute());
app.post("/api/analyze-results", requireAuth, analyzeResultsRoute());

app.use((err, req, res, next) => {
  console.error("ERROR:", err.message);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Zubrilka server on :${PORT}`));
