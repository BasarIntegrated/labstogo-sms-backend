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
const dotenv_1 = require("dotenv");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const queue_1 = require("./lib/queue");
const campaigns_1 = __importDefault(require("./api/campaigns"));
// Load environment variables
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API routes
app.use(campaigns_1.default);
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        workers: {
            sms: queue_1.smsWorker.isRunning(),
            campaign: queue_1.campaignWorker.isRunning()
        }
    });
});
// Queue status endpoint
app.get("/queue/status", async (req, res) => {
    try {
        const smsQueue = await Promise.resolve().then(() => __importStar(require("./lib/queue"))).then(m => m.smsQueue);
        const campaignQueue = await Promise.resolve().then(() => __importStar(require("./lib/queue"))).then(m => m.campaignQueue);
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to get queue status" });
    }
});
// Start server
app.listen(PORT, () => {
    console.log(`🚀 SMS Backend Service running on port ${PORT}`);
    console.log(`📧 SMS Worker: ${queue_1.smsWorker.isRunning() ? 'Running' : 'Stopped'}`);
    console.log(`📊 Campaign Worker: ${queue_1.campaignWorker.isRunning() ? 'Running' : 'Stopped'}`);
    console.log(`🔗 Redis Connection: ${process.env.REDIS_URL || 'localhost:6379'}`);
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