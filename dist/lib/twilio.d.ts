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
declare class TwilioService {
    private config;
    private twilioClient;
    constructor();
    private initializeTwilio;
    sendSMS(message: SMSMessage): Promise<SMSResponse>;
    sendBulkSMS(messages: SMSMessage[]): Promise<SMSResponse[]>;
    getMessageStatus(messageId: string): Promise<Record<string, unknown>>;
    isConfigured(): boolean;
    getConfig(): TwilioConfig | null;
}
export declare const twilioService: TwilioService;
export declare function sendCampaignSMS(campaignId: string, contactId: string, message: string, phoneNumber: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
export declare function processCampaignRecipients(campaignId: string, recipients: string[]): Promise<{
    success: boolean;
    processed: number;
    errors: number;
}>;
export declare function handleTwilioWebhook(messageId: string, status: string, errorCode?: string, errorMessage?: string): Promise<void>;
export {};
//# sourceMappingURL=twilio.d.ts.map