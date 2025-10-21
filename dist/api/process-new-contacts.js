"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Backend API route to process newly assigned contacts for active campaigns
const express_1 = __importDefault(require("express"));
const queue_1 = require("../lib/queue");
const supabase_1 = require("../lib/supabase");
const router = express_1.default.Router();
// Process newly assigned contacts for active campaigns
router.post("/campaigns/:id/process-new-contacts", async (req, res) => {
    try {
        const { id: campaignId } = req.params;
        const { contactIds } = req.body;
        if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({ error: "Contact IDs are required" });
        }
        console.log(`Processing ${contactIds.length} newly assigned contacts for active campaign ${campaignId}`);
        // Get campaign details
        const { data: campaign, error: campaignError } = await supabase_1.supabaseAdmin
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
        const { data: contacts, error: contactsError } = await supabase_1.supabaseAdmin
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
        await queue_1.smsQueue.addBulk(smsJobs);
        console.log(`Added ${contacts.length} SMS jobs to queue for newly assigned contacts`);
        res.json({
            success: true,
            message: `Processed ${contacts.length} newly assigned contacts`,
            campaignId,
            processedContacts: contacts.length,
            smsJobsAdded: smsJobs.length,
        });
    }
    catch (error) {
        console.error("Error processing new contacts:", error);
        res.status(500).json({ error: "Failed to process new contacts" });
    }
});
exports.default = router;
//# sourceMappingURL=process-new-contacts.js.map