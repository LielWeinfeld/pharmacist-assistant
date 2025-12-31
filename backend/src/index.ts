import "dotenv/config";
import express from "express";
import cors from "cors";
import chatRouter from "./routes/chat";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  })
);

app.use("/api/chat", chatRouter);

if (!process.env.OPENAI_API_KEY) {
  console.error("[server] Missing OPENAI_API_KEY in server/.env");
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  // console.log(`[server] listening on http://localhost:${port}`);
});