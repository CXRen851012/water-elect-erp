import React, { useState, useEffect } from 'react';
import { Project, Worker, MaterialPreset, MaterialUnitOption, DailyRecord, RecordMaterial, RecordExpense, RecordWorker, Supplier } from '../types';
import { 
  Plus, Trash2, Calendar, ClipboardList, HardHat, 
  FileText, ShoppingCart, DollarSign, Wrench, PlusCircle, AlertCircle, Sparkles, Check, Scale,
  ShieldCheck, Lock, Unlock, Settings, Search, X
} from 'lucide-react';

interface RecordFormProps {
  projects: Project[];
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>;
  onSaveToast?: (msg: string) => void;
  workersPreset: Worker[];
  materialsPreset: MaterialPreset[];
  suppliersPreset: Supplier[];
  onSaveRecord: (record: Omit<DailyRecord, 'id' | 'createdAt'>) => void;
  onOpenNewProjectModal: () => void;
  initialRecordToEdit?: DailyRecord;
  initialProjectId?: string;
  onCancel: () => void;
  setMaterialsPreset?: React.Dispatch<React.SetStateAction<MaterialPreset[]>>;
  records?: DailyRecord[];
}

const DEFAULT_SUBCATEGORIES: Record<string, string[]> = {
  '電路電材類': ['開關面板', '插座插頭', 'PVC電線捲', '斷路器開關', '燈具照明', '明盒與暗盒', '絕緣膠帶/端子', '電線配管架/線槽'],
  '水路管材類': ['PVC水管及配件', '不銹鋼壓接管件', '高壓軟管/三角凡而', '生膠帶膠水', '排水防臭配件', '止水閥活接頭'],
  '廚衛設備類': ['臉盆龍頭', '淋浴套件組合', '馬桶及配件', '抽風機/排風馬達', '落水頭/落水管', '廚房冷熱龍頭', '熱水器管件配件'],
  '五金緊固類': ['膨脹螺栓/壁虎', '自攻螺絲釘', '不銹鋼管卡支架', '矽利康膠/槍', '防水防霉填縫劑', '免釘膠/萬能膠'],
  '工具與雜耗': ['鑽頭與鑽置螺絲', '安全防護帽面罩', '砂輪切割片', '絕緣工具手套', '清潔刷與抹布', '垃圾袋保鮮膜', '潤滑油防銹劑']
};

