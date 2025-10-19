import { Job, Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { Campaign, Patient } from "./database";
import { formatPhoneNumber, personalizeMessage, sendSMS } from "./sms";
import { supabaseAdmin } from "./supabase";

// Redis connection - Use Railway Redis URL if available
const connection = process.env.REDIS_URL 
  ? new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ blocking operations
    })
  : new IORedis({
      host: process.env.REDISHOST || process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDISPORT || process.env.REDIS_PORT || "6379"),
      password: process.env.REDISPASSWORD || process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Required for BullMQ blocking operations
    });

// Job types
export interface SMSJobData {
  campaignId: string;
  patientId: string;
  phoneNumber: string;
  message: string;
  patient: Patient;
  campaign: Campaign;
}

export interface CampaignStartJobData {
  campaignId: string;
  patientIds: string[];
}

// Create queues
export const smsQueue = new Queue<SMSJobData>("sms-processing", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

export const campaignQueue = new Queue<CampaignStartJobData>("campaign-start", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
  },
});

// SMS Job Processor
export const smsWorker = new Worker<SMSJobData>(
  "sms-processing",
  async (job: Job<SMSJobData>) => {
    const { campaignId, patientId, phoneNumber, message, patient, campaign } =
      job.data;

    console.log(
      `Processing SMS job for patient ${patientId} in campaign ${campaignId}`
    );

    try {
      // Check if campaign is still running
      if (!supabaseAdmin) {
        throw new Error("Supabase admin client not configured");
      }

      const { data: currentCampaign } = await supabaseAdmin
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (!currentCampaign || currentCampaign.status !== "running") {
        throw new Error("Campaign is not running");
      }

      // Personalize the message
      const personalizedMessage = personalizeMessage(message, patient);

      // Format phone number
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Send SMS
      const smsResult = await sendSMS(formattedPhone, personalizedMessage);

      if (smsResult.success) {
        // Update SMS message record
        await supabaseAdmin
          .from("sms_messages")
          .update({
            status: "sent",
            provider_message_id: smsResult.messageId,
            provider_response: smsResult.providerResponse,
            sent_at: new Date().toISOString(),
          })
          .eq("campaign_id", campaignId)
          .eq("contact_id", patientId);

        // Update campaign sent count
        await supabaseAdmin
          .from("campaigns")
          .update({
            sent_count: (campaign.sent_count || 0) + 1,
          })
          .eq("id", campaignId);

        console.log(`SMS sent successfully for patient ${patientId}`);
        return { success: true, messageId: smsResult.messageId };
      } else {
        throw new Error(smsResult.error || "SMS sending failed");
      }
    } catch (error: any) {
      console.error(`SMS job failed for patient ${patientId}:`, error.message);

      // Update SMS message record with error
      await supabaseAdmin
        .from("sms_messages")
        .update({
          status: "failed",
          error_message: error.message,
          failed_at: new Date().toISOString(),
        })
        .eq("campaign_id", campaignId)
        .eq("contact_id", patientId);

      // Update campaign failed count
      await supabaseAdmin
        .from("campaigns")
        .update({
          failed_count: (campaign.failed_count || 0) + 1,
        })
        .eq("id", campaignId);

      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 SMS jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs per second
      duration: 1000,
    },
  }
);

// Campaign Start Job Processor
export const campaignWorker = new Worker<CampaignStartJobData>(
  "campaign-start",
  async (job: Job<CampaignStartJobData>) => {
    const { campaignId, patientIds } = job.data;

    console.log(
      `Starting campaign ${campaignId} with ${patientIds.length} patients`
    );

    try {
      if (!supabaseAdmin) {
        throw new Error("Supabase admin client not configured");
      }

      // Get campaign details
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (campaignError || !campaign) {
        throw new Error("Campaign not found");
      }

      // Get patients
      const { data: patients, error: patientsError } = await supabaseAdmin
        .from("patients")
        .select("*")
        .in("id", patientIds);

      if (patientsError || !patients) {
        throw new Error("Failed to fetch patients");
      }

      // Create SMS messages
      const smsMessages = patients.map((patient) => ({
        campaign_id: campaignId,
        contact_id: patient.id,
        phone_number: patient.phone_number,
        message: campaign.message_template,
        status: "pending",
      }));

      const { error: smsError } = await supabaseAdmin
        .from("sms_messages")
        .insert(smsMessages);

      if (smsError) {
        throw new Error("Failed to create SMS messages");
      }

      // Add SMS jobs to queue with delay to prevent overwhelming
      const smsJobs = patients.map((patient, index) => ({
        name: "send-sms",
        data: {
          campaignId,
          patientId: patient.id,
          phoneNumber: patient.phone_number,
          message: campaign.message_template,
          patient,
          campaign,
        },
        delay: index * 100, // 100ms delay between each job
      }));

      await smsQueue.addBulk(smsJobs);

      console.log(
        `Added ${patients.length} SMS jobs to queue for campaign ${campaignId}`
      );
      return { success: true, jobCount: patients.length };
    } catch (error: any) {
      console.error(
        `Campaign start job failed for ${campaignId}:`,
        error.message
      );
      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Process up to 2 campaign start jobs concurrently
  }
);

// Event handlers
smsWorker.on("completed", (job) => {
  console.log(`SMS job ${job.id} completed successfully`);
});

smsWorker.on("failed", (job, err) => {
  console.error(`SMS job ${job?.id} failed:`, err.message);
});

campaignWorker.on("completed", (job) => {
  console.log(`Campaign start job ${job.id} completed successfully`);
});

campaignWorker.on("failed", (job, err) => {
  console.error(`Campaign start job ${job?.id} failed:`, err.message);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down workers...");
  await smsWorker.close();
  await campaignWorker.close();
  await connection.quit();
  process.exit(0);
});

export { connection };
