import React, { useState, useEffect } from 'react';
import { MaterialPreset, Supplier, MaterialUnitOption, MaterialSupplier } from '../types';
import { Plus, Trash2, Edit, ShoppingBag, Info, ShieldCheck, ChevronDown, ChevronUp, Scale, Settings, Check, X, FileSpreadsheet, Download, Upload } from 'lucide-react';
import { calculateMaterialListPrice, getCategoryMaterialConfigs, saveCategoryMaterialConfigs, getSubcategories, saveSubcategories, getSubcategoryMultipliers, saveSubcategoryMultipliers } from '../utils/billingUtils';
import * as XLSX from 'xlsx';

export const DEFAULT_SUBCATEGORIES: { [key: string]: string[] } = {
  '水路管材類': ['PVC管/另件', '不銹鋼管/接頭', '壓接另件', '配管閥門', '止洩帶/膠水', '冷熱水龍頭', '給排水管件'],
  '電路電材類': ['電線單線', '絞線電纜', '電工膠帶', '插座開關', '配電箱/斷路器', '線槽軟管', '絕緣套管/端子'],
  '廚衛設備類': ['衛生馬桶', '面盆面鏡', '花灑淋浴', '排風機/暖風機', '廚房水槽/龍頭', '衛浴五金掛件'],
  '五金緊固類': ['木工牙螺絲', '水泥壁虎/膨脹螺栓', '鋼牙螺母', '吊架固定環', '矽利康/結構膠'],
  '工具與雜耗': ['手工具類', '電動工具', '測量計量', '保護雜耗', '清潔打掃/手套']
};

interface MaterialsPanelProps {
  materials: MaterialPreset[];
  setMaterials: React.Dispatch<React.SetStateAction<MaterialPreset[]>>;
  suppliers: Supplier[];
  onSaveToast: (msg: string) => void;
}

