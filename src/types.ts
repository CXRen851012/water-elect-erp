export interface CustomerAddress {
  id: string;
  fullAddress: string;
  addressAbbreviated?: string; // 地址簡稱 (可能無)
  contactPerson?: string; // 現場負責人/聯絡人 (此地址專屬，可能無)
  contactPhone?: string; // 聯絡人號碼/電話 (此地址專屬，可能無)
  addressNotes?: string; // 地址特別備註 / 注意事項 (此地址專屬，可能無)
}

export interface Customer {
  id: string;
  name: string; // 公司名 / 業主名
  contactPerson?: string; // 客戶主聯絡人 (非必填)
  phone?: string; // 客戶主聯絡方式 (非必填)
  notes?: string; // 客戶特別備註 (非必填 / 例如付款方式、代表作等等)
  addresses: CustomerAddress[]; // 同一客戶可能有多個客製化工意地址及專屬聯絡細部
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

export interface SalaryAdjustment {
  id: string;
  date: string;       // 變更日期 (YYYY-MM-DD)
  oldRate: number;    // 調整前時薪
  newRate: number;    // 調整後時薪
  oldRole?: string;   // 調整前級職
  newRole?: string;   // 調整後級職
  reason?: string;    // 原因/說明
}

export interface Worker {
  id: string;
  name: string;
  role?: string; // e.g., 師傅, 半技工, 粗工, 外調支援
  defaultHourlyRate: number; // 預設時薪
  billingHourlyRate?: number; // 預設對客報價時薪
  status?: '在職' | '離職'; // 在職狀態，預設在職
  phone?: string; // 聯絡電話
  idNumber?: string; // 身分證字號
  address?: string; // 居住地址
  birthDate?: string; // 出生年月日
  registeredAddress?: string; // 戶籍地址
  doubleIdPhotos?: string[]; // 雙證件照片上傳 (Base64字串陣列)
  emergencyContacts?: EmergencyContact[]; // 允許多位緊急聯絡人
  notes?: string; // 特別備註
  joinDate?: string; // 入職日期 YYYY-MM-DD
  leaveDate?: string; // 離職日期 YYYY-MM-DD
  salaryHistory?: SalaryAdjustment[]; // 紀錄調薪/晉升紀錄
  
