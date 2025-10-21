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
// Debug endpoint to test Supabase connection
router.get("/debug/campaigns", async (req, res) => {
    try {
        const { data: campaigns, error } = await supabase_1.supabaseAdmin
            .from("campaigns")
            .select("*")
            .limit(5);
        if (error) {
            return res.status(500).json({
                error: "Supabase query failed",
                details: error.message,
                code: error.code,
            });
        }
        res.json({
            success: true,
            campaignCount: campaigns?.length || 0,
            campaigns: campaigns || [],
        });
    }
    catch (error) {
        console.error("Debug campaigns error:", error);
        res
            .status(500)
            .json({ error: "Debug query failed", details: error.message });
    }
});
// Start a campaign
router.post("/campaigns/:id/start", async (req, res) => {
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
        // Get contact details (patients table might be renamed to contacts)
        const { data: contacts, error: contactsError } = await supabase_1.supabaseAdmin
            .from("contacts")
            .select("*")
            .in("id", patientIds);
        if (contactsError || !contacts) {
            return res.status(400).json({
                error: "Failed to get contacts",
                details: contactsError?.message,
            });
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
            patientCount: contacts.length,
        });
    }
    catch (error) {
        console.error("Campaign start error:", error);
        res.status(500).json({ error: "Failed to start campaign" });
    }
});
// Get campaign status
router.get("/campaigns/:id/status", async (req, res) => {
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