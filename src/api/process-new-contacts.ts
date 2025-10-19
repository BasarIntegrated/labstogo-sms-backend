// Backend API route to process newly assigned contacts for active campaigns
import express from "express";
import { smsQueue } from "../lib/queue";
import { supabaseAdmin } from "../lib/supabase";

const router = express.Router();

// Process newly assigned contacts for active campaigns
router.post("/campaigns/:id/process-new-contacts", async (req, res) => {
  try {
    const { id: campaignId } = req.params;
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: "Contact IDs are required" });
    }

    console.log(
      `Processing ${contactIds.length} newly assigned contacts for active campaign ${campaignId}`
    );

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Verify campaign is active
    if (campaign.status !== "active") {
      return res.status(400).json({ error: "Campaign is not active" });
    }

    // Get contact details
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from("contacts")
      .select("*")
      .in("id", contactIds);

    if (contactsError || !contacts) {
      return res.status(500).json({ error: "Failed to get contacts" });
    }

    // Add SMS jobs to queue with delay to prevent overwhelming
    const smsJobs = contacts.map((contact, index) => ({
      name: "send-sms",
      data: {
        campaignId,
        patientId: contact.id,
        phoneNumber: contact.phone_number,
        message: campaign.message_template,
        patient: contact,
        campaign,
      },
      delay: index * 100, // 100ms delay between each job
    }));

    await smsQueue.addBulk(smsJobs);

    console.log(
      `Added ${contacts.length} SMS jobs to queue for newly assigned contacts`
    );

    res.json({
      success: true,
      message: `Processed ${contacts.length} newly assigned contacts`,
      campaignId,
      processedContacts: contacts.length,
      smsJobsAdded: smsJobs.length,
    });
  } catch (error: any) {
    console.error("Error processing new contacts:", error);
    res.status(500).json({ error: "Failed to process new contacts" });
  }
});

export default router;
