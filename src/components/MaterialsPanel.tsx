import React, { useState, useEffect } from 'react';
import { MaterialPreset, Supplier, MaterialUnitOption, MaterialSupplier } from '../types';
import { Plus, Trash2, Edit, ShoppingBag, Info, ShieldCheck, ChevronDown, ChevronUp, Scale, Settings, Check, X } from 'lucide-react';
import { calculateMaterialListPrice, getCategoryMaterialConfigs, saveCategoryMaterialConfigs } from '../utils/billingUtils';

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
      suppliers: [],
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
  };

  const handleSaveEditMat = () => {
    if (!editMatName.trim()) return;
    setMaterials(materials.map(m => {
      if (m.id === editingMatId) {
        return {
          ...m,
          name: editMatName.trim(),
          category: editMatCategory
        };
      }
      return m;
    }));
    setEditingMatId(null);
    onSaveToast('✅ 材料名稱與分類更新成功！');
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
                updatedRecord.listPrice = calculateMaterialListPrice(m.category, numericVal);
              }
              
              if (updatedRecord.listPrice === 0 && updatedRecord.costPrice === 0) {
                updatedSuppliers = updatedSuppliers.filter((_, idx) => idx !== existingIndex);
              } else {
                updatedSuppliers[existingIndex] = updatedRecord;
              }
            } else if (numericVal > 0) {
              const initialListPrice = field === 'costPrice' ? calculateMaterialListPrice(m.category, numericVal) : (field === 'listPrice' ? numericVal : 0);
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
    <div id="materials-panel" className="bg-white p-6 rounded-2xl border-2 border-neutral-300 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-neutral-200">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider font-extrabold text-amber-700 block font-mono">Materials Preset Stock</span>
          <h2 className="text-lg font-black text-neutral-950 flex items-center gap-2">
            <ShoppingBag className="text-amber-700 animate-pulse stroke-[2.5]" size={24} />
            施工耗料規格大庫
          </h2>
        </div>
      </div>

      {/* Add new material preset main item form */}
      <div className="bg-neutral-50 p-5 border-2 border-neutral-250 rounded-xl">
        <div className="mb-3">
          <h3 className="text-sm font-black text-neutral-950 block text-amber-950">➕ 建立新材料品項至大庫</h3>
          <p className="text-xs text-neutral-600 mt-1 font-bold">
            建立後，可於下方材料卡內直接點擊「新增其他規格單位」，為同一個材料增設不同的計量單位裝箱。
          </p>
        </div>
        <form onSubmit={handleAddMaterial} className="grid grid-cols-12 gap-3 mt-1.5">
          <div className="col-span-12 sm:col-span-7">
            <label className="block text-[10px] text-neutral-500 font-bold mb-1">材料品項名稱</label>
            <input
              id="material-add-name"
              type="text"
              value={newMatName}
              onChange={(e) => setNewMatName(e.target.value)}
              placeholder="例如: PVC 水管、插座開關、冷熱水龍頭"
              className="w-full px-2.5 py-2 border border-neutral-200 bg-white rounded-lg text-xs text-neutral-800 font-medium"
              required
            />
          </div>
          <div className="col-span-12 sm:col-span-5">
            <label className="block text-[10px] text-neutral-500 font-bold mb-1">品項分類</label>
            <select
              value={newMatCategory}
              onChange={(e) => setNewMatCategory(e.target.value)}
              className="w-full px-2.5 py-2 border border-neutral-200 bg-white rounded-lg text-xs text-neutral-800 font-bold"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>📦 {cat}</option>
              ))}
            </select>
          </div>
          <div className="col-span-12 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              建立材料品項
            </button>
          </div>
        </form>
      </div>

      {/* Search & Filters Container */}
      <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-b border-neutral-200 pb-3">
          <div className="md:col-span-4 text-xs font-bold text-neutral-700 flex items-center gap-1.5">
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
                className="w-full pl-8 pr-12 py-1.5 border border-amber-200/80 bg-white rounded-xl text-xs text-neutral-800 placeholder-neutral-400 focus:ring-1 focus:ring-amber-500 font-bold"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs select-none pointer-events-none">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-450 hover:text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-1.5 py-0.5 rounded font-black cursor-pointer"
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
              <label className="block text-[10px] text-neutral-500 font-extrabold font-sans">📂 依材料大類篩選</label>
              <button
                type="button"
                onClick={() => setShowConfigCategories(!showConfigCategories)}
                className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 px-2 py-0.5 rounded font-black flex items-center gap-1 transition cursor-pointer"
              >
                <Settings size={11} className="text-amber-600 shrink-0 animate-spin-slow" />
                <span>⚙️ 自主配置/改名與排序大類</span>
              </button>
            </div>

            {/* Config categories inline form */}
            {showConfigCategories && (
              <div className="bg-white border text-[11px] border-neutral-200 p-3 rounded-lg space-y-2.5 animate-slideDown shadow-xs">
                <div className="font-extrabold text-neutral-700 pb-1 border-b border-neutral-100 flex items-center justify-between">
                  <span>🛠️ 材料大類設定庫 (可使用箭頭微調前後排序)</span>
                  <button 
                    type="button"
                    onClick={() => setShowConfigCategories(false)}
                    className="p-0.5 hover:bg-neutral-100 rounded"
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
                    className="w-full px-2 py-1 text-xs border rounded bg-neutral-50"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-neutral-800 text-white rounded font-bold hover:bg-neutral-900 text-xs shrink-0"
                  >
                    ➕ 新增
                  </button>
                </form>

                {/* Categories items config lists */}
                <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-neutral-50">
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
                              className="px-1 py-0.5 border text-xs text-neutral-800 rounded bg-white w-full font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRenameCategory(cat)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingCategoryOld(null)}
                              className="p-1 text-neutral-400 hover:bg-neutral-50 rounded"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col flex-1 text-left min-w-0 pr-1.5">
                              <span className="font-extrabold text-neutral-805 text-[11px] truncate flex-1 leading-none">
                                {idx + 1}. 📦 {cat}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-neutral-400 font-bold">加成倍率:</span>
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
                                  className="w-11 px-1 py-0.2 border border-neutral-200 rounded text-[10px] font-mono text-center bg-amber-50/40 text-amber-950 font-extrabold focus:outline-none focus:border-amber-500"
                                />
                                <span className="text-[9.5px] text-neutral-400">(如: 1.10)</span>
                              </div>
                            </div>
                            {deleteConfirmCategory === cat ? (
                              <div className="flex items-center gap-1 bg-red-50 px-1.5 py-0.5 border border-red-250 rounded animate-fadeIn shrink-0">
                                <span className="text-[10px] font-bold text-red-900">確定刪除？</span>
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
                                  className="px-1.5 py-0.5 bg-neutral-200 text-neutral-600 rounded font-bold hover:bg-neutral-300"
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
                                  className={`p-0.5 text-neutral-500 hover:text-amber-600 hover:bg-neutral-50 rounded transition ${idx === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
                                  title="將此大類向上移"
                                >
                                  <ChevronUp size={13} />
                                </button>
                                {/* 向下排列按鈕 */}
                                <button
                                  type="button"
                                  disabled={idx === categories.length - 1}
                                  onClick={() => handleMoveCategory(idx, 'down')}
                                  className={`p-0.5 text-neutral-500 hover:text-amber-600 hover:bg-neutral-50 rounded transition ${idx === categories.length - 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
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
                                  className="p-1 hover:text-amber-600 hover:bg-neutral-50 rounded transition shrink-0 cursor-pointer"
                                  title="更名"
                                >
                                  <Edit size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmCategory(cat)}
                                  className="p-1 hover:text-red-600 hover:bg-rose-55 rounded transition shrink-0 cursor-pointer"
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
                        ? 'bg-amber-600 text-white shadow-3xs'
                        : 'bg-white hover:bg-neutral-200 border border-neutral-200 text-neutral-600'
                    }`}
                  >
                    {emoji}
                    {cat === '全部' ? '全部種類' : cat.replace('類', '')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Supplier Filter */}
          <div className="space-y-1.5">
            <label className="block text-[10px] text-neutral-500 font-extrabold">🏬 依特約材料行報價篩選 (精確比對有登錄該行對照報價的耗材)</label>
            <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSettingsMatSupplierFilter('全部')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  settingsMatSupplierFilter === '全部'
                    ? 'bg-amber-600 text-white shadow-3xs'
                    : 'bg-white hover:bg-neutral-200 border border-neutral-200 text-neutral-600'
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
                      ? 'bg-amber-600 text-white shadow-3xs'
                      : 'bg-white hover:bg-neutral-200 border border-neutral-200 text-neutral-600'
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
                  <div key={m.id} className="p-5 bg-neutral-50/40 hover:bg-neutral-50/70 border border-neutral-200 rounded-2xl space-y-4 transition">
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 w-full bg-white p-4 border border-neutral-200 rounded-xl">
                        <div className="sm:col-span-7">
                          <label className="block text-[9px] text-neutral-400 mb-0.5">品項名稱 (不含單位)</label>
                          <input
                            type="text"
                            value={editMatName}
                            onChange={(e) => setEditMatName(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-bold"
                            required
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <label className="block text-[9px] text-neutral-400 mb-0.5">品項分類</label>
                          <select
                            value={editMatCategory}
                            onChange={(e) => setEditMatCategory(e.target.value)}
                            className="w-full px-2 py-1.5 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-bold"
                          >
                            {categories.map(cat => (
                              <option key={cat} value={cat}>📦 {cat}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-1 justify-end items-end sm:col-span-12 border-t pt-2 border-neutral-150 mt-1">
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-extrabold text-neutral-800 text-sm sm:text-base">{m.name}</h4>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-neutral-100 border border-neutral-200 text-neutral-600 font-mono">
                                {m.category === '電路電材類' && '⚡ '}
                                {m.category === '水路管材類' && '💧 '}
                                {m.category === '廚衛設備類' && '🛁 '}
                                {m.category === '五金緊固類' && '🔩 '}
                                {m.category === '工具與雜耗' && '🛠️ '}
                                {m.category || '水路管材類'}
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-400">目前設有 {options.length} 個單位計價對照規格</p>
                          </div>

                          <div className="flex items-center gap-1.5 font-mono">
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
                              <div key={uo.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs space-y-3">
                                {/* Option Header */}
                                <div className="flex items-center justify-between border-b border-neutral-100 pb-2 flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    <span className="font-sans font-black text-xs text-neutral-700 flex items-center gap-1">
                                      規格單位：
                                      <input
                                        type="text"
                                        value={uo.unit}
                                        onChange={(e) => handleUpdateUnitString(m.id, uo.id, e.target.value)}
                                        className="font-black text-amber-700 border-b border-dashed border-amber-300 bg-transparent px-1 w-12 text-center text-xs focus:ring-0 focus:border-amber-500"
                                        title="可直接點擊進行單位名稱重改"
                                      />
                                    </span>
                                    {idx === 0 && (
                                      <span className="text-[9px] bg-neutral-100 text-neutral-500 font-bold px-1.5 py-0.5 rounded">
                                        預設規格
                                      </span>
                                    )}

                                    {/* 單位順序調整 */}
                                    <div className="flex items-center gap-1 bg-neutral-50 px-1 py-0.5 rounded border border-neutral-200">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveUnitOption(m.id, idx, 'up')}
                                        className={`p-1 rounded hover:bg-neutral-200 transition-colors ${idx === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer text-neutral-500 hover:text-neutral-800'}`}
                                        title="單位向上移動"
                                      >
                                        <ChevronUp size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === options.length - 1}
                                        onClick={() => handleMoveUnitOption(m.id, idx, 'down')}
                                        className={`p-1 rounded hover:bg-neutral-200 transition-colors ${idx === options.length - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer text-neutral-500 hover:text-neutral-800'}`}
                                        title="單位向下移動"
                                      >
                                        <ChevronDown size={11} />
                                      </button>
                                    </div>
                                    {idx > 0 && (
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-amber-50/70 p-2 rounded-xl border border-amber-200/85 shadow-3xs flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Scale size={11} className="text-amber-600" />
                                          <span className="text-[11px] text-amber-800 font-black">
                                            單位換算：
                                          </span>
                                          <label className="flex items-center gap-1 bg-amber-100/70 hover:bg-amber-100 transition px-2 py-0.5 rounded border border-amber-300 text-[10px] font-black cursor-pointer text-amber-950 select-none shadow-3xs" title="勾選開啟後，此規格單位的牌價與進價將依以下比例自動自動自基準單位折合換算。若不勾選，則為獨立計價規格，可直接手動輸入不同報價。">
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
                                            <div className="flex items-center gap-1 text-[10px] bg-white border border-neutral-205 rounded px-1.5 py-0.5 shadow-3xs">
                                              <span className="text-neutral-500 font-bold">對照：</span>
                                              <select
                                                value={uo.targetUnitOptionId || options[0]?.id || ''}
                                                onChange={(e) => handleUpdateUnitTargetOptionId(m.id, uo.id, e.target.value)}
                                                className="border-none bg-transparent py-0 pl-1 pr-4 text-[10px] font-black text-amber-950 focus:ring-0 focus:outline-none cursor-pointer"
                                              >
                                                {options.map(o => (
                                                  <option key={o.id} value={o.id} disabled={o.id === uo.id}>
                                                    {o.unit || '未具名'} {o.id === uo.id ? '(本單位)' : ''}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => handleUpdateUnitConversionInverse(m.id, uo.id, !uo.conversionInverse)}
                                            className="flex items-center gap-1 bg-white hover:bg-neutral-100 transition px-1.5 py-0.5 rounded border border-neutral-200 text-[9px] sm:text-[10px] text-neutral-600 font-bold cursor-pointer select-none"
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
                                                  className="w-12 text-center text-[10px] py-0.5 font-bold text-amber-900 border border-neutral-250 bg-white rounded focus:ring-1 focus:ring-amber-500"
                                                  title="設定多少個此副單位能折合為 1 個對照單位。例如 100米 = 1捆，則此處填 100"
                                                />
                                                <span className="text-neutral-700 font-black">{uo.unit} = 1 {targetUnitName}</span>
                                              </>
                                            ) : (
                                              <>
                                                <span className="text-neutral-700 font-black">1 {uo.unit} =</span>
                                                <input
                                                  type="number"
                                                  min="0.001"
                                                  step="any"
                                                  value={uo.conversionFactor ?? 1}
                                                  onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    handleUpdateUnitConversionFactor(m.id, uo.id, isNaN(val) ? 1 : val);
                                                  }}
                                                  className="w-12 text-center text-[10px] py-0.5 font-bold text-amber-900 border border-neutral-250 bg-white rounded focus:ring-1 focus:ring-amber-500"
                                                  title="設定 1 個此副單位能折合多少個對照單位。例如 1捆 = 100米，則此處填 100"
                                                />
                                                <span className="text-neutral-600 font-black">
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
                                            className={`w-14 text-center border font-bold rounded text-[11px] py-0.5 px-1 font-mono ${
                                              (hasActiveSuppliers || uo.useConversionPricing)
                                                ? 'bg-amber-50/50 text-amber-900 border-amber-250/30 cursor-not-allowed' 
                                                : 'bg-white text-neutral-900 border-neutral-300 hover:border-neutral-400'
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
                                            className={`w-14 text-center border font-bold rounded text-[11px] py-0.5 px-1 font-mono ${
                                              (hasActiveSuppliers || uo.useConversionPricing)
                                                ? 'bg-amber-50/50 text-amber-900 border-amber-250/30 cursor-not-allowed' 
                                                : 'bg-white text-amber-900 border-neutral-300 hover:border-neutral-400 bg-amber-50/10'
                                            }`}
                                            title={uo.useConversionPricing ? '此進法由單位換算比與基準進價自動乘算鎖定。取消勾選「自動換算計價」解鎖手動輸入。' : ''}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {uo.useConversionPricing ? (
                                      <span className="text-[9px] bg-amber-100 text-amber-950 font-black px-1.5 py-0.5 rounded border border-amber-300 hidden md:inline-block">
                                        ⚡ 換算鎖定
                                      </span>
                                    ) : hasActiveSuppliers ? (
                                      <span className="text-[9px] bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-200 hidden md:inline-block">
                                        📈 已採特約最高值
                                      </span>
                                    ) : null}

                                    {options.length > 1 && (
                                      <div className="flex items-center gap-1 border-r border-neutral-200 pr-2 mr-1">
                                        {/* 規格單位向上排列按鈕 */}
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleMoveUnitOption(m.id, idx, 'up')}
                                          className={`p-1 text-neutral-500 hover:text-amber-600 hover:bg-neutral-50 rounded transition ${idx === 0 ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}`}
                                          title="向上調整此單位的排列順序"
                                        >
                                          <ChevronUp size={13} />
                                        </button>
                                        {/* 規格單位向下排列按鈕 */}
                                        <button
                                          type="button"
                                          disabled={idx === options.length - 1}
                                          onClick={() => handleMoveUnitOption(m.id, idx, 'down')}
                                          className={`p-1 text-neutral-500 hover:text-amber-600 hover:bg-neutral-50 rounded transition ${idx === options.length - 1 ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'}`}
                                          title="向下調整此單位的排列順序"
                                        >
                                          <ChevronDown size={13} />
                                        </button>
                                      </div>
                                    )}

                                    {options.length > 1 && (
                                      deleteConfirmUnitId === uo.id ? (
                                        <div className="flex items-center gap-1.5 bg-rose-50 px-2 py-1 border border-rose-200 rounded-lg animate-fadeIn shrink-0">
                                          <span className="text-[10px] font-extrabold text-rose-900">確認刪除規格與報價？</span>
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
                                            className="px-2 py-0.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-600 text-[10px] font-bold rounded cursor-pointer transition-all"
                                          >
                                            取消
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setDeleteConfirmUnitId(uo.id)}
                                          className="p-1 px-2.5 py-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 border border-neutral-200 hover:border-red-200 rounded-lg transition-all flex items-center gap-1 cursor-pointer text-[10px]"
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
                                <div className="space-y-1.5 border-t border-neutral-150 pt-3 mt-2">
                                  {(() => {
                                    const isSupExpanded = expandedSuppliers[uo.id] || false;
                                    return (
                                      <>
                                        <div className="flex items-center justify-between">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedSuppliers(prev => ({ ...prev, [uo.id]: !isSupExpanded }))}
                                            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-extrabold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-pointer transition-all shadow-3xs"
                                            title="點擊展開或摺疊特約材料行的報價輸入格"
                                          >
                                            <span>🏬 特約材料行合約對照價</span>
                                            <span className="text-[9px] px-1.5 py-0.2 bg-white text-amber-900 border border-amber-350/30 rounded-full font-mono">
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
                                              <p className="text-[10px] text-neutral-400 py-1.5 italic leading-relaxed pl-2 bg-neutral-50 rounded">
                                                💡 提示：您尚未在系統建置任何「特約材料行」。如需對照不同店家的合約報價，請先利用右上角名冊功能建立材料行。
                                              </p>
                                            ) : (
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-neutral-50/40 p-2.5 rounded-xl border border-neutral-150-dot border-dashed">
                                                {activeSuppliers.map(s => {
                                                  const record = uo.suppliers?.find(sup => sup.storeName === s.name);
                                                  const listPrice = record ? record.listPrice : '';
                                                  const costPrice = record ? record.costPrice : '';

                                                  return (
                                                    <div key={s.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-neutral-200 shadow-3xs hover:border-amber-250 transition-all">
                                                      <div className="min-w-0 flex-1 pr-2">
                                                        <span className="text-[11px] font-bold text-neutral-700 block truncate" title={s.name}>
                                                          🏬 {s.name}
                                                        </span>
                                                      </div>

                                                      <div className="flex items-center gap-2 flex-shrink-0 text-xs font-mono">
                                                        <div className="flex items-center gap-0.5">
                                                          <span className="text-[9px] text-neutral-400 font-sans">牌價</span>
                                                          <div className="flex items-center gap-0.5 bg-neutral-50 px-1 border border-neutral-200 rounded">
                                                            <span className="text-[10px] text-neutral-500 font-bold">$</span>
                                                            <input
                                                              type="number"
                                                              disabled={uo.useConversionPricing}
                                                              placeholder={uo.useConversionPricing ? "自動" : "未設定"}
                                                              value={listPrice}
                                                              onChange={(e) => {
                                                                const val = parseInt(e.target.value, 10);
                                                                handleUpdateSupplierPriceForUnit(m.id, uo.id, s.name, 'listPrice', isNaN(val) ? 0 : val);
                                                              }}
                                                              className={`w-12 text-center text-[11px] py-0.5 border-none font-bold text-neutral-800 bg-transparent focus:outline-none ${uo.useConversionPricing ? 'text-amber-900/60 cursor-not-allowed font-medium' : ''}`}
                                                              title={uo.useConversionPricing ? '此特約行報價已依單位比例由基準特約價自動算出。若需手動覆寫獨立計費，請取消勾選「自動換算計價」解鎖。' : ''}
                                                            />
                                                          </div>
                                                        </div>

                                                        <div className="flex items-center gap-0.5">
                                                          <span className="text-[9px] text-neutral-400 font-sans">成本</span>
                                                          <div className="flex items-center gap-0.5 bg-amber-50/40 px-1 border border-amber-200 rounded">
                                                            <span className="text-[10px] text-amber-700 font-bold">$</span>
                                                            <input
                                                              type="number"
                                                              disabled={uo.useConversionPricing}
                                                              placeholder={uo.useConversionPricing ? "自動" : "未設定"}
                                                              value={costPrice}
                                                              onChange={(e) => {
                                                                const val = parseInt(e.target.value, 10);
                                                                handleUpdateSupplierPriceForUnit(m.id, uo.id, s.name, 'costPrice', isNaN(val) ? 0 : val);
                                                              }}
                                                              className={`w-12 text-center text-[11px] py-0.5 border-none font-black text-amber-950 bg-transparent focus:outline-none ${uo.useConversionPricing ? 'text-amber-900/60 cursor-not-allowed font-medium' : ''}`}
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
                        <div className="bg-neutral-100/60 p-3 rounded-xl border border-neutral-200/80 flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-[10px] font-bold text-neutral-500">
                            📏 需要此品項支援其他包裝/規格單位嗎？ (例如一綑或一箱，可在此直接開立新單位獨立計售)
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              placeholder="例如: 支、米、桶"
                              value={newUnitStr[m.id] || ''}
                              onChange={(e) => setNewUnitStr(prev => ({ ...prev, [m.id]: e.target.value }))}
                              maxLength={6}
                              className="px-2.5 py-1.5 border border-neutral-250 bg-white rounded-lg text-xs w-28 text-center font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddUnitOption(m.id)}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
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
