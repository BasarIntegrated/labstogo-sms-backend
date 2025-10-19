export interface SMSResult {
    success: boolean;
    messageId?: string;
    error?: string;
    providerResponse?: any;
}
export declare const sendSMS: (phoneNumber: string, message: string) => Promise<SMSResult>;
export declare const personalizeMessage: (template: string, patient: {
    first_name?: string;
    last_name?: string;
    company?: string;
    email?: string;
    license_type?: string;
    license_number?: string;
    specialty?: string;
    next_exam_due?: string;
}) => string;
export declare const isSandboxEnabled: () => boolean;
export declare const getSandboxInfo: () => {
    enabled: boolean;
    fromNumber: string | undefined;
    messagePrefix: string;
    cost: string;
};
export declare const validatePhoneNumber: (phoneNumber: string) => boolean;
export declare const formatPhoneNumber: (phoneNumber: string) => string;
//# sourceMappingURL=sms.d.ts.map