  // 勞健保、提撥與代扣款設定
  laborInsuranceSelfPay?: number;       // 勞保個人自付額 (代扣)
  healthInsuranceSelfPay?: number;      // 健保個人自付額 (代扣)
  laborPensionSelfPay?: number;         // 勞退個人自繳金 (代扣)
  laborPensionEmployerUnit?: number;    // 勞退公司提撥金 ( employer 6% 負擔)
  otherWithholding?: number;            // 其它代扣款 (如所得稅、工會費)
  laborInsuranceEmployerPay?: number;   // 勞保公司負擔部分
  healthInsuranceEmployerPay?: number;  // 健保公司負擔部分
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  notes?: string; // 備註 (例如：主打給水器材、全品項退1.5成、隔月付款電線便宜等)
  taxId?: string; // 統一編號 (統編，非必填)
  photoUrl?: string; // 名片或商家相片 (Base64 或圖片路徑)
  showInMaterialsDatabase?: boolean; // 勾選是否顯示在材料大庫內中的特約材料行
}

export interface MaterialSupplier {
  id: string;
  storeName: string; // 材料行名稱 (e.g., 振興材料行)
  listPrice: number; // 牌價
  costPrice: number; // 成本 / 進價
}

export interface MaterialUnitOption {
  id: string;
  unit: string; // 單位 (e.g., 支, 米, 個, 捲, 箱)
  defaultUnitPrice: number; // 預設牌價 (店家特約最高值)
  defaultCostPrice: number; // 預設進料成本 (店家特約最高值)
  suppliers?: MaterialSupplier[]; // 此單位下的特約店家專屬合約牌價/成本
  conversionFactor?: number; // 快速單位換算係數：1 [此單位] = X [主單位]
  conversionInverse?: boolean; // 是否為逆向換算方向，即 Y [此單位] = 1 [主單位]
  useConversionPricing?: boolean; // 是否自動以換算方向/比例計算牌價與成本
  targetUnitOptionId?: string; // 自選要對應/換算的目標單位 ID (若無則預設為第一個即預設規格)
}

export interface MaterialPreset {
  id: string;
  name: string;
  unit: string;
  defaultUnitPrice: number; // 預設牌價
  defaultCostPrice?: number; // 預設成本 (可選)
  suppliers?: MaterialSupplier[]; // 可自訂多個材料行的牌價及進價成本
  category?: string; // 材料品項分類 (電材、水材、廚衛等)
  subcategory?: string; // 材料品項次分類 / 二層分類 (例如: 電線, 水管)
  unitOptions?: MaterialUnitOption[]; // 同一品項可能對應不同單位，各自擁有其牌成本即特定材料行商報價
  isRealPrice?: boolean; // 是否為「實價」品項 (無固定成本牌價)
}

export interface Project {
  id: string;
  clientId?: string; // 關聯之客戶ID (可能無)
  serialNumber: string; // 流水號 (e.g., P-202605-001)
  companyOrOwner: string; // 公司名/業主名
  contactPerson?: string; // 聯絡人 (原為負責人)
  addressAbbreviated?: string; // 地址簡稱
  fullAddress: string; // 完整地址
  contactPhone?: string; // 聯絡方式 (非必填)
  projectNotes?: string; // 專案注意事項 (非必填)
  generatedName: string; // 自動生成的案場名稱: 日期-公司名/業主名-聯絡人(可能無)-地址簡稱(可能無)-完整地址-流水號(自動)
  isCompleted: boolean; // 是否完工
  isEstimation?: boolean; // 是否為估價案場模式
  estimationLabor?: RecordWorker[]; // 預估人力項目
  estimationMaterials?: RecordMaterial[]; // 預估耗材項目
  estimationQuoteAmount?: number; // 報價金額 (預算總合報價)
  estimationStatus?: '估價中' | '進行中施工' | '報價未成'; // 估價案場專用狀態
  createdAt: string;
}

export interface RecordMaterial {
  id: string; 
  materialId?: string; // 庫存模版關聯 ID
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number; // 本日記帳單價 (在日誌輸入頁隱藏或顯示，代表牌價/報價單價)
  isNearbyPurchased: boolean; // 是否為附近臨採
  storeName?: string; // 採購店家 / 材料行名稱
  costPrice?: number; // 實際採購成本單價
}

export interface RecordExpense {
  id: string;
  type: string; // 例如 parking, meal, custom 等
  description: string;
  amount: number;
  isProjectExpense?: boolean; // 新增：是否算在案場內開銷
}

export interface RecordWorker {
  id: string;
  workerId: string; // 'support' 代表外調額外人力
  name: string;
  hoursWork: number; // 當日工時
  hourlyRate: number; // 計酬時薪 (在日誌輸入頁隱藏，但實體內要附值便於事後計算)
  billingHourlyRate?: number; // 對客報價時薪
  isSupport?: boolean; // 是否為外調支援或額外人力 (不停留於固定在職人員名單中)
  workerCount?: number; // 預估人數
  daysWork?: number; // 預估天工時 (以半天 0.5 天為單位)
  estimationSalary?: number; // 預估薪資/每人日工薪
  supportRole?: string; // 外聘調遣工種 (粗工、半技工、專業水電大工等)
}

export interface DailyRecord {
  id: string;
  date: string; // 日期 (YYYY-MM-DD)
  projectId: string; // 案場ID
  projectName: string; // 案場名稱備份
  materials: RecordMaterial[];
  expenses: RecordExpense[];
  workers: RecordWorker[];
  notes: string; // 每日注意事項與進程
  markAsCompleted: boolean; // 今日是否完工
  collectedAmount?: number; // 現場當下直接收款金額 (自選)
  internalCostOnly?: boolean; // 僅登錄內部工工資/車馬費，不對業主產生計價費用（純查勘/零施作）
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  customerId: string; // 關聯客戶
  projectNameOrId?: string; // 特定案場 ID (如果是專案專用或直接收款)，若無則為客戶預收/備用溢收池
  date: string; // 付款日期 YYYY-MM-DD
  amount: number; // 款項金額
  method?: string; // 支付方式 (現金, 匯款, 支票等)
  allocationType: 'specific_project' | 'client_pool' | 'multi_project' | 'old_debt' | 'round_adjustment' | 'advance';
  // specific_project: 特定案場專款專用
  // client_pool: 儲存至客戶預收款/溢收池 (多給、未施工先給)
  // multi_project: 多案場分配付款
  // old_debt: 隨機給/自動抵扣未清案場
  // round_adjustment: 去尾多給的調整 (調整款/抹零/溢付不找零)
  // advance: 未施工先給的保證金/預付款
  description?: string; // 備註 (例如：去尾多給、後續案場合扣、信義店訂金)
  paymentStage?: string; // 收款期別 / 階段 (例如: 第一期款-定金, 第二期款, 尾款)
  createdAt: string;
}

export interface WorkerAdvance {
  id: string;
  workerId: string;       // 關聯工班同仁
  workerName: string;     // 備份同仁名稱
  date: string;           // 預支/借支日期 YYYY-MM-DD
  amount: number;         // 金額
  type: 'borrow' | 'repay'; // borrow: 預支/借支, repay: 還款/薪資抵扣
  status: 'pending' | 'settled'; // pending: 未結清, settled: 已結清/已扣除
  description?: string;   // 備註/說明 (例如：買手工具、預支生活費)
  createdAt: string;
}

export interface PettyCashTransaction {
  id: string;
  date: string;           // 收支日期 YYYY-MM-DD
  type: 'income' | 'expense'; // income: 提撥/收/補進零用金, expense: 支出/買雜物
  amount: number;         // 金額
  category: 'feed' | 'tool' | 'parking' | 'fuel' | 'fund_in' | 'other'; // 分類
  projectNameOrId?: string; // 關聯案場
  description: string;   // 詳細說明
  payerName?: string;     // 經手人/支付人姓名
  createdAt: string;
}
