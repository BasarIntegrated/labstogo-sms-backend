// API routes for campaign management
import express from "express";
import { smsQueue, campaignQueue } from "../lib/queue";
import { supabaseAdmin } from "../lib/supabase";

const router = express.Router();

// Start a campaign
router.post("/api/campaigns/:id/start", async (req, res) => {
  try {
    const { id: campaignId } = req.params;
    const { patientIds } = req.body;

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Get patient details
    const { data: patients, error: patientsError } = await supabaseAdmin
      .from("patients")
      .select("*")
      .in("id", patientIds);

    if (patientsError || !patients) {
      return res.status(400).json({ error: "Failed to get patients" });
    }

    // Add campaign start job to queue
    await campaignQueue.add("start-campaign", {
      campaignId,
      patientIds,
    });

    res.json({ 
      success: true, 
      message: "Campaign started",
      campaignId,
      patientCount: patients.length
    });
  } catch (error) {
    console.error("Campaign start error:", error);
    res.status(500).json({ error: "Failed to start campaign" });
  }
});

// Get campaign status
router.get("/api/campaigns/:id/status", async (req, res) => {
  try {
    const { id: campaignId } = req.params;

    const { data: campaign, error } = await supabaseAdmin
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
  } catch (error) {
    console.error("Campaign status error:", error);
    res.status(500).json({ error: "Failed to get campaign status" });
  }
});

export default router;
