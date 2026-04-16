export type ServiceType = 'luz' | 'agua' | 'gas'

export interface Receipt {
  id: string
  user_id: string
  service_type: ServiceType
  provider: string | null
  period_start: string | null
  period_end: string | null
  issue_date: string | null
  consumption: number | null
  consumption_unit: string | null
  amount: number
  currency: string
  raw_text: string | null
  ai_confidence: number | null
  created_at: string
}

export interface ReceiptInsert {
  service_type: ServiceType
  provider?: string
  period_start?: string
  period_end?: string
  issue_date?: string
  consumption?: number
  consumption_unit?: string
  amount: number
  currency?: string
  raw_text?: string
  ai_confidence?: number
}

export interface DashboardStats {
  totalSpent: number
  byService: { luz: number; agua: number; gas: number }
  lastReceipts: Receipt[]
}
