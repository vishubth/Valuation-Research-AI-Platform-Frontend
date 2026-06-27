// Hand-written domain types. The OpenAPI spec declares all response bodies as
// empty schemas ({}), so response shapes are not auto-generated. These types
// reflect the documented response shapes and are used optimistically across the
// UI; unknown extra fields are tolerated.

export type UserRole = "analyst" | "reviewer" | "admin";

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole | string;
  is_active?: boolean;
}

export interface LoginResponse {
  // Backend returns a JWT under one of these keys depending on config.
  token?: string;
  access_token?: string;
  [key: string]: unknown;
}

export type EngagementStatus =
  | "intake"
  | "pending"
  | "processing"
  | "draft"
  | "approved"
  | "failed"
  | "archived"
  | string;

export interface Engagement {
  id: string;
  client_name?: string | null;
  purpose?: string | null;
  status: EngagementStatus;
  current_stage?: string;
  created_at?: string;
  updated_at?: string;
}

export type GateStatus = "pending" | "approved" | "rejected" | string;

export interface Gate {
  id?: string;
  gate_key: string; // e.g. "G1".."G7"
  label?: string;
  status: GateStatus;
  approved_by_name?: string | null;
  approved_by_email?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  selected_approach?: string | null;
}

export type ConfidenceBand = "high" | "medium" | "low" | string;

export interface ExtractionLineItem {
  label: string;
  value: string | number | null;
  period?: string | null;
  confidence?: ConfidenceBand;
}

export interface ExtractionResult {
  company_name?: string | null;
  fiscal_period?: string | null;
  line_items?: ExtractionLineItem[];
  flags?: string[];
}

export type UploadStatus =
  | "queued"
  | "processing"
  | "parsed"
  | "failed"
  | string;

export interface DocumentRecord {
  id: string;
  file_name?: string | null;
  document_type?: string | null;
  upload_status: UploadStatus;
  extraction_status?: UploadStatus;
  extraction_result?: ExtractionResult | null;
  extraction_error?: string | null;
  created_at?: string;
}

export interface RiskFactor {
  factor: string;
  severity?: string;
  source?: string;
}

export interface IndustryClassification {
  naics_code?: string;
  naics_label?: string;
  confidence_band?: ConfidenceBand;
  rationale?: string;
}

export interface BusinessProfile {
  id?: string;
  industry_classification?: IndustryClassification | null;
  revenue_model_summary?: string | null;
  company_stage?: string | null;
  growth_drivers?: string[] | null;
  risk_factors?: RiskFactor[] | null;
  error_message?: string | null;
  status?: string;
}

export const DOCUMENT_TYPES = [
  "10-K",
  "10-Q",
  "annual_report",
  "financial_statements",
  "other",
] as const;

export const GATE_KEYS = ["G1", "G2", "G3", "G4", "G5", "G6", "G7"] as const;

// Research
export interface ResearchItem {
  id: string;
  engagement_id: string;
  title: string;
  source: string; // "sec_edgar" | "news"
  url?: string | null;
  summary?: string | null;
  published_at?: string | null;
  relevance_score?: number | null;
  relevance_band?: string | null;
  is_stale?: boolean;
  analyst_flagged?: boolean;
  analyst_dismissed?: boolean;
  created_at?: string;
}

// Methodology
export interface MethodologyRecommendation {
  id: string;
  engagement_id: string;
  recommended_approach: string;
  rationale?: string | null;
  confidence?: number | null;
  confidence_band?: string | null;
  analyst_selected_approach?: string | null;
  status?: string;
  error_message?: string | null;
  created_at?: string;
}

// Comparables
export interface ComparableCompany {
  ticker?: string;
  name?: string;
  ev_ebitda?: number | null;
  ev_revenue?: number | null;
  market_cap?: number | null;
  revenue?: number | null;
  ebitda?: number | null;
  [key: string]: unknown;
}

export interface MultiplesSummary {
  metric: string;
  mean?: number | null;
  median?: number | null;
  min?: number | null;
  max?: number | null;
  q1?: number | null;
  q3?: number | null;
}

export interface ComparableSet {
  id: string;
  engagement_id: string;
  status: string;
  screening_criteria?: Record<string, unknown> | null;
  comparables?: ComparableCompany[];
  multiples_summary?: MultiplesSummary[] | Record<string, unknown> | null;
  selection_rationale?: string | null;
  error_message?: string | null;
  created_at?: string;
}

// DCF — field names match the backend DCFModel SQLAlchemy model + finance/schemas.py
export interface WaccResult {
  wacc?: number | null;
  cost_of_equity?: number | null;
  after_tax_cost_of_debt?: number | null;
  equity_weight?: number | null;
  debt_weight?: number | null;
  // calculation_trace holds all intermediate values for auditability
  calculation_trace?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface DcfYear {
  year: number;
  fcf?: number | null;
  discount_factor?: number | null;
  present_value?: number | null;
}

export interface DcfResult {
  enterprise_value?: number | null;
  pv_of_cash_flows?: number | null;
  pv_of_terminal_value?: number | null;
  terminal_value_undiscounted?: number | null;
  year_by_year_breakdown?: DcfYear[];
  terminal_value_method?: string | null;
}

// sensitivity_grid is {row_param, col_param, row_values[], col_values[], grid[][]}
export interface SensitivityGrid {
  row_param?: string;
  col_param?: string;
  row_values?: number[];
  col_values?: number[];
  grid?: number[][];
}

export interface DcfModel {
  id: string;
  engagement_id: string;
  status?: string;
  wacc_inputs?: Record<string, unknown> | null;
  wacc_result?: WaccResult | null;
  projection_inputs?: Record<string, unknown> | null;
  dcf_result?: DcfResult | null;
  sensitivity_grid?: SensitivityGrid | null;
  narrative?: string | null;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Report
export interface ReportSection {
  section_key: string;
  content?: string | null;
  citation_validation_passed?: boolean | null;
  version?: number;
  updated_at?: string | null;
}

export interface Report {
  id: string;
  engagement_id: string;
  status?: string;
  sections?: ReportSection[];
  citation_map?: Record<string, unknown> | null;
  error_message?: string | null;
  created_at?: string;
}

export const REPORT_SECTION_ORDER = [
  "executive_summary",
  "company_overview",
  "industry_overview",
  "sources_of_information",
  "valuation_methodology",
  "comparable_company_analysis",
  "dcf_analysis",
  "valuation_conclusion",
  "risk_factors_and_limiting_conditions",
  "ai_usage_disclosure",
] as const;

// Review — item shape from review/agent/checklist.py
export interface ChecklistItem {
  item: string;        // e.g. "all_sections_present"
  description: string; // human-readable description
  status: string;      // "pass" | "fail" | "warning"
  details?: string | null;
}

export interface ReviewChecklist {
  id: string;
  engagement_id: string;
  overall_status: string; // "pass" | "pass_with_warnings" | "fail"
  checklist_results?: ChecklistItem[];
  created_at?: string;
}

// Audit log
export interface AuditEntry {
  id: string;
  engagement_id?: string | null;
  actor_id?: string;
  actor_email?: string;
  actor_full_name?: string | null;
  action: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

// Admin
export interface AdminUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  created_at?: string;
}

// Config
export interface ConfigSetting {
  id: string;
  config_key: string;
  config_type?: string | null;
  config_value?: Record<string, unknown> | unknown;
  version?: number;
  is_active?: boolean;
  updated_by?: string | null;
  updated_at?: string;
}