export default function RecordForm({
  projects,
  setProjects,
  onSaveToast,
  workersPreset,
  materialsPreset,
  suppliersPreset,
  onSaveRecord,
  onOpenNewProjectModal,
  initialRecordToEdit,
  initialProjectId,
  onCancel,
  setMaterialsPreset,
  records = []
}: RecordFormProps) {
  const activeSuppliersPreset = (suppliersPreset || []).filter(s => s.showInMaterialsDatabase !== false);

  // Load custom categories for sorting and filter lists
  const categoriesList = React.useMemo(() => {
    let customCategories: string[] = ['電路電材類', '水路管材類', '廚衛設備類', '五金緊固類', '工具與雜耗'];
    try {
      const stored = localStorage.getItem('engineering_material_categories');
      if (stored) {
        customCategories = JSON.parse(stored);
      }
    } catch (e) {
      // fallback
    }
    if (materialsPreset && Array.isArray(materialsPreset)) {
      materialsPreset.forEach(m => {
        if (m.category && !customCategories.includes(m.category)) {
          customCategories.push(m.category);
        }
      });
    }
    return ['全部', ...customCategories];
  }, [materialsPreset]);

  // Sort materialsPreset by Category order, then by Name ascending (localeCompare zh-TW)
  const subcategoriesConfig = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('engineering_material_subcategories');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return DEFAULT_SUBCATEGORIES;
  }, []);

  const sortedMaterialsPreset = React.useMemo(() => {
    return [...(materialsPreset || [])].sort((a, b) => {
      const catA = a.category || '水路管材類';
      const catB = b.category || '水路管材類';
      
      const cats = categoriesList.filter(c => c !== '全部');
      let idxA = cats.indexOf(catA);
      let idxB = cats.indexOf(catB);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;

      if (idxA !== idxB) {
        return idxA - idxB;
      }
      return a.name.localeCompare(b.name, 'zh-TW');
    });
  }, [materialsPreset, categoriesList]);

  // 1. Basic properties
  const [date, setDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [projectSearch, setProjectSearch] = useState<string>('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState<boolean>(false);
  const projectDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [showCompletedInSelect, setShowCompletedInSelect] = useState<boolean>(false);
  const [prevProjIds, setPrevProjIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [markAsCompleted, setMarkAsCompleted] = useState<boolean>(false);
  const [collectedAmount, setCollectedAmount] = useState<number>(0);
  const [internalCostOnly, setInternalCostOnly] = useState<boolean>(false);

  // 2. Materials log (No visible prices inside logger!)
  const [materials, setMaterials] = useState<RecordMaterial[]>([]);
  const [overridePricingMode, setOverridePricingMode] = useState<boolean>(false);
  const [confirmWriteRowId, setConfirmWriteRowId] = useState<string | null>(null);
  const [selectedAddCategory, setSelectedAddCategory] = useState<string>('全部');
  const [selectedAddSubcategory, setSelectedAddSubcategory] = useState<string>('全部');
  const [selectedAddSupplier, setSelectedAddSupplier] = useState<string>('全部');
  const [addSearchQuery, setAddSearchQuery] = useState<string>('');
  const [isSubcategoryCollapsed, setIsSubcategoryCollapsed] = useState<boolean>(false);
  const [isQuickAddCollapsed, setIsQuickAddCollapsed] = useState<boolean>(false);

  useEffect(() => {
    setSelectedAddSubcategory('全部');
  }, [selectedAddCategory]);

  // 3. Common Expenses directly loaded in UI blocks, plus optional blanks
  const [mealAmount, setMealAmount] = useState<number>(0);
  const [mealDesc, setMealDesc] = useState<string>('');
  const [parkingAmount, setParkingAmount] = useState<number>(0);
  const [parkingDesc, setParkingDesc] = useState<string>('');

  // General Non-project expenses:
  const [generalMealAmount, setGeneralMealAmount] = useState<number>(0);
  const [generalMealDesc, setGeneralMealDesc] = useState<string>('');
  const [generalParkingAmount, setGeneralParkingAmount] = useState<number>(0);
  const [generalParkingDesc, setGeneralParkingDesc] = useState<string>('');
  
  // Customizable blank expense items
  const [customExpenses, setCustomExpenses] = useState<RecordExpense[]>([]);

  const [vehicleNames] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('engineering_vehicle_names');
    return saved ? JSON.parse(saved) : {
      'A車': 'A車備用金',
      'B車': 'B車備用金',
      'C車': 'C車備用金'
    };
  });

  // 4. Labor crew logs (Hides hourly wages and costs totally inside form)
  const [workers, setWorkers] = useState<RecordWorker[]>([]);

  // Filter projects categories
  const activeProjects = projects.filter(p => !p.isCompleted);
  const completedProjects = projects.filter(p => p.isCompleted);

  const filteredActiveProjects = React.useMemo(() => {
    const q = projectSearch.toLowerCase().trim();
    if (!q) return activeProjects;
    return activeProjects.filter(p => {
      const disp = getProjectDisplayName(p).toLowerCase();
      const num = (p.serialNumber || '').toLowerCase();
      const addr = (p.fullAddress || '').toLowerCase();
      const note = (p.projectNotes || '').toLowerCase();
      return disp.includes(q) || num.includes(q) || addr.includes(q) || note.includes(q);
    });
  }, [activeProjects, projectSearch]);

  const filteredCompletedProjects = React.useMemo(() => {
    const q = projectSearch.toLowerCase().trim();
    const list = completedProjects.filter(p => showCompletedInSelect || p.id === selectedProjectId);
    if (!q) return list;
    return list.filter(p => {
      const disp = getProjectDisplayName(p).toLowerCase();
      const num = (p.serialNumber || '').toLowerCase();
      const addr = (p.fullAddress || '').toLowerCase();
      const note = (p.projectNotes || '').toLowerCase();
      return disp.includes(q) || num.includes(q) || addr.includes(q) || note.includes(q);
    });
  }, [completedProjects, showCompletedInSelect, selectedProjectId, projectSearch]);

  // Helper checks to determine if a row is completely empty/unfilled (placeholder)
  const isMaterialRowEmpty = (m: RecordMaterial) => {
    return !m.materialId && (!m.name || m.name.trim() === '');
  };

  const isWorkerRowEmpty = (w: RecordWorker) => {
    return (!w.workerId || w.workerId === '') && (!w.name || w.name.trim() === '');
  };

  const isExpenseRowEmpty = (e: RecordExpense) => {
    return (!e.amount || e.amount === 0) && (!e.description || e.description.trim() === '');
  };

  // 智慧自動延展：確保至少有一個空白材料列供使用者點選/輸入
  useEffect(() => {
    const hasEmpty = materials.some(isMaterialRowEmpty);
    if (!hasEmpty) {
      const item: RecordMaterial = {
        id: `mat-placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        materialId: undefined,
        name: '',
        quantity: 1,
        unit: '個',
        unitPrice: 0,
        costPrice: 0,
        isNearbyPurchased: true
      };
      setMaterials(prev => [...prev, item]);
    }
  }, [materials]);

  // 智慧自動延展：確保至少有一個空白派工列供使用者點選/輸入
  useEffect(() => {
    const hasEmpty = workers.some(isWorkerRowEmpty);
    if (!hasEmpty) {
      const item: RecordWorker = {
        id: `crew-placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        workerId: undefined,
        name: '',
        hoursWork: 8,
        hourlyRate: 250,
        billingHourlyRate: 250,
        isSupport: true
      };
      setWorkers(prev => [...prev, item]);
    }
  }, [workers]);

  // 智慧自動延展：確保案場內開銷與非案場營運各至少有一個空白列供使用者點選/輸入
  useEffect(() => {
    setCustomExpenses(prev => {
      const projectExpenses = prev.filter(e => e.isProjectExpense !== false);
      const companyExpenses = prev.filter(e => e.isProjectExpense === false);

      const hasEmptyProject = projectExpenses.some(isExpenseRowEmpty);
      const hasEmptyCompany = companyExpenses.some(isExpenseRowEmpty);

      if (hasEmptyProject && hasEmptyCompany) {
        return prev;
      }

      let updated = false;
      const newCustomExpenses = [...prev];

      if (!hasEmptyProject) {
        newCustomExpenses.push({
          id: `exp-project-placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'other',
          description: '',
          amount: 0,
          isProjectExpense: true
        });
        updated = true;
      }

      if (!hasEmptyCompany) {
        newCustomExpenses.push({
          id: `exp-company-placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'other',
          description: '',
          amount: 0,
          isProjectExpense: false
        });
        updated = true;
      }

      return updated ? newCustomExpenses : prev;
    });
  }, [customExpenses]);

  // Compute Project Context & History stats for "案場脈絡關聯"
  const projectStats = React.useMemo(() => {
    if (!selectedProjectId || !records || records.length === 0) return null;

    const projRecords = records.filter(r => r.projectId === selectedProjectId);
    
    // 1. Accumulated costs
    let totalMaterialsCost = 0;
    let totalLaborCost = 0;
    let totalExpenses = 0;

    projRecords.forEach(r => {
      // Materials cost
      (r.materials || []).forEach(m => {
        const qty = m.quantity || 0;
        const cost = m.costPrice !== undefined ? m.costPrice : (m.unitPrice || 0);
        totalMaterialsCost += qty * cost;
      });

      // Labor cost
      (r.workers || []).forEach(w => {
        const hours = w.hoursWork || 0;
        const rate = w.hourlyRate || 0;
        totalLaborCost += hours * rate;
      });

      // Expenses
      (r.expenses || []).forEach(e => {
        if (e.isProjectExpense !== false) {
          totalExpenses += e.amount || 0;
        }
      });
    });

    const totalCost = totalMaterialsCost + totalLaborCost + totalExpenses;

    // 2. Most frequent workers in this project
    const workerCounts: Record<string, { name: string; count: number; presetWorker?: Worker }> = {};
    projRecords.forEach(r => {
      (r.workers || []).forEach(w => {
        if (w.workerId && w.workerId !== 'support_temp') {
          if (!workerCounts[w.workerId]) {
            const pWorker = workersPreset.find(wp => wp.id === w.workerId);
            workerCounts[w.workerId] = { name: w.name, count: 0, presetWorker: pWorker };
          }
          workerCounts[w.workerId].count += 1;
        }
      });
    });

    const frequentWorkers = Object.entries(workerCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    // 3. Most frequent materials in this project
    const materialCounts: Record<string, { name: string; count: number; presetMaterial?: MaterialPreset }> = {};
    projRecords.forEach(r => {
      (r.materials || []).forEach(m => {
        const key = m.materialId || `custom-${m.name}`;
        if (!materialCounts[key]) {
          const pMat = m.materialId ? sortedMaterialsPreset.find(pm => pm.id === m.materialId) : undefined;
          materialCounts[key] = { name: m.name, count: 0, presetMaterial: pMat };
        }
        materialCounts[key].count += m.quantity;
      });
    });

    const frequentMaterials = Object.entries(materialCounts)
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      recordCount: projRecords.length,
      totalMaterialsCost,
      totalLaborCost,
      totalExpenses,
      totalCost,
      frequentWorkers,
      frequentMaterials
    };
  }, [selectedProjectId, records, workersPreset, sortedMaterialsPreset]);

  // 取得特定材料在此案場的歷史累計正耗量 (排除目前編輯的這份日誌，以計算真正的歷史背景)
  const getHistoricalQuantityForMaterial = (m: RecordMaterial) => {
    if (!selectedProjectId || !records || records.length === 0) return 0;
    let total = 0;
    records.forEach(r => {
      // 排除當前編輯的這筆日誌
      if (r.projectId === selectedProjectId && r.id !== initialRecordToEdit?.id) {
        (r.materials || []).forEach(historyMat => {
          const hasSameId = m.materialId && historyMat.materialId === m.materialId;
          const hasSameName = !m.materialId && historyMat.name && m.name && historyMat.name.trim().toLowerCase() === m.name.trim().toLowerCase();
          if (hasSameId || hasSameName) {
            total += historyMat.quantity || 0;
          }
        });
      }
    });
    return total;
  };

  const isInitializedRef = React.useRef<string | null>(null);

  // Initialization & Loading values for Editing or Defaults
  useEffect(() => {
    const currentInitKey = initialRecordToEdit ? initialRecordToEdit.id : 'new';
    if (isInitializedRef.current === currentInitKey) {
      // Avoid resetting any of the user entered logs if we are already initialized
      if (!initialRecordToEdit && activeProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(initialProjectId || activeProjects[0].id);
      }
      return;
    }

    if (initialRecordToEdit) {
      setDate(initialRecordToEdit.date);
      setSelectedProjectId(initialRecordToEdit.projectId);
      setNotes(initialRecordToEdit.notes);
      setMarkAsCompleted(initialRecordToEdit.markAsCompleted);
      setCollectedAmount(initialRecordToEdit.collectedAmount || 0);
      setInternalCostOnly(initialRecordToEdit.internalCostOnly || false);
      
      // Load materials (without caring about pricing display) and assign a unique ID if it doesn't exist
      setMaterials((initialRecordToEdit.materials || []).map((m, idx) => ({
        ...m,
        id: m.id || `mat-loaded-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`
      })));

      // Load all expenses directly into customExpenses
      setCustomExpenses((initialRecordToEdit.expenses || []).map((ex, idx) => ({
        ...ex,
        id: ex.id || `exp-loaded-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        isProjectExpense: ex.isProjectExpense !== false // default to true
      })));

      // Load workers and ensure unique IDs
      setWorkers((initialRecordToEdit.workers || []).map((w, idx) => ({
        ...w,
        id: w.id || `crew-loaded-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`
      })));
    } else {
      // Default initialization
      if (activeProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(initialProjectId || activeProjects[0].id);
      }
      setMealAmount(0);
      setMealDesc('');
      setParkingAmount(0);
      setParkingDesc('');
      setGeneralMealAmount(0);
      setGeneralMealDesc('');
      setGeneralParkingAmount(0);
      setGeneralParkingDesc('');
      setCustomExpenses([]);
      setMaterials([]);
      setWorkers([]);
      setCollectedAmount(0);
      setInternalCostOnly(false);
    }

    isInitializedRef.current = currentInitKey;
  }, [initialRecordToEdit, projects, selectedProjectId, activeProjects]);

  const selectedProjDetails = projects.find(p => p.id === selectedProjectId);

  // Auto-detect newly added project and select it
  useEffect(() => {
    const currentIds = projects.map(p => p.id);
    if (prevProjIds.length > 0 && currentIds.length > prevProjIds.length) {
      // Find the single new project ID
      const newId = currentIds.find(id => !prevProjIds.includes(id));
      if (newId) {
        setSelectedProjectId(newId);
        // Automatically load presets/conversions
        handleProjectSelect(newId);
        if (onSaveToast) {
          onSaveToast(`🎯 偵測到新創立案場！已自動為您在「施工目的」中選定此案場。`);
        }
      }
    }
    setPrevProjIds(currentIds);
  }, [projects]);

  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
    
    const p = projects.find(item => item.id === projId);
    if (!p) return;

    // Handle Completed Project Reversion
    if (p.isCompleted) {
      if (setProjects) {
        setProjects(prev => prev.map(item => {
          if (item.id === p.id) {
            return {
              ...item,
              isCompleted: false,
              estimationStatus: '進行中施工'
            };
          }
          return item;
        }));
        if (onSaveToast) {
          onSaveToast(`🏗️ 案場【${p.companyOrOwner}】原為「已完工結案」！已自動為您重新轉換回「施工進行中案場」狀態並標示！`);
        }
      }
    }
  };

  // Track previous project's estimation state
  const [prevIsEstimation, setPrevIsEstimation] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (selectedProjectId && selectedProjDetails) {
      const isEst = selectedProjDetails.isEstimation || false;
      if (prevIsEstimation !== undefined && prevIsEstimation !== isEst) {
        // According to user request, do NOT clear inputs or attendance when selecting project/changing status
        // setWorkers([]);
      }
      setPrevIsEstimation(isEst);
    }
  }, [selectedProjectId, selectedProjDetails, prevIsEstimation]);

  // 統一專案顯示名稱格式化 (確保不論新舊專案皆符合新標準)
  const getProjectDisplayName = (p: Project): string => {
    let dateFormatted = '';
    if (p.createdAt) {
      dateFormatted = p.createdAt.substring(0, 10).replace(/-/g, '');
    } else {
      dateFormatted = new Date().toISOString().substring(0, 10).replace(/-/g, '');
    }

    let clientPart = p.companyOrOwner.trim();
    const person = (p.contactPerson || '').trim();
    const phone = (p.contactPhone || '').trim();

    if (person && person !== '本人' && person !== p.companyOrOwner.trim()) {
      if (phone) {
        clientPart += `(${person}:${phone})`;
      } else {
        clientPart += `(${person})`;
      }
    } else {
      if (phone) {
        clientPart += `(${phone})`;
      }
    }

    const abbrev = (p.addressAbbreviated || '').trim();
    const addressPart = abbrev ? `(${abbrev})${p.fullAddress.trim()}` : p.fullAddress.trim();

    let serial = p.serialNumber || '001';
    if (serial.includes('-')) {
      const parts = serial.split('-');
      serial = parts[parts.length - 1];
    }
    if (/^\d+$/.test(serial)) {
      serial = serial.padStart(3, '0');
    }

    const baseName = `${dateFormatted}-${clientPart}-${addressPart}-${serial}`;
    if (p.isBooking) {
      return `⏰ [預約待辦] ${baseName}`;
    }
    return (p.isEstimation || p.generatedName?.startsWith('[估]')) ? `[估]${baseName}` : baseName;
  };

  // --- Material Operations ---
  const getUnitAndSupplierPrices = (preset: MaterialPreset, selectedUnit: string, storeName?: string) => {
    const unitOptions = preset.unitOptions || [];
    const matchedOption = unitOptions.find(uo => uo.unit === selectedUnit);
    
    if (matchedOption) {
      if (storeName && storeName !== 'default') {
        const supplierOption = matchedOption.suppliers?.find(s => s.storeName === storeName);
        if (supplierOption) {
          return {
            unitPrice: supplierOption.listPrice,
            costPrice: supplierOption.costPrice
          };
        }
      }
      return {
        unitPrice: matchedOption.defaultUnitPrice,
        costPrice: matchedOption.defaultCostPrice
      };
    }
    
    // Fallback to legacy root preset fields
    if (storeName && storeName !== 'default') {
      const supplier = preset.suppliers?.find(s => s.storeName === storeName);
      if (supplier) {
        return {
          unitPrice: supplier.listPrice,
          costPrice: supplier.costPrice
        };
      }
    }
    return {
      unitPrice: preset.defaultUnitPrice,
      costPrice: preset.defaultCostPrice !== undefined ? preset.defaultCostPrice : preset.defaultUnitPrice
    };
  };

  const handleAddMaterialRow = () => {
    const item: RecordMaterial = {
      id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      materialId: undefined,
      name: '',
      quantity: 1,
      unit: '個',
      unitPrice: 0,
      costPrice: 0,
      isNearbyPurchased: true
    };
    setMaterials([...materials, item]);
  };

  const handleQuickAddPresetMaterial = (preset: MaterialPreset) => {
    const defaultUnit = preset.unit || '個';
    const activeSupplier = selectedAddSupplier === '全部' ? undefined : selectedAddSupplier;
    const prices = getUnitAndSupplierPrices(preset, defaultUnit, activeSupplier);
    
    // 先過濾掉任何空白預設列，避免空白列積壓或卡在中間
    const cleanedMaterials = materials.filter(m => !isMaterialRowEmpty(m));

    const existingIndex = cleanedMaterials.findIndex(
      m => m.materialId === preset.id && 
      !m.isNearbyPurchased && 
      m.unit === defaultUnit && 
      m.storeName === activeSupplier
    );
    if (existingIndex > -1) {
      setMaterials(cleanedMaterials.map((m, idx) => idx === existingIndex ? {
        ...m,
        quantity: m.quantity + 1
      } : m));
    } else {
      const item: RecordMaterial = {
        id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`,
        materialId: preset.id,
        name: preset.name,
        quantity: 1,
        unit: defaultUnit,
        unitPrice: prices.unitPrice,
        costPrice: prices.costPrice,
        isNearbyPurchased: false,
        storeName: activeSupplier,
        isAutoFilled: true
      };
      setMaterials([...cleanedMaterials, item]);
    }
  };

  const handleUpdateMaterialChoice = (rowId: string, presetId: string) => {
    if (presetId === 'custom') {
      setMaterials(prev => prev.map(m => m.id === rowId ? {
        ...m,
        materialId: undefined,
        name: '',
        unit: '個',
        unitPrice: 0,
        costPrice: 0,
        isNearbyPurchased: true // local custom buy implies hand price later
      } : m));
    } else {
      const preset = sortedMaterialsPreset.find(p => p.id === presetId);
      if (preset) {
        const defaultUnit = preset.unit || '個';
        const prices = getUnitAndSupplierPrices(preset, defaultUnit);
        setMaterials(prev => prev.map(m => m.id === rowId ? {
          ...m,
          materialId: preset.id,
          name: preset.name,
          unit: defaultUnit,
          unitPrice: prices.unitPrice,
          costPrice: prices.costPrice,
          isNearbyPurchased: false,
          storeName: undefined,
          isAutoFilled: true
        } : m));
      }
    }
  };

  const handleUpdateMaterialUnitChoiceInRow = (rowId: string, unitStr: string, preset: MaterialPreset) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === rowId) {
        const prices = getUnitAndSupplierPrices(preset, unitStr, m.storeName);
        return {
          ...m,
          unit: unitStr,
          unitPrice: prices.unitPrice,
          costPrice: prices.costPrice,
          isAutoFilled: true
        };
      }
      return m;
    }));
  };

  const handleUpdateMaterialSupplierChoice = (rowId: string, storeName: string, preset: MaterialPreset) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === rowId) {
        const prices = getUnitAndSupplierPrices(preset, m.unit, storeName === 'default' ? undefined : storeName);
        return {
          ...m,
          storeName: storeName === 'default' ? undefined : storeName,
          unitPrice: prices.unitPrice,
          costPrice: prices.costPrice,
          isAutoFilled: true
        };
      }
      return m;
    }));
  };

  const handleWriteBackToPreset = (m: RecordMaterial, preset: MaterialPreset) => {
    if (!setMaterialsPreset || !m.storeName || m.storeName === 'default') return;

    // Helper to ensure unit options exist for the preset
    const ensureLocalUnitOptions = (p: MaterialPreset): MaterialUnitOption[] => {
      if (p.unitOptions && p.unitOptions.length > 0) {
        return p.unitOptions;
      }
      return [
        {
          id: `${p.id}-unit-default`,
          unit: p.unit || '個',
          defaultUnitPrice: p.defaultUnitPrice || 0,
          defaultCostPrice: p.defaultCostPrice || 0,
          suppliers: p.suppliers || []
        }
      ];
    };

    // Helper to apply auto conversion to target options
    const applyLocalAutoConversions = (p: MaterialPreset): MaterialPreset => {
      const uOptions = ensureLocalUnitOptions(p);
      if (uOptions.length <= 1) {
        if (uOptions.length === 1) {
          const primaryUo = uOptions[0];
          return {
            ...p,
            unit: primaryUo.unit,
            defaultUnitPrice: primaryUo.defaultUnitPrice,
            defaultCostPrice: primaryUo.defaultCostPrice,
            suppliers: primaryUo.suppliers
          };
        }
        return p;
      }

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
                id: existing?.id || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`,
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
        ...p,
        unitOptions: updatedOptions,
        unit: primaryUo.unit,
        defaultUnitPrice: primaryUo.defaultUnitPrice,
        defaultCostPrice: primaryUo.defaultCostPrice,
        suppliers: primaryUo.suppliers
      };
    };

    setMaterialsPreset(prevPresets => {
      return prevPresets.map(p => {
        if (p.id !== preset.id) return p;

        const updatedPreset = { ...p };

        // Ensure we always have unitOptions array for consistent updates
        const unitOptions = [...ensureLocalUnitOptions(updatedPreset)];
        const matchedOptionIndex = unitOptions.findIndex(uo => uo.unit === m.unit);

        if (matchedOptionIndex > -1) {
          const targetUnitOption = { ...unitOptions[matchedOptionIndex] };
          const suppliersList = [...(targetUnitOption.suppliers || [])];
          const supIdx = suppliersList.findIndex(s => s.storeName === m.storeName);

          if (supIdx > -1) {
            suppliersList[supIdx] = {
              ...suppliersList[supIdx],
              listPrice: m.unitPrice ?? 0,
              costPrice: m.costPrice ?? 0
            };
          } else {
            suppliersList.push({
              id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`,
              storeName: m.storeName!,
              listPrice: m.unitPrice ?? 0,
              costPrice: m.costPrice ?? 0
            });
          }

          targetUnitOption.suppliers = suppliersList;

          // --- RECALCULATE MAX PRICING FOR THIS UNIT OPTION ---
          const activeSuppliersWithListPrice = suppliersList.filter(s => s.listPrice > 0);
          const activeSuppliersWithCostPrice = suppliersList.filter(s => s.costPrice > 0);

          if (activeSuppliersWithListPrice.length > 0) {
            targetUnitOption.defaultUnitPrice = Math.max(...activeSuppliersWithListPrice.map(s => s.listPrice));
          } else if (m.unitPrice !== undefined) {
            targetUnitOption.defaultUnitPrice = m.unitPrice;
          }

          if (activeSuppliersWithCostPrice.length > 0) {
            targetUnitOption.defaultCostPrice = Math.max(...activeSuppliersWithCostPrice.map(s => s.costPrice));
          } else if (m.costPrice !== undefined) {
            targetUnitOption.defaultCostPrice = m.costPrice;
          }

          unitOptions[matchedOptionIndex] = targetUnitOption;
          updatedPreset.unitOptions = unitOptions;
        } else {
          // Fallback legacy branch if somehow matchedOptionIndex is not found even after ensuring unitOptions
          const suppliersList = [...(updatedPreset.suppliers || [])];
          const supIdx = suppliersList.findIndex(s => s.storeName === m.storeName);

          if (supIdx > -1) {
            suppliersList[supIdx] = {
              ...suppliersList[supIdx],
              listPrice: m.unitPrice ?? 0,
              costPrice: m.costPrice ?? 0
            };
          } else {
            suppliersList.push({
              id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`,
              storeName: m.storeName!,
              listPrice: m.unitPrice ?? 0,
              costPrice: m.costPrice ?? 0
            });
          }
          updatedPreset.suppliers = suppliersList;

          // --- RECALCULATE MAX PRICING FOR TOP LEVEL ---
          const activeSuppliersWithListPrice = suppliersList.filter(s => s.listPrice > 0);
          const activeSuppliersWithCostPrice = suppliersList.filter(s => s.costPrice > 0);

          if (activeSuppliersWithListPrice.length > 0) {
            updatedPreset.defaultUnitPrice = Math.max(...activeSuppliersWithListPrice.map(s => s.listPrice));
          } else if (m.unitPrice !== undefined) {
            updatedPreset.defaultUnitPrice = m.unitPrice;
          }

          if (activeSuppliersWithCostPrice.length > 0) {
            updatedPreset.defaultCostPrice = Math.max(...activeSuppliersWithCostPrice.map(s => s.costPrice));
          } else if (m.costPrice !== undefined) {
            updatedPreset.defaultCostPrice = m.costPrice;
          }
        }

        // Apply auto conversions across other unit options, and sync primary to top-level
        return applyLocalAutoConversions(updatedPreset);
      });
    });

    if (onSaveToast) {
      onSaveToast(`⭐ 已成功同步更新【${preset.name}】於【${m.storeName}】的特約大庫牌價與成本，並自動取最高特約值更新系統預設牌進價！`);
    }
  };

  const handleUpdateMaterialField = (rowId: string, key: keyof RecordMaterial, value: any) => {
    setMaterials(prev => prev.map(m => {
      if (m.id === rowId) {
        const updated = { ...m, [key]: value };
        if (key === 'unitPrice' || key === 'costPrice') {
          updated.isAutoFilled = false;
        }
        return updated;
      }
      return m;
    }));
  };

  const handleRemoveMaterialRow = (rowId: string) => {
    setMaterials(prev => prev.filter(m => m.id !== rowId));
  };

  // --- Labor / Crew Operations ---
  const handleAddWorkerRow = () => {
    const activeStaffIds = workers.map(w => w.workerId);
    const activeOnlyPresets = workersPreset.filter(wp => wp.status !== '離職');
    const availableStaff = activeOnlyPresets.find(wp => !activeStaffIds.includes(wp.id));

    if (!availableStaff) {
      // All fixed crew are already dispatched, add a custom temp support row automatically to prevent duplicate selection!
      const item: RecordWorker = {
        id: `crew-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        workerId: 'support_temp',
        name: '',
        hoursWork: 8,
        hourlyRate: 250,
        billingHourlyRate: 250,
        isSupport: true
      };
      setWorkers([...workers, item]);
      return;
    }

    const item: RecordWorker = {
      id: `crew-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      workerId: availableStaff.id,
      name: availableStaff.name,
      hoursWork: 8, // Standard shifts
      hourlyRate: availableStaff.defaultHourlyRate || 250, // silent backend value for analytics
      billingHourlyRate: availableStaff.billingHourlyRate ?? availableStaff.defaultHourlyRate ?? 250,
      isSupport: false
    };
    setWorkers([...workers, item]);
  };

  const handleUpdateEstimationWorkerField = (rowId: string, key: 'name' | 'workerCount' | 'daysWork' | 'estimationSalary', value: any) => {
    setWorkers(prev => prev.map(w => {
      if (w.id === rowId) {
        const count = key === 'workerCount' ? value : (w.workerCount ?? 1);
        const days = key === 'daysWork' ? value : (w.daysWork ?? 1.0);
        const salary = key === 'estimationSalary' ? value : (w.estimationSalary ?? 3000);
        
        // Sync calculations:
        // hoursWork is for standard analytics: count * days * 8 (representing total aggregate hours)
        // hourlyRate: salary / 8
        return {
          ...w,
          [key]: value,
          workerCount: count,
          daysWork: days,
          estimationSalary: salary,
          hoursWork: count * days * 8,
          hourlyRate: salary / 8,
          billingHourlyRate: salary / 8
        };
      }
      return w;
    }));
  };

  const handleUpdateCrewWorkerType = (rowId: string, choiceId: string) => {
    if (choiceId === '') {
      setWorkers(prev => prev.map(w => w.id === rowId ? {
        ...w,
        workerId: undefined,
        name: '',
        hourlyRate: 250,
        billingHourlyRate: 250,
        isSupport: true
      } : w));
    } else if (choiceId === 'support_temp') {
      // Outside/additional labor is selected
      setWorkers(prev => prev.map(w => w.id === rowId ? {
        ...w,
        workerId: 'support_temp',
        name: '', // waits for worker to fill via input
        hourlyRate: 250, // default silent base billing rate
        billingHourlyRate: 250,
        isSupport: true
      } : w));
    } else {
      const staff = workersPreset.find(wp => wp.id === choiceId);
      if (staff) {
        setWorkers(prev => prev.map(w => w.id === rowId ? {
          ...w,
          workerId: staff.id,
          name: staff.name,
          hourlyRate: staff.defaultHourlyRate,
          billingHourlyRate: staff.billingHourlyRate ?? staff.defaultHourlyRate,
          isSupport: false
        } : w));
      }
    }
  };

  const handleUpdateCrewHours = (rowId: string, hours: number) => {
    setWorkers(prev => prev.map(w => w.id === rowId ? { ...w, hoursWork: hours } : w));
  };

  const handleUpdateCrewSupportName = (rowId: string, name: string) => {
    setWorkers(prev => prev.map(w => w.id === rowId ? { ...w, name } : w));
  };

  const handleUpdateCrewSupportRate = (rowId: string, hourlyRate: number) => {
    setWorkers(prev => prev.map(w => w.id === rowId ? { ...w, hourlyRate, billingHourlyRate: hourlyRate } : w));
  };

  const handleUpdateCrewSupportBillingRate = (rowId: string, billingHourlyRate: number) => {
    setWorkers(prev => prev.map(w => w.id === rowId ? { ...w, billingHourlyRate } : w));
  };

  const handleUpdateCrewSupportRole = (rowId: string, supportRole: string) => {
    setWorkers(prev => prev.map(w => w.id === rowId ? { ...w, supportRole } : w));
  };

  const handleRemoveCrewRow = (rowId: string) => {
    setWorkers(prev => prev.filter(w => w.id !== rowId));
  };

  // --- Custom Blank Expenses Operations ---
  const handleAddCustomExpenseRow = (isProjectExpense: boolean) => {
    const item: RecordExpense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'other',
      description: '',
      amount: 0,
      isProjectExpense,
      vehicle: '公司大庫/銀行'
    };
    setCustomExpenses([...customExpenses, item]);
  };

  const handleUpdateCustomExpenseField = (rowId: string, key: keyof RecordExpense, value: any) => {
    setCustomExpenses(prev => prev.map(ex => ex.id === rowId ? { ...ex, [key]: value } : ex));
  };

  const handleTypeChange = (exId: string, newType: string, currentDesc: string) => {
    setCustomExpenses(prev => prev.map(ex => {
      if (ex.id !== exId) return ex;
      const standardLabels = ['', '停車', '加油', '伙食', '設備', '五金', '其他'];
      let newDesc = ex.description;
      if (standardLabels.includes(currentDesc.trim())) {
        if (newType === 'parking') newDesc = '停車';
        else if (newType === 'fuel') newDesc = '加油';
        else if (newType === 'meal') newDesc = '伙食';
        else if (newType === 'tool') newDesc = '設備';
        else if (newType === 'hardware') newDesc = '五金';
        else if (newType === 'other') newDesc = '';
      }
      return { ...ex, type: newType, description: newDesc };
    }));
  };

  const handleRemoveCustomExpenseRow = (rowId: string) => {
    setCustomExpenses(prev => prev.filter(ex => ex.id !== rowId));
  };

  // --- Form submission ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert('請先選擇或建立一個工程案場！');
      return;
    }

    // 剔除尚未選取/未填寫的空白預設列
    const filteredWorkers = workers.filter(w => !isWorkerRowEmpty(w));
    const filteredMaterials = materials.filter(m => !isMaterialRowEmpty(m));

    // Validate that support crew names are not left blank (excluding already filtered empty placeholders)
    const blankSupport = filteredWorkers.find(w => w.workerId === 'support_temp' && !w.name.trim());
    if (blankSupport) {
      alert('請填寫外調或額外派遣勞工姓名！');
      return;
    }

    // Assemble final expenses array
    const finalExpensesList: RecordExpense[] = [];
    
    // Filter valid custom expenses (exclude empty name/price)
    customExpenses.forEach(ce => {
      if (!isExpenseRowEmpty(ce)) {
        finalExpensesList.push({
          id: ce.id.includes('placeholder') ? `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` : ce.id,
          type: ce.type || 'other',
          description: ce.description.trim(),
          amount: ce.amount || 0,
          isProjectExpense: ce.isProjectExpense !== false,
          payerName: ce.payerName?.trim() || undefined,
          vehicle: ce.vehicle || '公司大庫/銀行'
        });
      }
    });

    onSaveRecord({
      date,
      projectId: selectedProjectId,
      projectName: selectedProjDetails ? getProjectDisplayName(selectedProjDetails) : '未知施工案場',
      materials: filteredMaterials,
      expenses: finalExpensesList,
      workers: filteredWorkers,
      notes: notes.trim(),
      markAsCompleted,
      collectedAmount: collectedAmount > 0 ? collectedAmount : undefined,
      internalCostOnly: internalCostOnly
    });
  };

  return (
    <>
      <div id="record-form-container" className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden font-sans">
      {/* Upper Dark bar */}
      <div className="bg-neutral-900 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">DAILY ON-SITE JOURNAL</span>
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
            {initialRecordToEdit ? '🔧 修改工務日誌' : '📋 登錄工務日誌'}
          </h2>
          <p className="text-xs text-neutral-400">
            請現場員工核實登記：去往之工地、耗用材料數量（臨採手填）、成員工時、以及餐食停車開鋪。
          </p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-800 p-2 px-3 rounded-lg border border-neutral-700/60 w-fit self-start sm:self-center">
          <Calendar size={14} className="text-amber-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-neutral-200">{date}</span>
        </div>
      </div>

      <form id="daily-record-form" onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Administrator Pricing Override Toggle (Discrete hidden-style button) */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setOverridePricingMode(!overridePricingMode);
              if (onSaveToast) {
                onSaveToast(
                  !overridePricingMode 
                    ? '🔓 已開啟「進階計費與牌價覆寫模式」！您現在可以直接微調此日誌中的對客材料牌價與同仁派遣時薪，這不會影響您的後台大庫常規設定。' 
                    : '🔒 已關閉進階覆寫模式並恢復常規保密狀態。'
                );
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
              overridePricingMode 
                ? 'bg-amber-100 text-amber-805 border border-amber-400 font-extrabold shadow-sm'
                : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-400 border border-neutral-200/60'
            }`}
          >
            {overridePricingMode ? (
              <>
                <Unlock size={11} className="text-amber-600 animate-pulse" />
                <span>⚙️ 工務主管已啟用</span>
              </>
            ) : (
              <>
                <Lock size={11} className="text-neutral-400" />
                <span>🔒 啟用工務主管</span>
              </>
            )}
          </button>
        </div>

        {/* SECTION 1: Case details & date picker */}
        <section className="bg-neutral-50 p-4.5 rounded-xl border border-neutral-200/60 space-y-4">
          <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-200 text-neutral-700 font-bold">
            <ClipboardList size={16} className="text-amber-600" />
            <h3 className="text-xs sm:text-sm font-extrabold text-neutral-850">一、 日期與施工案場選擇</h3>
          </div>

          <div className="space-y-4">
            {/* Input Date */}
            <div className="w-full">
              <label className="block text-xs font-bold text-neutral-500 mb-1">施工派遣日期 <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full sm:max-w-xs px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white font-mono"
                required
              />
            </div>

            {/* Project Selection Dropdown */}
            <div className="w-full min-w-0">
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <label className="block text-xs font-bold text-neutral-500">施工目的案場 <span className="text-red-500">*</span></label>
                <label className="inline-flex items-center gap-1 cursor-pointer text-[10px] text-neutral-600 font-extrabold bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={showCompletedInSelect}
                    onChange={(e) => setShowCompletedInSelect(e.target.checked)}
                    className="w-3.5 h-3.5 text-amber-600 border-neutral-300 rounded focus:ring-0 cursor-pointer text-[10px]"
                  />
                  <span>🛠️ 顯示已完工案場</span>
                </label>
              </div>

              {projects.length === 0 ? (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-xs text-neutral-400">尚無工程案場，請先點按開案</span>
                  <button
                    type="button"
                    onClick={onOpenNewProjectModal}
                    className="px-3 py-1 bg-amber-600 text-white font-bold text-xs rounded-lg flex items-center gap-1"
                  >
                    新開立案場
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full min-w-0">
                  <div className="flex-1 min-w-0 w-full relative" ref={projectDropdownRef}>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-neutral-400">
                        <Search size={14} />
                      </div>
                      <input
                        type="text"
                        placeholder="🔍 輸入關鍵字模糊搜尋案場 (如：合悅、新店、2026)..."
                        value={isProjectDropdownOpen ? projectSearch : (selectedProjDetails ? getProjectDisplayName(selectedProjDetails) : '')}
                        onChange={(e) => {
                          setProjectSearch(e.target.value);
                          setIsProjectDropdownOpen(true);
                        }}
                        onFocus={() => {
                          setIsProjectDropdownOpen(true);
                          setProjectSearch('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                          }
                        }}
                        className="w-full pl-8 pr-8 py-1.5 border border-neutral-200 rounded-lg text-xs bg-[#121212] font-bold text-neutral-200 focus:ring-1 focus:ring-amber-500 truncate block"
                      />
                      {selectedProjectId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProjectId('');
                            setProjectSearch('');
                          }}
                          className="absolute inset-y-0 right-2.5 flex items-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {isProjectDropdownOpen && (
                      <div className="absolute z-[110] mt-1 w-full bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                        {filteredActiveProjects.length === 0 && filteredCompletedProjects.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-neutral-400 text-center">
                            找不到符合的案場，請嘗試其他關鍵字
                          </div>
                        ) : (
                          <>
                            {filteredActiveProjects.length > 0 && (
                              <div>
                                <div className="px-3 py-1.5 bg-[#252525] border-b border-[#2C2C2C] text-[10px] font-black text-neutral-400 sticky top-0 z-10">
                                  進行中 / 未完工案場
                                </div>
                                {filteredActiveProjects.map(p => {
                                  const isSelected = p.id === selectedProjectId;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => {
                                        handleProjectSelect(p.id);
                                        setIsProjectDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-3.5 py-2 text-xs font-bold transition-colors flex items-center justify-between border-b border-[#2C2C2C] hover:bg-amber-550/10 ${
                                        isSelected ? 'bg-amber-500/20 text-amber-300 font-extrabold' : 'text-neutral-300'
                                      }`}
                                    >
                                      <span className="truncate mr-2">{getProjectDisplayName(p)}</span>
                                      {isSelected && <Check size={12} className="text-amber-500 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {filteredCompletedProjects.length > 0 && (
                              <div>
                                <div className="px-3 py-1.5 bg-[#252525] border-b border-[#2C2C2C] text-[10px] font-black text-neutral-400 sticky top-0 z-10">
                                  已完工結案案場 (選取後自動重啟為進行中)
                                </div>
                                {filteredCompletedProjects.map(p => {
                                  const isSelected = p.id === selectedProjectId;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => {
                                        handleProjectSelect(p.id);
                                        setIsProjectDropdownOpen(false);
                                      }}
                                      className={`w-full text-left px-3.5 py-2 text-xs font-bold transition-colors flex items-center justify-between border-b border-[#2C2C2C] hover:bg-amber-550/10 ${
                                        isSelected ? 'bg-amber-500/20 text-amber-300 font-extrabold' : 'text-neutral-400'
                                      }`}
                                    >
                                      <span className="truncate mr-2 text-neutral-450">
                                        ⚠️ [已完工] {getProjectDisplayName(p)}
                                      </span>
                                      {isSelected && <Check size={12} className="text-amber-500 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onOpenNewProjectModal}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 w-full sm:w-auto shadow-sm cursor-pointer"
                  >
                    <Plus size={13} />
                    +新開案場
                  </button>
                </div>
              )}
            </div>

            {/* Project Context & Proximity Stats Panel (案場脈絡關聯與累計數據) */}
            {selectedProjectId && projectStats && (
              <div className="mt-3 bg-white p-4.5 rounded-xl border border-amber-200/60 shadow-3xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-amber-800 font-extrabold text-xs">
                    <Sparkles size={14} className="text-amber-500 animate-pulse" />
                    <span>🎯 案場脈絡累計：【{selectedProjDetails?.companyOrOwner}】累計數據</span>
                  </div>
                  <span className="text-[10px] bg-amber-50 text-amber-800 font-black px-2 py-0.5 rounded border border-amber-200/50">
                    共 {projectStats.recordCount} 筆工務日誌
                  </span>
                </div>

                {/* Bento layout for project numbers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-150 text-center">
                    <div className="text-[9px] text-neutral-400 font-bold">🛠️ 累計耗材成本</div>
                    <div className="text-xs font-mono font-black text-neutral-750 mt-0.5">
                      ${projectStats.totalMaterialsCost.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-150 text-center">
                    <div className="text-[9px] text-neutral-400 font-bold">👷 累計派遣薪資</div>
                    <div className="text-xs font-mono font-black text-neutral-750 mt-0.5">
                      ${projectStats.totalLaborCost.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-150 text-center">
                    <div className="text-[9px] text-neutral-400 font-bold">🚗 累計雜支開銷</div>
                    <div className="text-xs font-mono font-black text-neutral-750 mt-0.5">
                      ${projectStats.totalExpenses.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2.5 bg-amber-50/40 rounded-lg border border-amber-150 text-center">
                    <div className="text-[9px] text-amber-700 font-bold">💰 累計總支出</div>
                    <div className="text-xs font-mono font-black text-amber-950 mt-0.5">
                      ${projectStats.totalCost.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {/* Complete marker */}
            <div className="p-3.5 bg-amber-50/20 hover:bg-amber-50/40 transition-colors rounded-xl border border-dashed border-amber-200 flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={markAsCompleted}
                  onChange={(e) => setMarkAsCompleted(e.target.checked)}
                  className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-neutral-300 rounded cursor-pointer"
                />
                <span className="text-xs font-extrabold text-neutral-800">案場今日完工結案</span>
              </label>
              <span className="text-[10px] text-neutral-400 mt-1 leading-tight">
                打勾送出後，該案場會被標記為「已完工」並移入歸檔列表，與其它的快捷鍵或 "+新開案場" 互不影響。
              </span>
            </div>

            {/* Internal Cost Only flag */}
            <div className="p-3.5 bg-rose-50/30 hover:bg-rose-50/50 transition-colors rounded-xl border border-dashed border-[#D4AF37]/30 flex flex-col justify-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={internalCostOnly}
                  onChange={(e) => setInternalCostOnly(e.target.checked)}
                  className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-neutral-300 rounded cursor-pointer"
                />
                <span className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                  🛡️ 僅計內部薪資與耗材 (不跟業主收款)
                </span>
              </label>
              <span className="text-[10px] text-rose-600/80 mt-1 leading-tight">
                勾選後，此趟日誌將<strong>不計入業主請款/估價單金額</strong>。適合去現場看估價、到了現場已修好無施作，但員工薪資照付的純内部成本專案。
              </span>
            </div>
          </div>
          </div>
        </section>

        {/* SECTION 2: Material registers (No price shown!) */}
        <section className="space-y-3">
          <div className="flex items-center pb-1.5 border-b border-neutral-200">
            <div className="flex items-center gap-1.5">
              <ShoppingCart size={16} className="text-amber-600" />
              <h3 className="text-xs sm:text-sm font-extrabold text-neutral-850">二、 本日工地用料消耗登記（倉儲出庫 / 附近臨購）</h3>
            </div>
          </div>

          {/* Categorized Quick Add Material Tablet Dashboard */}
          <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-neutral-600 block flex items-center gap-1">
                📂 【大庫耗材分類速選盤】 (點選施工項目，一鍵自動添加至本日登記清單，多次點擊可累加數量)
              </span>
              <span className="text-[9px] text-amber-700 font-bold bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-full">
                💡 電工、水工、五金一目了然
              </span>
            </div>

            {/* 🔍 Dynamic Material Search Input */}
            <div className="relative group">
              <input
                id="recordform-material-search-input"
                type="text"
                value={addSearchQuery}
                onChange={(e) => setAddSearchQuery(e.target.value)}
                placeholder="🔍 輸入大庫耗材規格品名、單位或分類關鍵字進行快速搜尋... (例如：PVC、南亞、白扁線、個)"
                className="w-full pl-9 pr-12 py-1.5 border border-neutral-250 bg-white rounded-xl text-xs text-neutral-800 placeholder-neutral-450 focus:ring-1 focus:ring-amber-500 font-bold shadow-2xs transition"
              />
              {addSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAddSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-1.5 py-0.5 rounded font-bold cursor-pointer transition select-none"
                >
                  清除
                </button>
              )}
            </div>

            {/* Category Filter Buttons */}
            <div className="flex flex-wrap gap-1">
              {categoriesList.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedAddCategory(cat);
                    // Reset supplier filter when category changes to prevent empty states
                  }}
                  className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    selectedAddCategory === cat
                      ? 'bg-amber-600 text-white shadow-3xs'
                      : 'bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-600'
                  }`}
                >
                  {cat === '電路電材類' && '⚡ '}
                  {cat === '水路管材類' && '💧 '}
                  {cat === '廚衛設備類' && '🛁 '}
                  {cat === '五金緊固類' && '🔩 '}
                  {cat === '工具與雜耗' && '🛠️ '}
                  {cat}
                </button>
              ))}
            </div>

            {/* Subcategory Dynamic Filter */}
            {selectedAddCategory !== '全部' && (
              <div className="space-y-1 mt-2.5 p-2 bg-amber-500/5 rounded-xl border border-dashed border-[#D4AF37]/20">
                <div 
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setIsSubcategoryCollapsed(!isSubcategoryCollapsed)}
                >
                  <span className="text-[10px] font-extrabold text-amber-600 block flex items-center gap-1">
                    <span>📂 依次細分類 (二層細項) 進階過濾：</span>
                  </span>
                  <span className="text-[10px] text-[#D4AF37] font-bold flex items-center gap-0.5">
                    {isSubcategoryCollapsed ? '🔽 展開次分類' : '🔼 折疊次分類'}
                  </span>
                </div>
                {!isSubcategoryCollapsed && (
                  <div className="flex flex-wrap gap-1 pt-1.5 animate-fadeIn">
                    {(() => {
                      const subList = [...(subcategoriesConfig[selectedAddCategory] || [])];
                      const extraSubs: string[] = [];
                      if (materialsPreset && Array.isArray(materialsPreset)) {
                        materialsPreset.forEach(m => {
                          if (m.category === selectedAddCategory && m.subcategory && m.subcategory.trim() !== '') {
                            if (!subList.includes(m.subcategory) && !extraSubs.includes(m.subcategory)) {
                              extraSubs.push(m.subcategory);
                            }
                          }
                        });
                      }
                      const hasUnclassified = materialsPreset?.some(m => m.category === selectedAddCategory && (!m.subcategory || m.subcategory.trim() === ''));
                      const listWithStatus = [
                        { value: '全部', label: '🔍 全部次分類' },
                        ...subList.map(s => ({ value: s, label: s })),
                        ...extraSubs.map(s => ({ value: s, label: `⚠️ ${s} (舊分類)` })),
                      ];
                      if (hasUnclassified) {
                        listWithStatus.push({ value: '未分類', label: '❓ 未分類' });
                      }
                      return listWithStatus;
                    })().map(({ value, label }) => {
                      const isSelected = selectedAddSubcategory === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelectedAddSubcategory(value)}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#D4AF37] text-neutral-900 font-extrabold shadow-3xs'
                              : 'bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-500'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Supplier Filter Buttons inside Jobsite Log Entry Quick Add Panel */}
            <div className="space-y-1.5 border-t border-neutral-200/60 pt-2.5">
              <span className="text-[10px] font-extrabold text-neutral-500 block flex items-center gap-1">
                🏬 依配合之「特約材料行」快速限縮：
              </span>
              <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setSelectedAddSupplier('全部')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    selectedAddSupplier === '全部'
                      ? 'bg-neutral-800 text-white shadow-3xs'
                      : 'bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-500'
                  }`}
                >
                  🏬 全部聯配行
                </button>
                {activeSuppliersPreset.filter(sup => {
                  if (selectedAddCategory !== '全部') {
                    if (sup.allowedCategories && sup.allowedCategories.length > 0 && !sup.allowedCategories.includes(selectedAddCategory)) {
                      return false;
                    }
                  }
                  if (selectedAddSubcategory !== '全部' && selectedAddSubcategory !== '未分類') {
                    if (sup.allowedSubcategories && sup.allowedSubcategories.length > 0 && !sup.allowedSubcategories.includes(selectedAddSubcategory)) {
                      return false;
                    }
                  }
                  return true;
                }).map(sup => {
                  // Count matches dynamically
                  const matchedCount = sortedMaterialsPreset
                    .filter(p => {
                      const matchesCategory = selectedAddCategory === '全部' || p.category === selectedAddCategory;
                      if (!matchesCategory) return false;
                      const matchesSubcategory = selectedAddSubcategory === '全部' || (selectedAddSubcategory === '未分類' ? (!p.subcategory || p.subcategory.trim() === '') : p.subcategory === selectedAddSubcategory);
                      if (!matchesSubcategory) return false;
                      
                      const matchesSearch = !addSearchQuery.trim() || (() => {
                        const kw = addSearchQuery.trim().toLowerCase();
                        return p.name.toLowerCase().includes(kw) || 
                               (p.category || '').toLowerCase().includes(kw) ||
                               (p.unit || '').toLowerCase().includes(kw);
                      })();
                      if (!matchesSearch) return false;

                      const unitOpts = p.unitOptions || [];
                      const hasStoreInUnit = unitOpts.some(uo => uo.suppliers?.some(s => s.storeName === sup.name && (s.listPrice > 0 || s.costPrice > 0)));
                      const hasStoreInLegacy = p.suppliers?.some(s => s.storeName === sup.name && (s.listPrice > 0 || s.costPrice > 0));
                      return hasStoreInUnit || hasStoreInLegacy;
                    }).length;

                  return (
                    <button
                      key={sup.id}
                      type="button"
                      onClick={() => setSelectedAddSupplier(sup.name)}
                      className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        selectedAddSupplier === sup.name
                          ? 'bg-amber-700 text-white shadow-3xs'
                          : 'bg-white hover:bg-neutral-150 border border-neutral-200 text-neutral-600'
                      }`}
                    >
                      <span>🏬 {sup.name}</span>
                      <span className={`text-[9px] font-mono px-1 rounded-sm ${selectedAddSupplier === sup.name ? 'bg-amber-800 text-amber-200' : 'bg-neutral-100 text-neutral-500'}`}>{matchedCount}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preset Buttons Grid Toggle Header */}
            <div 
              className="flex items-center justify-between border-t border-neutral-200/60 pt-2.5 cursor-pointer select-none"
              onClick={() => setIsQuickAddCollapsed(!isQuickAddCollapsed)}
            >
              <span className="text-[10px] font-extrabold text-neutral-600 flex items-center gap-1">
                ⚡ 快速點選大庫材料品項 (單擊直接累加至耗用清單)：
              </span>
              <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5">
                {isQuickAddCollapsed ? '🔽 展開品項列表' : '🔼 折疊品項列表'}
              </span>
            </div>

            {/* Preset Buttons Grid */}
            {!isQuickAddCollapsed && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[170px] overflow-y-auto pr-1 pt-1.5 animate-fadeIn">
                {sortedMaterialsPreset
                  .filter(p => selectedAddCategory === '全部' || p.category === selectedAddCategory)
                  .filter(p => {
                    if (selectedAddSubcategory === '全部') return true;
                    if (selectedAddSubcategory === '未分類') return !p.subcategory || p.subcategory.trim() === '';
                    return p.subcategory === selectedAddSubcategory;
                  })
                  .filter(p => {
                    if (selectedAddSupplier === '全部') return true;
                    const unitOpts = p.unitOptions || [];
                    const hasStoreInUnit = unitOpts.some(uo => uo.suppliers?.some(s => s.storeName === selectedAddSupplier && (s.listPrice > 0 || s.costPrice > 0)));
                    const hasStoreInLegacy = p.suppliers?.some(s => s.storeName === selectedAddSupplier && (s.listPrice > 0 || s.costPrice > 0));
                    return hasStoreInUnit || hasStoreInLegacy;
                  })
                  .filter(p => {
                    if (!addSearchQuery.trim()) return true;
                    const kw = addSearchQuery.trim().toLowerCase();
                    return p.name.toLowerCase().includes(kw) || 
                           (p.category || '').toLowerCase().includes(kw) ||
                           (p.unit || '').toLowerCase().includes(kw);
                  })
                  .map(p => {
                    const uniqueSuppliers = p.suppliers?.length || 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleQuickAddPresetMaterial(p)}
                        className="text-left p-2 bg-white hover:bg-amber-50/40 border border-neutral-200 hover:border-amber-300 rounded-lg shadow-3xs transition flex flex-col justify-between h-auto cursor-pointer"
                      >
                        <span className="font-bold text-neutral-800 text-[11px] leading-tight line-clamp-2">{p.name}</span>
                        <div className="flex justify-between items-center text-[9px] text-neutral-400 mt-1 font-mono scale-95 origin-left">
                        <span>單位：{p.unit}</span>
                        {uniqueSuppliers > 0 && (
                          <span className="text-amber-700 font-sans font-extrabold text-[8px] scale-90">🏬特約({uniqueSuppliers})</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              {sortedMaterialsPreset
                .filter(p => selectedAddCategory === '全部' || p.category === selectedAddCategory)
                .filter(p => {
                  if (selectedAddSubcategory === '全部') return true;
                  if (selectedAddSubcategory === '未分類') return !p.subcategory || p.subcategory.trim() === '';
                  return p.subcategory === selectedAddSubcategory;
                })
                .filter(p => {
                  if (selectedAddSupplier === '全部') return true;
                  const unitOpts = p.unitOptions || [];
                  const hasStoreInUnit = unitOpts.some(uo => uo.suppliers?.some(s => s.storeName === selectedAddSupplier && (s.listPrice > 0 || s.costPrice > 0)));
                  const hasStoreInLegacy = p.suppliers?.some(s => s.storeName === selectedAddSupplier && (s.listPrice > 0 || s.costPrice > 0));
                  return hasStoreInUnit || hasStoreInLegacy;
                })
                .filter(p => {
                  if (!addSearchQuery.trim()) return true;
                  const kw = addSearchQuery.trim().toLowerCase();
                  return p.name.toLowerCase().includes(kw) || 
                         (p.category || '').toLowerCase().includes(kw) ||
                         (p.unit || '').toLowerCase().includes(kw);
                }).length === 0 && (
                <div className="col-span-12 text-center py-4 text-[10px] text-neutral-400 italic">
                  💡 依此分類、店家過濾或關鍵字【{addSearchQuery}】搜尋，大庫中查無符合之消耗性耗材。
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-1.5 flex-wrap gap-2">
          <p className="text-[10px] text-amber-800 bg-amber-50/60 border border-amber-200/50 px-2.5 py-1 rounded-md font-bold italic">
            💡 系統已啟用智慧自動延展：在表格中填寫或點選大庫、推薦，將自動為您生成下一行空白材料列。
          </p>
        </div>

        {materials.length === 0 ? (
          <div className="text-center py-7 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/20 text-xs text-neutral-400">
            請點選上方大庫一鍵速選，或直接在下方空白列填寫。
          </div>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold">
                    <td className="py-2 px-3">材料品項預設選擇</td>
                    <td className="py-2 px-3 w-[10%]">數量</td>
                    <td className="py-2 px-3 w-[10%]">單位</td>
                    <td className="py-2 px-3 w-[15%]">緊急臨時採購</td>
                    <td className="py-2 px-3 w-[18%]">
                      {overridePricingMode ? "出庫報帳對客牌價 (微調覆寫)" : "臨購購買單價 (非必填)"}
                    </td>
                    <td className="py-2 px-3 w-[20%]">材料備註</td>
                    <td className="py-2 px-3 w-[50px] text-center"></td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(() => {
                    const sortedRegistered = [...materials].sort((a, b) => {
                      // 依據新增/載入時的時間戳記進行反向排序，讓最後新增的工地耗材顯示在最上方，省去上下拉動選單
                      const getTs = (id: string) => {
                        const match = id.match(/\d+/);
                        return match ? parseInt(match[0], 10) : 0;
                      };
                      const tsDiff = getTs(b.id) - getTs(a.id);
                      if (tsDiff !== 0) return tsDiff;
                      return materials.indexOf(b) - materials.indexOf(a);
                    });
                    return sortedRegistered.map(m => (
                      <tr key={m.id} className="hover:bg-neutral-50/30">
                        {/* Name Selector */}
                        <td className="py-2.5 px-3">
                          <div className="space-y-1.5">
                            <select
                              value={m.materialId || 'custom'}
                              onChange={(e) => handleUpdateMaterialChoice(m.id, e.target.value)}
                              className="w-full px-2 py-1.5 border border-neutral-200 rounded text-xs bg-white text-neutral-700 font-bold"
                            >
                              <option value="custom">-- ⚙️ 現場自定義自填材料 (例如臨採) --</option>
                              {(() => {
                                const grouped: { [key: string]: typeof sortedMaterialsPreset } = {};
                                sortedMaterialsPreset.forEach(wp => {
                                  const cat = wp.category || '水路管材類';
                                  if (!grouped[cat]) grouped[cat] = [];
                                  grouped[cat].push(wp);
                                });
                                return Object.entries(grouped).map(([catName, list]) => (
                                  <optgroup 
                                    key={catName} 
                                    label={`${
                                      catName === '電路電材類' ? '⚡' :
                                      catName === '水路管材類' ? '💧' :
                                      catName === '廚衛設備類' ? '🛁' :
                                      catName === '五金緊固類' ? '🔩' :
                                      catName === '工具與雜耗' ? '🛠️' : '📦'
                                    } ${catName}`}
                                  >
                                    {list.map(wp => {
                                      const uniqueSuppliers = wp.suppliers?.length || 0;
                                      return (
                                        <option key={wp.id} value={wp.id}>
                                          {wp.name} ({wp.unit}) {uniqueSuppliers > 0 ? `[店家特約 x${uniqueSuppliers}]` : ''}
                                        </option>
                                      );
                                    })}
                                  </optgroup>
                                ));
                              })()}
                            </select>

                            {m.materialId && !m.isNearbyPurchased && (() => {
                              const preset = sortedMaterialsPreset.find(p => p.id === m.materialId);
                              if (!preset) return null;
                              
                              const unitOptions = preset.unitOptions || [];
                              const matchedOption = unitOptions.find(uo => uo.unit === m.unit);
                              const relevantSuppliers = matchedOption 
                                ? (matchedOption.suppliers || [])
                                : (preset.suppliers || []);

                              // Filter to only include suppliers with set price (listPrice > 0 or costPrice > 0)
                              const activeSuppliers = relevantSuppliers.filter(s => s.listPrice > 0 || s.costPrice > 0);
                              const activeSupplierNames = activeSuppliers.map(s => s.storeName);

                              // All other system suppliers that are not already active for this material/unit, filtered by category and subcategory limits
                              const otherSuppliers = activeSuppliersPreset.filter(s => {
                                if (activeSupplierNames.includes(s.name)) return false;
                                if (s.allowedCategories && s.allowedCategories.length > 0) {
                                  if (preset.category && !s.allowedCategories.includes(preset.category)) {
                                    return false;
                                  }
                                }
                                if (s.allowedSubcategories && s.allowedSubcategories.length > 0) {
                                  if (preset.subcategory && !s.allowedSubcategories.includes(preset.subcategory)) {
                                    return false;
                                  }
                                }
                                return true;
                              });

                              const currentStore = m.storeName || 'default';
                              return (
                                <div className="flex flex-col gap-1 bg-amber-50/20 border border-amber-200/50 p-2 rounded-lg text-[10px] text-neutral-600 mt-1 shadow-3xs">
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold flex-shrink-0 text-amber-900">🏬 報價材料行:</span>
                                    <select
                                      value={currentStore}
                                      onChange={(e) => handleUpdateMaterialSupplierChoice(m.id, e.target.value, preset)}
                                      className="px-1.5 py-0.5 border border-amber-250 bg-white rounded font-bold text-amber-950 text-[10px] w-full focus:ring-1 focus:ring-amber-500 cursor-pointer"
                                    >
                                      <option value="default">-- 📦 使用預設大庫供貨 --</option>
                                      
                                      {activeSuppliers.length > 0 && (
                                        <optgroup label="✅ 已有特約合約報價">
                                          {activeSuppliers.map(sup => (
                                            <option key={sup.id} value={sup.storeName}>
                                              🏬 {sup.storeName} (大庫: ${sup.listPrice}{overridePricingMode ? ` / 成本 ${sup.costPrice}` : ''})
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}

                                      {otherSuppliers.length > 0 && (
                                        <optgroup label="➕ 其它配合材料行 (選取後可打自定價格並寫入大庫)">
                                          {otherSuppliers.map(sup => (
                                            <option key={sup.id} value={sup.name}>
                                              ➕ {sup.name}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                    </select>
                                  </div>
                                  <div className="text-[9px] pl-0.5 leading-snug font-semibold text-neutral-500 scale-95 origin-left italic mt-0.5 flex items-center gap-1">
                                    <span>👉 已選定：</span>
                                    <span className={m.storeName ? "text-amber-800 font-extrabold" : "text-neutral-500 font-bold"}>
                                      {m.storeName ? `🏬 【${m.storeName}】特約用料` : '📦 預設大庫供貨儲備'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                          {(!m.materialId || m.isNearbyPurchased) && (
                            <input
                              type="text"
                              required={!isMaterialRowEmpty(m)}
                              placeholder="請輸入自打材料品名 (如：廚房止水閥、軟管)"
                              value={m.name}
                              onChange={(e) => handleUpdateMaterialField(m.id, 'name', e.target.value)}
                              className="w-full px-2 py-1 border border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 rounded text-xs bg-amber-50/10 placeholder-neutral-400 text-amber-900"
                            />
                          )}

                          {/* 智慧防呆提醒 (針對退料與扣量進行案場歷史資料交叉比對) */}
                          {(() => {
                            if (isMaterialRowEmpty(m) || m.quantity >= 0) return null;
                            
                            const totalPrev = getHistoricalQuantityForMaterial(m);
                            const materialDisplayName = m.materialId 
                              ? (sortedMaterialsPreset.find(p => p.id === m.materialId)?.name || m.name)
                              : m.name;
                            
                            if (totalPrev <= 0) {
                              return (
                                <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-800 space-y-1 font-bold animate-pulse">
                                  <div className="flex items-center gap-1 text-rose-700">
                                    <AlertCircle size={12} className="flex-shrink-0 animate-bounce" />
                                    <span>⚠️ 智慧防呆警示：此案場先前從未登記過此材料！</span>
                                  </div>
                                  <p className="font-normal leading-relaxed text-rose-700/90 pl-4.5 text-[9.5px]">
                                    此案場歷史紀錄中並未登記使用過 <span className="underline font-black">{materialDisplayName}</span>。您是否誤選了別的材料品項？
                                  </p>
                                </div>
                              );
                            } else if (totalPrev + m.quantity < 0) {
                              return (
                                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-850 space-y-1 font-bold">
                                  <div className="flex items-center gap-1 text-amber-700">
                                    <AlertCircle size={12} className="flex-shrink-0" />
                                    <span>⚠️ 智慧防呆提醒：退料數量大於此案場歷史累計！</span>
                                  </div>
                                  <p className="font-normal leading-relaxed text-amber-800/90 pl-4.5 text-[9.5px]">
                                    此案場歷史累計僅帶入/耗用 <span className="font-mono font-bold text-amber-950">{totalPrev}</span> {m.unit}，但本次登記退料 <span className="font-mono font-bold text-rose-700">{-m.quantity}</span> {m.unit}，將使案場淨耗用變為負數 (<span className="font-mono font-bold text-rose-700">{totalPrev + m.quantity}</span> {m.unit})。請確認是否選錯材料或數量填寫錯誤！
                                  </p>
                                </div>
                              );
                            } else {
                              return (
                                <div className="mt-1.5 p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-800 flex items-start gap-1 font-bold">
                                  <ShieldCheck size={12} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                                  <p className="font-normal leading-normal text-emerald-800/90 text-[9.5px]">
                                    🛡️ 歷史比對通過：此案場歷史曾帶入/耗用 <span className="font-mono font-bold">{totalPrev}</span> {m.unit}，退回後案場累計淨耗用為 <span className="font-mono font-bold">{totalPrev + m.quantity}</span> {m.unit}。
                                  </p>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <input
                            type="number"
                            required={!isMaterialRowEmpty(m)}
                            min="-9999999"
                            step="any"
                            value={m.quantity}
                            onChange={(e) => handleUpdateMaterialField(m.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-750 font-mono text-center font-medium focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                          />
                          {m.quantity < 0 && (
                            <div className="text-[9px] text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded text-center font-bold scale-90 origin-center animate-pulse">
                              ↩️ 退料 / 減耗登記
                            </div>
                          )}
                          {(() => {
                            if (!m.materialId) return null;
                            const preset = sortedMaterialsPreset.find(p => p.id === m.materialId);
                            if (!preset) return null;
                            const uos = preset.unitOptions || [];
                            const matcheduo = uos.find(u => u.unit === m.unit);
                            if (matcheduo && matcheduo.conversionFactor && matcheduo.conversionFactor !== 1) {
                              const baseQty = matcheduo.conversionInverse 
                                ? (m.quantity / matcheduo.conversionFactor)
                                : (m.quantity * matcheduo.conversionFactor);
                              const totalBase = baseQty.toFixed(2).replace(/\.00$/, '');
                              return (
                                <div className="text-[9px] text-amber-900 bg-amber-50/70 border border-amber-200/60 px-1 py-0.5 rounded text-center font-black flex items-center justify-center gap-0.5 scale-90 origin-center" title={matcheduo.conversionInverse ? `換算比: ${matcheduo.conversionFactor}${m.unit} = 1${preset.unit}` : `換算比: 1${m.unit} = ${matcheduo.conversionFactor}${preset.unit}`}>
                                  <Scale size={10} className="text-amber-600 flex-shrink-0" />
                                  <span>折合: {totalBase} {preset.unit}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-2.5 px-3">
                        {(() => {
                          const preset = m.materialId ? sortedMaterialsPreset.find(p => p.id === m.materialId) : null;
                          if (preset) {
                            const unitOptions = preset.unitOptions || [];
                            const uniqueUnits = Array.from(new Set([
                              preset.unit,
                              ...unitOptions.map(uo => uo.unit)
                            ])).filter(Boolean);

                            return (
                              <select
                                value={m.unit}
                                onChange={(e) => handleUpdateMaterialUnitChoiceInRow(m.id, e.target.value, preset)}
                                className="w-full px-1.5 py-1 border border-neutral-200 rounded text-xs font-bold text-neutral-800 bg-white cursor-pointer focus:ring-1 focus:ring-amber-500"
                              >
                                {uniqueUnits.map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            );
                          }
                          return (
                            <input
                              type="text"
                              required={!isMaterialRowEmpty(m)}
                              placeholder="個/組/捲"
                              value={m.unit}
                              onChange={(e) => handleUpdateMaterialField(m.id, 'unit', e.target.value)}
                              className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-700 text-center"
                            />
                          );
                        })()}
                      </td>

                      {/* Nearby purchase control */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-neutral-600 select-none">
                            <input
                              type="checkbox"
                              checked={m.isNearbyPurchased}
                              onChange={(e) => handleUpdateMaterialField(m.id, 'isNearbyPurchased', e.target.checked)}
                              className="w-3.5 h-3.5 text-amber-600 focus:ring-amber-400 rounded border-neutral-300"
                            />
                            <span>現場緊急臨採</span>
                          </label>

                          {m.isNearbyPurchased && (
                            <div className="space-y-1">
                              <input
                                type="text"
                                list={`nearby-suppliers-${m.id}`}
                                placeholder="選擇特約店家或自行輸入"
                                value={m.storeName || ''}
                                onChange={(e) => handleUpdateMaterialField(m.id, 'storeName', e.target.value)}
                                className="w-full px-2 py-1 border border-neutral-200 rounded text-[10px] text-neutral-600 outline-none focus:border-amber-500"
                              />
                              <datalist id={`nearby-suppliers-${m.id}`}>
                                {(suppliersPreset || []).map(s => (
                                  <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                              </datalist>
                            </div>
                          )}
                        </div>
                      </td>

                       {/* Hand price or Master Override Price */}
                      <td className="py-2.5 px-3">
                        {m.isNearbyPurchased ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 bg-amber-50/20 p-1 rounded border border-amber-200/40">
                              <span className="text-amber-700 font-bold">$</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="收據實付單價"
                                value={m.unitPrice || ''}
                                onChange={(e) => handleUpdateMaterialField(m.id, 'unitPrice', parseInt(e.target.value, 10) || 0)}
                                className="w-full p-1 bg-white border border-neutral-200 rounded text-xs font-mono font-bold text-neutral-850 text-center"
                              />
                            </div>
                            {overridePricingMode && m.costPrice !== undefined && m.costPrice > 0 && (
                              <span className="text-[9px] text-neutral-400 text-center font-bold">臨購成本: ${m.costPrice}</span>
                            )}
                          </div>
                        ) : overridePricingMode ? (
                          <div className="flex flex-col gap-1.5 p-1 bg-amber-50/20 border border-dashed border-amber-300 rounded-lg">
                            {/* 牌價欄位 */}
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-amber-800 shrink-0 w-8">牌價:</span>
                              <div className="flex items-center gap-0.5 bg-white border border-neutral-200 rounded px-1 py-0.5 w-full">
                                <span className="text-amber-700 font-black text-[10px]">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="牌價覆寫"
                                  value={m.unitPrice !== undefined ? m.unitPrice : 0}
                                  onChange={(e) => handleUpdateMaterialField(m.id, 'unitPrice', parseInt(e.target.value, 10) || 0)}
                                  className="w-full p-0 bg-transparent text-xs font-mono font-black text-amber-950 text-center focus:outline-none"
                                />
                              </div>
                            </div>
                            {/* 成本欄位 */}
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-bold text-emerald-800 shrink-0 w-8">成本:</span>
                              <div className="flex items-center gap-0.5 bg-white border border-neutral-200 rounded px-1 py-0.5 w-full">
                                <span className="text-emerald-700 font-black text-[10px]">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="成本覆寫"
                                  value={m.costPrice !== undefined ? m.costPrice : 0}
                                  onChange={(e) => handleUpdateMaterialField(m.id, 'costPrice', parseInt(e.target.value, 10) || 0)}
                                  className="w-full p-0 bg-transparent text-xs font-mono font-black text-emerald-950 text-center focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* 檢視大庫對比 & 寫入大庫特約店家按鈕 */}
                            {(() => {
                              const preset = m.materialId ? sortedMaterialsPreset.find(p => p.id === m.materialId) : null;
                              if (preset) {
                                const pricing = getUnitAndSupplierPrices(preset, m.unit, m.storeName);
                                const hasSupplier = m.storeName && m.storeName !== 'default';
                                
                                // Check if this supplier exists in either matched unit option suppliers, or preset-wide suppliers
                                const unitOptions = preset.unitOptions || [];
                                const matchedOption = unitOptions.find(uo => uo.unit === m.unit);
                                const relevantSuppliers = matchedOption 
                                  ? (matchedOption.suppliers || [])
                                  : (preset.suppliers || []);
                                const isExistingSupplier = relevantSuppliers.some(s => s.storeName === m.storeName);

                                const priceChanged = (m.unitPrice ?? 0) !== pricing.unitPrice;
                                const costChanged = (m.costPrice ?? 0) !== pricing.costPrice;
                                const isDifferent = priceChanged || costChanged;

                                const shouldShowButton = hasSupplier && (!isExistingSupplier || isDifferent);
                                const isConfirming = confirmWriteRowId === m.id;

                                return (
                                  <div className="space-y-1 block mt-0.5 text-center">
                                    <div className="text-[8px] text-neutral-400 leading-tight select-none italic">
                                      大庫預設：牌價 ${pricing.unitPrice} / 成本 ${pricing.costPrice}
                                    </div>
                                    {shouldShowButton && setMaterialsPreset && (
                                      isConfirming ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleWriteBackToPreset(m, preset);
                                            setConfirmWriteRowId(null);
                                          }}
                                          className="w-full py-1 px-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[9px] transition-all cursor-pointer shadow-3xs hover:shadow-2xs border border-rose-700 animate-pulse flex items-center justify-center gap-0.5"
                                          title="確定將特約報價寫入並更新耗材大庫？"
                                        >
                                          ⚠️ 確定更新大庫？
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setConfirmWriteRowId(m.id);
                                            // Auto-reset confirming state after 4 seconds
                                            setTimeout(() => {
                                              setConfirmWriteRowId(prev => prev === m.id ? null : prev);
                                            }, 4000);
                                          }}
                                          className="w-full py-1 px-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[9px] transition-all cursor-pointer shadow-3xs hover:shadow-2xs border border-amber-600 animate-pulse flex items-center justify-center gap-0.5"
                                          title="將此處調整的特定特約材料行牌成本同步更新回後台耗材大庫"
                                        >
                                          💾 寫入大庫特約報價
                                        </button>
                                      )
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-400 italic block pt-1.5 font-bold">倉庫出庫 (已加密隱藏)</span>
                        )}
                      </td>

                      {/* 材料備註 */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          placeholder="材料備註 (如：自備、特殊規格)"
                          value={m.note || ''}
                          onChange={(e) => handleUpdateMaterialField(m.id, 'note', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-neutral-200 rounded text-xs bg-white text-neutral-700 outline-none focus:border-amber-500 font-medium"
                        />
                      </td>

                      {/* Remove Row */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterialRow(m.id)}
                          className="p-1 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ));
                })()}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECTION 3: Labor times */}
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <HardHat size={16} className="text-amber-600" />
              <h3 className="text-xs sm:text-sm font-extrabold text-neutral-850 font-sans">
                三、 當日出勤派遣人員與各別工時填報
              </h3>
            </div>
            <p className="text-[10px] text-amber-800 bg-amber-50/60 border border-amber-200/50 px-2.5 py-1 rounded-md font-bold italic">
              💡 智慧自動延展：選擇師傅或外部派工後，系統將自動展開下一空白行。
            </p>
          </div>

          {workers.length === 0 ? (
            <div className="text-center py-7 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/20 text-xs text-neutral-400">
              請直接在下方空白列中選擇出勤師傅或填寫外調人員。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold">
                    <td className="py-2 px-3 w-[25%]">出勤師傅 / 外調臨時勞務來源</td>
                    <td className="py-2 px-3 w-[15%] text-center">當日工時</td>
                    <td className="py-2 px-3">外派派遣詳細設定 (姓名、工種、與約定時薪計酬)</td>
                    <td className="py-2 px-3 w-[50px] text-center"></td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {workers.map(w => (
                    <tr key={w.id} className="hover:bg-neutral-50/30 align-top">
                      {/* Worker Picker */}
                      <td className="py-3 px-3">
                        <select
                          value={w.workerId || ''}
                          onChange={(e) => handleUpdateCrewWorkerType(w.id, e.target.value)}
                          className="w-full p-2 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-extrabold focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                        >
                          <option value="">-- 🔍 請選擇出勤工班 / 人員 --</option>
                          <optgroup label="固定在職人員名單 (快速點選)">
                            {workersPreset
                              .filter(wp => wp.status !== '離職')
                              .filter(wp => {
                                const isAlreadySelected = workers.some(currW => currW.workerId === wp.id && currW.id !== w.id);
                                return !isAlreadySelected;
                              })
                              .map(wp => (
                                <option key={wp.id} value={wp.id}>
                                  👷 {wp.name} ({wp.role || '在職'})
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="外部派工臨時支援 (不留常備底名)">
                            <option value="support_temp">
                              ➕ 外調支援 / 額外外派員工...
                            </option>
                          </optgroup>
                        </select>
                        <div className="text-[10px] text-neutral-400 mt-1 pl-1">
                          {w.workerId === 'support_temp' ? '⚠️ 臨時人員保退與領現另計' : '✨ 常規在職員工'}
                        </div>
                      </td>

                      {/* Work Hours */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col items-center gap-1.5 mt-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              required={!isWorkerRowEmpty(w)}
                              min="0.5"
                              step="0.5"
                              value={w.hoursWork}
                              onChange={(e) => handleUpdateCrewHours(w.id, parseFloat(e.target.value) || 0)}
                              className="w-14 p-1 border border-neutral-200 rounded text-xs text-center font-mono font-black text-neutral-800 bg-neutral-50/50"
                            />
                            <span className="text-neutral-500 font-bold text-[10px]">小時</span>
                          </div>
                          {/* 快速派工時數選取鈕 */}
                          <div className="flex gap-1">
                            {[1, 2, 4, 8].map(h => (
                              <button
                                key={h}
                                type="button"
                                onClick={() => handleUpdateCrewHours(w.id, h)}
                                className={`text-[8px] px-1 py-0.5 rounded border ${
                                  w.hoursWork === h
                                    ? 'bg-neutral-800 text-white font-extrabold'
                                    : 'bg-white hover:bg-neutral-50 text-neutral-600 border-neutral-250'
                                }`}
                              >
                                {h}h
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Support Worker Configurations */}
                      <td className="py-3 px-3">
                        {w.workerId === 'support_temp' ? (
                          <div className="bg-amber-50/10 p-2.5 rounded-lg border border-amber-200/60 shadow-sm space-y-2.5 bg-white">
                            {/* Line 1: Name and Role */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[9px] font-black text-neutral-500 mb-0.5">👷 外聘派遣同仁姓名 *</label>
                                <input
                                  type="text"
                                  required={!isWorkerRowEmpty(w)}
                                  placeholder="請手填姓名 (如: 陳阿朋)"
                                  value={w.name}
                                  onChange={(e) => handleUpdateCrewSupportName(w.id, e.target.value)}
                                  className="w-full px-2 py-1 border border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-250 rounded text-xs bg-white text-neutral-800 font-extrabold"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-neutral-500 mb-0.5">🛠️ 外聘級職工種 / 備註資訊 (選填)</label>
                                <input
                                  type="text"
                                  placeholder="手動輸入備註 (如: 消防配電粗工)"
                                  value={w.supportRole || ''}
                                  onChange={(e) => handleUpdateCrewSupportRole(w.id, e.target.value)}
                                  className="w-full px-2 py-1 border border-neutral-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-250 rounded text-xs bg-white text-neutral-800 font-bold"
                                />
                              </div>
                            </div>

                            {/* Line 2: Both Cost (Internal) and Billing (External) Rates */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-dashed border-neutral-200/70 pt-2.5">
                              <div>
                                <label className="block text-[9px] font-black text-neutral-500 mb-0.5">🪙 對內約定工資時薪 (成本)</label>
                                <div className="flex items-center gap-1.5">
                                  <div className="relative w-24">
                                    <span className="absolute left-1.5 top-0.5 text-neutral-400 font-bold text-[9px]">$</span>
                                    <input
                                      type="number"
                                      required={!isWorkerRowEmpty(w)}
                                      min="0"
                                      value={w.hourlyRate || 250}
                                      onChange={(e) => handleUpdateCrewSupportRate(w.id, Number(e.target.value) || 0)}
                                      className="w-full pl-4 pr-1 py-0.5 border border-neutral-200 rounded text-xs font-mono font-bold text-neutral-700 text-center bg-neutral-50/50"
                                    />
                                  </div>
                                  <span className="text-[9px] text-neutral-400 block pt-0.5">
                                    薪資: <strong>${Math.round((w.hourlyRate || 250) * w.hoursWork)}</strong>
                                  </span>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[9px] font-black text-amber-700 mb-0.5">🪙 對客報價派遣時薪 (報帳)</label>
                                <div className="flex items-center gap-1.5">
                                  <div className="relative w-24">
                                    <span className="absolute left-1.5 top-0.5 text-amber-500 font-bold text-[9px]">$</span>
                                    <input
                                      type="number"
                                      required={!isWorkerRowEmpty(w)}
                                      min="0"
                                      value={w.billingHourlyRate ?? w.hourlyRate ?? 250}
                                      onChange={(e) => handleUpdateCrewSupportBillingRate(w.id, Number(e.target.value) || 0)}
                                      className="w-full pl-4 pr-1 py-0.5 border border-amber-200 rounded text-xs font-mono font-black text-amber-700 text-center bg-amber-50/20"
                                    />
                                  </div>
                                  <span className="text-[9px] text-amber-600 block pt-0.5">
                                    報價: <strong>${Math.round((w.billingHourlyRate ?? w.hourlyRate ?? 250) * w.hoursWork)}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Preset Buttons */}
                            <div className="flex flex-wrap gap-1 border-t border-neutral-100 pt-2 items-center">
                              <span className="text-[9px] text-neutral-400 font-bold">快速時薪調配：</span>
                              {[150, 200, 250, 300, 350, 450].map(rate => (
                                <button
                                  key={rate}
                                  type="button"
                                  onClick={() => handleUpdateCrewSupportRate(w.id, rate)}
                                  className={`text-[9px] px-1.5 py-0.5 rounded border transition cursor-pointer font-bold ${
                                    w.hourlyRate === rate
                                      ? 'bg-amber-600 border-amber-600 text-white font-extrabold shadow-2xs'
                                      : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                                  }`}
                                >
                                  ${rate}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 pl-2 bg-neutral-50/60 p-2.5 rounded-lg border border-neutral-200/50 max-w-md">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] text-neutral-400 font-extrabold block">💼 常規在職人員</span>
                              {overridePricingMode ? (
                                <span className="text-[9px] text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5 animate-pulse">
                                  ⚡ 派遣對客報價覆寫中
                                </span>
                              ) : (
                                <span className="text-[9px] text-neutral-400 bg-neutral-200/60 px-1.5 py-0.5 rounded font-bold">已鎖定安全加密 🔒</span>
                              )}
                            </div>
                            {overridePricingMode ? (
                              <div className="space-y-2 mt-1">
                                <span className="text-[10px] text-neutral-500 font-bold leading-relaxed block">
                                  您已啟動進階計費模式，可調整此同仁的「今日對客派遣報價時薪」而不影響後台常規設定：
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="relative w-32">
                                    <span className="absolute left-1.5 top-1 -translate-y-0.5 text-amber-600 font-black text-[10px]">$</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={w.billingHourlyRate ?? w.hourlyRate ?? 250}
                                      onChange={(e) => {
                                        const rate = parseInt(e.target.value, 10) || 0;
                                        setWorkers(prev => prev.map(item => item.id === w.id ? { ...item, billingHourlyRate: rate } : item));
                                      }}
                                      className="w-full pl-5 pr-2 py-1 border border-amber-300 rounded font-mono font-bold text-amber-950 bg-amber-50/20 text-center text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                    />
                                  </div>
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    今日派遣總計: <strong className="text-amber-800">${Math.round((w.billingHourlyRate ?? w.hourlyRate ?? 250) * w.hoursWork)}</strong>
                                  </span>
                                </div>
                                {(() => {
                                  const staff = workersPreset.find(wp => wp.id === w.workerId);
                                  if (staff) {
                                    const defaultBilling = staff.billingHourlyRate ?? staff.defaultHourlyRate;
                                    return (
                                      <div className="bg-emerald-50/40 p-2 rounded border border-dashed border-emerald-300 space-y-1">
                                        <div className="flex items-center justify-between text-[10px] text-emerald-800 font-black">
                                          <span>🪙 對內在職時薪 (工資成本):</span>
                                          <span className="font-mono bg-emerald-100 px-1 py-0.5 rounded">${staff.defaultHourlyRate} / hr</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-emerald-700 font-bold">
                                          <span>👥 師傅今日薪資成本累計 ({w.hoursWork}h):</span>
                                          <span className="font-mono font-black">${Math.round(staff.defaultHourlyRate * w.hoursWork)}</span>
                                        </div>
                                        <div className="text-[9px] text-neutral-400 border-t border-neutral-200/50 pt-1 flex justify-between select-none">
                                          <span>原系統外派計費建議:</span>
                                          <span>${defaultBilling} / hr</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-[10px] text-neutral-400 font-medium leading-relaxed block">
                                本欄位為在職員工。其內部工資時薪與對客派遣牌價皆已由系統保密隱藏，僅能在後台與報表分析頁面進行彙整。
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Remove Row */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveCrewRow(w.id)}
                          className="p-1.5 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECTION 4: Split into On-site vs Non-site Expenses */}
        <section className="space-y-4">
          <div className="pb-1.5 border-b border-neutral-200">
            <div className="flex items-center gap-1.5">
              <DollarSign size={16} className="text-amber-600" />
              <h3 className="text-xs sm:text-sm font-extrabold text-neutral-850">四、 案場及公司開銷雜費填報 (分為「算在案場內」與「非案場營運」)</h3>
            </div>
            <p className="text-[10px] text-neutral-400 mt-1 leading-normal italic">
              * 提示：算在案場內的開銷將列入報表向客戶估算或對帳；非案場一般餐飲與通用車馬費則不計入該專案對外帳目。本欄位採用空白列預載與自動展延，並可快速指定細帳分類。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* COLUMN 1: On-site (算在案場內開銷) */}
            <div className="space-y-4 p-4 bg-amber-50/10 border border-amber-200/60 rounded-xl">
              <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                <span className="text-xs font-black text-amber-800 flex items-center gap-1">
                  🚧 算在「案場內」開銷
                </span>
                <button
                  type="button"
                  onClick={() => handleAddCustomExpenseRow(true)}
                  className="px-2 py-0.5 bg-amber-600 text-white hover:bg-amber-700 text-[9px] font-black rounded flex items-center gap-0.5 shadow-3xs"
                >
                  <Plus size={10} />
                  手動新增一列
                </button>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {customExpenses.filter(ce => ce.isProjectExpense !== false).map((ex) => (
                  <div key={ex.id} className="p-2 bg-white rounded border border-amber-100 flex items-center gap-1.5 text-[11px] hover:border-amber-300 transition-all">
                    {/* Category Select Dropdown */}
                    <select
                      value={ex.type || 'other'}
                      onChange={(e) => handleTypeChange(ex.id, e.target.value, ex.description)}
                      className="w-24 p-1 border border-neutral-200 rounded text-[10px] bg-white text-neutral-700 font-medium"
                    >
                      <option value="parking">🅿️ 停車</option>
                      <option value="fuel">⛽ 加油</option>
                      <option value="meal">🍱 伙食</option>
                      <option value="tool">⚙️ 設備</option>
                      <option value="hardware">🔧 五金</option>
                      <option value="other">💬 其他</option>
                    </select>

                    {/* Description Text Input */}
                    <input
                      type="text"
                      placeholder="說明 / 備註..."
                      value={ex.description}
                      onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'description', e.target.value)}
                      className="flex-1 p-1 border border-neutral-200 rounded text-[10px]"
                    />

                    {/* Payer Name Selection / Input */}
                    <div className="relative">
                      <input
                        type="text"
                        list={`payer-list-${ex.id}`}
                        placeholder="經手同仁/付款人..."
                        value={ex.payerName || ''}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'payerName', e.target.value)}
                        className="w-24 p-1 border border-neutral-200 rounded text-[10px] text-neutral-700 bg-white"
                      />
                      <datalist id={`payer-list-${ex.id}`}>
                        {workersPreset.map(w => (
                          <option key={w.id} value={w.name}>{w.name} ({w.role || '無職稱'})</option>
                        ))}
                      </datalist>
                    </div>

                    {/* Vehicle Select Dropdown */}
                    <select
                      value={ex.vehicle || '公司大庫/銀行'}
                      onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'vehicle', e.target.value)}
                      className="w-24 p-1 border border-neutral-200 rounded text-[10px] bg-white text-neutral-700 font-medium"
                    >
                      <option value="公司大庫/銀行">🏦 公司 (大庫)</option>
                      <option value="A車">🚗 {vehicleNames['A車'] || 'A車'}</option>
                      <option value="B車">🚗 {vehicleNames['B車'] || 'B車'}</option>
                      <option value="C車">🚗 {vehicleNames['C車'] || 'C車'}</option>
                    </select>

                    {/* Amount Input */}
                    <div className="flex items-center gap-0.5">
                      <span className="text-[10px] text-neutral-400 font-mono">$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={ex.amount || ''}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'amount', parseInt(e.target.value, 10) || 0)}
                        className="w-16 p-1 border border-neutral-200 rounded text-[10px] font-mono font-black text-center text-amber-900"
                      />
                    </div>

                    {/* Delete Icon */}
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomExpenseRow(ex.id)}
                      className="p-1 hover:bg-neutral-100 text-neutral-400 hover:text-red-500 rounded transition-colors"
                      title="刪除此列"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* COLUMN 2: Non-project (非案場開銷) */}
            <div className="space-y-4 p-4 bg-neutral-100/60 border border-neutral-200 rounded-xl">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5">
                <span className="text-xs font-black text-neutral-600 flex items-center gap-1">
                  🏢 非案場公務開銷 (公司營運)
                </span>
                <button
                  type="button"
                  onClick={() => handleAddCustomExpenseRow(false)}
                  className="px-2 py-0.5 bg-neutral-600 text-white hover:bg-neutral-700 text-[9px] font-black rounded flex items-center gap-0.5 shadow-3xs"
                >
                  <Plus size={10} />
                  手動新增一列
                </button>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {customExpenses.filter(ce => ce.isProjectExpense === false).map((ex) => (
                  <div key={ex.id} className="p-2 bg-white rounded border border-neutral-200 flex items-center gap-1.5 text-[11px] hover:border-neutral-350 transition-all">
                    {/* Category Select Dropdown */}
                    <select
                      value={ex.type || 'other'}
                      onChange={(e) => handleTypeChange(ex.id, e.target.value, ex.description)}
                      className="w-24 p-1 border border-neutral-200 rounded text-[10px] bg-white text-neutral-600 font-medium"
                    >
                      <option value="parking">🅿️ 停車</option>
                      <option value="fuel">⛽ 加油</option>
                      <option value="meal">🍱 伙食</option>
                      <option value="tool">⚙️ 設備</option>
                      <option value="hardware">🔧 五金</option>
                      <option value="other">💬 其他</option>
                    </select>

                    {/* Description Text Input */}
                    <input
                      type="text"
                      placeholder="說明 / 備註..."
                      value={ex.description}
                      onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'description', e.target.value)}
                      className="flex-1 p-1 border border-neutral-200 rounded text-[10px] text-neutral-600"
                    />

                    {/* Payer Name Selection / Input */}
                    <div className="relative">
                      <input
                        type="text"
                        list={`payer-list-${ex.id}`}
                        placeholder="經手同仁/付款人..."
                        value={ex.payerName || ''}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'payerName', e.target.value)}
                        className="w-24 p-1 border border-neutral-200 rounded text-[10px] text-neutral-600 bg-white"
                      />
                      <datalist id={`payer-list-${ex.id}`}>
                        {workersPreset.map(w => (
                          <option key={w.id} value={w.name}>{w.name} ({w.role || '無職稱'})</option>
                        ))}
                      </datalist>
                    </div>

                    {/* Vehicle Select Dropdown */}
                    <select
                      value={ex.vehicle || '公司大庫/銀行'}
                      onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'vehicle', e.target.value)}
                      className="w-24 p-1 border border-neutral-200 rounded text-[10px] bg-white text-neutral-600 font-medium"
                    >
                      <option value="公司大庫/銀行">🏦 公司 (大庫)</option>
                      <option value="A車">🚗 {vehicleNames['A車'] || 'A車'}</option>
                      <option value="B車">🚗 {vehicleNames['B車'] || 'B車'}</option>
                      <option value="C車">🚗 {vehicleNames['C車'] || 'C車'}</option>
                    </select>

                    {/* Amount Input */}
                    <div className="flex items-center gap-0.5">
                      <span className="text-[10px] text-neutral-400 font-mono">$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={ex.amount || ''}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'amount', parseInt(e.target.value, 10) || 0)}
                        className="w-16 p-1 border border-neutral-200 rounded text-[10px] font-mono font-black text-center text-neutral-600"
                      />
                    </div>

                    {/* Delete Icon */}
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomExpenseRow(ex.id)}
                      className="p-1 hover:bg-neutral-100 text-neutral-450 hover:text-red-500 rounded transition-colors"
                      title="刪除此列"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: Special remarks */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-200 text-neutral-700 font-bold">
            <FileText size={16} className="text-amber-600" />
            <h3 className="text-xs sm:text-sm font-extrabold text-neutral-850">五、 本日施工特別注意事項 / 現場進度特殊備忘錄</h3>
          </div>
          <div>
            <textarea
              rows={3}
              placeholder="請填寫任何需要特別登陸註記事項。例如屋主临时要求變更管路高度、管道粉刷完畢有些微龜裂已叮囑水泥師、冷熱水試壓漏水穩壓12kgw狀態正常，明日交接水泥..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-neutral-200 rounded-xl text-neutral-800 placeholder-neutral-400 text-xs focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </section>

        {/* SECTION 6: Immediate payment collection */}
        <section className="bg-amber-50/30 p-4.5 rounded-xl border border-amber-200/50 space-y-4">
          <div className="flex items-center justify-between border-b border-amber-200/40 pb-2">
            <span className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-neutral-850">
              <span className="text-lg">💰</span>
              六、 現場直接收款與專案報價 (選填；有輸入會直接作為此案場工程款基數)
            </span>
            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              重設工程款計價基數
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-neutral-600 mb-1">
                本日現場報價暨實收金額 (元)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-neutral-400 font-bold text-xs">$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="0 (留空則依常規估算)"
                  value={collectedAmount || ''}
                  onChange={(e) => setCollectedAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full pl-7 pr-3 py-1.5 border border-neutral-200 focus:ring-1 focus:ring-amber-500 rounded-lg text-xs font-mono font-bold text-amber-950 bg-white"
                />
              </div>
            </div>
            <div className="md:col-span-8">
              <p className="text-[11px] text-neutral-500 leading-relaxed font-medium">
                💡 <strong>現場計價機制：</strong>當在此處填入金額時，此金額將<strong>直接做為此案場的工程款基數（即向客戶請款之定額報價）</strong>，且現場當下收訖。在此模式下，系統<strong>不會重複計算材料用料牌價與人力費率牌價</strong>，能直接以此登錄金額完成案場結算。
              </p>
            </div>
          </div>
        </section>

        {/* 佔位空間，防止最下方欄位被 Fixed 提交底欄遮擋 */}
        <div className="h-28"></div>
      </form>
    </div>

    {/* BOTTOM SUBMISSION ROW - FIXED FLOATING AT VIEWPORT BOTTOM */}
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 z-[100] flex items-center justify-end gap-3 p-3 bg-[#0a0a0af5] backdrop-blur-md border border-neutral-800 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold text-neutral-450 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800/80 rounded-xl transition cursor-pointer text-center"
      >
        取消返回
      </button>
      <button
        type="submit"
        form="daily-record-form"
        className="flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold text-neutral-950 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer font-black whitespace-nowrap animate-pulse hover:animate-none"
      >
        <Check size={14} className="stroke-[2.5]" />
        {initialRecordToEdit ? '儲存修改日誌' : '送出施工日誌'}
      </button>
    </div>
  </>
);
}
