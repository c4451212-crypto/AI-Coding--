/** 合同列表可配置列（与用户偏好、列设置组件保持一致） */
export const VALID_CONTRACT_LIST_COLUMNS = [
  'sign_date',
  'company_id',
  'contract_no',
  'title',
  'contract_type',
  'total_amount',
  'end_date',
  'status',
  'primary_handler',
  'current_holder',
  'party_company',
  'storage_location',
  'created_at',
  'return_status',
  'scan_file_path',
] as const;

export type ContractListColumnKey = (typeof VALID_CONTRACT_LIST_COLUMNS)[number];

export const DEFAULT_CONTRACT_LIST_COLUMNS: ContractListColumnKey[] = [
  'sign_date',
  'company_id',
  'contract_no',
  'title',
  'contract_type',
  'total_amount',
  'end_date',
  'status',
];

export const ALLOWED_LIST_PAGE_SIZES = [10, 30, 50, 100] as const;

export function parseListColumnsJson(raw: string | null | undefined): ContractListColumnKey[] {
  if (!raw) return [...DEFAULT_CONTRACT_LIST_COLUMNS];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [...DEFAULT_CONTRACT_LIST_COLUMNS];
    const out = arr.filter((c): c is ContractListColumnKey =>
      (VALID_CONTRACT_LIST_COLUMNS as readonly string[]).includes(c as string),
    );
    return out.length ? out : [...DEFAULT_CONTRACT_LIST_COLUMNS];
  } catch {
    return [...DEFAULT_CONTRACT_LIST_COLUMNS];
  }
}
