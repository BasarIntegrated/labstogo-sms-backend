#!/usr/bin/env node

/**
 * SMS Backend Service
 *
 * This service runs the BullMQ workers for SMS campaigns.
 * It's designed to run on Railway as a background service.
 */

import cors from "cors";
import { config } from "dotenv";
import express from "express";
import campaignRoutes from "./api/campaigns";
import processNewContactsRoutes from "./api/process-new-contacts";
import { campaignWorker, connection, smsWorker } from "./lib/queue";

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api", campaignRoutes);
app.use("/api", processNewContactsRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    workers: {
      sms: smsWorker.isRunning(),
      campaign: campaignWorker.isRunning(),
    },
  });
});

// Queue status endpoint
app.get("/queue/status", async (req, res) => {
  try {
    const smsQueue = await import("./lib/queue").then((m) => m.smsQueue);
    const campaignQueue = await import("./lib/queue").then(
      (m) => m.campaignQueue
    );

    const [smsWaiting, smsActive, smsCompleted, smsFailed] = await Promise.all([
      smsQueue.getWaiting(),
      smsQueue.getActive(),
      smsQueue.getCompleted(),
      smsQueue.getFailed(),
    ]);

    const [campaignWaiting, campaignActive, campaignCompleted, campaignFailed] =
      await Promise.all([
        campaignQueue.getWaiting(),
        campaignQueue.getActive(),
        campaignQueue.getCompleted(),
        campaignQueue.getFailed(),
      ]);

    res.json({
      smsQueue: {
        waiting: smsWaiting.length,
        active: smsActive.length,
        completed: smsCompleted.length,
        failed: smsFailed.length,
      },
      campaignQueue: {
        waiting: campaignWaiting.length,
        active: campaignActive.length,
        completed: campaignCompleted.length,
        failed: campaignFailed.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get queue status" });
  }
});

// Debug endpoint to test Supabase connection
app.get("/debug/supabase", async (req, res) => {
  try {
    const { supabaseAdmin } = await import("./lib/supabase");
    
    // Test basic connection
    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .select("id, name, status")
      .limit(3);

    if (error) {
      return res.status(500).json({
        error: "Supabase connection failed",
        details: error.message,
        code: error.code,
        hint: error.hint,
      });
    }

    res.json({
      success: true,
      message: "Supabase connection successful",
      campaignCount: data?.length || 0,
      campaigns: data || [],
      env: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Not set",
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set" : "Not set",
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Debug query failed",
      details: error.message,
      stack: error.stack,
    });
  }
});

// Manual queue processing endpoint
app.post("/api/process-pending-sms", async (req, res) => {
  try {
    const { supabaseAdmin } = await import("./lib/supabase");
    const { smsQueue } = await import("./lib/queue");

    // Get pending SMS messages
    const { data: pendingSMS, error: smsError } = await supabaseAdmin
      .from("sms_messages")
      .select(`
        id,
        campaign_id,
        contact_id,
        phone_number,
        message,
        status,
        campaigns (
          id,
          name,
          message_template,
          status
        ),
        contacts (
          id,
          first_name,
          last_name,
          phone_number
        )
      `)
      .eq("status", "pending")
      .limit(10);

    if (smsError) {
      return res.status(500).json({
        error: "Failed to fetch pending SMS",
        details: smsError.message,
      });
    }

    if (!pendingSMS || pendingSMS.length === 0) {
      return res.json({
        success: true,
        message: "No pending SMS messages found",
        processed: 0,
      });
    }

    // Add SMS jobs to queue
    const smsJobs = pendingSMS.map((sms, index) => ({
      name: "send-sms",
      data: {
        campaignId: sms.campaign_id,
        patientId: sms.contact_id,
        phoneNumber: sms.phone_number,
        message: sms.message,
        patient: sms.contacts,
        campaign: sms.campaigns,
      },
      delay: index * 100, // 100ms delay between each job
    }));

    await smsQueue.addBulk(smsJobs);

    res.json({
      success: true,
      message: `Added ${smsJobs.length} SMS jobs to queue`,
      processed: smsJobs.length,
      jobs: smsJobs.map(job => ({
        campaignId: job.data.campaignId,
        patientId: job.data.patientId,
        phoneNumber: job.data.phoneNumber,
      })),
    });
  } catch (error: any) {
    console.error("Manual queue processing error:", error);
    res.status(500).json({
      error: "Failed to process pending SMS",
      details: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SMS Backend Service running on port ${PORT}`);
  console.log(
    `📧 SMS Worker: ${smsWorker.isRunning() ? "Running" : "Stopped"}`
  );
  console.log(
    `📊 Campaign Worker: ${campaignWorker.isRunning() ? "Running" : "Stopped"}`
  );
  console.log(
    `🔗 Redis Connection: ${process.env.REDIS_URL || "localhost:6379"}`
  );
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
