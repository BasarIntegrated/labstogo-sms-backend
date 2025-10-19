import { supabaseAdmin } from "./supabase";

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

export interface SMSMessage {
  to: string;
  body: string;
  from?: string;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

class TwilioService {
  private config: TwilioConfig | null = null;
  private twilioClient: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor() {
    this.initializeTwilio();
  }

  private async initializeTwilio() {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.warn(
        "Twilio credentials not configured. SMS functionality will be disabled."
      );
      return;
    }

    try {
      // Dynamic import to avoid issues if Twilio is not installed
      const twilio = await import("twilio");
      this.twilioClient = twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      this.config = {
        accountSid: TWILIO_ACCOUNT_SID,
        authToken: TWILIO_AUTH_TOKEN,
        phoneNumber: TWILIO_PHONE_NUMBER,
      };
      console.log("Twilio service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Twilio service:", error);
    }
  }

  async sendSMS(message: SMSMessage): Promise<SMSResponse> {
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
    } catch (error: unknown) {
      console.error("Twilio SMS error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send SMS",
      };
    }
  }

  async sendBulkSMS(messages: SMSMessage[]): Promise<SMSResponse[]> {
    const results: SMSResponse[] = [];

    for (const message of messages) {
      const result = await this.sendSMS(message);
      results.push(result);

      // Add a small delay between messages to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  async getMessageStatus(messageId: string): Promise<Record<string, unknown>> {
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
    } catch (error: unknown) {
      console.error("Error fetching message status:", error);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.twilioClient && !!this.config;
  }

  getConfig(): TwilioConfig | null {
    return this.config;
  }
}

// Create a singleton instance
export const twilioService = new TwilioService();

// Campaign SMS sending functions
export async function sendCampaignSMS(
  campaignId: string,
  contactId: string,
  message: string,
  phoneNumber: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Send SMS via Twilio
    const smsResponse = await twilioService.sendSMS({
      to: phoneNumber,
      body: message,
    });

    // Record the SMS message in the database
    const { error: dbError } = await supabaseAdmin.from("sms_messages").insert({
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
  } catch (error: unknown) {
    console.error("Error sending campaign SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

export async function processCampaignRecipients(
  campaignId: string,
  recipients: string[]
): Promise<{ success: boolean; processed: number; errors: number }> {
  try {
    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaign not found");
    }

    // Get contact details
    const { data: contacts, error: contactsError } = await supabaseAdmin
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
        personalizedMessage = personalizedMessage.replace(
          /\{\{first_name\}\}/g,
          contact.first_name || ""
        );
        personalizedMessage = personalizedMessage.replace(
          /\{\{last_name\}\}/g,
          contact.last_name || ""
        );
        personalizedMessage = personalizedMessage.replace(
          /\{\{phone_number\}\}/g,
          contact.phone_number || ""
        );
        personalizedMessage = personalizedMessage.replace(
          /\{\{email\}\}/g,
          contact.email || ""
        );
        personalizedMessage = personalizedMessage.replace(
          /\{\{company\}\}/g,
          contact.company || ""
        );

        // Send SMS
        const result = await sendCampaignSMS(
          campaignId,
          contact.id,
          personalizedMessage,
          contact.phone_number
        );

        if (result.success) {
          processed++;
        } else {
          errors++;
        }

        // Update campaign recipient status
        await supabaseAdmin.from("campaign_recipients").upsert({
          campaign_id: campaignId,
          contact_id: contact.id,
          status: result.success ? "sent" : "failed",
          sent_at: result.success ? new Date().toISOString() : null,
          failed_at: !result.success ? new Date().toISOString() : null,
          error_message: result.error,
          provider_message_id: result.messageId,
        });
      } catch (error: any) {
        console.error(`Error processing contact ${contact.id}:`, error);
        errors++;
      }
    }

    // Update campaign statistics
    await supabaseAdmin
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
  } catch (error: unknown) {
    console.error("Error processing campaign recipients:", error);
    return {
      success: false,
      processed: 0,
      errors: 0,
    };
  }
}

// Webhook handler for Twilio status updates
export async function handleTwilioWebhook(
  messageId: string,
  status: string,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  try {
    const updateData: Record<string, string | null> = {
      status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === "delivered") {
      updateData.delivered_at = new Date().toISOString();
    } else if (status === "failed" || status === "undelivered") {
      updateData.failed_at = new Date().toISOString();
      updateData.error_message = errorMessage || null;
    }

    const { error } = await supabaseAdmin
      .from("sms_messages")
      .update(updateData)
      .eq("provider_message_id", messageId);

    if (error) {
      console.error("Error updating SMS message status:", error);
    }
  } catch (error) {
    console.error("Error handling Twilio webhook:", error);
  }
}
