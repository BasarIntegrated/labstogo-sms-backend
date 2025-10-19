// User and Authentication Types
export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  role: "admin" | "standard";
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// Contact Types (renamed from Patient for general use)
export interface Contact {
  id: string;
  phone_number: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  job_type?: string;
  last_reminder?: string;
  notes?: string;
  tags?: string[];
  status: "active" | "inactive" | "unsubscribed" | "bounced" | "pending";
  group_id?: string;
  license_expiration_date?: string;
  others?: string;
  preferred_contact_method: "sms" | "email" | "both";
  last_contact_date?: string;
  source?: string;
  priority?: "low" | "medium" | "high";

  // Comprehensive timestamp coverage
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;

  campaigns?: Campaign[];
  campaignStats?: {
    total: number;
    delivered: number;
    sent: number;
    failed: number;
    pending: number;
  };
}

// Contact Groups
export interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  contact_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Message Templates
export interface MessageTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  type: "sms" | "email";
  character_count: number;
  parts_estimate: number;
  merge_tags: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Upload Management
export interface Upload {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  total_rows: number;
  processed_rows: number;
  success_rows: number;
  error_rows: number;
  status: "pending" | "processing" | "completed" | "failed";
  error_summary: Record<string, unknown>;
  created_by: string;
  created_at: string;
  completed_at?: string;
}

export interface UploadError {
  id: string;
  upload_id: string;
  row_number: number;
  field_name?: string;
  field_value?: string;
  error_message: string;
  created_at: string;
}

// Campaign Recipients
export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: "pending" | "sent" | "delivered" | "failed" | "bounced";
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error_message?: string;
  provider_message_id?: string;
  provider_response: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Legacy Patient interface for backward compatibility
export interface Patient extends Contact {
  // Medical/Professional Information (legacy)
  license_type?: "Medical" | "Nursing" | "Pharmacy" | "Dental" | "Other";
  license_number?: string;
  specialty?: string;

  // Exam/Renewal Tracking (legacy)
  exam_date?: string;
  renewal_date?: string;
  last_exam_date?: string;
  next_exam_due?: string;
  expires?: string;
  days_until_expiry?: number;
}

export interface RenewalData {
  id: string;
  patient_id: string;
  license_type: string;
  license_number: string;
  current_expiry_date: string;
  renewal_deadline: string;
  renewal_status: "pending" | "submitted" | "approved" | "rejected" | "expired";
  exam_date?: string;
  exam_score?: number;
  renewal_fee?: number;
  notes?: string;

  // Comprehensive timestamp coverage
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;
}

export interface PatientSegment {
  id: string;
  name: string;
  description?: string;
  filters: PatientFilters;
  patient_count: number;

  // Comprehensive timestamp coverage
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;
}

export interface BulkOperation {
  id: string;
  operation_type: "update_status" | "add_tags" | "delete" | "export";
  status: "pending" | "processing" | "completed" | "failed";
  patient_ids: string[];
  operation_data: Record<string, unknown>;
  error_message?: string;

  // Comprehensive timestamp coverage
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  started_at?: string;
  completed_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;
}

export interface Campaign {
  id?: string;
  name: string;
  description?: string;
  message_template: string;
  template_id?: string;
  campaign_type:
    | "renewal_reminder"
    | "exam_notification"
    | "general"
    | "custom";
  status:
    | "draft"
    | "scheduled"
    | "active"
    | "paused"
    | "completed"
    | "cancelled";
  recipient_type: "all" | "groups" | "custom";
  recipient_groups?: string[];
  recipient_contacts?: string[];
  scheduled_at?: string;
  sent_at?: string;
  completed_at?: string;
  filters?: CampaignFilters;
  total_patients?: number;
  sent_count?: number;
  delivered_count?: number;
  failed_count?: number;

  // Renewal-specific fields (legacy)
  renewal_deadline_start?: string;
  renewal_deadline_end?: string;
  license_types?: string[];
  specialties?: string[];
  reminder_frequency?: "daily" | "weekly" | "monthly";
  max_reminders?: number;

  // Comprehensive timestamp coverage
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  created_by: string;
  updated_by?: string;
  deleted_by?: string;
}

