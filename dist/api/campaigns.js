"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// API routes for campaign management
const express_1 = __importDefault(require("express"));
const queue_1 = require("../lib/queue");
const supabase_1 = require("../lib/supabase");
const router = express_1.default.Router();
// Start a campaign
router.post("/api/campaigns/:id/start", async (req, res) => {
    try {
        const { id: campaignId } = req.params;
        const { patientIds } = req.body;
        // Get campaign details
        const { data: campaign, error: campaignError } = await supabase_1.supabaseAdmin
            .from("campaigns")
            .select("*")
            .eq("id", campaignId)
            .single();
        if (campaignError || !campaign) {
            return res.status(404).json({ error: "Campaign not found" });
        }
        // Get patient details
        const { data: patients, error: patientsError } = await supabase_1.supabaseAdmin
            .from("patients")
            .select("*")
            .in("id", patientIds);
        if (patientsError || !patients) {
            return res.status(400).json({ error: "Failed to get patients" });
        }
        // Add campaign start job to queue
        await queue_1.campaignQueue.add("start-campaign", {
            campaignId,
            patientIds,
        });
        res.json({
            success: true,
            message: "Campaign started",
            campaignId,
            patientCount: patients.length
        });
    }
    catch (error) {
        console.error("Campaign start error:", error);
        res.status(500).json({ error: "Failed to start campaign" });
    }
});
// Get campaign status
router.get("/api/campaigns/:id/status", async (req, res) => {
    try {
        const { id: campaignId } = req.params;
        const { data: campaign, error } = await supabase_1.supabaseAdmin
            .from("campaigns")
            .select("*")
            .eq("id", campaignId)
            .single();
        if (error || !campaign) {
            return res.status(404).json({ error: "Campaign not found" });
        }
        res.json({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            sentCount: campaign.sent_count || 0,
            failedCount: campaign.failed_count || 0,
            totalRecipients: campaign.total_recipients || 0,
        });
    }
    catch (error) {
        console.error("Campaign status error:", error);
        res.status(500).json({ error: "Failed to get campaign status" });
    }
});
exports.default = router;
//# sourceMappingURL=campaigns.js.map