export default function MaterialsPanel({
  materials,
  setMaterials,
  suppliers,
  onSaveToast
}: MaterialsPanelProps) {
  const activeSuppliers = suppliers.filter(s => s.showInMaterialsDatabase !== false);

  const [categoryConfigs, setCategoryConfigs] = useState(() => getCategoryMaterialConfigs());
  const [subcategories, setSubcategories] = useState<{ [category: string]: string[] }>(() => getSubcategories());
  const [subMultipliers, setSubMultipliers] = useState<{ [key: string]: number }>(() => getSubcategoryMultipliers());
  const [activeConfigCategory, setActiveConfigCategory] = useState<string | null>(null);
  const [newSubcatName, setNewSubcatName] = useState('');

  // Material categories state
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_material_categories');
      return stored ? JSON.parse(stored) : ['電路電材類', '水路管材類', '廚衛設備類', '五金緊固類', '工具與雜耗'];
    } catch {
      return ['電路電材類', '水路管材類', '廚衛設備類', '五金緊固類', '工具與雜耗'];
    }
  });

  // 快速搜尋材料關鍵字
  const [searchQuery, setSearchQuery] = useState('');

  const saveCategories = (newCats: string[]) => {
    setCategories(newCats);
    localStorage.setItem('engineering_material_categories', JSON.stringify(newCats));
  };

  // 調整大類分類順序 (向上/向下移)
  const handleMoveCategory = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const updatedCats = [...categories];
    const temp = updatedCats[idx];
    updatedCats[idx] = updatedCats[targetIdx];
    updatedCats[targetIdx] = temp;
    saveCategories(updatedCats);
    onSaveToast('↕️ 已成功自訂調整大類分類之排列順序！');
  };

  // 移轉整個二級次分類至其他大類 (主分類)
  const handleMoveSubcategoryToNewCategory = (subName: string, oldCategory: string, newCategory: string) => {
    // 1. Remove subName from oldCategory list
    const oldList = (subcategories[oldCategory] || []).filter(s => s !== subName);
    // 2. Add subName to newCategory list (if not already exists)
    const newList = [...(subcategories[newCategory] || [])];
    if (!newList.includes(subName)) {
      newList.push(subName);
    }
    
    const updatedSubcategories = {
      ...subcategories,
      [oldCategory]: oldList,
      [newCategory]: newList
    };
    
    setSubcategories(updatedSubcategories);
    saveSubcategories(updatedSubcategories);

    // 3. Move subcategory multipliers as well
    const oldMultKey = `${oldCategory}:${subName}`;
    const newMultKey = `${newCategory}:${subName}`;
    if (subMultipliers[oldMultKey] !== undefined) {
      const updatedMults = { ...subMultipliers };
      updatedMults[newMultKey] = updatedMults[oldMultKey];
      delete updatedMults[oldMultKey];
      setSubMultipliers(updatedMults);
      saveSubcategoryMultipliers(updatedMults);
    }

    // 4. Update all materials belonging to oldCategory with this subcategory
    setMaterials(prevMaterials => {
      const updatedMaterials = prevMaterials.map(m => {
        if (m.category === oldCategory && m.subcategory === subName) {
          return {
            ...m,
            category: newCategory
          };
        }
        return m;
      });
      return updatedMaterials;
    });

    onSaveToast(`📦 已成功將次分類【${subName}】轉移至主分類【${newCategory}】，且該次分類下的所有建檔資材已自動更新為新大類！`);
    setActiveConfigCategory(null); // Reset configure view to refresh states safely
  };

  // 記錄哪些單位選項的特約材料行是展開的（預設為摺疊，不在此 map 中或為 false）
  const [expandedSuppliers, setExpandedSuppliers] = useState<{ [optionId: string]: boolean }>({});

  // Category Configuration States
  const [showConfigCategories, setShowConfigCategories] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [renamingCategoryOld, setRenamingCategoryOld] = useState<string | null>(null);
  const [renamingCategoryInput, setRenamingCategoryInput] = useState('');

  // New Material form state
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState(categories[0] || '水路管材類');
  const [newMatSubcategory, setNewMatSubcategory] = useState('');
  const [newMatIsRealPrice, setNewMatIsRealPrice] = useState(false);
  const [editMatSubcategory, setEditMatSubcategory] = useState('');
  const [editMatIsRealPrice, setEditMatIsRealPrice] = useState(false);
  const [settingsMatSubcategoryFilter, setSettingsMatSubcategoryFilter] = useState('全部');
  const [excelImportReport, setExcelImportReport] = useState<{
    show: boolean;
    allReadCount: number;
    newItems: {
      item: MaterialPreset;
      decision: 'import' | 'skip';
    }[];
    dupItems: {
      item: MaterialPreset;
      matchedExistingItem: MaterialPreset;
      decision: 'overwrite' | 'skip';
    }[];
    suspectItems: {
      importedItem: MaterialPreset;
      matchedExistingItem: MaterialPreset;
      decision: 'import_as_new' | 'skip' | 'overwrite';
    }[];
  } | null>(null);

  // 類似/重複材料防呆提示機制
  const [dupConflictMaterials, setDupConflictMaterials] = useState<MaterialPreset[]>([]);
  const [pendingMaterialToAdd, setPendingMaterialToAdd] = useState<MaterialPreset | null>(null);

  // Inline Material basic editing state (name & category only)
  const [editingMatId, setEditingMatId] = useState<string | null>(null);
  const [editMatName, setEditMatName] = useState('');
  const [editMatCategory, setEditMatCategory] = useState(categories[0] || '水路管材類');

  // Selected filter
  const [settingsMatCategoryFilter, setSettingsMatCategoryFilter] = useState('全部');
  const [settingsMatSupplierFilter, setSettingsMatSupplierFilter] = useState('全部');

  // Input state for adding new units under a material
  const [newUnitStr, setNewUnitStr] = useState<{ [matId: string]: string }>({});

  // 1. 當篩選分類變更時，自動引導將「新增材料的選單分類」代入該篩選，方便使用者在該單一種類下快速建檔
  useEffect(() => {
    if (settingsMatCategoryFilter !== '全部' && categories.includes(settingsMatCategoryFilter)) {
      setNewMatCategory(settingsMatCategoryFilter);
    }
    setSettingsMatSubcategoryFilter('全部');
  }, [settingsMatCategoryFilter]);

  // 2. 當 categories 變更時，確保現選的新增和編輯分類依然合法存在於名單中，避免被刪除後報錯
  useEffect(() => {
    if (categories.length > 0) {
      if (!categories.includes(newMatCategory)) {
        setNewMatCategory(categories[0]);
      }
      if (!categories.includes(editMatCategory)) {
        setEditMatCategory(categories[0]);
      }
    }
  }, [categories]);

  // --- EXCEL IMPORT / EXPORT OPERATIONS ---
  const handleExportExcel = () => {
    try {
      const dataToExport = materials.map((m, idx) => {
        const uos = m.unitOptions && m.unitOptions.length > 0 ? m.unitOptions : [
          {
            unit: m.unit || '個',
            defaultUnitPrice: m.defaultUnitPrice || 0,
            defaultCostPrice: m.defaultCostPrice || 0
          }
        ];
        // We export primary or first option
        const primary = uos[0];
        return {
          '系統防重複ID(請勿更動，空白視為全新增)': m.id,
          '名稱(必填)': m.name,
          '大分類(必填)': m.category || '水路管材類',
          '次細分類二層(選填)': m.subcategory || '',
          '計量單位(必填)': primary.unit || '個',
          '建議對外牌價(元)': primary.defaultUnitPrice || 0,
          '進料實際成本(元)': primary.defaultCostPrice || 0
        };
      });

      if (dataToExport.length === 0) {
        dataToExport.push({
          '系統防重複ID(請勿更動，空白視為全新增)': 'template-1',
          '名稱(必填)': '南亞 PVC 1英吋水管 (4米/支)',
          '大分類(必填)': '水路管材類',
          '次細分類二層(選填)': 'PVC管/另件',
          '計量單位(必填)': '支',
          '建議對外牌價(元)': 150,
          '進料實際成本(元)': 95
        });
        dataToExport.push({
          '系統防重複ID(請勿更動，空白視為全新增)': 'template-2',
          '名稱(必填)': '太平洋 2.0 單線紅 100米',
          '大分類(必填)': '電路電材類',
          '次細分類二層(選填)': '電線單線',
          '計量單位(必填)': '捲',
          '建議對外牌價(元)': 1800,
          '進料實際成本(元)': 1350
        });
      }

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '材料儲備大庫');
      XLSX.writeFile(workbook, `常備資材儲備大庫_${new Date().toISOString().substring(0, 10)}.xlsx`);
      onSaveToast('📥 已成功產出並下載常備資材大庫 Excel 清單/範本！');
    } catch (err) {
      console.error(err);
      alert('產生 Excel 失敗：' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDownloadTemplateExcel = () => {
    try {
      const templateData = [
        {
          '系統防重複ID(請勿更動，空白視為全新增)': '',
          '名稱(必填)': '南亞 15ml PVC塑膠膠水 (單罐小包裝)',
          '大分類(必填)': '水路管材類',
          '次細分類二層(選填)': '給水配件/膠水',
          '計量單位(必填)': '罐',
          '建議對外牌價(元)': 40,
          '進料實際成本(元)': 25,
          '是否為實價(填: 是/否，亦可空白)': '否'
        },
        {
          '系統防重複ID(請勿更動，空白視為全新增)': '',
          '名稱(必填)': '南亞 15ml PVC塑膠膠水 (單罐小包裝)',
          '大分類(必填)': '水路管材類',
          '次細分類二層(選填)': '給水配件/膠水',
          '計量單位(必填)': '箱 (12罐)',
          '建議對外牌價(元)': 420,
          '進料實際成本(元)': 260,
          '是否為實價(填: 是/否，亦可空白)': '否'
        },
        {
          '系統防重複ID(請勿更動，空白視為全新增)': '',
          '名稱(必填)': '太平洋 2.0 單線紅 100米',
          '大分類(必填)': '電路電材類',
          '次細分類二層(選填)': '電線單線',
          '計量單位(必填)': '捲',
          '建議對外牌價(元)': 1800,
          '進料實際成本(元)': 1350,
          '是否為實價(填: 是/否，亦可空白)': '否'
        },
        {
          '系統防重複ID(請勿更動，空白視為全新增)': '',
          '名稱(必填)': '白水泥 (實價浮動測試品項)',
          '大分類(必填)': '泥作五金類',
          '次細分類二層(選填)': '泥作建材',
          '計量單位(必填)': '包',
          '建議對外牌價(元)': 0,
          '進料實際成本(元)': 0,
          '是否為實價(填: 是/否，亦可空白)': '是'
        },
        {
          '系統防重複ID(請勿更動，空白視為全新增)': '說明列 (本行不會被匯入)',
          '名稱(必填)': '★多單位輸入指南★：若欲在一個材料品項下建立多個計量包裝單位 (例如:罐、箱)，只需像上方範例一樣，在 Excel 內寫多行，並讓「品項名稱」和「大分類」保持完全一致。系統匯入時就會自動合併在同一個品項名下！',
          '大分類(必填)': '水路管材類',
          '次細分類二層(選填)': '',
          '計量單位(必填)': '',
          '建議對外牌價(元)': 0,
          '進料實際成本(元)': 0,
          '是否為實價(填: 是/否，亦可空白)': ''
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      worksheet['!cols'] = [
        { wch: 36 }, // ID
        { wch: 45 }, // 名稱
        { wch: 15 }, // 大分類
        { wch: 20 }, // 次分類
        { wch: 12 }, // 單位
        { wch: 18 }, // 建議對外牌價
        { wch: 18 }, // 進料實際成本
        { wch: 22 }  // 是否為實價
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '資材大庫匯入標準範本');
      XLSX.writeFile(workbook, `常備資材儲備大庫_批次匯入範本.xlsx`);
      onSaveToast('📋 成功取得「多單位/實價」專用 Excel 匯入規範範本！請參考範本內容進行填寫。');
    } catch (err) {
      console.error(err);
      alert('產生 Excel 範本失敗：' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawData.length === 0) {
          alert('上傳的 Excel 中沒有讀取到任何資料！');
          return;
        }

        const imported: MaterialPreset[] = [];
        
        rawData.forEach((row: any) => {
          // Identify columns
          const idKey = Object.keys(row).find(k => k.includes('系統') || k.includes('ID') || k.toLowerCase().includes('id'));
          const nameKey = Object.keys(row).find(k => k.includes('名稱') || k.toLowerCase().includes('name') || k.includes('品項'));
          const catKey = Object.keys(row).find(k => k.includes('大分類') || k.includes('分類') || k.toLowerCase().includes('category'));
          const subcatKey = Object.keys(row).find(k => k.includes('次細') || k.includes('次分類') || k.includes('二層') || k.toLowerCase().includes('subcat'));
          const unitKey = Object.keys(row).find(k => k.includes('計量單位') || k.includes('單位') || k.toLowerCase().includes('unit'));
          const priceKey = Object.keys(row).find(k => k.includes('牌價') || k.includes('單價') || k.toLowerCase().includes('price') || k.includes('定價'));
          const costKey = Object.keys(row).find(k => k.includes('成本') || k.includes('進價') || k.toLowerCase().includes('cost'));
          const isRealPriceKey = Object.keys(row).find(k => k.includes('是否為實價') || k.includes('實價') || k.includes('浮動'));

          if (!nameKey || !row[nameKey]) return; // Skip blank lines

          const rawId = idKey && row[idKey] ? String(row[idKey]).trim() : '';
          const nameVal = String(row[nameKey]).trim();
          if (rawId.startsWith('template-')) return; // Ignore guide row

          const catVal = catKey && row[catKey] ? String(row[catKey]).trim() : '水路管材類';
          const subcatVal = subcatKey && row[subcatKey] ? String(row[subcatKey]).trim() : '';
          const unitVal = unitKey && row[unitKey] ? String(row[unitKey]).trim() : '個';
          let priceVal = priceKey && row[priceKey] !== undefined ? Math.max(0, parseFloat(row[priceKey]) || 0) : 0;
          let costVal = costKey && row[costKey] !== undefined ? Math.max(0, parseFloat(row[costKey]) || 0) : 0;

          // 偵測是否設定為實價 (是/1/true 變為 true)
          const isRealPriceRaw = isRealPriceKey && row[isRealPriceKey] !== undefined ? String(row[isRealPriceKey]).trim() : '';
          const isRealPriceVal = isRealPriceRaw === '是' || isRealPriceRaw === '1' || isRealPriceRaw.toLowerCase() === 'true';

          if (isRealPriceVal) {
            priceVal = 0;
            costVal = 0;
          }

          // 檢查之前在本次匯入清單中是否已經讀取過同名同分類品項
          const existingImported = imported.find(m => 
            m.name.toLowerCase().replace(/\s+/g, '') === nameVal.toLowerCase().replace(/\s+/g, '') &&
            m.category === catVal
          );

          if (existingImported) {
            // 目前專案已在大庫暫存中，追加新的包裝單位選項到 unitOptions 裡面
            if (!existingImported.unitOptions) {
              existingImported.unitOptions = [
                {
                  id: `uo-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                  unit: existingImported.unit,
                  defaultUnitPrice: existingImported.defaultUnitPrice,
                  defaultCostPrice: existingImported.defaultCostPrice,
                  suppliers: []
                }
              ];
            }
            // 檢查重複單位防呆
            const hasUnit = existingImported.unitOptions.some(uo => uo.unit === unitVal);
            if (!hasUnit) {
              existingImported.unitOptions.push({
                id: `uo-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                unit: unitVal,
                defaultUnitPrice: priceVal,
                defaultCostPrice: costVal,
                suppliers: []
              });
            }
          } else {
            const cleanId = rawId && rawId.length > 3 ? rawId : `m-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            imported.push({
              id: cleanId,
              name: nameVal,
              category: catVal,
              subcategory: subcatVal || undefined,
              unit: unitVal,
              defaultUnitPrice: priceVal,
              defaultCostPrice: costVal,
              isRealPrice: isRealPriceVal,
              unitOptions: [
                {
                  id: `uo-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                  unit: unitVal,
                  defaultUnitPrice: priceVal,
                  defaultCostPrice: costVal,
                  suppliers: []
                }
              ]
            });
          }
        });

        if (imported.length === 0) {
          alert('未能成功識別有效材料品項，請檢查欄位格式是否包含「名稱」！');
          return;
        }

        const newItems: MaterialPreset[] = [];
        const dupItems: MaterialPreset[] = [];
        const suspectItems: {
          importedItem: MaterialPreset;
          matchedExistingItem: MaterialPreset;
          decision: 'import_as_new' | 'skip' | 'overwrite';
        }[] = [];

        imported.forEach(item => {
          // Both name match or ID match count as exact duplicates
          const exactMatch = materials.find(m => 
            m.name.toLowerCase().replace(/\s+/g, '') === item.name.toLowerCase().replace(/\s+/g, '') ||
            m.id === item.id
          );
          
          if (exactMatch) {
            dupItems.push(item);
          } else {
            // Check for fuzzy similar matches (includes substrings or 65%+ letter overlaps)
            const fuzzyMatch = materials.find(m => {
              const na = m.name.toLowerCase().trim();
              const nb = item.name.toLowerCase().trim();
              if (na === nb) return false;
              if (na.includes(nb) || nb.includes(na)) return true;
              
              const setA = new Set<string>(na.replace(/\s+/g, '').split(''));
              const setB = new Set<string>(nb.replace(/\s+/g, '').split(''));
              let intersectCount = 0;
              setA.forEach(char => {
                if (setB.has(char)) intersectCount++;
              });
              const maxLength = Math.max(setA.size, setB.size);
              if (maxLength > 0) {
                const ratio = intersectCount / maxLength;
                if (ratio >= 0.65) return true;
              }
              return false;
            });

            if (fuzzyMatch) {
              suspectItems.push({
                importedItem: item,
                matchedExistingItem: fuzzyMatch,
                decision: 'import_as_new'
              });
            } else {
              newItems.push(item);
            }
          }
        });

        setExcelImportReport({
          show: true,
          allReadCount: imported.length,
          newItems: newItems.map(item => ({ item, decision: 'import' as const })),
          dupItems: dupItems.map(item => {
            const matchedExistingItem = materials.find(m => 
              m.name.toLowerCase().replace(/\s+/g, '') === item.name.toLowerCase().replace(/\s+/g, '') ||
              m.id === item.id
            ) || item;
            return {
              item,
              matchedExistingItem,
              decision: 'overwrite' as const
            };
          }),
          suspectItems
        });
      } catch (err) {
        console.error(err);
        alert('匯入解析失敗，請確認檔案格式是否正確。');
      } finally {
        e.target.value = ''; // Reset
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleApplyImport = (mode: 'skip_dups' | 'overwrite_dups' | 'force_all') => {
    if (!excelImportReport) return;
    const { newItems, dupItems, suspectItems } = excelImportReport;
    
    let resultMaterials = [...materials];
    
    // 1. Process new items based on choice
    const finalNewItemsToImport: MaterialPreset[] = [];
    newItems.forEach(ni => {
      if (mode === 'force_all' || ni.decision === 'import') {
        finalNewItemsToImport.push(ni.item);
      }
    });

    // 2. Process duplicate items based on choice
    const finalDupItemsToOverwrite: MaterialPreset[] = [];
    const finalDupItemsToForceAdd: MaterialPreset[] = [];
    let dupsSkipped = 0;

    dupItems.forEach(di => {
      if (mode === 'force_all') {
        const cleanId = `m-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        finalDupItemsToForceAdd.push({
          ...di.item,
          id: cleanId
        });
      } else {
        let actualDecision = di.decision;
        if (actualDecision === 'overwrite') {
          finalDupItemsToOverwrite.push(di.item);
        } else {
          dupsSkipped++;
        }
      }
    });

    // Strip existing duplicate items that are being overwritten
    if (finalDupItemsToOverwrite.length > 0) {
      const overNames = finalDupItemsToOverwrite.map(d => d.name.toLowerCase().replace(/\s+/g, ''));
      resultMaterials = resultMaterials.filter(m => !overNames.includes(m.name.toLowerCase().replace(/\s+/g, '')));
    }

    resultMaterials = [...resultMaterials, ...finalNewItemsToImport, ...finalDupItemsToOverwrite, ...finalDupItemsToForceAdd];

    // 3. Process suspect items based on decision
    let suspectAdded = 0;
    let suspectOverwritten = 0;
    let suspectSkipped = 0;

    suspectItems.forEach(rep => {
      if (rep.decision === 'import_as_new' || mode === 'force_all') {
        const cleanId = `m-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        resultMaterials.push({
          ...rep.importedItem,
          id: cleanId
        });
        suspectAdded++;
      } else if (rep.decision === 'overwrite' && mode !== 'skip_dups') {
        const foundIdx = resultMaterials.findIndex(m => m.id === rep.matchedExistingItem.id);
        if (foundIdx > -1) {
          resultMaterials[foundIdx] = {
            ...rep.importedItem,
            id: rep.matchedExistingItem.id
          };
          suspectOverwritten++;
        } else {
          resultMaterials.push(rep.importedItem);
          suspectAdded++;
        }
      } else {
        suspectSkipped++;
      }
    });

    // 4. Automatically check and ask if we should register new Categories/Subcategories
    const allImportedItems: MaterialPreset[] = [
      ...finalNewItemsToImport,
      ...finalDupItemsToOverwrite,
      ...finalDupItemsToForceAdd
    ];
    suspectItems.forEach(rep => {
      if (rep.decision === 'import_as_new' || mode === 'force_all') {
        allImportedItems.push(rep.importedItem);
      } else if (rep.decision === 'overwrite' && mode !== 'skip_dups') {
        allImportedItems.push(rep.importedItem);
      }
    });

    const newCatsToRegister: string[] = [];
    const newSubcatsToRegister: { [cat: string]: string[] } = {};

    let registeredCats = [...categories];
    let registeredSubcats = { ...subcategories };

    allImportedItems.forEach(m => {
      if (m.category && !registeredCats.includes(m.category) && !newCatsToRegister.includes(m.category)) {
        newCatsToRegister.push(m.category);
      }
      if (m.category && m.subcategory && m.subcategory.trim()) {
        const sub = m.subcategory.trim();
        const currentList = registeredSubcats[m.category] || [];
        if (!currentList.includes(sub)) {
          if (!newSubcatsToRegister[m.category]) {
            newSubcatsToRegister[m.category] = [];
          }
          if (!newSubcatsToRegister[m.category].includes(sub)) {
            newSubcatsToRegister[m.category].push(sub);
          }
        }
      }
    });

    let autoRegisteredMessage = '';
    const hasNewCats = newCatsToRegister.length > 0;
    const hasNewSubcats = Object.keys(newSubcatsToRegister).length > 0;

    if (hasNewCats || hasNewSubcats) {
      let confirmMsg = '⚙️ 偵測到本次匯入之品項含有「尚未註冊」之全新分類名稱：\n';
      if (hasNewCats) {
        confirmMsg += `🔹 全新大分類：${newCatsToRegister.join('、')}\n`;
      }
      if (hasNewSubcats) {
        confirmMsg += `🔹 全新次細分類：\n`;
        Object.entries(newSubcatsToRegister).forEach(([cat, subs]) => {
          confirmMsg += `  * 屬於【${cat}】：${subs.join('、')}\n`;
        });
      }
      confirmMsg += '\n是否要一併將這些全新分類名稱自動註冊至您的系統常用分類大庫中，以利日後排序或進行快速倍率調整？\n(若選擇「取消」，商品仍會照常匯入，但不會為其新增常用選單項目)';

      if (window.confirm(confirmMsg)) {
        // Register categories
        if (hasNewCats) {
          registeredCats = [...registeredCats, ...newCatsToRegister];
          setCategories(registeredCats);
          localStorage.setItem('engineering_material_categories', JSON.stringify(registeredCats));
          
          // categoryConfigs
          const updatedConfigs = [...categoryConfigs];
          newCatsToRegister.forEach(newCat => {
            if (!updatedConfigs.some(cfg => cfg.category === newCat)) {
              updatedConfigs.push({ category: newCat, multiplier: 1.10 });
            }
          });
          setCategoryConfigs(updatedConfigs);
          saveCategoryMaterialConfigs(updatedConfigs);
        }

        // Register subcategories
        Object.entries(newSubcatsToRegister).forEach(([cat, subs]) => {
          const currentList = registeredSubcats[cat] || [];
          const combined = Array.from(new Set([...currentList, ...subs]));
          registeredSubcats[cat] = combined;
        });
        setSubcategories(registeredSubcats);
        saveSubcategories(registeredSubcats);

        autoRegisteredMessage = `，並已自動註冊常用大類 ${newCatsToRegister.length} 個、次細分類 ${Object.values(newSubcatsToRegister).flat().length} 個。`;
      }
    }

    const exactInfo = mode === 'skip_dups' 
      ? `已新增 ${finalNewItemsToImport.length} 項全新，略過 ${dupsSkipped} 項重複。`
      : mode === 'overwrite_dups'
      ? `已新增 ${finalNewItemsToImport.length} 項全新，覆蓋 ${finalDupItemsToOverwrite.length} 項重複已存在。`
      : `強制全部直接新增 ${finalNewItemsToImport.length + finalDupItemsToForceAdd.length} 筆項目。`;

    const suspectInfo = suspectItems.length > 0
      ? ` 另外對於疑似重複之疑慮品項：已手動新增 ${suspectAdded} 項、覆蓋 ${suspectOverwritten} 項、跳過不匯入 ${suspectSkipped} 項。`
      : '';

    onSaveToast(`✅ 成功匯入大庫！${exactInfo}${suspectInfo}${autoRegisteredMessage}`);

    setMaterials(resultMaterials);
    setExcelImportReport(null);
  };

  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<string | null>(null);
  const [deleteConfirmMatId, setDeleteConfirmMatId] = useState<string | null>(null);
  const [deleteConfirmUnitId, setDeleteConfirmUnitId] = useState<string | null>(null); // 'matId-optionId'

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newCategoryInput.trim();
    if (!val) return;
    if (categories.includes(val)) {
      onSaveToast('⚠️ 品項大類中已存在相同名稱的分類項目！');
      return;
    }
    const updatedCats = [...categories, val];
    saveCategories(updatedCats);

    const updatedConfigs = [...categoryConfigs, { category: val, multiplier: 1.10 }];
    setCategoryConfigs(updatedConfigs);
    saveCategoryMaterialConfigs(updatedConfigs);

    setNewCategoryInput('');
    onSaveToast(`➕ 已成功新增大庫材料分類：【${val}】！`);
  };

  const handleSaveRenameCategory = (oldVal: string) => {
    const newVal = renamingCategoryInput.trim();
    if (!newVal || oldVal === newVal) {
      setRenamingCategoryOld(null);
      return;
    }
    if (categories.includes(newVal)) {
      onSaveToast('⚠️ 品項大類中已存在同名分類！');
      return;
    }
    const updatedCats = categories.map(c => c === oldVal ? newVal : c);
    saveCategories(updatedCats);

    const updatedConfigs = categoryConfigs.map(c => c.category === oldVal ? { ...c, category: newVal } : c);
    setCategoryConfigs(updatedConfigs);
    saveCategoryMaterialConfigs(updatedConfigs);

    // Sync all existing presets in the database
    setMaterials(materials.map(m => m.category === oldVal ? { ...m, category: newVal } : m));
    setRenamingCategoryOld(null);
    onSaveToast(`📂 已大整改品項分類：${oldVal} ➡️ ${newVal}！`);
  };

  const handleDeleteCategory = (catName: string) => {
    const updatedCats = categories.filter(c => c !== catName);
    saveCategories(updatedCats);

    const updatedConfigs = categoryConfigs.filter(c => c.category !== catName);
    setCategoryConfigs(updatedConfigs);
    saveCategoryMaterialConfigs(updatedConfigs);

    setMaterials(materials.map(m => m.category === catName ? { ...m, category: '工具與雜耗' } : m));
    onSaveToast(`🗑️ 成功撤銷分類【${catName}】。原分類材料已安全歸類至「工具與雜耗」！`);
  };

  const ensureUnitOptions = (m: MaterialPreset): MaterialUnitOption[] => {
    if (m.unitOptions && m.unitOptions.length > 0) {
      return m.unitOptions;
    }
    // Backward compatibility: create legacy values
    return [
      {
        id: `${m.id}-unit-default`,
        unit: m.unit || '個',
        defaultUnitPrice: m.defaultUnitPrice || 0,
        defaultCostPrice: m.defaultCostPrice || 0,
        suppliers: m.suppliers || []
      }
    ];
  };

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim()) return;

    const defaultUnitId = `uo-${Date.now()}-default`;
    const item: MaterialPreset = {
      id: `m-${Date.now()}`,
      name: newMatName.trim(),
      unit: '個', // primary unit
      defaultUnitPrice: 0,
      defaultCostPrice: 0,
      category: newMatCategory,
      subcategory: newMatSubcategory.trim() || undefined,
      suppliers: [],
      isRealPrice: newMatIsRealPrice,
      unitOptions: [
        {
          id: defaultUnitId,
          unit: '個',
          defaultUnitPrice: 0,
          defaultCostPrice: 0,
          suppliers: []
        }
      ]
    };

    // 進行相似名稱、完全重複名稱之模糊比對
    const trimmedInput = newMatName.trim().toLowerCase();
    const conflicts = materials.filter(m => {
      const existingName = m.name.toLowerCase().trim();
      // 1. 完全一致
      if (existingName === trimmedInput) return true;
      // 2. 子字串包含
      if (existingName.includes(trimmedInput) || trimmedInput.includes(existingName)) return true;
      // 3. 寬鬆比例字元重疊 (去空格比對)
      const setA = new Set<string>(trimmedInput.replace(/\s+/g, '').split(''));
      const setB = new Set<string>(existingName.replace(/\s+/g, '').split(''));
      let intersectCount = 0;
      setA.forEach(char => {
        if (setB.has(char)) intersectCount++;
      });
      const maxLength = Math.max(setA.size, setB.size);
      if (maxLength > 0) {
        const ratio = intersectCount / maxLength;
        if (ratio >= 0.65) return true; // 重疊度超 65% 為相近
      }
      return false;
    });

    if (conflicts.length > 0) {
      setPendingMaterialToAdd(item);
      setDupConflictMaterials(conflicts);
    } else {
      setMaterials([...materials, item]);
      setNewMatName('');
      setNewMatSubcategory('');
      setNewMatIsRealPrice(false);
      onSaveToast(`✅ 材料品項【${item.name}】已成功建檔！可於下方直接追加不同包裝單位，或編輯配合廠商牌價與進價。`);
    }
  };

  const handleProceedAddMaterial = () => {
    if (!pendingMaterialToAdd) return;
    setMaterials([...materials, pendingMaterialToAdd]);
    const addedName = pendingMaterialToAdd.name;
    setPendingMaterialToAdd(null);
    setDupConflictMaterials([]);
    setNewMatName('');
    setNewMatSubcategory('');
    setNewMatIsRealPrice(false);
    onSaveToast(`✅ 已忽略重複警告，材料品項【${addedName}】已成功強制建檔！`);
  };

  const handleCancelAddMaterial = () => {
    setPendingMaterialToAdd(null);
    setDupConflictMaterials([]);
  };

  const handleStartEditMat = (m: MaterialPreset) => {
    setEditingMatId(m.id);
    setEditMatName(m.name);
    setEditMatCategory(m.category || '水路管材類');
    setEditMatSubcategory(m.subcategory || '');
    setEditMatIsRealPrice(!!m.isRealPrice);
  };

  const handleSaveEditMat = () => {
    if (!editMatName.trim()) return;
    setMaterials(materials.map(m => {
      if (m.id === editingMatId) {
        const updated: MaterialPreset = {
          ...m,
          name: editMatName.trim(),
          category: editMatCategory,
          subcategory: editMatSubcategory.trim() || undefined,
          isRealPrice: editMatIsRealPrice,
          defaultUnitPrice: editMatIsRealPrice ? 0 : m.defaultUnitPrice,
          defaultCostPrice: editMatIsRealPrice ? 0 : m.defaultCostPrice
        };
        if (editMatIsRealPrice && updated.unitOptions) {
          updated.unitOptions = updated.unitOptions.map(uo => ({
            ...uo,
            defaultUnitPrice: 0,
            defaultCostPrice: 0,
            suppliers: uo.suppliers ? uo.suppliers.map(s => ({ ...s, listPrice: 0, costPrice: 0 })) : []
          }));
        }
        return updated;
      }
      return m;
    }));
    setEditingMatId(null);
    setEditMatSubcategory('');
    onSaveToast('✅ 材料名稱、分類與實價設定更新成功！');
  };

  const handleToggleRealPrice = (id: string, currentVal: boolean) => {
    const updatedMats = materials.map(m => {
      if (m.id === id) {
        const nextVal = !currentVal;
        const updated: MaterialPreset = {
          ...m,
          isRealPrice: nextVal,
          defaultUnitPrice: nextVal ? 0 : m.defaultUnitPrice,
          defaultCostPrice: nextVal ? 0 : m.defaultCostPrice
        };
        if (nextVal && updated.unitOptions) {
          updated.unitOptions = updated.unitOptions.map(uo => ({
            ...uo,
            defaultUnitPrice: 0,
            defaultCostPrice: 0,
            suppliers: uo.suppliers ? uo.suppliers.map(s => ({ ...s, listPrice: 0, costPrice: 0 })) : []
          }));
        }
        return updated;
      }
      return m;
    });
    setMaterials(updatedMats);
    const targetName = materials.find(m => m.id === id)?.name || '';
    onSaveToast(`⚖️ 已將【${targetName}】快速切換為 ${!currentVal ? '「實價」品項' : '「標準定價」品項'}！`);
  };

  const handleDeleteMat = (id: string, name: string) => {
    setMaterials(materials.filter(m => m.id !== id));
    onSaveToast(`🗑️ 材料品項【${name}】已成功移出大庫！`);
  };

  // Unit Options Operations
  const handleAddUnitOption = (matId: string) => {
    const rawUnit = newUnitStr[matId]?.trim() || '';
    if (!rawUnit) return;

    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = ensureUnitOptions(m);
        if (uOptions.some(uo => uo.unit === rawUnit)) {
          onSaveToast(`⚠️ 此耗材品項下已存在【${rawUnit}】單位！`);
          return m;
        }

        const newUo: MaterialUnitOption = {
          id: `uo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          unit: rawUnit,
          defaultUnitPrice: 0,
          defaultCostPrice: 0,
          suppliers: [],
          conversionFactor: 1
        };

        const updatedOptions = [...uOptions, newUo];
        const primaryUo = updatedOptions[0];

        return {
          ...m,
          unitOptions: updatedOptions,
          // Sync primary unit option back to legacy keys for simple list rendering
          unit: primaryUo.unit,
          defaultUnitPrice: primaryUo.defaultUnitPrice,
          defaultCostPrice: primaryUo.defaultCostPrice,
          suppliers: primaryUo.suppliers
        };
      }
      return m;
    }));

    setNewUnitStr(prev => ({ ...prev, [matId]: '' }));
    onSaveToast(`📏 成功新增單位【${rawUnit}】！`);
  };

  const handleRemoveUnitOption = (matId: string, optionId: string, unitStr: string) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = ensureUnitOptions(m);
        if (uOptions.length <= 1) {
          onSaveToast('🚫 抱歉！水電品項必須至少保留一個計算單位。');
          return m;
        }

        const filtered = uOptions.filter(uo => uo.id !== optionId);
        const primaryUo = filtered[0];
        
        onSaveToast(`🗑️ 已成功將規格單位【${unitStr}】其特約店家報價自品項中移出！`);
        return {
          ...m,
          unitOptions: filtered,
          unit: primaryUo.unit,
          defaultUnitPrice: primaryUo.defaultUnitPrice,
          defaultCostPrice: primaryUo.defaultCostPrice,
          suppliers: primaryUo.suppliers
        };
      }
      return m;
    }));
  };

  // 調整規格單位之排列順序 (向上/向下移)
  const handleMoveUnitOption = (matId: string, idx: number, direction: 'up' | 'down') => {
    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = [...ensureUnitOptions(m)];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= uOptions.length) return m;

        // 對調
        const temp = uOptions[idx];
        uOptions[idx] = uOptions[targetIdx];
        uOptions[targetIdx] = temp;

        const primaryUo = uOptions[0];

        const updatedMat = {
          ...m,
          unitOptions: uOptions,
          unit: primaryUo.unit,
          defaultUnitPrice: primaryUo.defaultUnitPrice,
          defaultCostPrice: primaryUo.defaultCostPrice,
          suppliers: primaryUo.suppliers
        };
        return applyAutoConversionsForMaterial(updatedMat);
      }
      return m;
    }));
    onSaveToast('↕️ 已成功自訂調整此耗材的規格單位排列順序！第一個單位已被同步為系統基準規格。');
  };

  const handleUpdateUnitString = (matId: string, optionId: string, value: string) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = ensureUnitOptions(m).map(uo => {
          if (uo.id === optionId) {
            return { ...uo, unit: value };
          }
          return uo;
        });
        const primaryUo = uOptions[0];
        return {
          ...m,
          unitOptions: uOptions,
          unit: primaryUo.unit
        };
      }
      return m;
    }));
  };

  const applyAutoConversionsForMaterial = (m: MaterialPreset): MaterialPreset => {
    const uOptions = ensureUnitOptions(m);
    if (uOptions.length <= 1) return m;

    const updatedOptions = [...uOptions];
    // Run 2 passes to resolve multi-stage target conversions perfectly
    for (let pass = 0; pass < 2; pass++) {
      for (let idx = 0; idx < updatedOptions.length; idx++) {
        const uo = updatedOptions[idx];
        if (idx === 0) continue; // First unit option is always the system root default basereference

        if (uo.useConversionPricing) {
          const factor = uo.conversionFactor ?? 1;
          const convertVal = (v: number) => {
            if (factor <= 0) return v;
            return uo.conversionInverse ? Math.round(v / factor) : Math.round(v * factor);
          };

          // Find specific target unit option
          const targetUo = updatedOptions.find(o => o.id === uo.targetUnitOptionId && o.id !== uo.id) || updatedOptions[0];

          const defaultUnitPrice = convertVal(targetUo.defaultUnitPrice);
          const defaultCostPrice = convertVal(targetUo.defaultCostPrice);

          const updatedSuppliers = (targetUo.suppliers || []).map(ts => {
            const existing = uo.suppliers?.find(s => s.storeName === ts.storeName);
            return {
              id: existing?.id || `sup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              storeName: ts.storeName,
              listPrice: convertVal(ts.listPrice),
              costPrice: convertVal(ts.costPrice)
            };
          });

          updatedOptions[idx] = {
            ...uo,
            defaultUnitPrice,
            defaultCostPrice,
            suppliers: updatedSuppliers
          };
        }
      }
    }

    const primaryUo = updatedOptions[0];
    return {
      ...m,
      unitOptions: updatedOptions,
      unit: primaryUo.unit,
      defaultUnitPrice: primaryUo.defaultUnitPrice,
      defaultCostPrice: primaryUo.defaultCostPrice,
      suppliers: primaryUo.suppliers
    };
  };

  const handleUpdateUnitConversionFactor = (matId: string, optionId: string, factor: number) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = ensureUnitOptions(m).map(uo => {
          if (uo.id === optionId) {
            return { ...uo, conversionFactor: factor };
          }
          return uo;
        });
        const updatedMat = { ...m, unitOptions: uOptions };
        return applyAutoConversionsForMaterial(updatedMat);
      }
      return m;
    }));
  };

  const handleUpdateUnitConversionInverse = (matId: string, optionId: string, inverse: boolean) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = ensureUnitOptions(m).map(uo => {
          if (uo.id === optionId) {
            return { ...uo, conversionInverse: inverse };
          }
          return uo;
        });
        const updatedMat = { ...m, unitOptions: uOptions };
        return applyAutoConversionsForMaterial(updatedMat);
      }
      return m;
    }));
  };

  const handleToggleUnitConversionPricing = (matId: string, optionId: string, useConversion: boolean) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = ensureUnitOptions(m).map(uo => {
          if (uo.id === optionId) {
            return { ...uo, useConversionPricing: useConversion };
          }
          return uo;
        });
        const updatedMat = { ...m, unitOptions: uOptions };
        return applyAutoConversionsForMaterial(updatedMat);
      }
      return m;
    }));
  };

  const handleUpdateUnitTargetOptionId = (matId: string, optionId: string, targetId: string) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = ensureUnitOptions(m).map(uo => {
          if (uo.id === optionId) {
            return { ...uo, targetUnitOptionId: targetId };
          }
          return uo;
        });
        const updatedMat = { ...m, unitOptions: uOptions };
        return applyAutoConversionsForMaterial(updatedMat);
      }
      return m;
    }));
    onSaveToast('🔄 已成功自訂本規格單位之換算對照目標！系統已立即重新計算新對應單位的折合進銷價。');
  };

  const handleUpdateUnitBasePrices = (
    matId: string,
    optionId: string,
    field: 'defaultUnitPrice' | 'defaultCostPrice',
    numericVal: number
  ) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = ensureUnitOptions(m).map(uo => {
          if (uo.id === optionId) {
            const currentSuppliers = uo.suppliers || [];
            let valueToSet = numericVal;

            if (field === 'defaultUnitPrice') {
              const activeSuppliers = currentSuppliers.filter(s => s.listPrice > 0);
              if (activeSuppliers.length > 0) {
                valueToSet = Math.max(numericVal, ...activeSuppliers.map(s => s.listPrice));
              }
            } else {
              const activeSuppliers = currentSuppliers.filter(s => s.costPrice > 0);
              if (activeSuppliers.length > 0) {
                valueToSet = Math.max(numericVal, ...activeSuppliers.map(s => s.costPrice));
              }
            }

            return {
              ...uo,
              [field]: valueToSet
            };
          }
          return uo;
        });

        const primaryUo = uOptions[0];
        const updatedMat = {
          ...m,
          unitOptions: uOptions,
          unit: primaryUo.unit,
          defaultUnitPrice: primaryUo.defaultUnitPrice,
          defaultCostPrice: primaryUo.defaultCostPrice,
          suppliers: primaryUo.suppliers
        };
        return applyAutoConversionsForMaterial(updatedMat);
      }
      return m;
    }));
  };

  const handleUpdateSupplierPriceForUnit = (
    matId: string,
    optionId: string,
    storeName: string,
    field: 'listPrice' | 'costPrice',
    numericVal: number
  ) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === matId) {
        const uOptions = ensureUnitOptions(m).map(uo => {
          if (uo.id === optionId) {
            const currentSuppliers = uo.suppliers ? [...uo.suppliers] : [];
            const existingIndex = currentSuppliers.findIndex(s => s.storeName === storeName);

            let updatedSuppliers = [...currentSuppliers];
            if (existingIndex > -1) {
              const updatedRecord = {
                ...updatedSuppliers[existingIndex],
                [field]: numericVal
              };

              // 當輸入特約材料行之進價成本(costPrice)時，依分類加成倍率自動將成本計算為牌價，但仍可手動覆寫修改牌價
              if (field === 'costPrice') {
                updatedRecord.listPrice = calculateMaterialListPrice(m.category, numericVal, m.subcategory);
              }
              
              if (updatedRecord.listPrice === 0 && updatedRecord.costPrice === 0) {
                updatedSuppliers = updatedSuppliers.filter((_, idx) => idx !== existingIndex);
              } else {
                updatedSuppliers[existingIndex] = updatedRecord;
              }
            } else if (numericVal > 0) {
              const initialListPrice = field === 'costPrice' ? calculateMaterialListPrice(m.category, numericVal, m.subcategory) : (field === 'listPrice' ? numericVal : 0);
              updatedSuppliers.push({
                id: `sup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                storeName,
                listPrice: initialListPrice,
                costPrice: field === 'costPrice' ? numericVal : 0
              });
            }

            const activeSuppliersWithListPrice = updatedSuppliers.filter(s => s.listPrice > 0);
            const activeSuppliersWithCostPrice = updatedSuppliers.filter(s => s.costPrice > 0);

            const highestListPrice = activeSuppliersWithListPrice.length > 0 
              ? Math.max(...activeSuppliersWithListPrice.map(s => s.listPrice)) 
              : uo.defaultUnitPrice;

            const highestCostPrice = activeSuppliersWithCostPrice.length > 0 
              ? Math.max(...activeSuppliersWithCostPrice.map(s => s.costPrice)) 
              : uo.defaultCostPrice;

            return {
              ...uo,
              suppliers: updatedSuppliers,
              defaultUnitPrice: highestListPrice,
              defaultCostPrice: highestCostPrice
            };
          }
          return uo;
        });

        const primaryUo = uOptions[0];
        const updatedMat = {
          ...m,
          unitOptions: uOptions,
          unit: primaryUo.unit,
          defaultUnitPrice: primaryUo.defaultUnitPrice,
          defaultCostPrice: primaryUo.defaultCostPrice,
          suppliers: primaryUo.suppliers
        };
        return applyAutoConversionsForMaterial(updatedMat);
      }
      return m;
    }));
  };

  return (
    <div id="materials-panel" className="!bg-[var(--bg-card)] p-6 rounded-2xl border border-[#D4AF37]/20 shadow-3xs space-y-6">

      {/* Excel Upload Progress Report Dialog / Banner */}
      {excelImportReport && excelImportReport.show && (
        <div className="p-5 bg-[#1B1212] border-2 border-red-950 rounded-2xl space-y-4 shadow-md text-left">
          <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
            <FileSpreadsheet size={20} className="animate-bounce" />
            <span>📊 Excel 批次匯入檢測報告與疑慮審查</span>
          </div>
          <p className="text-xs text-neutral-400">
            系統成功載入檔案，共讀取到 <span className="font-bold text-[#F3E5AB] font-mono text-sm">{excelImportReport.allReadCount}</span> 筆名單品項。
            經過與大庫目前資料庫比對後：
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-neutral-900/50 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-emerald-400 font-extrabold block mb-1">🆕 全新建建增商品 ({excelImportReport.newItems.length} 筆)</span>
              <p className="text-[11px] text-neutral-300">
                大庫中查無重複，將直接匯入儲備庫中。
              </p>
            </div>
            <div className="p-3 bg-neutral-900/50 rounded-xl border border-neutral-850">
              <span className="text-[10px] text-amber-500 font-extrabold block mb-1">⚠️ 偵測已重複品項 ({excelImportReport.dupItems.length} 筆)</span>
              <p className="text-[11px] text-neutral-300">
                品項名稱已存在，適用下方大批規覆蓋或跳過決策。
              </p>
            </div>
            <div className="p-3 bg-[#241C15] rounded-xl border border-amber-900/30">
              <span className="text-[10px] text-[#E5A93C] font-extrabold block mb-1">🔍 疑似重複疑慮 ({excelImportReport.suspectItems.length} 筆)</span>
              <p className="text-[11px] text-neutral-300">
                名稱非常接近現有項目，可能有誤入重複之疑。
              </p>
            </div>
          </div>

          {/* 1. Newly Created Items Auditing List */}
          {excelImportReport.newItems && excelImportReport.newItems.length > 0 && (
            <div className="p-3 bg-[#121B15] border border-emerald-900/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-extrabold block">🆕 全新建增商品審核清單 ({excelImportReport.newItems.length} 筆)：</span>
                <span className="text-neutral-500 font-bold">(預設直接匯入，可個別切換略過)</span>
              </div>
              <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                {excelImportReport.newItems.map((ni, idx) => (
                  <div key={`ni-${idx}`} className="p-2 bg-[#0E1510] border border-emerald-950/40 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-[#F3E5AB] text-[11px] truncate">
                        品項：{ni.item.name}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        分類：{ni.item.category || '未分類'} {ni.item.subcategory ? ` • 次細類：${ni.item.subcategory}` : ''} | 牌價: {ni.item.defaultUnitPrice}元 / 成本: {ni.item.defaultCostPrice}元
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...excelImportReport.newItems];
                          updated[idx] = { ...updated[idx], decision: 'import' };
                          setExcelImportReport({ ...excelImportReport, newItems: updated });
                        }}
                        className={`px-2 py-0.5 text-[9.5px] font-extrabold rounded border transition cursor-pointer ${
                          ni.decision === 'import'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-900'
                            : 'bg-[#121212] text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        📥 匯入
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...excelImportReport.newItems];
                          updated[idx] = { ...updated[idx], decision: 'skip' };
                          setExcelImportReport({ ...excelImportReport, newItems: updated });
                        }}
                        className={`px-2 py-0.5 text-[9.5px] font-extrabold rounded border transition cursor-pointer ${
                          ni.decision === 'skip'
                            ? 'bg-rose-950 text-rose-400 border-rose-900'
                            : 'bg-[#121212] text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        ⏭️ 略過
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Detected Duplicates Auditing List */}
          {excelImportReport.dupItems && excelImportReport.dupItems.length > 0 && (
            <div className="p-3 bg-[#24211A] border border-amber-900/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-500 font-extrabold block">⚠️ 偵測已重複品項審核清單 ({excelImportReport.dupItems.length} 筆)：</span>
                <span className="text-neutral-500 font-bold">(預設覆蓋更新，可個別切換略過)</span>
              </div>
              <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                {excelImportReport.dupItems.map((di, idx) => (
                  <div key={`di-${idx}`} className="p-2 bg-[#1C1A14] border border-neutral-850 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-[#F3E5AB] text-[11px] truncate">
                        品項：{di.item.name}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        大庫中已存在現有分類: {di.matchedExistingItem.category || '未分類'} | 新匯牌價: {di.item.defaultUnitPrice}元 (現有牌價: {di.matchedExistingItem.defaultUnitPrice}元)
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...excelImportReport.dupItems];
                          updated[idx] = { ...updated[idx], decision: 'overwrite' };
                          setExcelImportReport({ ...excelImportReport, dupItems: updated });
                        }}
                        className={`px-2 py-0.5 text-[9.5px] font-extrabold rounded border transition cursor-pointer ${
                          di.decision === 'overwrite'
                            ? 'bg-amber-950 text-amber-400 border-amber-900'
                            : 'bg-[#121212] text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        🔄 覆蓋
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...excelImportReport.dupItems];
                          updated[idx] = { ...updated[idx], decision: 'skip' };
                          setExcelImportReport({ ...excelImportReport, dupItems: updated });
                        }}
                        className={`px-2 py-0.5 text-[9.5px] font-extrabold rounded border transition cursor-pointer ${
                          di.decision === 'skip'
                            ? 'bg-rose-950 text-rose-400 border-rose-900'
                            : 'bg-[#121212] text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        ⏭️ 略過
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Individual suspicious similar items check list */}
          {excelImportReport.suspectItems && excelImportReport.suspectItems.length > 0 && (
            <div className="p-3 bg-[#221614] border border-[#DE5045]/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[10.5px] text-amber-500 font-extrabold block">🔍 疑似已有類似名稱之「疑慮品項」審核清單：</span>
                <span className="text-[9.5px] text-neutral-500 font-bold">(可在此個別決定是否匯入或如何匯入)</span>
              </div>
              <div className="max-h-[190px] overflow-y-auto space-y-1.5 pr-1">
                {excelImportReport.suspectItems.map((sus, idx) => (
                  <div key={`sus-${idx}`} className="p-2 bg-[#1A1010] border border-red-950/25 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-left">
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-neutral-205 text-[11px] truncate">
                        📥 匯入：{sus.importedItem.name} <span className="text-[9.5px] font-normal text-neutral-500">({sus.importedItem.category})</span>
                      </div>
                      <div className="text-[10px] text-amber-500 mt-0.5 font-bold">
                        ⚠️ 相似：<span className="underline">{sus.matchedExistingItem.name}</span> <span className="text-[9px] font-normal text-neutral-500">({sus.matchedExistingItem.category})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...excelImportReport.suspectItems];
                          updated[idx] = { ...updated[idx], decision: 'skip' };
                          setExcelImportReport({ ...excelImportReport, suspectItems: updated });
                        }}
                        className={`px-2 py-0.5 text-[9.5px] font-extrabold rounded border transition cursor-pointer ${
                          sus.decision === 'skip'
                            ? 'bg-rose-950 text-rose-400 border-rose-900'
                            : 'bg-[#121212] text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                        title="不匯入此相似項目"
                      >
                        ⏭️ 略過此項
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...excelImportReport.suspectItems];
                          updated[idx] = { ...updated[idx], decision: 'import_as_new' };
                          setExcelImportReport({ ...excelImportReport, suspectItems: updated });
                        }}
                        className={`px-2 py-0.5 text-[9.5px] font-extrabold rounded border transition cursor-pointer ${
                          sus.decision === 'import_as_new'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-900'
                            : 'bg-[#121212] text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                        title="依然當成全新獨立商品匯入"
                      >
                        ➕ 仍作全新
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...excelImportReport.suspectItems];
                          updated[idx] = { ...updated[idx], decision: 'overwrite' };
                          setExcelImportReport({ ...excelImportReport, suspectItems: updated });
                        }}
                        className={`px-2 py-0.5 text-[9.5px] font-extrabold rounded border transition cursor-pointer ${
                          sus.decision === 'overwrite'
                            ? 'bg-amber-955 text-amber-400 border-amber-900'
                            : 'bg-[#121212] text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                        title="以此規格覆蓋現有同名之品項"
                      >
                        🔄 覆蓋現有
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleApplyImport('skip_dups')}
                className="px-3.5 py-2 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-900/30 font-bold rounded-lg cursor-pointer transition"
              >
                ⏭️ 跳過重複 (僅匯入全新 {excelImportReport.newItems.length} 筆)
              </button>
              <button
                type="button"
                onClick={() => handleApplyImport('overwrite_dups')}
                className="px-3.5 py-2 bg-amber-900/40 text-amber-400 hover:bg-amber-900/60 border border-amber-900/30 font-bold rounded-lg cursor-pointer transition"
              >
                🔄 覆蓋更新 (匯入全新並覆蓋更新 {excelImportReport.dupItems.length} 筆)
              </button>
              <button
                type="button"
                onClick={() => handleApplyImport('force_all')}
                className="px-3 py-2 bg-slate-900/40 text-slate-400 hover:bg-slate-900/60 border border-slate-900/30 font-bold rounded-lg cursor-pointer transition"
              >
                ➕ 強制全部直接新增 (不排除任何重複)
              </button>
            </div>
            <button
              type="button"
              onClick={() => setExcelImportReport(null)}
              className="px-3 py-2 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 border border-neutral-850 font-bold rounded-lg cursor-pointer transition shrink-0"
            >
              取消匯入
            </button>
          </div>
        </div>
      )}

      {/* Add new material preset main item form */}
      <div className="!bg-[var(--bg-main)] !text-[var(--text-secondary)] p-5 border border-[#D4AF37]/20 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4AF37]/10 pb-3">
          <div>
            <h3 className="text-sm font-bold !text-[var(--text-primary)] flex items-center gap-2">
              <Plus size={16} className="text-[#D4AF37]" />
              建立新材料品項至大庫
            </h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              建立後，可於下方材料卡內直接點擊「新增其他規格單位」，為同一個材料增設不同的計量單位裝箱。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplateExcel}
              className="px-3 py-1.5 bg-[#1E1E1E] text-amber-300 border border-amber-500/30 hover:bg-amber-500/15 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-3xs cursor-pointer transition"
              title="下載具有同品項多單位、實價格式說明的匯入 Excel 規範範本"
            >
              <FileSpreadsheet size={13} />
              📋 下載匯入範本
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-[#1E1E1E] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/15 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-3xs cursor-pointer transition"
            >
              <Download size={13} />
              📥 下載大庫 EXCEL
            </button>
            <label className="px-3 py-1.5 bg-[#1E1E1E] text-[#F3E5AB] border border-[#F3E5AB]/30 hover:bg-[#F3E5AB]/15 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-3xs cursor-pointer transition-all">
              <Upload size={13} />
              📤 匯入 EXCEL
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleImportExcel}
                className="hidden"
              />
            </label>
          </div>
        </div>
        <form onSubmit={handleAddMaterial} className="grid grid-cols-12 gap-3 mt-1 text-xs">
          <div className="col-span-12 sm:col-span-7">
            <label className="block text-[10px] text-neutral-300 font-bold mb-1">材料品項名稱</label>
            <input
              id="material-add-name"
              type="text"
              value={newMatName}
              onChange={(e) => setNewMatName(e.target.value)}
              placeholder="例如: PVC 水管、插座開關、冷熱水龍頭"
              className="w-full px-3 py-2 border border-[#D4AF37]/20 !text-[var(--text-secondary)] !bg-[var(--bg-input)] rounded-lg placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
              required
            />
          </div>
          <div className="col-span-12 sm:col-span-5">
            <label className="block text-[10px] text-neutral-300 font-bold mb-1">品項分類</label>
            <select
              value={newMatCategory}
              onChange={(e) => {
                const cat = e.target.value;
                setNewMatCategory(cat);
                const suggested = subcategories[cat] || [];
                setNewMatSubcategory(suggested[0] || '');
              }}
              className="w-full px-3 py-2 border border-[#D4AF37]/20 !text-[var(--text-secondary)] !bg-[var(--bg-input)] rounded-lg font-bold focus:outline-none focus:border-[#D4AF37]"
            >
              {categories.map(cat => (
                <option key={cat} value={cat} className="!bg-[var(--bg-card)] !text-[var(--text-secondary)]">📦 {cat}</option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          <div className="col-span-12 grid grid-cols-12 gap-2 border-t border-[#D4AF37]/10 pt-3 mt-1">
            <div className="col-span-12 sm:col-span-6">
              <label className="block text-[10px] text-neutral-300 font-bold mb-1">✍️ 品項次細分類 (二層二級分類)</label>
              <div className="flex gap-2">
                <select
                  value={subcategories[newMatCategory]?.includes(newMatSubcategory) ? newMatSubcategory : (newMatSubcategory ? 'custom' : '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setNewMatSubcategory('');
                    } else {
                      setNewMatSubcategory(val);
                    }
                  }}
                  className="w-1/2 px-3 py-2 border border-[#D4AF37]/20 !text-[var(--text-secondary)] !bg-[var(--bg-input)] rounded-lg font-bold focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="" className="!bg-[var(--bg-card)]">-- 無特定次分類 --</option>
                  {(subcategories[newMatCategory] || []).map(sub => (
                    <option key={sub} value={sub} className="!bg-[var(--bg-card)]">{sub}</option>
                  ))}
                  <option value="custom" className="!bg-[var(--bg-card)]">➕ 自行手動輸入...</option>
                </select>
                <input
                  type="text"
                  placeholder="請在此輸入或修改次分類名稱"
                  value={newMatSubcategory}
                  onChange={(e) => setNewMatSubcategory(e.target.value)}
                  className="w-1/2 px-3 py-2 border border-[#D4AF37]/20 !text-[var(--text-secondary)] !bg-[var(--bg-input)] rounded-lg placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <span className="text-[10px] text-neutral-400 mt-1 block">提示：您可以選取常見之推薦次分類，亦可直接於右側文字框自行編修。</span>
            </div>
          </div>

          {/* Real Price Option Selection */}
          <div className="col-span-12 flex items-center gap-2.5 bg-[#D4AF37]/5 border border-[#D4AF37]/15 rounded-xl p-3.5 select-none text-left">
            <input
              id="new-mat-is-real-price"
              type="checkbox"
              checked={newMatIsRealPrice}
              onChange={(e) => setNewMatIsRealPrice(e.target.checked)}
              className="w-4 h-4 text-[#D4AF37] border-[#D4AF37]/30 bg-[var(--bg-input)] rounded focus:ring-0 accent-[#D4AF37] cursor-pointer"
            />
            <label htmlFor="new-mat-is-real-price" className="cursor-pointer flex flex-col sm:flex-row sm:items-center gap-1.5 min-w-0">
              <span className="text-xs font-extrabold text-[#F3E5AB] flex-shrink-0">⚖️ 設為「實價」品項</span>
              <span className="text-[10px] text-neutral-400 font-normal leading-relaxed truncate md:whitespace-normal">
                (勾選後表示此材料無固定價格。系統牌價、進價與特約合約報價均由實價浮動，不輸入固定牌成本，並將在日誌與案場中提供缺失追蹤)
              </span>
            </label>
          </div>

          <div className="col-span-12 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 !bg-[#D4AF37] hover:brightness-110 !text-[var(--bg-main)] rounded-lg text-xs font-black flex items-center gap-1 transition-all shadow-sm cursor-pointer border border-[#D4AF37]"
            >
              <Plus size={14} className="stroke-[2.5]" />
              建立材料品項
            </button>
          </div>
        </form>
      </div>

      {/* Search & Filters Container */}
      <div className="!bg-[var(--bg-card)] border border-[var(--color-accent)]/20 p-4 rounded-xl space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-b border-[#D4AF37]/15 pb-3">
          <div className="md:col-span-4 text-xs font-bold !text-[var(--text-primary)] flex items-center gap-1.5">
            <span>🔍 快速搜尋大庫材料</span>
          </div>
          <div className="md:col-span-8">
            <div className="relative">
              <input
                id="materials-search-query-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="輸入材料名稱、分類或規格單位進行快速檢索... (例如: PVC、水龍頭、線)"
                className="w-full pl-8 pr-12 py-1.5 border border-[#D4AF37]/25 !bg-[var(--bg-input)] rounded-xl text-xs !text-[var(--text-secondary)] placeholder-neutral-500 font-bold focus:border-[#D4AF37] outline-none"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs select-none pointer-events-none">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 rounded font-black cursor-pointer"
                >
                  清除
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] !text-[var(--text-secondary)] font-extrabold font-sans">📂 依材料大類篩選</label>
              <button
                type="button"
                onClick={() => setShowConfigCategories(!showConfigCategories)}
                className="text-[10px] !text-[var(--text-primary)] hover:brightness-110 !bg-[#D4AF37]/10 hover:!bg-[#D4AF37]/15 border border-[#D4AF37]/20 px-2 py-0.5 rounded font-black flex items-center gap-1 transition cursor-pointer"
              >
                <Settings size={11} className="text-[#D4AF37] shrink-0 animate-spin-slow" />
                <span>⚙️ 自主配置/改名與排序大類</span>
              </button>
            </div>

            {/* Config categories inline form */}
            {showConfigCategories && (
              <div className="!bg-[var(--bg-main)] border text-[11px] border-[#D4AF37]/20 p-3 rounded-lg space-y-2.5 animate-slideDown shadow-lg">
                <div className="font-extrabold !text-[var(--text-primary)] pb-1 border-b border-[#D4AF37]/15 flex items-center justify-between">
                  <span>🛠️ 材料大類設定庫 (可使用箭頭微調前後排序)</span>
                  <button 
                    type="button"
                    onClick={() => setShowConfigCategories(false)}
                    className="p-0.5 hover:bg-neutral-800 rounded"
                  >
                    <X size={11} />
                  </button>
                </div>
                
                {/* Add standard categories */}
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="例如: 燈具照明類"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-[#D4AF37]/20 rounded !bg-[#1A1A1A] !text-[var(--text-secondary)] placeholder-neutral-500 outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[#252525] border border-[#D4AF37]/20 !text-[#F3E5AB] rounded font-bold hover:bg-[#333333] text-xs shrink-0"
                  >
                    ➕ 新增
                  </button>
                </form>

                {/* Categories items config lists */}
                <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#D4AF37]/10">
                  {categories.map((cat, idx) => {
                    const isRenaming = renamingCategoryOld === cat;
                    return (
                      <div key={cat} className="flex items-center justify-between pt-1.5">
                        {isRenaming ? (
                          <div className="flex items-center gap-1 w-full">
                            <input
                              type="text"
                              value={renamingCategoryInput}
                              onChange={(e) => setRenamingCategoryInput(e.target.value)}
                              className="px-1 py-0.5 border text-xs !text-[#E0E0E0] rounded bg-[#121212] w-full font-bold focus:outline-none focus:border-[#D4AF37]"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRenameCategory(cat)}
                              className="p-1 text-emerald-400 hover:bg-emerald-950/20 rounded"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingCategoryOld(null)}
                              className="p-1 text-neutral-500 hover:bg-neutral-800 rounded"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col flex-1 text-left min-w-0 pr-1.5">
                              <span className="font-extrabold !text-[var(--text-secondary)] text-[11px] truncate flex-1 leading-none">
                                {idx + 1}. 📦 {cat}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-neutral-500 font-bold">加成倍率:</span>
                                <input
                                  type="number"
                                  step="0.05"
                                  min="1.0"
                                  max="3.0"
                                  title="此材料類別之牌價/成本加成倍率"
                                  value={categoryConfigs.find(cfg => cfg.category === cat)?.multiplier ?? 1.10}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 1.10;
                                    const updated = [...categoryConfigs];
                                    const foundIdx = updated.findIndex(cfg => cfg.category === cat);
                                    if (foundIdx > -1) {
                                      updated[foundIdx].multiplier = val;
                                    } else {
                                      updated.push({ category: cat, multiplier: val });
                                    }
                                    setCategoryConfigs(updated);
                                    saveCategoryMaterialConfigs(updated);
                                  }}
                                  className="w-11 px-1 py-0.2 border border-[#D4AF37]/20 rounded text-[10px] font-mono text-center bg-[#121212] !text-[#F3E5AB] font-extrabold focus:outline-none focus:border-[#D4AF37]"
                                />
                                <span className="text-[9.5px] text-neutral-500">(如: 1.10)</span>
                              </div>
                            </div>
                            {deleteConfirmCategory === cat ? (
                              <div className="flex items-center gap-1 bg-red-950/30 px-1.5 py-0.5 border border-red-900 rounded animate-fadeIn shrink-0">
                                <span className="text-[10px] font-bold text-red-400">確定刪除？</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeleteCategory(cat);
                                    setDeleteConfirmCategory(null);
                                  }}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer transition-all"
                                >
                                  是
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmCategory(null)}
                                  className="px-1.5 py-0.5 bg-[#252525] text-neutral-400 rounded font-bold hover:bg-[#333333]"
                                >
                                  否
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-neutral-405 shrink-0 select-none">
                                {/* 向上排列按鈕 */}
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveCategory(idx, 'up')}
                                  className={`p-0.5 text-neutral-500 hover:text-[#D4AF37] hover:bg-neutral-800 rounded transition ${idx === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                  title="將此大類向上移"
                                >
                                  <ChevronUp size={13} />
                                </button>
                                {/* 向下排列按鈕 */}
                                <button
                                  type="button"
                                  disabled={idx === categories.length - 1}
                                  onClick={() => handleMoveCategory(idx, 'down')}
                                  className={`p-0.5 text-neutral-500 hover:text-[#D4AF37] hover:bg-neutral-800 rounded transition ${idx === categories.length - 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                  title="將此大類向下移"
                                >
                                  <ChevronDown size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenamingCategoryOld(cat);
                                    setRenamingCategoryInput(cat);
                                  }}
                                  className="p-1 hover:text-[#D4AF37] hover:bg-neutral-850 rounded transition shrink-0 cursor-pointer"
                                  title="更名"
                                >
                                  <Edit size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmCategory(cat)}
                                  className="p-1 hover:text-red-400 hover:bg-neutral-850 rounded transition shrink-0 cursor-pointer"
                                  title="刪除"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Subcategory configurations */}
                <div className="mt-4 border-t border-[#D4AF37]/15 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#D4AF37] text-[11px]">🛠️ 二級次細分類設定與自訂排序 (請點選大類配置)</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 justify-start">
                    {categories.map(cat => (
                      <button
                        key={`subcfg-${cat}`}
                        type="button"
                        onClick={() => {
                          setActiveConfigCategory(activeConfigCategory === cat ? null : cat);
                          setNewSubcatName('');
                        }}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded border transition ${
                          activeConfigCategory === cat
                            ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]'
                            : 'bg-[#121212] text-neutral-450 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        📂 {cat} ({subcategories[cat]?.length ?? 0})
                      </button>
                    ))}
                  </div>

                  {activeConfigCategory && (
                    <div className="!bg-[#121212] p-2.5 rounded-lg border border-neutral-800 space-y-2 animate-fadeIn text-[11px] mt-1.5 text-left">
                      <div className="flex items-center justify-between border-b border-neutral-850 pb-1 font-bold">
                        <span className="text-amber-200">二級次分類清單 : 【{activeConfigCategory}】</span>
                        <button
                          type="button"
                          onClick={() => setActiveConfigCategory(null)}
                          className="text-neutral-500 hover:text-white"
                        >
                          關閉
                        </button>
                      </div>

                      {/* Add new subcategory */}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="輸入新次細分類，例如: PVC管/另件"
                          value={newSubcatName}
                          onChange={(e) => setNewSubcatName(e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-neutral-800 rounded bg-[#1A1A1A] text-white focus:border-[#D4AF37] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = newSubcatName.trim();
                            if (!val) return;
                            const currentList = subcategories[activeConfigCategory] || [];
                            if (currentList.includes(val)) {
                              onSaveToast('⚠️ 該大類下已存在此二級次分類！');
                              return;
                            }
                            const updatedList = [...currentList, val];
                            const updatedAll = {
                              ...subcategories,
                              [activeConfigCategory]: updatedList
                            };
                            setSubcategories(updatedAll);
                            saveSubcategories(updatedAll);
                            setNewSubcatName('');
                            onSaveToast(`➕ 已新增次細分類：【${val}】！`);
                          }}
                          className="px-2.5 py-0.5 bg-neutral-850 hover:bg-neutral-800 text-amber-200 font-bold border border-neutral-700/80 rounded shrink-0 cursor-pointer"
                        >
                          新增
                        </button>
                      </div>

                      {/* Subcategory items with sorting, multipliers, and delete */}
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                        {(subcategories[activeConfigCategory] || []).length === 0 ? (
                          <p className="text-neutral-500 text-[10px] text-center py-1">目前無任何次級分類，請在上方輸入新增</p>
                        ) : (
                          (subcategories[activeConfigCategory] || []).map((sub, sidx) => {
                            const multKey = `${activeConfigCategory}:${sub}`;
                            return (
                              <div key={`subitem-${sub}`} className="flex items-center justify-between bg-[#151515] p-1.5 rounded border border-neutral-900">
                                <div className="flex flex-col flex-1 min-w-0 pr-2">
                                  <span className="font-extrabold text-neutral-300 text-[10.5px] truncate">
                                    {sidx + 1}. {sub}
                                  </span>
                                  
                                  {/* Custom markup rate and move category for this subcategory */}
                                  <div className="flex flex-col gap-1 mt-0.5 text-[9.5px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-neutral-500">自訂加成：</span>
                                      <input
                                        type="number"
                                        step="0.05"
                                        min="1.0"
                                        max="3.0"
                                        placeholder="繼承大類"
                                        value={subMultipliers[multKey] || ''}
                                        onChange={(e) => {
                                          const valStr = e.target.value;
                                          const updated = { ...subMultipliers };
                                          if (valStr === '') {
                                            delete updated[multKey];
                                          } else {
                                            const val = parseFloat(valStr) || 1.1;
                                            updated[multKey] = val;
                                          }
                                          setSubMultipliers(updated);
                                          saveSubcategoryMultipliers(updated);
                                        }}
                                        className="w-16 px-1 border border-neutral-800 rounded text-[9.5px] font-mono text-center bg-[#1A1A1A] text-[#F3E5AB] font-extrabold focus:outline-none focus:border-[#D4AF37]"
                                      />
                                      <span className="text-neutral-400 text-[8.5px]">{subMultipliers[multKey] ? `已啟用 (${subMultipliers[multKey]}x)` : '繼承大類'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-amber-200">變更大類：</span>
                                      <select
                                        value={activeConfigCategory}
                                        onChange={(e) => {
                                          const targetCategory = e.target.value;
                                          if (targetCategory === activeConfigCategory) return;
                                          handleMoveSubcategoryToNewCategory(sub, activeConfigCategory, targetCategory);
                                        }}
                                        className="px-1 py-0 border border-neutral-800 rounded text-[9.5px] bg-[#1E1E1E] text-amber-250 focus:outline-none focus:border-[#D4AF37] cursor-pointer font-extrabold"
                                      >
                                        {categories.map(cat => (
                                          <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  {/* Reorder up */}
                                  <button
                                    type="button"
                                    disabled={sidx === 0}
                                    onClick={() => {
                                      const currentList = [...(subcategories[activeConfigCategory] || [])];
                                      if (sidx === 0) return;
                                      const temp = currentList[sidx];
                                      currentList[sidx] = currentList[sidx - 1];
                                      currentList[sidx - 1] = temp;
                                      const updatedAll = { ...subcategories, [activeConfigCategory]: currentList };
                                      setSubcategories(updatedAll);
                                      saveSubcategories(updatedAll);
                                      onSaveToast('↕️ 已調整次細分類排序！');
                                    }}
                                    className={`p-0.5 text-neutral-500 hover:text-[#D4AF37] ${sidx === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                  >
                                    <ChevronUp size={12} />
                                  </button>

                                  {/* Reorder down */}
                                  <button
                                    type="button"
                                    disabled={sidx === (subcategories[activeConfigCategory] || []).length - 1}
                                    onClick={() => {
                                      const currentList = [...(subcategories[activeConfigCategory] || [])];
                                      if (sidx === currentList.length - 1) return;
                                      const temp = currentList[sidx];
                                      currentList[sidx] = currentList[sidx + 1];
                                      currentList[sidx + 1] = temp;
                                      const updatedAll = { ...subcategories, [activeConfigCategory]: currentList };
                                      setSubcategories(updatedAll);
                                      saveSubcategories(updatedAll);
                                      onSaveToast('↕️ 已調整次細分類排序！');
                                    }}
                                    className={`p-0.5 text-neutral-500 hover:text-[#D4AF37] ${sidx === (subcategories[activeConfigCategory] || []).length - 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                  >
                                    <ChevronDown size={12} />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentList = (subcategories[activeConfigCategory] || []).filter(item => item !== sub);
                                      const updatedAll = { ...subcategories, [activeConfigCategory]: currentList };
                                      setSubcategories(updatedAll);
                                      saveSubcategories(updatedAll);
                                      
                                      // Also delete multiplier
                                      const updatedMults = { ...subMultipliers };
                                      delete updatedMults[multKey];
                                      setSubMultipliers(updatedMults);
                                      saveSubcategoryMultipliers(updatedMults);

                                      onSaveToast(`🗑️ 已刪除次級細分類：【${sub}】。`);
                                    }}
                                    className="p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition cursor-pointer"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {['全部', ...categories].map(cat => {
                const isSelected = settingsMatCategoryFilter === cat;
                
                // Get smart emoji icon
                let emoji = '📦 ';
                if (cat === '全部') emoji = '📂 ';
                else if (cat.includes('電')) emoji = '⚡ ';
                else if (cat.includes('水') || cat.includes('管')) emoji = '💧 ';
                else if (cat.includes('廚') || cat.includes('衛') || cat.includes('浴')) emoji = '🛁 ';
                else if (cat.includes('五') || cat.includes('緊') || cat.includes('金')) emoji = '🔩 ';
                else if (cat.includes('工') || cat.includes('耗') || cat.includes('雜')) emoji = '🛠️ ';

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSettingsMatCategoryFilter(cat)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? '!bg-[var(--color-accent)] !text-[#0D0D0D] font-extrabold shadow-md'
                        : '!bg-[var(--bg-main)] hover:!bg-[#1D1D1D] border border-[#D4AF37]/15 !text-[var(--text-secondary)] hover:!text-[var(--text-primary)]'
                    }`}
                  >
                    {emoji}
                    {cat === '全部' ? '全部種類' : cat.replace('類', '')}
                  </button>
                );
              })}
            </div>
            
            {settingsMatCategoryFilter !== '全部' && (
              <div className="space-y-1.5 border-t border-[#D4AF37]/10 pt-2.5 mt-2 animate-fadeIn bg-[#1A1A1A]/60 p-2.5 rounded-xl">
                <label className="block text-[10px] !text-amber-200 font-extrabold flex items-center gap-1">
                  <span>📂 依細分二層分類 (次分類) 進階篩選：</span>
                </label>
                <div className="flex flex-wrap gap-1">
                  {(() => {
                    const subList = [...(subcategories[settingsMatCategoryFilter] || [])];
                    const hasUnclassified = materials.some(m => m.category === settingsMatCategoryFilter && (!m.subcategory || m.subcategory.trim() === ''));
                    if (hasUnclassified) {
                      subList.push('未分類');
                    }
                    return ['全部', ...subList];
                  })().map(sub => {
                    const isSelected = settingsMatSubcategoryFilter === sub;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSettingsMatSubcategoryFilter(sub)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#D4AF37] text-[#0D0D0D] font-extrabold shadow-sm'
                            : 'bg-[#121212] text-neutral-400 hover:text-white border border-neutral-800/85 hover:border-neutral-700'
                        }`}
                      >
                        {sub === '全部' ? '🔍 全部次細部' : (sub === '未分類' ? '❓ 未分類' : sub)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Supplier Filter */}
          <div className="space-y-1.5">
            <label className="block text-[10px] !text-[var(--text-secondary)] font-extrabold">🏬 依特約材料行報價篩選 (精確比對有登錄該行對照報價的耗材)</label>
            <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSettingsMatSupplierFilter('全部')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  settingsMatSupplierFilter === '全部'
                    ? '!bg-[var(--color-accent)] !text-[#0D0D0D] font-extrabold shadow-md'
                    : '!bg-[var(--bg-main)] hover:!bg-[#1D1D1D] border border-[#D4AF37]/15 !text-[var(--text-secondary)] hover:!text-[var(--text-primary)]'
                }`}
              >
                🏬 全部特約行
              </button>
              {activeSuppliers.map(sup => (
                <button
                  key={sup.id}
                  type="button"
                  onClick={() => setSettingsMatSupplierFilter(sup.name)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    settingsMatSupplierFilter === sup.name
                      ? '!bg-[var(--color-accent)] !text-[#0D0D0D] font-extrabold shadow-md'
                      : '!bg-[var(--bg-main)] hover:!bg-[#1D1D1D] border border-[#D4AF37]/15 !text-[var(--text-secondary)] hover:!text-[var(--text-primary)]'
                  }`}
                >
                  🏬 {sup.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* List Materials items */}
      <div className="space-y-5 max-h-[600px] overflow-y-auto pr-1">
        {(() => {
          const filteredMaterials = materials
            .filter(m => settingsMatCategoryFilter === '全部' || m.category === settingsMatCategoryFilter)
            .filter(m => {
              if (settingsMatSubcategoryFilter === '全部') return true;
              if (settingsMatSubcategoryFilter === '未分類') return !m.subcategory || m.subcategory.trim() === '';
              return m.subcategory === settingsMatSubcategoryFilter;
            })
            .filter(m => {
              if (settingsMatSupplierFilter === '全部') return true;
              const options = ensureUnitOptions(m);
              return options.some(uo => 
                uo.suppliers?.some(s => s.storeName === settingsMatSupplierFilter && (s.listPrice > 0 || s.costPrice > 0))
              );
            })
            .filter(m => {
              if (!searchQuery.trim()) return true;
              const keyword = searchQuery.trim().toLowerCase();
              const matchName = m.name.toLowerCase().includes(keyword);
              const matchCategory = (m.category || '').toLowerCase().includes(keyword);
              const options = ensureUnitOptions(m);
              const matchUnit = options.some(uo => uo.unit.toLowerCase().includes(keyword));
              return matchName || matchCategory || matchUnit;
            });

          const sortedFiltered = [...filteredMaterials].sort((a, b) => {
            const catA = a.category || '水路管材類';
            const catB = b.category || '水路管材類';
            let idxA = categories.indexOf(catA);
            let idxB = categories.indexOf(catB);
            if (idxA === -1) idxA = 999;
            if (idxB === -1) idxB = 999;
            if (idxA !== idxB) {
              return idxA - idxB;
            }
            return a.name.localeCompare(b.name, 'zh-TW');
          });

          // Group by category based on categories list
          const groups: { [cat: string]: typeof sortedFiltered } = {};
          categories.forEach(cat => {
            groups[cat] = [];
          });
          groups['其它/未分類'] = [];

          sortedFiltered.forEach(m => {
            const cat = m.category || '其它/未分類';
            if (groups[cat]) {
              groups[cat].push(m);
            } else {
              groups['其它/未分類'].push(m);
            }
          });

          return (
            <div className="space-y-8">
              {Object.entries(groups).map(([catName, list]) => {
                if (list.length === 0) return null;

                let emoji = '📦 ';
                if (catName.includes('電')) emoji = '⚡ ';
                else if (catName.includes('水') || catName.includes('管')) emoji = '💧 ';
                else if (catName.includes('廚') || catName.includes('衛') || catName.includes('浴')) emoji = '🛁 ';
                else if (catName.includes('五') || catName.includes('緊') || catName.includes('金')) emoji = '🔩 ';
                else if (catName.includes('工') || catName.includes('耗') || catName.includes('雜')) emoji = '🛠️ ';

                return (
                  <div key={catName} className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-neutral-250 font-bold select-none text-neutral-800">
                      <span className="text-sm sm:text-base">{emoji}</span>
                      <span className="text-sm sm:text-base text-neutral-850 font-black">{catName}</span>
                      <span className="text-xs text-neutral-400 font-mono font-medium">({list.length} 筆耗材)</span>
                    </div>
                    <div className="space-y-5">
                      {list.map(m => {
                const isEditing = editingMatId === m.id;
                const options = ensureUnitOptions(m);

                return (
                  <div key={m.id} className="p-5 !bg-[var(--bg-card)] hover:brightness-[1.03] border border-[var(--color-accent)]/20 rounded-2xl space-y-4 transition">
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 w-full !bg-[var(--bg-card)] p-4 border border-[var(--color-accent)]/20 rounded-xl">
                        <div className="sm:col-span-7">
                          <label className="block text-[9px] text-neutral-400 mb-0.5">品項名稱 (不含單位)</label>
                          <input
                            type="text"
                            value={editMatName}
                            onChange={(e) => setEditMatName(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-[#D4AF37]/20 rounded text-xs !bg-[var(--bg-input)] !text-[var(--text-secondary)] font-bold outline-none focus:border-[#D4AF37]"
                            required
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <label className="block text-[9px] text-neutral-400 mb-0.5">品項分類</label>
                          <select
                            value={editMatCategory}
                            onChange={(e) => {
                              const cat = e.target.value;
                              setEditMatCategory(cat);
                              const suggested = subcategories[cat] || [];
                              setEditMatSubcategory(suggested[0] || '');
                            }}
                            className="w-full px-2 py-1.5 border border-[#D4AF37]/20 rounded text-xs !bg-[var(--bg-input)] !text-[var(--text-secondary)] font-bold outline-none focus:border-[#D4AF37]"
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat} className="!bg-[var(--bg-card)]">📦 {cat}</option>
                            ))}
                          </select>
                        </div>

                        {/* Subcategory Edit */}
                        <div className="sm:col-span-12 grid grid-cols-12 gap-2 border-t pt-2 border-[var(--color-accent)]/20">
                          <div className="col-span-12">
                            <label className="block text-[9px] text-neutral-400 mb-0.5">次細分類 (二層二級分類)</label>
                            <div className="flex gap-2">
                              <select
                                value={subcategories[editMatCategory]?.includes(editMatSubcategory) ? editMatSubcategory : (editMatSubcategory ? 'custom' : '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'custom') {
                                    setEditMatSubcategory('');
                                  } else {
                                    setEditMatSubcategory(val);
                                  }
                                }}
                                className="w-1/2 px-2 py-1.5 border border-[#D4AF37]/20 rounded text-xs !bg-[var(--bg-input)] !text-[var(--text-secondary)] font-bold outline-none focus:border-[#D4AF37]"
                              >
                                <option value="">-- 無特定次分類 --</option>
                                {(subcategories[editMatCategory] || []).map(sub => (
                                  <option key={sub} value={sub}>{sub}</option>
                                ))}
                                <option value="custom">➕ 自行手動輸入...</option>
                              </select>
                              <input
                                type="text"
                                placeholder="自行手動輸入或自訂次分類"
                                value={editMatSubcategory}
                                onChange={(e) => setEditMatSubcategory(e.target.value)}
                                className="w-1/2 px-2.5 py-1.5 border border-[#D4AF37]/20 rounded text-xs !bg-[var(--bg-input)] !text-[var(--text-secondary)] font-bold outline-none focus:border-[#D4AF37]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Real Price Option Checkbox under Edit */}
                        <div className="sm:col-span-12 flex items-center gap-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 select-none text-left w-full">
                          <input
                            id="edit-mat-is-real-price"
                            type="checkbox"
                            checked={editMatIsRealPrice}
                            onChange={(e) => setEditMatIsRealPrice(e.target.checked)}
                            className="w-4 h-4 text-amber-500 border-amber-500/30 bg-[var(--bg-input)] rounded focus:ring-0 accent-amber-500 cursor-pointer"
                          />
                          <label htmlFor="edit-mat-is-real-price" className="cursor-pointer flex flex-col sm:flex-row sm:items-center gap-1.5 min-w-0">
                            <span className="text-[11px] font-extrabold text-[#F3E5AB] flex-shrink-0">⚖️ 設為「實價」品項</span>
                            <span className="text-[10px] text-neutral-400 font-normal leading-relaxed">
                              (啟用後，此材料之規格牌價與進料成本將固定歸 0，並且日誌或對帳將追蹤警示)
                            </span>
                          </label>
                        </div>

                        <div className="flex gap-1 justify-end items-end sm:col-span-12 border-t pt-2 border-[var(--color-accent)]/20 mt-1">
                          <button
                            type="button"
                            onClick={handleSaveEditMat}
                            className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-bold hover:bg-amber-700 cursor-pointer"
                          >
                            儲存修改
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMatId(null)}
                            className="px-3 py-1 bg-neutral-200 text-neutral-600 rounded text-xs hover:bg-neutral-300 cursor-pointer"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Material Main Title Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-accent)]/20 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold !text-[var(--text-primary)] text-sm sm:text-base">{m.name}</h4>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded !bg-[var(--bg-input)] border border-[#D4AF37]/20 !text-[var(--text-secondary)] font-mono">
                                {m.category === '電路電材類' && '⚡ '}
                                {m.category === '水路管材類' && '💧 '}
                                {m.category === '廚衛設備類' && '🛁 '}
                                {m.category === '五金緊固類' && '🔩 '}
                                {m.category === '工具與雜耗' && '🛠️ '}
                                {m.category || '水路管材類'}
                              </span>
                              {m.subcategory && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold rounded bg-amber-500/10 border border-amber-500/20 text-[#D4AF37] font-mono">
                                  📂 {m.subcategory}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-neutral-400">目前設有 {options.length} 個單位計價對照規格</p>
                          </div>

                          <div className="flex items-center gap-1.5 font-mono">
                            <button
                              type="button"
                              onClick={() => handleToggleRealPrice(m.id, !!m.isRealPrice)}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border ${
                                m.isRealPrice
                                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25'
                                  : 'bg-white text-neutral-500 hover:text-amber-500 border-neutral-200 hover:border-amber-300 hover:bg-amber-50'
                              }`}
                              title={m.isRealPrice ? '此為「實價」品項（無固定牌成本，全額浮動）。點擊切換為「標準定價」品項' : '此為並非實價的「標準定價」品項。點擊切換為「實價」品項'}
                            >
                              <span>⚖️ {m.isRealPrice ? '當前：實價' : '設定為實價'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditMat(m)}
                              className="px-2.5 py-1 text-neutral-500 hover:text-amber-700 bg-white hover:bg-amber-50 border border-neutral-200 hover:border-amber-300 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              title="修改大類品名/分類"
                            >
                              <Edit size={11} />
                              改品名
                            </button>
                            {deleteConfirmMatId === m.id ? (
                              <div className="flex items-center gap-1.5 bg-rose-55 px-2.5 py-1 border border-rose-250 rounded-lg animate-fadeIn">
                                <span className="text-[11px] font-extrabold text-red-900 leading-none">確定自大庫移除此耗材嗎？</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeleteMat(m.id, m.name);
                                    setDeleteConfirmMatId(null);
                                  }}
                                  className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-black rounded cursor-pointer transition-all"
                                >
                                  刪除
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmMatId(null)}
                                  className="px-2.5 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-600 text-[11px] font-bold rounded cursor-pointer transition-all"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmMatId(m.id)}
                                className="px-3 py-1.5 text-red-600 bg-white hover:bg-red-600 border border-red-200 hover:border-red-600 hover:text-white rounded-lg transition-all flex items-center gap-1 cursor-pointer text-xs font-black shadow-3xs"
                                title="自大庫中刪除個品項"
                              >
                                <Trash2 size={12} />
                                移除品項
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Unit Options Segment inside Card */}
                        <div className="space-y-4">
                          {options.map((uo, idx) => {
                            const supCount = uo.suppliers?.length || 0;
                            const hasActiveSuppliers = supCount > 0;
                            const targetUo = options.find(o => o.id === uo.targetUnitOptionId) || options[0];
                            const targetUnitName = targetUo?.unit || '個';

                            return (
                              <div key={uo.id} className="!bg-[var(--bg-card)] border border-[var(--color-accent)]/20 rounded-xl p-4 shadow-3xs space-y-3">
                                {/* Option Header */}
                                <div className="flex items-center justify-between border-b border-[var(--color-accent)]/10 pb-2 flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    <span className="font-sans font-black text-xs text-neutral-750 flex items-center gap-1">
                                      規格單位：
                                      <input
                                        type="text"
                                        value={uo.unit}
                                        onChange={(e) => handleUpdateUnitString(m.id, uo.id, e.target.value)}
                                        className="font-black !text-[var(--text-primary)] border-b border-dashed border-[#D4AF37]/40 bg-transparent px-1 w-12 text-center text-xs focus:ring-0 focus:border-amber-500"
                                        title="可直接點擊進行單位名稱重改"
                                      />
                                    </span>
                                    {idx === 0 && (
                                      <span className="text-[9px] !bg-[#D4AF37]/10 !text-[var(--text-primary)] border border-[#D4AF37]/20 font-bold px-1.5 py-0.5 rounded">
                                        預設規格
                                      </span>
                                    )}

                                    {/* 單位順序調整 */}
                                    <div className="flex items-center gap-1 !bg-[var(--bg-input)] px-1 py-0.5 rounded border border-[#D4AF37]/20">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveUnitOption(m.id, idx, 'up')}
                                        className={`p-1 rounded hover:!bg-[#D4AF37]/10 hover:!text-[var(--text-primary)] transition-colors ${idx === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer text-neutral-500 hover:text-neutral-800'}`}
                                        title="單位向上移動"
                                      >
                                        <ChevronUp size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === options.length - 1}
                                        onClick={() => handleMoveUnitOption(m.id, idx, 'down')}
                                        className={`p-1 rounded hover:!bg-[#D4AF37]/10 hover:!text-[var(--text-primary)] transition-colors ${idx === options.length - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer text-neutral-500 hover:text-neutral-800'}`}
                                        title="單位向下移動"
                                      >
                                        <ChevronDown size={11} />
                                      </button>
                                    </div>
                                    {idx > 0 && (
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 !bg-[var(--bg-input)] p-2 rounded-xl border border-[#D4AF37]/20 shadow-3xs flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Scale size={11} className="text-amber-600" />
                                          <span className="text-[11px] !text-[var(--text-primary)] font-black">
                                            單位換算：
                                          </span>
                                          <label className="flex items-center gap-1 !bg-[#D4AF37]/10 hover:!bg-[#D4AF37]/15 transition px-2 py-0.5 rounded border border-[#D4AF37]/35 text-[10px] font-black cursor-pointer !text-[var(--text-primary)] select-none shadow-3xs" title="勾選開啟後，此規格單位的牌價與進價將依以下比例自動自動自基準單位折合換算。若不勾選，則為獨立計價規格，可直接手動輸入不同報價。">
                                            <input
                                              type="checkbox"
                                              checked={uo.useConversionPricing || false}
                                              onChange={(e) => handleToggleUnitConversionPricing(m.id, uo.id, e.target.checked)}
                                              className="rounded text-amber-600 border-amber-300 focus:ring-1 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                                            />
                                            <span>⚡ 自動換算計價</span>
                                          </label>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {/* 對應換算目標選擇 */}
                                          {uo.useConversionPricing && (
                                            <div className="flex items-center gap-1 text-[10px] !bg-[var(--bg-main)] border border-[#D4AF37]/20 rounded px-1.5 py-0.5 shadow-3xs">
                                              <span className="text-neutral-500 font-bold">對照：</span>
                                              <select
                                                value={uo.targetUnitOptionId || options[0]?.id || ''}
                                                onChange={(e) => handleUpdateUnitTargetOptionId(m.id, uo.id, e.target.value)}
                                                className="border-none bg-transparent py-0 pl-1 pr-4 text-[10px] font-black !text-[var(--text-primary)] focus:ring-0 focus:outline-none cursor-pointer"
                                              >
                                                {options.map(o => (
                                                  <option key={o.id} value={o.id} disabled={o.id === uo.id} className="!bg-[var(--bg-card)] !text-[var(--text-secondary)]">
                                                    {o.unit || '未具名'} {o.id === uo.id ? '(本單位)' : ''}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => handleUpdateUnitConversionInverse(m.id, uo.id, !uo.conversionInverse)}
                                            className="flex items-center gap-1 !bg-[var(--bg-main)] hover:!bg-[#D4AF37]/10 transition px-1.5 py-0.5 rounded border border-[#D4AF37]/20 text-[9px] sm:text-[10px] !text-[var(--text-secondary)] font-bold cursor-pointer select-none"
                                            title="點擊切換換算關係方向"
                                          >
                                            🔄 {uo.conversionInverse ? '逆向' : '正向'}
                                          </button>
                                          <div className="flex items-center gap-1 text-[10px]">
                                            {uo.conversionInverse ? (
                                              <>
                                                <input
                                                  type="number"
                                                  min="0.001"
                                                  step="any"
                                                  value={uo.conversionFactor ?? 1}
                                                  onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    handleUpdateUnitConversionFactor(m.id, uo.id, isNaN(val) ? 1 : val);
                                                  }}
                                                  className="w-12 text-center text-[10px] py-0.5 font-bold !text-[var(--text-primary)] border border-[#D4AF37]/20 !bg-[var(--bg-main)] rounded focus:outline-none focus:border-[#D4AF37]"
                                                  title="設定多少個此副單位能折合為 1 個對照單位。例如 100米 = 1捆，則此處填 100"
                                                />
                                                <span className="!text-[var(--text-secondary)] font-black">{uo.unit} = 1 {targetUnitName}</span>
                                              </>
                                            ) : (
                                              <>
                                                <span className="!text-[var(--text-secondary)] font-black">1 {uo.unit} =</span>
                                                <input
                                                  type="number"
                                                  min="0.001"
                                                  step="any"
                                                  value={uo.conversionFactor ?? 1}
                                                  onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    handleUpdateUnitConversionFactor(m.id, uo.id, isNaN(val) ? 1 : val);
                                                  }}
                                                  className="w-12 text-center text-[10px] py-0.5 font-bold !text-[var(--text-primary)] border border-[#D4AF37]/20 !bg-[var(--bg-main)] rounded focus:outline-none focus:border-[#D4AF37]"
                                                  title="設定 1 個此副單位能折合多少個對照單位。例如 1捆 = 100米，則此處填 100"
                                                />
                                                <span className="!text-[var(--text-secondary)] font-black">
                                                  {targetUnitName}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {m.isRealPrice ? (
                                      <div className="text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/15 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 shadow-3xs select-none">
                                        ⚖️ 實價品項 (價格浮動大，無固定牌價/成本)
                                      </div>
                                    ) : (
                                      <>
                                        {/* Unit Base Price Custom inputs (If no supplier special prices are entered yet or locked by auto conversion) */}
                                        <div className="flex items-center gap-3 text-[10px] sm:text-xs">
                                          <div className="flex items-center gap-1">
                                            <span className="text-neutral-400">{uo.useConversionPricing ? '🔄對照牌價' : '系統牌價'}</span>
                                            <div className="flex items-center gap-0.5 font-mono">
                                              <span className="text-neutral-500 font-bold">$</span>
                                              <input
                                                type="number"
                                                value={uo.defaultUnitPrice}
                                                onChange={(e) => handleUpdateUnitBasePrices(m.id, uo.id, 'defaultUnitPrice', parseInt(e.target.value, 10) || 0)}
                                                disabled={hasActiveSuppliers || uo.useConversionPricing}
                                                className={`w-14 text-center border font-bold rounded text-[11px] py-0.5 px-1 font-mono outline-none ${
                                                  (hasActiveSuppliers || uo.useConversionPricing)
                                                    ? '!bg-[rgba(255,255,255,0.05)] !text-neutral-500 border-neutral-800 cursor-not-allowed' 
                                                    : '!bg-[var(--bg-input)] !text-[var(--text-primary)] border-[#D4AF37]/25 hover:border-[#D4AF37]/60 focus:border-[#D4AF37]'
                                                }`}
                                                title={uo.useConversionPricing ? '此價格由單位換算比與基準牌價自動乘算鎖定。取消勾選「自動換算計價」解鎖手動輸入。' : ''}
                                              />
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1">
                                            <span className="text-neutral-400">{uo.useConversionPricing ? '🔄對照成本' : '系統進價'}</span>
                                            <div className="flex items-center gap-0.5 font-mono">
                                              <span className="text-neutral-500 font-bold">$</span>
                                              <input
                                                type="number"
                                                value={uo.defaultCostPrice}
                                                onChange={(e) => handleUpdateUnitBasePrices(m.id, uo.id, 'defaultCostPrice', parseInt(e.target.value, 10) || 0)}
                                                disabled={hasActiveSuppliers || uo.useConversionPricing}
                                                className={`w-14 text-center border font-bold rounded text-[11px] py-0.5 px-1 font-mono outline-none ${
                                                  (hasActiveSuppliers || uo.useConversionPricing)
                                                    ? '!bg-[rgba(255,255,255,0.05)] !text-neutral-500 border-neutral-800 cursor-not-allowed' 
                                                    : '!bg-[var(--bg-input)] !text-[var(--text-primary)] border-[#D4AF37]/25 hover:border-[#D4AF37]/60 focus:border-[#D4AF37]'
                                                }`}
                                                title={uo.useConversionPricing ? '此進法由單位換算比與基準進價自動乘算鎖定。取消勾選「自動換算計價」解鎖手動輸入。' : ''}
                                              />
                                            </div>
                                          </div>
                                        </div>

                                        {uo.useConversionPricing ? (
                                          <span className="text-[9px] !bg-[#D4AF37]/10 !text-[var(--text-primary)] font-black px-1.5 py-0.5 rounded border border-[#D4AF37]/25 hidden md:inline-block">
                                            ⚡ 換算鎖定
                                          </span>
                                        ) : hasActiveSuppliers ? (
                                          <span className="text-[9px] !bg-[#D4AF37]/10 !text-[var(--text-primary)] font-bold px-2 py-0.5 rounded border border-[#D4AF37]/25 hidden md:inline-block">
                                            📈 已採特約最高值
                                          </span>
                                        ) : null}
                                      </>
                                    )}

                                    {options.length > 1 && (
                                      <div className="flex items-center gap-1 border-r border-[#D4AF37]/20 pr-2 mr-1">
                                        {/* 規格單位向上排列按鈕 */}
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleMoveUnitOption(m.id, idx, 'up')}
                                          className={`p-1 text-neutral-500 hover:!text-[var(--text-primary)] hover:!bg-[#D4AF37]/15 rounded transition ${idx === 0 ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}`}
                                          title="向上調整此單位的排列順序"
                                        >
                                          <ChevronUp size={13} />
                                        </button>
                                        {/* 規格單位向下排列按鈕 */}
                                        <button
                                          type="button"
                                          disabled={idx === options.length - 1}
                                          onClick={() => handleMoveUnitOption(m.id, idx, 'down')}
                                          className={`p-1 text-neutral-500 hover:!text-[var(--text-primary)] hover:!bg-[#D4AF37]/15 rounded transition ${idx === options.length - 1 ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}`}
                                          title="向下調整此單位的排列順序"
                                        >
                                          <ChevronDown size={13} />
                                        </button>
                                      </div>
                                    )}

                                    {options.length > 1 && (
                                      deleteConfirmUnitId === uo.id ? (
                                        <div className="flex items-center gap-1.5 !bg-rose-950/30 px-2 py-1 border border-rose-500/30 rounded-lg animate-fadeIn shrink-0">
                                          <span className="text-[10px] font-extrabold text-rose-200">確認刪除規格與報價？</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleRemoveUnitOption(m.id, uo.id, uo.unit);
                                              setDeleteConfirmUnitId(null);
                                            }}
                                            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded cursor-pointer transition-all"
                                          >
                                            確定
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDeleteConfirmUnitId(null)}
                                            className="px-2 py-0.5 !bg-[var(--bg-main)] hover:brightness-125 !text-neutral-300 text-[10px] font-bold rounded cursor-pointer transition-all border border-neutral-700"
                                          >
                                            取消
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setDeleteConfirmUnitId(uo.id)}
                                          className="p-1 px-2.5 py-1 text-neutral-400 hover:text-red-400 hover:!bg-red-950/20 border border-[#D4AF37]/20 hover:border-red-400 rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[10px]"
                                          title="刪除此計算單位"
                                        >
                                          <Trash2 size={11} />
                                          刪除此計價單位
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>

                                {/* Supplier prices grid for this unit option */}
                                <div className="space-y-1.5 border-t border-[var(--color-accent)]/15 pt-3 mt-2">
                                  {(() => {
                                    if (m.isRealPrice) return null;
                                    const isSupExpanded = expandedSuppliers[uo.id] || false;
                                    return (
                                      <>
                                        <div className="flex items-center justify-between">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedSuppliers(prev => ({ ...prev, [uo.id]: !isSupExpanded }))}
                                            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-extrabold !text-[var(--text-primary)] !bg-[#D4AF37]/10 hover:!bg-[#D4AF37]/20 border border-[#D4AF37]/25 rounded-lg cursor-pointer transition-all shadow-3xs"
                                            title="點擊展開或摺疊特約材料行的報價輸入格"
                                          >
                                            <span>🏬 特約材料行合約對照價</span>
                                            <span className="text-[9px] px-1.5 py-0.2 !bg-[var(--bg-main)] !text-[var(--text-secondary)] border border-[#D4AF37]/30 rounded-full font-mono">
                                              {activeSuppliers.length} 家特約
                                            </span>
                                            {isSupExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                          </button>
                                          <span className="text-[9px] text-neutral-400 font-medium hidden sm:inline-block">
                                            {isSupExpanded ? '（點擊按鈕摺疊收合）' : '（預設摺疊，點擊展開編輯特約合約報價）'}
                                          </span>
                                        </div>

                                        {isSupExpanded && (
                                          <div className="animate-fadeIn space-y-1.5 pt-1.5">
                                            <span className="text-[9px] text-neutral-400 font-bold block">💡 直接輸入後方特約牌進價，系統自動於上方「系統牌價與系統進價」取特約最高實值：</span>
                                            {activeSuppliers.length === 0 ? (
                                              <p className="text-[10px] text-neutral-400 py-1.5 italic leading-relaxed pl-2 !bg-[var(--bg-main)] rounded border border-neutral-800">
                                                💡 提示：您尚未在系統建置任何「特約材料行」。如需對照不同店家的合約報價，請先利用右上角名冊功能建立材料行。
                                              </p>
                                            ) : (
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 !bg-[var(--bg-main)] p-2.5 rounded-xl border border-[#D4AF37]/15 border-dashed">
                                                {activeSuppliers.map(s => {
                                                  const record = uo.suppliers?.find(sup => sup.storeName === s.name);
                                                  const listPrice = record ? record.listPrice : '';
                                                  const costPrice = record ? record.costPrice : '';

                                                  return (
                                                    <div key={s.id} className="flex items-center justify-between p-2 !bg-[var(--bg-input)] rounded-lg border border-[#D4AF37]/20 shadow-3xs hover:border-[#D4AF37]/60 transition-all">
                                                      <div className="min-w-0 flex-1 pr-2">
                                                        <span className="text-[11px] font-bold !text-[var(--text-secondary)] block truncate" title={s.name}>
                                                          🏬 {s.name}
                                                        </span>
                                                      </div>

                                                      <div className="flex items-center gap-2 flex-shrink-0 text-xs font-mono">
                                                        <div className="flex items-center gap-0.5">
                                                          <span className="text-[9px] text-neutral-400 font-sans">牌價</span>
                                                          <div className="flex items-center gap-0.5 !bg-[var(--bg-main)] px-1 border border-[#D4AF37]/25 rounded">
                                                            <span className="text-[10px] !text-[var(--text-primary)] font-bold">$</span>
                                                            <input
                                                              type="number"
                                                              disabled={uo.useConversionPricing}
                                                              placeholder={uo.useConversionPricing ? "自動" : "未設定"}
                                                              value={listPrice}
                                                              onChange={(e) => {
                                                                const val = parseInt(e.target.value, 10);
                                                                handleUpdateSupplierPriceForUnit(m.id, uo.id, s.name, 'listPrice', isNaN(val) ? 0 : val);
                                                              }}
                                                              className={`w-12 text-center text-[11px] py-0.5 border-none font-bold !text-[var(--text-primary)] bg-transparent focus:outline-none ${uo.useConversionPricing ? '!text-[#D4AF37]/50 cursor-not-allowed font-medium' : ''}`}
                                                              title={uo.useConversionPricing ? '此特約行報價已依單位比例由基準特約價自動算出。若需手動覆寫獨立計費，請取消勾選「自動換算計價」解鎖。' : ''}
                                                            />
                                                          </div>
                                                        </div>

                                                        <div className="flex items-center gap-0.5">
                                                          <span className="text-[9px] text-neutral-400 font-sans">成本</span>
                                                          <div className="flex items-center gap-0.5 !bg-[var(--bg-main)] px-1 border border-[#D4AF37]/25 rounded">
                                                            <span className="text-[10px] !text-[var(--text-primary)] font-bold">$</span>
                                                            <input
                                                              type="number"
                                                              disabled={uo.useConversionPricing}
                                                              placeholder={uo.useConversionPricing ? "自動" : "未設定"}
                                                              value={costPrice}
                                                              onChange={(e) => {
                                                                const val = parseInt(e.target.value, 10);
                                                                handleUpdateSupplierPriceForUnit(m.id, uo.id, s.name, 'costPrice', isNaN(val) ? 0 : val);
                                                              }}
                                                              className={`w-12 text-center text-[11px] py-0.5 border-none font-black !text-[var(--text-primary)] bg-transparent focus:outline-none ${uo.useConversionPricing ? '!text-[#D4AF37]/50 cursor-not-allowed font-medium' : ''}`}
                                                              title={uo.useConversionPricing ? '此進料報價已依單位比例由基準特約價自動算出。若需手動覆寫獨立計費，請取消勾選「自動換算計價」解鎖。' : ''}
                                                            />
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Quick Add alternative Unit Option Form inside card */}
                        <div className="!bg-[var(--bg-main)] p-3 rounded-xl border border-[#D4AF37]/15 flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-[10px] font-bold !text-[var(--text-secondary)]">
                            📏 需要此品項支援其他包裝/規格單位嗎？ (例如一綑或一箱，可在此直接開立新單位獨立計售)
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              placeholder="例如: 支、米、桶"
                              value={newUnitStr[m.id] || ''}
                              onChange={(e) => setNewUnitStr(prev => ({ ...prev, [m.id]: e.target.value }))}
                              maxLength={6}
                              className="px-2.5 py-1.5 border border-[#D4AF37]/20 !bg-[var(--bg-input)] !text-[var(--text-primary)] rounded-lg text-xs w-28 text-center font-bold focus:outline-none focus:border-[#D4AF37]"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddUnitOption(m.id)}
                              className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-50 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer !text-[var(--bg-main)] !bg-[#D4AF37] hover:brightness-110"
                            >
                              <Plus size={12} />
                              新增單位
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredMaterials.length === 0 && (
                <div className="text-center py-12 border border-dashed border-neutral-200 text-neutral-400 text-xs italic rounded-2xl bg-neutral-50/20">
                  💡 大庫中依您目前的篩選條件（分類: {settingsMatCategoryFilter}、材料行: {settingsMatSupplierFilter}）查查無相符耗材。您可使用上方表單新增，或變更篩選。
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ⚠️ 耗材重覆或相近名稱警示彈窗 / Elegant Similarity Warning Modal */}
      {dupConflictMaterials.length > 0 && pendingMaterialToAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-scaleUp">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                <Info size={28} className="animate-bounce" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black text-amber-800 tracking-wider uppercase block">Duplicate Check</span>
                <h3 className="text-base font-black text-neutral-900 leading-tight">
                  ⚠️ 檢測到大庫已存在相同或極相近之材料名稱！
                </h3>
                <p className="text-xs text-neutral-500">
                  您準備新增：<strong className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-xs font-mono">
                    {pendingMaterialToAdd.name}
                  </strong>（分類：{pendingMaterialToAdd.category}）
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-2xl border border-neutral-200/65 p-4.5 space-y-3">
              <span className="block text-[11px] font-extrabold text-neutral-700">
                📋 目前大庫中與之相同或高度相似的耗材清單如下：
              </span>
              <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1.5 division-y division-neutral-100">
                {dupConflictMaterials.map((m, i) => (
                  <div key={m.id} className="flex justify-between items-center text-xs py-1.5 first:pt-0 last:pb-0">
                    <div className="space-y-0.5 text-left">
                      <span className="font-bold text-neutral-800">
                        {i + 1}. 📦 {m.name}
                      </span>
                      <span className="block text-[10px] text-neutral-400 font-mono">
                        種類：{m.category || '未分類'} 
                        {m.unitOptions && m.unitOptions.length > 0 ? ` • 單位: ${m.unitOptions.map(uo => uo.unit).join('/')}` : ''}
                      </span>
                    </div>
                    {m.name.toLowerCase().trim() === pendingMaterialToAdd.name.toLowerCase().trim() && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-800 font-black text-[9px] rounded-md border border-red-200/40">
                        完全相同
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-neutral-500 leading-relaxed bg-amber-50/40 border border-amber-200/30 rounded-xl p-3 text-left">
              💡 <strong>提示：</strong> 為了維護「施工耗料規格大庫」的資料整潔，建議您可直接在下方現有耗材卡內<strong>點擊「新增其他規格單位 / 店家配合報價」</strong>即可，無需重複建立多個相同的新品項。
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelAddMaterial}
                className="flex-1 order-2 sm:order-1 px-5 py-3 border border-neutral-250 bg-white hover:bg-neutral-50 text-neutral-700 font-black text-xs rounded-xl shadow-3xs cursor-pointer select-none transition-all duration-150 focus:ring-1 focus:ring-neutral-205"
              >
                取消建立 (返回檢查)
              </button>
              <button
                type="button"
                onClick={handleProceedAddMaterial}
                className="flex-1 order-1 sm:order-2 px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer select-none transition-all duration-150 flex items-center justify-center gap-1.5"
              >
                <span>忽略警告，仍要建立</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
