"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.twilioService = void 0;
exports.sendCampaignSMS = sendCampaignSMS;
exports.processCampaignRecipients = processCampaignRecipients;
exports.handleTwilioWebhook = handleTwilioWebhook;
const supabase_1 = require("./supabase");
// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
class TwilioService {
    constructor() {
        this.config = null;
        this.twilioClient = null; // eslint-disable-line @typescript-eslint/no-explicit-any
        this.initializeTwilio();
    }
    async initializeTwilio() {
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
            console.warn("Twilio credentials not configured. SMS functionality will be disabled.");
            return;
        }
        try {
            // Dynamic import to avoid issues if Twilio is not installed
            const twilio = await Promise.resolve().then(() => __importStar(require("twilio")));
            this.twilioClient = twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            this.config = {
                accountSid: TWILIO_ACCOUNT_SID,
                authToken: TWILIO_AUTH_TOKEN,
                phoneNumber: TWILIO_PHONE_NUMBER,
            };
            console.log("Twilio service initialized successfully");
        }
        catch (error) {
            console.error("Failed to initialize Twilio service:", error);
        }
    }
    async sendSMS(message) {
        if (!this.twilioClient || !this.config) {
            return {
                success: false,
                error: "Twilio service not configured",
            };
        }
        try {
            const response = await this.twilioClient.messages.create({
                body: message.body,
                from: message.from || this.config.phoneNumber,
                to: message.to,
            });
            return {
                success: true,
                messageId: response.sid,
                status: response.status,
            };
        }
        catch (error) {
            console.error("Twilio SMS error:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to send SMS",
            };
        }
    }
    async sendBulkSMS(messages) {
        const results = [];
        for (const message of messages) {
            const result = await this.sendSMS(message);
            results.push(result);
            // Add a small delay between messages to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return results;
    }
    async getMessageStatus(messageId) {
        if (!this.twilioClient) {
            throw new Error("Twilio service not configured");
        }
        try {
            const message = await this.twilioClient.messages(messageId).fetch();
            return {
                sid: message.sid,
                status: message.status,
                errorCode: message.errorCode,
                errorMessage: message.errorMessage,
                dateCreated: message.dateCreated,
                dateSent: message.dateSent,
                dateUpdated: message.dateUpdated,
            };
        }
        catch (error) {
            console.error("Error fetching message status:", error);
            throw error;
        }
    }
    isConfigured() {
        return !!this.twilioClient && !!this.config;
    }
    getConfig() {
        return this.config;
    }
}
// Create a singleton instance
exports.twilioService = new TwilioService();
// Campaign SMS sending functions
async function sendCampaignSMS(campaignId, contactId, message, phoneNumber) {
    try {
        // Send SMS via Twilio
        const smsResponse = await exports.twilioService.sendSMS({
            to: phoneNumber,
            body: message,
        });
        // Record the SMS message in the database
        const { error: dbError } = await supabase_1.supabaseAdmin.from("sms_messages").insert({
            campaign_id: campaignId,
            contact_id: contactId,
            phone_number: phoneNumber,
            message: message,
            status: smsResponse.success ? "sent" : "failed",
            provider_message_id: smsResponse.messageId,
            provider_response: smsResponse,
            sent_at: smsResponse.success ? new Date().toISOString() : null,
            failed_at: !smsResponse.success ? new Date().toISOString() : null,
            error_message: smsResponse.error,
        });
        if (dbError) {
            console.error("Error recording SMS message:", dbError);
        }
        return {
            success: smsResponse.success,
            messageId: smsResponse.messageId,
            error: smsResponse.error,
        };
    }
    catch (error) {
        console.error("Error sending campaign SMS:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to send SMS",
        };
    }
}
async function processCampaignRecipients(campaignId, recipients) {
    try {
        // Get campaign details
        const { data: campaign, error: campaignError } = await supabase_1.supabaseAdmin
            .from("campaigns")
            .select("*")
            .eq("id", campaignId)
            .single();
        if (campaignError || !campaign) {
            throw new Error("Campaign not found");
        }
        // Get contact details
        const { data: contacts, error: contactsError } = await supabase_1.supabaseAdmin
            .from("contacts")
            .select("*")
            .in("id", recipients);
        if (contactsError) {
            throw new Error("Failed to fetch contacts");
        }
        let processed = 0;
        let errors = 0;
        // Process each recipient
        for (const contact of contacts || []) {
            try {
                // Replace merge tags in message
                let personalizedMessage = campaign.message_template;
                // Simple merge tag replacement
                personalizedMessage = personalizedMessage.replace(/\{\{first_name\}\}/g, contact.first_name || "");
                personalizedMessage = personalizedMessage.replace(/\{\{last_name\}\}/g, contact.last_name || "");
                personalizedMessage = personalizedMessage.replace(/\{\{phone_number\}\}/g, contact.phone_number || "");
                personalizedMessage = personalizedMessage.replace(/\{\{email\}\}/g, contact.email || "");
                personalizedMessage = personalizedMessage.replace(/\{\{company\}\}/g, contact.company || "");
                // Send SMS
                const result = await sendCampaignSMS(campaignId, contact.id, personalizedMessage, contact.phone_number);
                if (result.success) {
                    processed++;
                }
                else {
                    errors++;
                }
                // Update campaign recipient status
                await supabase_1.supabaseAdmin.from("campaign_recipients").upsert({
                    campaign_id: campaignId,
                    contact_id: contact.id,
                    status: result.success ? "sent" : "failed",
                    sent_at: result.success ? new Date().toISOString() : null,
                    failed_at: !result.success ? new Date().toISOString() : null,
                    error_message: result.error,
                    provider_message_id: result.messageId,
                });
            }
            catch (error) {
                console.error(`Error processing contact ${contact.id}:`, error);
                errors++;
            }
        }
        // Update campaign statistics
        await supabase_1.supabaseAdmin
            .from("campaigns")
            .update({
            sent_count: processed,
            failed_count: errors,
            status: "completed",
            completed_at: new Date().toISOString(),
        })
            .eq("id", campaignId);
        return {
            success: true,
            processed,
            errors,
        };
    }
    catch (error) {
        console.error("Error processing campaign recipients:", error);
        return {
            success: false,
            processed: 0,
            errors: 0,
        };
    }
}
// Webhook handler for Twilio status updates
async function handleTwilioWebhook(messageId, status, errorCode, errorMessage) {
    try {
        const updateData = {
            status: status,
            updated_at: new Date().toISOString(),
        };
        if (status === "delivered") {
            updateData.delivered_at = new Date().toISOString();
        }
        else if (status === "failed" || status === "undelivered") {
            updateData.failed_at = new Date().toISOString();
            updateData.error_message = errorMessage || null;
        }
        const { error } = await supabase_1.supabaseAdmin
            .from("sms_messages")
            .update(updateData)
            .eq("provider_message_id", messageId);
        if (error) {
            console.error("Error updating SMS message status:", error);
        }
    }
    catch (error) {
        console.error("Error handling Twilio webhook:", error);
    }
}
//# sourceMappingURL=twilio.js.map