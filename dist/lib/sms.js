"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPhoneNumber = exports.validatePhoneNumber = exports.getSandboxInfo = exports.isSandboxEnabled = exports.personalizeMessage = exports.sendSMS = void 0;
// @ts-ignore
const twilio_1 = __importDefault(require("twilio"));
// Check if we're in sandbox mode
const isSandboxMode = process.env.TWILIO_SANDBOX_MODE === "true";
const isDevelopment = process.env.NODE_ENV === "development";
// Only initialize Twilio if valid credentials are provided
const hasValidCredentials = process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_ACCOUNT_SID.startsWith("AC") &&
    process.env.TWILIO_AUTH_TOKEN.length > 10 &&
    !process.env.TWILIO_ACCOUNT_SID.includes("your_") &&
    !process.env.TWILIO_AUTH_TOKEN.includes("your_");
let client = null;
if (hasValidCredentials) {
    try {
        client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        if (isSandboxMode || isDevelopment) {
            console.log("🧪 Twilio Sandbox Mode: SMS will be sent to verified numbers only");
        }
    }
    catch (error) {
        console.warn("Failed to initialize Twilio client:", error);
        client = null;
    }
}
const sendSMS = async (phoneNumber, message) => {
    try {
        if (!client) {
            console.warn("Twilio client not initialized - SMS sending disabled");
            return {
                success: false,
                error: "Twilio credentials not configured",
            };
        }
        // Test mode: Route all SMS to verified number to prevent failures
        const verifiedTestNumber = process.env.TWILIO_VERIFIED_NUMBER || "+639688800575";
        const isTestMode = isSandboxMode || isDevelopment;
        const shouldUseVerifiedNumber = isTestMode;
        // Development mode: Route all SMS to virtual number
        const virtualPhoneNumber = process.env.DEV_VIRTUAL_PHONE_NUMBER || "+18777804236";
        const shouldUseVirtualNumber = isDevelopment && process.env.DEV_ROUTE_ALL_SMS === "true";
        // Twilio draft mode: Route all SMS to specified test number
        const draftModeTestNumber = "+639688800575";
        const isDraftMode = process.env.TWILIO_DRAFT_MODE === "true";
        const shouldUseDraftNumber = isDraftMode;
        // Use your Twilio phone number as the "from" number
        const fromNumber = isSandboxMode
            ? process.env.TWILIO_PHONE_NUMBER || "+639221200726" // Use env var first, fallback to custom
            : process.env.TWILIO_PHONE_NUMBER;
        // Determine the actual recipient - prioritize verified number in test mode
        const actualRecipient = shouldUseVerifiedNumber
            ? verifiedTestNumber
            : shouldUseDraftNumber
                ? draftModeTestNumber
                : shouldUseVirtualNumber
                    ? virtualPhoneNumber
                    : phoneNumber;
        // Add prefixes for different modes
        let finalMessage = message;
        if (isSandboxMode) {
            finalMessage = `[SANDBOX] ${finalMessage}`;
        }
        if (shouldUseVerifiedNumber) {
            finalMessage = `[TEST] Original: ${phoneNumber}\n${finalMessage}`;
        }
        if (shouldUseDraftNumber) {
            finalMessage = `[DRAFT] Original: ${phoneNumber}\n${finalMessage}`;
        }
        if (shouldUseVirtualNumber) {
            finalMessage = `[DEV] Original: ${phoneNumber}\n${finalMessage}`;
        }
        console.log(`📱 Sending SMS ${isSandboxMode ? "(SANDBOX)" : ""}${shouldUseVerifiedNumber ? " [TEST-VERIFIED]" : ""}${shouldUseDraftNumber ? " [DRAFT-MODE]" : ""}${shouldUseVirtualNumber ? " [DEV-VIRTUAL]" : ""}: ${phoneNumber} -> ${actualRecipient} (from: ${fromNumber})`);
        const result = await client.messages.create({
            body: finalMessage,
            from: fromNumber,
            to: actualRecipient,
        });
        const response = {
            success: true,
            messageId: result.sid,
            providerResponse: {
                status: result.status,
                price: result.price || "0.00", // Sandbox is free
                priceUnit: result.priceUnit || "USD",
                sandbox: isSandboxMode,
            },
        };
        if (isSandboxMode) {
            console.log(`✅ Sandbox SMS sent successfully: ${result.sid}`);
        }
        if (shouldUseVerifiedNumber) {
            console.log(`✅ Test SMS sent to verified number: ${result.sid}`);
        }
        return response;
    }
    catch (error) {
        // Enhanced error logging
        console.error("🚨 SMS sending error:", {
            error: error.message,
            code: error.code,
            status: error.status,
            moreInfo: error.moreInfo,
            phoneNumber: phoneNumber,
            isSandboxMode: isSandboxMode,
            isDevelopment: isDevelopment,
            timestamp: new Date().toISOString(),
        });
        // Provide helpful error messages for sandbox mode
        if (isSandboxMode && error.code === 21211) {
            return {
                success: false,
                error: "Phone number not verified in Twilio sandbox. Please verify your number first.",
            };
        }
        // Enhanced error message with more details
        let errorMessage = error.message || "Unknown error occurred";
        if (error.code) {
            errorMessage = `[${error.code}] ${errorMessage}`;
        }
        if (error.moreInfo) {
            errorMessage += ` - More info: ${error.moreInfo}`;
        }
        return {
            success: false,
            error: errorMessage,
        };
    }
};
exports.sendSMS = sendSMS;
const personalizeMessage = (template, patient) => {
    let personalizedMessage = template;
    // Replace placeholders with actual values
    personalizedMessage = personalizedMessage.replace(/\{first_name\}/g, patient.first_name || "");
    personalizedMessage = personalizedMessage.replace(/\{last_name\}/g, patient.last_name || "");
    personalizedMessage = personalizedMessage.replace(/\{company\}/g, patient.company || "");
    personalizedMessage = personalizedMessage.replace(/\{email\}/g, patient.email || "");
    // Healthcare-specific placeholders
    personalizedMessage = personalizedMessage.replace(/\{license_type\}/g, patient.license_type || "");
    personalizedMessage = personalizedMessage.replace(/\{license_number\}/g, patient.license_number || "");
    personalizedMessage = personalizedMessage.replace(/\{specialty\}/g, patient.specialty || "");
    personalizedMessage = personalizedMessage.replace(/\{renewal_deadline\}/g, patient.next_exam_due
        ? new Date(patient.next_exam_due).toLocaleDateString()
        : "");
    // Calculate days until renewal
    if (patient.next_exam_due) {
        const renewalDate = new Date(patient.next_exam_due);
        const today = new Date();
        const daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        personalizedMessage = personalizedMessage.replace(/\{days_until_renewal\}/g, daysUntilRenewal.toString());
    }
    // Clean up any remaining placeholders or extra spaces
    personalizedMessage = personalizedMessage.replace(/\{[^}]+\}/g, "");
    personalizedMessage = personalizedMessage.replace(/\s+/g, " ").trim();
    return personalizedMessage;
};
exports.personalizeMessage = personalizeMessage;
// Sandbox utility functions
const isSandboxEnabled = () => {
    return isSandboxMode || isDevelopment;
};
exports.isSandboxEnabled = isSandboxEnabled;
const getSandboxInfo = () => {
    return {
        enabled: (0, exports.isSandboxEnabled)(),
        fromNumber: isSandboxMode
            ? process.env.TWILIO_PHONE_NUMBER || "+639221200726"
            : process.env.TWILIO_PHONE_NUMBER,
        messagePrefix: isSandboxMode ? "[SANDBOX] " : "",
        cost: isSandboxMode ? "FREE" : "Charged per message",
    };
};
exports.getSandboxInfo = getSandboxInfo;
const validatePhoneNumber = (phoneNumber) => {
    // Basic phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/\s|-|\(|\)/g, ""));
};
exports.validatePhoneNumber = validatePhoneNumber;
const formatPhoneNumber = (phoneNumber) => {
    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, "");
    // If it doesn't start with +, assume it's a US number and add +1
    if (!cleaned.startsWith("+")) {
        return `+1${cleaned}`;
    }
    return cleaned;
};
exports.formatPhoneNumber = formatPhoneNumber;
//# sourceMappingURL=sms.js.map