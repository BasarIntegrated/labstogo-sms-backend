import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { Campaign, Patient } from "./database";
declare const connection: IORedis;
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
export declare const smsQueue: Queue<SMSJobData, any, string>;
export declare const campaignQueue: Queue<CampaignStartJobData, any, string>;
export declare const smsWorker: Worker<SMSJobData, any, string>;
export declare const campaignWorker: Worker<CampaignStartJobData, any, string>;
export { connection };
//# sourceMappingURL=queue.d.ts.map