// 施工與工班後台統一加成與定價運算工具
// 用於徹底剝離個人資料，統一以職等與耗材分類作為報價計算核心

export interface RoleBillingConfig {
  role: string;
  mode: 'fixed' | 'multiplier'; // 'fixed': 固定對客時薪, 'multiplier': 成本加成倍率
  fixedRate?: number;            // 固定時薪 (如 500)
  multiplier?: number;          // 倍率 (如 1.25)
  maxLimit?: number;             // 倍率上限額度 (如 600)，若無或設為 0 則不設限
}

export interface CategoryMaterialConfig {
  category: string;
  multiplier: number; // 加成倍率 (如 1.10)
}

// 取得所有職等的對客報價定價規則
export function getRoleBillingConfigs(): RoleBillingConfig[] {
  try {
    const stored = localStorage.getItem('engineering_role_billing_configs');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse role billing configs:', e);
  }

  // 系統預設對應規則：預設採 1.2 倍加成 (部分特殊職責採固定或更高加成)
  const defaultRoles = ['專業師傅', '水電工頭', '半技工', '技術工', '粗工/助手', '學徒/助理', '臨時支援'];
  return defaultRoles.map(role => {
    if (role === '水電工頭') {
      return { role, mode: 'multiplier', multiplier: 1.25, maxLimit: 600 };
    }
    if (role === '專業師傅') {
      return { role, mode: 'multiplier', multiplier: 1.2, maxLimit: 500 };
    }
    return { role, mode: 'multiplier', multiplier: 1.15 };
  });
}

// 儲存職等對客報價定價規則
export function saveRoleBillingConfigs(configs: RoleBillingConfig[]): void {
  localStorage.setItem('engineering_role_billing_configs', JSON.stringify(configs));
}

// 計算特定同仁的動態對客報價時薪
export function calculateWorkerBillingRate(role: string | undefined, defaultHourlyRate: number, customConfigs?: RoleBillingConfig[]): number {
  const configs = customConfigs || getRoleBillingConfigs();
  const roleName = role || '專業師傅';
  const config = configs.find(c => c.role === roleName);

  if (!config) {
    // 預設 1.1 倍加成
    return Math.round(defaultHourlyRate * 1.1);
  }

  if (config.mode === 'fixed') {
    return config.fixedRate && config.fixedRate > 0 ? config.fixedRate : defaultHourlyRate;
  } else {
    const mult = config.multiplier && config.multiplier > 0 ? config.multiplier : 1.1;
    const calculated = Math.round(defaultHourlyRate * mult);
    if (config.maxLimit && config.maxLimit > 0) {
      return Math.min(calculated, config.maxLimit);
    }
    return calculated;
  }
}

// 取得所有耗材分類的對客報價加成倍率設定
export function getCategoryMaterialConfigs(): CategoryMaterialConfig[] {
  try {
    const stored = localStorage.getItem('engineering_category_material_configs');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse category material configs:', e);
  }

  // 預設分類加成倍率，預設乘上 1.1
  const defaultCategories = ['水路管材類', '電路電材類', '廚衛設備類', '五金緊固類', '工具與雜耗'];
  return defaultCategories.map(category => ({
    category,
    multiplier: category === '工具與雜耗' ? 1.05 : 1.10
  }));
}

// 儲存耗材分類加成倍率設定
export function saveCategoryMaterialConfigs(configs: CategoryMaterialConfig[]): void {
  localStorage.setItem('engineering_category_material_configs', JSON.stringify(configs));
}

// 計算特定消耗材料的建議對客牌價
export function getSubcategoryMultipliers(): Record<string, number> {
  try {
    const stored = localStorage.getItem('engineering_subcategory_multipliers');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse subcategory multipliers:', e);
  }
  return {};
}

export function saveSubcategoryMultipliers(multipliers: Record<string, number>): void {
  localStorage.setItem('engineering_subcategory_multipliers', JSON.stringify(multipliers));
}

export function getSubcategories(): Record<string, string[]> {
  try {
    const stored = localStorage.getItem('engineering_material_subcategories');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {}
  // 預設二級次細分類
  return {
    '水路管材類': ['PVC管/另件', '不銹鋼管/接頭', '壓接另件', '配管閥門', '止洩帶/膠水', '冷熱水龍頭', '給排水管件'],
    '電路電材類': ['電線單線', '絞線電纜', '電工膠帶', '插座開關', '配電箱/斷路器', '線槽軟管', '絕緣套管/端子'],
    '廚衛設備類': ['衛生馬桶', '面盆面鏡', '花灑淋浴', '排風機/暖風機', '廚房水槽/龍頭', '衛浴五金掛件'],
    '五金緊固類': ['木工牙螺絲', '水泥壁虎/膨脹螺栓', '鋼牙螺母', '吊架固定環', '矽利康/結構膠'],
    '工具與雜耗': ['手工具類', '電動工具', '測量計量', '保護雜耗', '清潔打掃/手套']
  };
}

export function saveSubcategories(subcats: Record<string, string[]>): void {
  localStorage.setItem('engineering_material_subcategories', JSON.stringify(subcats));
}

export function calculateMaterialListPrice(category: string | undefined, costPrice: number, subcategory?: string): number {
  const catName = category || '水路管材類';
  
  if (subcategory) {
    const subMults = getSubcategoryMultipliers();
    const key = `${catName}:${subcategory}`;
    if (subMults[key] !== undefined) {
      return Math.round(costPrice * subMults[key]);
    }
  }

  const configs = getCategoryMaterialConfigs();
  const config = configs.find(c => c.category === catName);
  
  // If multiplier is defined (even 0), we use it. Otherwise default to 1.10
  const mult = config && config.multiplier !== undefined ? config.multiplier : 1.1;
  return Math.round(costPrice * mult);
}
