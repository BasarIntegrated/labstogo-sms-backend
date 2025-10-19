#!/usr/bin/env node

/**
 * BullMQ Worker Script
 *
 * This script runs the BullMQ workers for processing SMS campaigns.
 * It's the Node.js equivalent of Celery workers.
 *
 * Usage: npm run worker
 */

import { config } from "dotenv";
import { campaignWorker, connection, smsWorker } from "../lib/queue";

// Load environment variables
config({ path: ".env.local" });

console.log("🚀 Starting BullMQ Workers...");
console.log("📧 SMS Worker: Processing SMS sending jobs");
console.log("📊 Campaign Worker: Processing campaign start jobs");
console.log("🔗 Redis Connection:", process.env.REDIS_HOST || "localhost:6379");

// Graceful shutdown
const shutdown = async () => {
  console.log("\n🛑 Shutting down workers...");

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
process.on("SIGUSR2", shutdown); // For nodemon

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  shutdown();
});

console.log("✅ Workers started successfully");
console.log("Press Ctrl+C to stop");
