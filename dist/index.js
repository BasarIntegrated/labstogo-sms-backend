#!/usr/bin/env node
"use strict";
/**
 * SMS Backend Service
 *
 * This service runs the BullMQ workers for SMS campaigns.
 * It's designed to run on Railway as a background service.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = require("dotenv");
const express_1 = __importDefault(require("express"));
const campaigns_1 = __importDefault(require("./api/campaigns"));
const process_new_contacts_1 = __importDefault(require("./api/process-new-contacts"));
const queue_1 = require("./lib/queue");
// Load environment variables
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API routes
app.use("/api", campaigns_1.default);
app.use("/api", process_new_contacts_1.default);
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        workers: {
            sms: queue_1.smsWorker.isRunning(),
            campaign: queue_1.campaignWorker.isRunning(),
        },
    });
});
// Queue status endpoint
app.get("/queue/status", async (req, res) => {
    try {
        const smsQueue = await Promise.resolve().then(() => __importStar(require("./lib/queue"))).then((m) => m.smsQueue);
        const campaignQueue = await Promise.resolve().then(() => __importStar(require("./lib/queue"))).then((m) => m.campaignQueue);
        const [smsWaiting, smsActive, smsCompleted, smsFailed] = await Promise.all([
            smsQueue.getWaiting(),
            smsQueue.getActive(),
            smsQueue.getCompleted(),
            smsQueue.getFailed(),
        ]);
        const [campaignWaiting, campaignActive, campaignCompleted, campaignFailed] = await Promise.all([
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to get queue status" });
    }
});
// Debug endpoint to test Supabase connection
app.get("/debug/supabase", async (req, res) => {
    try {
        const { supabaseAdmin } = await Promise.resolve().then(() => __importStar(require("./lib/supabase")));
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
    }
    catch (error) {
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
        const { supabaseAdmin } = await Promise.resolve().then(() => __importStar(require("./lib/supabase")));
        const { smsQueue } = await Promise.resolve().then(() => __importStar(require("./lib/queue")));
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
                patient: sms.contacts, // Type assertion for compatibility
                campaign: sms.campaigns, // Type assertion for compatibility
            },
            opts: {
                delay: index * 100, // 100ms delay between each job
            },
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
    }
    catch (error) {
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
    console.log(`📧 SMS Worker: ${queue_1.smsWorker.isRunning() ? "Running" : "Stopped"}`);
    console.log(`📊 Campaign Worker: ${queue_1.campaignWorker.isRunning() ? "Running" : "Stopped"}`);
    console.log(`🔗 Redis Connection: ${process.env.REDIS_URL || "localhost:6379"}`);
});
// Graceful shutdown
const shutdown = async () => {
    console.log("\n🛑 Shutting down SMS Backend Service...");
    try {
        await queue_1.smsWorker.close();
        await queue_1.campaignWorker.close();
        await queue_1.connection.quit();
        console.log("✅ Workers shut down successfully");
        process.exit(0);
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map