export interface PatientFilters {
  search?: string;
  tags?: string[];
  status?: string[];
  license_type?: string[];
  specialty?: string[];
  created_after?: string;
  created_before?: string;
  phone_prefix?: string;
  exam_date_after?: string;
  exam_date_before?: string;
  renewal_date_after?: string;
  renewal_date_before?: string;
  custom_filters?: Record<string, unknown>;
  // Pagination and sorting
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CampaignFilters {
  tags?: string[];
  status?: string[];
  created_after?: string;
  created_before?: string;
  phone_prefix?: string;
  custom_filters?: Record<string, unknown>;

  // Renewal-specific filters
  renewal_deadline_start?: string;
  renewal_deadline_end?: string;
  license_types?: string[];
  specialties?: string[];
  exam_date_start?: string;
  exam_date_end?: string;
  renewal_status?: string[];
  days_until_renewal?: {
    min?: number;
    max?: number;
  };
}

export interface SMSMessage {
  id: string;
  campaign_id: string;
  contact_id: string; // Changed from patient_id
  phone_number: string;
  message: string;
  status: "pending" | "sent" | "delivered" | "failed" | "undelivered";
  provider_message_id?: string;
  provider_response?: Record<string, any>;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error_message?: string;

  // Comprehensive timestamp coverage
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;
}

export interface CampaignStats {
  campaign_id: string;
  total_patients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  pending_count: number;
  delivery_rate: number;
  last_updated: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | "RESTORE";
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  changed_by?: string;
  changed_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface RenewalCampaignTemplate {
  id: string;
  name: string;
  description: string;
  campaign_type: "renewal_reminder" | "exam_notification";
  message_template: string;
  license_types: string[];
  specialties: string[];
  days_before_renewal: number[];
  reminder_frequency: "daily" | "weekly" | "monthly";
  max_reminders: number;
  is_active: boolean;

  // Comprehensive timestamp coverage
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by: string;
  updated_by?: string;
  deleted_by?: string;
}

export interface RenewalReminder {
  id: string;
  patient_id: string;
  renewal_data_id: string;
  campaign_id: string;
  reminder_type: "initial" | "follow_up" | "urgent" | "final";
  days_until_renewal: number;
  message_content: string;
  status: "pending" | "sent" | "delivered" | "failed";
  scheduled_at: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error_message?: string;

  // Comprehensive timestamp coverage
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by?: string;
  updated_by?: string;
  deleted_by?: string;
}

// Dashboard Analytics Types
export interface DashboardMetrics {
  totalPatients: number;
  activeCampaigns: number;
  messagesSentToday: number;
  deliveryRate: number;
  renewalDueCount: number;
  examPendingCount: number;
  totalRevenue?: number;
  conversionRate?: number;
}

export interface CampaignPerformanceData {
  date: string;
  campaigns: number;
  messagesSent: number;
  deliveryRate: number;
  engagementRate: number;
}

export interface PatientEngagementData {
  date: string;
  newPatients: number;
  activePatients: number;
  renewedPatients: number;
  expiredPatients: number;
}

export interface RecentActivity {
  id: string;
  type: "campaign" | "patient" | "renewal" | "system";
  title: string;
  description: string;
  timestamp: string;
  status: "success" | "warning" | "error" | "info";
  metadata?: Record<string, unknown>;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  campaignPerformance: CampaignPerformanceData[];
  patientEngagement: PatientEngagementData[];
  recentActivity: RecentActivity[];
  timeRange: {
    start: string;
    end: string;
    period: "7d" | "30d" | "90d" | "1y";
  };
  totalContacts: number;
  activeCampaigns: number;
  messagesSentToday: number;
  deliveryRate: number;
  performanceData: Array<{
    day: string;
    sent: number;
    delivered: number;
    failed: number;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
    total_patients?: number;
    sent_count?: number;
    created_at: string;
  }>;
}

export interface DashboardFilters {
  timeRange: "7d" | "30d" | "90d" | "1y";
  campaignType?: string;
  licenseType?: string;
  specialty?: string;
}

// Patient Import Types
export interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
  duplicates: DuplicateInfo[];
  summary: ImportSummary;
}

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface DuplicateInfo {
  row: number;
  phoneNumber: string;
  existingPatient: Patient;
  action: "skip" | "update" | "merge";
}

export interface ImportSummary {
  newPatients: number;
  updatedPatients: number;
  skippedPatients: number;
  errorCount: number;
  duplicateCount: number;
}

export interface ImportOptions {
  skipDuplicates: boolean;
  updateExisting: boolean;
  validatePhoneNumbers: boolean;
  validateEmails: boolean;
  batchSize: number;
}
