#!/usr/bin/env node

/**
 * SMS Backend Service
 * 
 * This service runs the BullMQ workers for SMS campaigns.
 * It's designed to run on Railway as a background service.
 */

import { config } from "dotenv";
import express from "express";
import cors from "cors";
import { smsWorker, campaignWorker, connection } from "./lib/queue";
import campaignRoutes from "./api/campaigns";

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use(campaignRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    workers: {
      sms: smsWorker.isRunning(),
      campaign: campaignWorker.isRunning()
    }
  });
});

// Queue status endpoint
app.get("/queue/status", async (req, res) => {
  try {
    const smsQueue = await import("./lib/queue").then(m => m.smsQueue);
    const campaignQueue = await import("./lib/queue").then(m => m.campaignQueue);
    
    const [smsWaiting, smsActive, smsCompleted, smsFailed] = await Promise.all([
      smsQueue.getWaiting(),
      smsQueue.getActive(),
      smsQueue.getCompleted(),
      smsQueue.getFailed()
    ]);

    const [campaignWaiting, campaignActive, campaignCompleted, campaignFailed] = await Promise.all([
      campaignQueue.getWaiting(),
      campaignQueue.getActive(),
      campaignQueue.getCompleted(),
      campaignQueue.getFailed()
    ]);

    res.json({
      smsQueue: {
        waiting: smsWaiting.length,
        active: smsActive.length,
        completed: smsCompleted.length,
        failed: smsFailed.length
      },
      campaignQueue: {
        waiting: campaignWaiting.length,
        active: campaignActive.length,
        completed: campaignCompleted.length,
        failed: campaignFailed.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get queue status" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SMS Backend Service running on port ${PORT}`);
  console.log(`📧 SMS Worker: ${smsWorker.isRunning() ? 'Running' : 'Stopped'}`);
  console.log(`📊 Campaign Worker: ${campaignWorker.isRunning() ? 'Running' : 'Stopped'}`);
  console.log(`🔗 Redis Connection: ${process.env.REDIS_URL || 'localhost:6379'}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("\n🛑 Shutting down SMS Backend Service...");
  
  try {
    await smsWorker.close();
    await campaignWorker.close();
    await connection.quit();
    console.log("✅ Workers shut down successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGUSR2", shutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  shutdown();
});
