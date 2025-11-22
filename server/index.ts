import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { getKyc, postKyc } from "./routes/gas-proxy";
import { handleAddressSearch } from "./routes/address-search";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  // allow uploading base64-encoded documents from the KYC/KYB forms
  const bodyLimit = process.env.BODY_LIMIT_MB ? `${process.env.BODY_LIMIT_MB}mb` : "60mb";
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/address/search", handleAddressSearch);
  app.post("/api/kyc", postKyc);
  app.get("/api/kyc", getKyc);

  return app;
}
