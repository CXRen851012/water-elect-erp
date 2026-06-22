import React, { useState, useEffect } from 'react';
import { Project, Worker, MaterialPreset, DailyRecord, RecordMaterial, RecordExpense, RecordWorker, Supplier } from '../types';
import { 
  Plus, Trash2, Calendar, ClipboardList, HardHat, 
  FileText, ShoppingCart, DollarSign, Wrench, PlusCircle, AlertCircle, Sparkles, Check, Scale,
  ShieldCheck, Lock, Unlock, Settings
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
  onCancel: () => void;
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
  onCancel,
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
    return ['全部', ...customCategories];
  }, []);

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
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showCompletedInSelect, setShowCompletedInSelect] = useState<boolean>(false);
  const [prevProjIds, setPrevProjIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [markAsCompleted, setMarkAsCompleted] = useState<boolean>(false);
  const [collectedAmount, setCollectedAmount] = useState<number>(0);
  const [internalCostOnly, setInternalCostOnly] = useState<boolean>(false);

  // 2. Materials log (No visible prices inside logger!)
  const [materials, setMaterials] = useState<RecordMaterial[]>([]);
  const [overridePricingMode, setOverridePricingMode] = useState<boolean>(false);
  const [selectedAddCategory, setSelectedAddCategory] = useState<string>('全部');
  const [selectedAddSubcategory, setSelectedAddSubcategory] = useState<string>('全部');
  const [selectedAddSupplier, setSelectedAddSupplier] = useState<string>('全部');
  const [addSearchQuery, setAddSearchQuery] = useState<string>('');

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

  // 4. Labor crew logs (Hides hourly wages and costs totally inside form)
  const [workers, setWorkers] = useState<RecordWorker[]>([]);

  // Filter projects categories
  const activeProjects = projects.filter(p => !p.isCompleted);
  const completedProjects = projects.filter(p => p.isCompleted);

  const isInitializedRef = React.useRef<string | null>(null);

  // Initialization & Loading values for Editing or Defaults
  useEffect(() => {
    const currentInitKey = initialRecordToEdit ? initialRecordToEdit.id : 'new';
    if (isInitializedRef.current === currentInitKey) {
      // Avoid resetting any of the user entered logs if we are already initialized
      if (!initialRecordToEdit && activeProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(activeProjects[0].id);
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

      // Extract meal and parking from expenses if they exist
      const mealExp = initialRecordToEdit.expenses.find(e => e.type === 'meal' && e.isProjectExpense !== false);
      if (mealExp) {
        setMealAmount(mealExp.amount);
        setMealDesc(mealExp.description);
      } else {
        const legacyMeal = initialRecordToEdit.expenses.find(e => e.type === 'meal' && e.isProjectExpense === undefined);
        if (legacyMeal) {
          setMealAmount(legacyMeal.amount);
          setMealDesc(legacyMeal.description);
        } else {
          setMealAmount(0);
          setMealDesc('');
        }
      }

      const mealGenExp = initialRecordToEdit.expenses.find(e => e.type === 'meal' && e.isProjectExpense === false);
      if (mealGenExp) {
        setGeneralMealAmount(mealGenExp.amount);
        setGeneralMealDesc(mealGenExp.description);
      } else {
        setGeneralMealAmount(0);
        setGeneralMealDesc('');
      }

      const parkExp = initialRecordToEdit.expenses.find(e => e.type === 'parking' && e.isProjectExpense !== false);
      if (parkExp) {
        setParkingAmount(parkExp.amount);
        setParkingDesc(parkExp.description);
      } else {
        const legacyPark = initialRecordToEdit.expenses.find(e => e.type === 'parking' && e.isProjectExpense === undefined);
        if (legacyPark) {
          setParkingAmount(legacyPark.amount);
          setParkingDesc(legacyPark.description);
        } else {
          setParkingAmount(0);
          setParkingDesc('');
        }
      }

      const parkGenExp = initialRecordToEdit.expenses.find(e => e.type === 'parking' && e.isProjectExpense === false);
      if (parkGenExp) {
        setGeneralParkingAmount(parkGenExp.amount);
        setGeneralParkingDesc(parkGenExp.description);
      } else {
        setGeneralParkingAmount(0);
        setGeneralParkingDesc('');
      }

      // Filter out standard ones to load custom blanks and ensure unique IDs
      const otherExps = initialRecordToEdit.expenses.filter(e => e.type !== 'meal' && e.type !== 'parking');
      setCustomExpenses(otherExps.map((ex, idx) => ({
        ...ex,
        id: ex.id || `exp-loaded-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`
      })));

      // Load workers and ensure unique IDs
      setWorkers((initialRecordToEdit.workers || []).map((w, idx) => ({
        ...w,
        id: w.id || `crew-loaded-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`
      })));
    } else {
      // Default initialization
      if (activeProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(activeProjects[0].id);
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
    const defaultPreset = sortedMaterialsPreset[0];
    const defaultUnit = defaultPreset?.unit || '個';
    const prices = defaultPreset ? getUnitAndSupplierPrices(defaultPreset, defaultUnit) : { unitPrice: 0, costPrice: 0 };
    const item: RecordMaterial = {
      id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      materialId: defaultPreset?.id || 'custom',
      name: defaultPreset?.name || '請輸入材料名稱',
      quantity: 1,
      unit: defaultUnit,
      unitPrice: prices.unitPrice,
      costPrice: prices.costPrice,
      isNearbyPurchased: false
    };
    setMaterials([...materials, item]);
  };

  const handleQuickAddPresetMaterial = (preset: MaterialPreset) => {
    const defaultUnit = preset.unit || '個';
    const activeSupplier = selectedAddSupplier === '全部' ? undefined : selectedAddSupplier;
    const prices = getUnitAndSupplierPrices(preset, defaultUnit, activeSupplier);
    const existingIndex = materials.findIndex(
      m => m.materialId === preset.id && 
      !m.isNearbyPurchased && 
      m.unit === defaultUnit && 
      m.storeName === activeSupplier
    );
    if (existingIndex > -1) {
      setMaterials(prev => prev.map((m, idx) => idx === existingIndex ? {
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
        storeName: activeSupplier
      };
      setMaterials([...materials, item]);
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
          storeName: undefined
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
          costPrice: prices.costPrice
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
          costPrice: prices.costPrice
        };
      }
      return m;
    }));
  };

  const handleUpdateMaterialField = (rowId: string, key: keyof RecordMaterial, value: any) => {
    setMaterials(prev => prev.map(m => m.id === rowId ? { ...m, [key]: value } : m));
  };

  const handleRemoveMaterialRow = (rowId: string) => {
    setMaterials(prev => prev.filter(m => m.id !== rowId));
  };

  // --- Labor / Crew Operations ---
  const handleAddWorkerRow = () => {
    const activeStaffIds = workers.map(w => w.workerId);
    const activeOnlyPresets = workersPreset.filter(wp => wp.status !== '離職');
    const availableStaff = activeOnlyPresets.find(wp => !activeStaffIds.includes(wp.id)) || activeOnlyPresets[0];

    const item: RecordWorker = {
      id: `crew-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      workerId: availableStaff?.id || 'support_temp',
      name: availableStaff?.name || '',
      hoursWork: 8, // Standard shifts
      hourlyRate: availableStaff?.defaultHourlyRate || 250, // silent backend value for analytics
      billingHourlyRate: availableStaff ? (availableStaff.billingHourlyRate ?? availableStaff.defaultHourlyRate) : 250,
      isSupport: availableStaff ? false : true
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
    if (choiceId === 'support_temp') {
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
      isProjectExpense
    };
    setCustomExpenses([...customExpenses, item]);
  };

  const handleUpdateCustomExpenseField = (rowId: string, key: keyof RecordExpense, value: any) => {
    setCustomExpenses(prev => prev.map(ex => ex.id === rowId ? { ...ex, [key]: value } : ex));
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

    // Validate that support crew names are not left blank
    const blankSupport = workers.find(w => w.workerId === 'support_temp' && !w.name.trim());
    if (blankSupport) {
      alert('請填寫外調或額外派遣勞工姓名！');
      return;
    }

    // Assemble final expenses array (meals, parking, and custom extras)
    const finalExpensesList: RecordExpense[] = [];
    
    if (mealAmount > 0) {
      finalExpensesList.push({
        id: `exp-meal-${Date.now()}`,
        type: 'meal',
        description: mealDesc.trim() || '當日午晚餐伙食費',
        amount: mealAmount,
        isProjectExpense: true
      });
    }

    if (generalMealAmount > 0) {
      finalExpensesList.push({
        id: `exp-gmeal-${Date.now()}`,
        type: 'meal',
        description: generalMealDesc.trim() || '行政/非案場伙食費',
        amount: generalMealAmount,
        isProjectExpense: false
      });
    }

    if (parkingAmount > 0) {
      finalExpensesList.push({
        id: `exp-parking-${Date.now()}`,
        type: 'parking',
        description: parkingDesc.trim() || '現場車輛停靠/過路車馬資',
        amount: parkingAmount,
        isProjectExpense: true
      });
    }

    if (generalParkingAmount > 0) {
      finalExpensesList.push({
        id: `exp-gparking-${Date.now()}`,
        type: 'parking',
        description: generalParkingDesc.trim() || '通勤/一般交通出開銷',
        amount: generalParkingAmount,
        isProjectExpense: false
      });
    }

    // Filter valid custom expenses (exclude empty name/price)
    customExpenses.forEach(ce => {
      if (ce.amount > 0 || ce.description.trim() !== '') {
        finalExpensesList.push({
          id: ce.id,
          type: ce.type,
          description: ce.description.trim() || '其他現場雜費支出',
          amount: ce.amount,
          isProjectExpense: ce.isProjectExpense ?? true
        });
      }
    });

    onSaveRecord({
      date,
      projectId: selectedProjectId,
      projectName: selectedProjDetails ? getProjectDisplayName(selectedProjDetails) : '未知施工案場',
      materials,
      expenses: finalExpensesList,
      workers,
      notes: notes.trim(),
      markAsCompleted,
      collectedAmount: collectedAmount > 0 ? collectedAmount : undefined,
      internalCostOnly: internalCostOnly
    });
  };

  return (
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

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                  <div className="flex-1 min-w-0 w-full">
                    <select
                      value={selectedProjectId}
                      onChange={(e) => handleProjectSelect(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white font-bold text-neutral-800 focus:ring-1 focus:ring-amber-500 truncate block max-w-full"
                      style={{ maxWidth: '100%' }}
                      required
                    >
                      <option value="" disabled>-- 請選取欲登錄之施工案場（支援新建或未完工） --</option>
                      
                      {activeProjects.length > 0 && (
                        <optgroup label="進行中 / 未完工案場">
                          {activeProjects.map(p => (
                            <option key={p.id} value={p.id}>
                              {getProjectDisplayName(p)}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {completedProjects.filter(p => showCompletedInSelect || p.id === selectedProjectId).length > 0 && (
                        <optgroup label="已完工結案案場 (選取後自動重啟為進行中或標記)">
                          {completedProjects
                             .filter(p => showCompletedInSelect || p.id === selectedProjectId)
                             .map(p => (
                              <option key={p.id} value={p.id}>
                                ⚠️ [已完工] {getProjectDisplayName(p)}
                              </option>
                             ))}
                        </optgroup>
                      )}
                    </select>
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
          <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
            <div className="flex items-center gap-1.5">
              <ShoppingCart size={16} className="text-amber-600" />
              <h3 className="text-xs sm:text-sm font-extrabold text-neutral-850">二、 本日工地用料消耗登記（倉儲出庫 / 附近臨購）</h3>
            </div>
            <button
              type="button"
              onClick={handleAddMaterialRow}
              className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 hover:border-amber-300 text-xs font-bold rounded-lg flex items-center gap-1"
            >
              <Plus size={12} />
              新增耗用材料
            </button>
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
                <span className="text-[10px] font-extrabold text-amber-600 block flex items-center gap-1">
                  <span>📂 依次細分類 (二層細項) 進階過濾：</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {['全部', ...(subcategoriesConfig[selectedAddCategory] || [])].map(sub => {
                    const isSelected = selectedAddSubcategory === sub;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSelectedAddSubcategory(sub)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#D4AF37] text-neutral-900 font-extrabold shadow-3xs'
                            : 'bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-500'
                        }`}
                      >
                        {sub === '全部' ? '🔍 全部次分類' : sub}
                      </button>
                    );
                  })}
                </div>
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
                {activeSuppliersPreset.map(sup => {
                  // Count matches dynamically
                  const matchedCount = sortedMaterialsPreset
                    .filter(p => {
                      const matchesCategory = selectedAddCategory === '全部' || p.category === selectedAddCategory;
                      if (!matchesCategory) return false;
                      const matchesSubcategory = selectedAddSubcategory === '全部' || p.subcategory === selectedAddSubcategory;
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

            {/* Preset Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[170px] overflow-y-auto pr-1 border-t border-neutral-200/60 pt-2.5">
              {sortedMaterialsPreset
                .filter(p => selectedAddCategory === '全部' || p.category === selectedAddCategory)
                .filter(p => selectedAddSubcategory === '全部' || p.subcategory === selectedAddSubcategory)
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
                .filter(p => selectedAddSubcategory === '全部' || p.subcategory === selectedAddSubcategory)
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
          </div>

          {materials.length === 0 ? (
            <div className="text-center py-7 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/20 text-xs text-neutral-400">
              今日工作無消耗倉庫材料，亦無附近緊急購買！若有使用，請點按上方大庫一鍵速選，或點按右上方「新增耗用材料」登記。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold">
                    <td className="py-2 px-3">材料品項預設選擇</td>
                    <td className="py-2 px-3 w-[15%]">數量</td>
                    <td className="py-2 px-3 w-[12%]">單位</td>
                    <td className="py-2 px-3 w-[18%]">緊急臨時採購</td>
                    <td className="py-2 px-3 w-[20%]">
                      {overridePricingMode ? "出庫報帳對客牌價 (微調覆寫)" : "臨購購買單價 (非必填)"}
                    </td>
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
                              className="w-full px-2 py-1.5 border border-neutral-200 rounded text-xs bg-white text-neutral-700"
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
                            const currentStore = m.storeName || 'default';
                            return (
                              <div className="flex flex-col gap-1 bg-neutral-100/60 border border-neutral-200 p-2 rounded-lg text-[10px] text-neutral-600 mt-1 shadow-2xs">
                                {activeSuppliers.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold flex-shrink-0">🏬 報價材料行:</span>
                                    <select
                                      value={currentStore}
                                      onChange={(e) => handleUpdateMaterialSupplierChoice(m.id, e.target.value, preset)}
                                      className="px-1.5 py-0.5 border border-neutral-250 bg-white rounded font-bold text-neutral-800 text-[10px] w-full focus:ring-1 focus:ring-amber-500"
                                    >
                                      <option value="default">-- 使用預設大庫供貨 --</option>
                                      {activeSuppliers.map(sup => (
                                        <option key={sup.id} value={sup.storeName}>
                                          {sup.storeName}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div className="text-[9px] text-neutral-400 font-sans italic">
                                    💡 此規格單位目前尚無特約店家的合約報價。
                                  </div>
                                )}
                                <div className="text-[9px] pl-0.5 leading-snug font-sans text-neutral-500 scale-95 origin-left italic">
                                  已選定：{m.storeName ? `🏬 【${m.storeName}】特約對照用料` : '📦 預設大庫供貨儲備'}
                                </div>
                              </div>
                            );
                          })()}

                          {(!m.materialId || m.isNearbyPurchased) && (
                            <input
                              type="text"
                              required
                              placeholder="請輸入自打材料品名 (如：廚房止水閥、軟管)"
                              value={m.name}
                              onChange={(e) => handleUpdateMaterialField(m.id, 'name', e.target.value)}
                              className="w-full px-2 py-1 border border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 rounded text-xs bg-amber-50/10 placeholder-neutral-400 text-amber-900"
                            />
                          )}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <input
                            type="number"
                            required
                            min="0.1"
                            step="any"
                            value={m.quantity}
                            onChange={(e) => handleUpdateMaterialField(m.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-750 font-mono text-center font-medium"
                          />
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
                              required
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
                            <input
                              type="text"
                              placeholder="買辦店家（如大永五金）"
                              value={m.storeName || ''}
                              onChange={(e) => handleUpdateMaterialField(m.id, 'storeName', e.target.value)}
                              className="w-full px-2 py-1 border border-neutral-200 rounded text-[10px] text-neutral-600"
                            />
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
                            {m.costPrice !== undefined && m.costPrice > 0 && (
                              <span className="text-[9px] text-neutral-400 text-center font-bold">臨購成本: ${m.costPrice}</span>
                            )}
                          </div>
                        ) : overridePricingMode ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 bg-amber-50/30 p-1 border border-dashed border-amber-400 rounded-lg">
                              <span className="text-amber-700 font-black text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="出庫牌價覆寫"
                                value={m.unitPrice || 0}
                                onChange={(e) => handleUpdateMaterialField(m.id, 'unitPrice', parseInt(e.target.value, 10) || 0)}
                                className="w-full p-0.5 bg-white border border-neutral-200 rounded text-xs font-mono font-black text-amber-950 text-center focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            {(() => {
                              const preset = m.materialId ? sortedMaterialsPreset.find(p => p.id === m.materialId) : null;
                              if (preset) {
                                const pricing = getUnitAndSupplierPrices(preset, m.unit, m.storeName);
                                return (
                                  <div className="space-y-1 block mt-0.5 text-center">
                                    <span className="text-[9px] text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-1 py-0.5 rounded font-black block leading-none">
                                      🏢 供貨成本: ${pricing.costPrice}
                                    </span>
                                    <span className="text-[9px] text-neutral-400 block leading-none select-none italic">
                                      原規牌價: ${pricing.unitPrice}
                                    </span>
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
          <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200">
            <div className="flex items-center gap-1.5">
              <HardHat size={16} className="text-amber-600" />
              <h3 className="text-xs sm:text-sm font-extrabold text-neutral-850 font-sans">
                三、 當日出勤派遣人員與各別工時填報
              </h3>
            </div>
            <button
              type="button"
              onClick={handleAddWorkerRow}
              className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 hover:border-amber-300 text-xs font-bold rounded-lg flex items-center gap-1"
            >
              <Plus size={12} />
              派遣出勤工班
            </button>
          </div>

          {workers.length === 0 ? (
            <div className="text-center py-7 border border-dashed border-neutral-200 rounded-xl bg-neutral-50/20 text-xs text-neutral-400">
              暫無派遣人員出勤填報！請點按右上方「派遣出勤工班」登記出勤師傅、時數。
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
                          value={w.workerId}
                          onChange={(e) => handleUpdateCrewWorkerType(w.id, e.target.value)}
                          className="w-full p-2 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-extrabold focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                        >
                          <optgroup label="固定在職人員名單 (快速點選)">
                            {workersPreset.filter(wp => wp.status !== '離職').map(wp => (
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
                              required
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
                            {[4, 8, 10, 12].map(h => (
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
                                  required
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
                                      required
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
                                      required
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
              * 提示：算在案場內的開銷將列入報表向客戶估算或對帳；非案場一般餐飲與通用車馬費則不計入該專案對外帳目。
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
                  新增案場代墊
                </button>
              </div>

              {/* Site Meal */}
              <div className="space-y-1.5 p-2 bg-white rounded border border-neutral-200 text-xs">
                <span className="font-extrabold text-neutral-700 flex items-center gap-1">🍱 案場施工伙食飲料</span>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <span className="text-[9px] text-neutral-400 font-bold block">金額 ($)</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={mealAmount || ''}
                      onChange={(e) => setMealAmount(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-1 border border-neutral-200 rounded font-mono font-bold"
                    />
                  </div>
                  <div className="col-span-8">
                    <span className="text-[9px] text-neutral-400 font-bold block">說明 / 備註</span>
                    <input
                      type="text"
                      placeholder="如：案場午餐及飲料"
                      value={mealDesc}
                      onChange={(e) => setMealDesc(e.target.value)}
                      className="w-full p-1 border border-neutral-200 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Site Parking */}
              <div className="space-y-1.5 p-2 bg-white rounded border border-neutral-200 text-xs">
                <span className="font-extrabold text-neutral-700 flex items-center gap-1">🅿️ 案場停車與過路費</span>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <span className="text-[9px] text-neutral-400 font-bold block">金額 ($)</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={parkingAmount || ''}
                      onChange={(e) => setParkingAmount(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-1 border border-neutral-200 rounded font-mono font-bold"
                    />
                  </div>
                  <div className="col-span-8">
                    <span className="text-[9px] text-neutral-400 font-bold block">說明 / 備註</span>
                    <input
                      type="text"
                      placeholder="如：案場地下停車費"
                      value={parkingDesc}
                      onChange={(e) => setParkingDesc(e.target.value)}
                      className="w-full p-1 border border-neutral-200 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Site Expenses */}
              {customExpenses.filter(ce => ce.isProjectExpense !== false).length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-dashed border-amber-200">
                  <span className="text-[9px] font-black text-amber-800 block">其他自填案場代墊費用：</span>
                  {customExpenses.filter(ce => ce.isProjectExpense !== false).map(ex => (
                    <div key={ex.id} className="p-2 bg-white rounded border border-amber-100 flex items-center gap-1.5 text-[11px]">
                      <select
                        value={ex.type}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'type', e.target.value)}
                        className="w-24 p-0.5 border border-neutral-200 rounded text-[10px] bg-white text-neutral-700"
                      >
                        <option value="other">💬 現場耗雜</option>
                        <option value="tool">🔨 臨時五金</option>
                        <option value="fuel">⛽ 施工車油</option>
                      </select>
                      <input
                        type="text"
                        placeholder="項目描述..."
                        value={ex.description}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'description', e.target.value)}
                        className="flex-1 p-0.5 border border-neutral-200 rounded text-[10px]"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="金額"
                        value={ex.amount || ''}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'amount', parseInt(e.target.value, 10) || 0)}
                        className="w-14 p-0.5 border border-neutral-200 rounded text-[10px] font-mono font-black text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomExpenseRow(ex.id)}
                        className="p-1 hover:bg-neutral-100 text-neutral-400 hover:text-red-500 rounded"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                  新增公司自理
                </button>
              </div>

              {/* General Meal */}
              <div className="space-y-1.5 p-2 bg-white rounded border border-neutral-200 text-xs">
                <span className="font-extrabold text-neutral-700 flex items-center gap-1">🍱 營運辦公伙食交通</span>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <span className="text-[9px] text-neutral-400 font-bold block">金額 ($)</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={generalMealAmount || ''}
                      onChange={(e) => setGeneralMealAmount(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-1 border border-neutral-200 rounded font-mono font-bold text-neutral-600"
                    />
                  </div>
                  <div className="col-span-8">
                    <span className="text-[9px] text-neutral-400 font-bold block">說明 / 備註</span>
                    <input
                      type="text"
                      placeholder="如：內部會議餐盒"
                      value={generalMealDesc}
                      onChange={(e) => setGeneralMealDesc(e.target.value)}
                      className="w-full p-1 border border-neutral-200 rounded text-neutral-600"
                    />
                  </div>
                </div>
              </div>

              {/* General Parking */}
              <div className="space-y-1.5 p-2 bg-white rounded border border-neutral-200 text-xs">
                <span className="font-extrabold text-neutral-700 flex items-center gap-1">🅿️ 一般通勤與公務停車</span>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <span className="text-[9px] text-neutral-400 font-bold block">金額 ($)</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={generalParkingAmount || ''}
                      onChange={(e) => setGeneralParkingAmount(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-1 border border-neutral-200 rounded font-mono font-bold text-neutral-600"
                    />
                  </div>
                  <div className="col-span-8">
                    <span className="text-[9px] text-neutral-400 font-bold block">說明 / 備註</span>
                    <input
                      type="text"
                      placeholder="如：公司公務車一般加油"
                      value={generalParkingDesc}
                      onChange={(e) => setGeneralParkingDesc(e.target.value)}
                      className="w-full p-1 border border-neutral-200 rounded text-neutral-600"
                    />
                  </div>
                </div>
              </div>

              {/* Custom General Expenses */}
              {customExpenses.filter(ce => ce.isProjectExpense === false).length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-dashed border-neutral-350">
                  <span className="text-[9px] font-black text-neutral-600 block">其他自理及一般營運代墊：</span>
                  {customExpenses.filter(ce => ce.isProjectExpense === false).map(ex => (
                    <div key={ex.id} className="p-2 bg-white rounded border border-neutral-200 flex items-center gap-1.5 text-[11px]">
                      <select
                        value={ex.type}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'type', e.target.value)}
                        className="w-24 p-0.5 border border-neutral-200 rounded text-[10px] bg-white text-neutral-700"
                      >
                        <option value="other">💬 一般營運</option>
                        <option value="fuel">⛽ 一般車油</option>
                        <option value="tool">🔨 辦公器具</option>
                      </select>
                      <input
                        type="text"
                        placeholder="項目描述..."
                        value={ex.description}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'description', e.target.value)}
                        className="flex-1 p-0.5 border border-neutral-200 rounded text-[10px] text-neutral-600"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="金額"
                        value={ex.amount || ''}
                        onChange={(e) => handleUpdateCustomExpenseField(ex.id, 'amount', parseInt(e.target.value, 10) || 0)}
                        className="w-14 p-0.5 border border-neutral-200 rounded text-[10px] font-mono font-black text-center text-neutral-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomExpenseRow(ex.id)}
                        className="p-1 hover:bg-neutral-100 text-neutral-400 hover:text-red-500 rounded"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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

        {/* BOTTOM SUBMISSION ROW - NO EXPENSIVE FINANCIAL PREVIEW ON WORKERS LOGGING SIDE */}
        <div className="p-4 bg-neutral-900 border border-neutral-950 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400 animate-pulse flex-shrink-0" />
            <p className="text-xs text-neutral-300">
              請檢查以上填報專案材料、人员時數完全正確，確認無誤後即可點按按鈕存檔。
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="w-1/2 sm:w-auto px-5 py-2 text-xs font-bold text-neutral-400 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition"
            >
              取消返回
            </button>
            <button
              type="submit"
              className="w-1/2 sm:w-auto px-6 py-2 text-xs font-bold text-neutral-900 bg-amber-400 hover:bg-amber-500 rounded-xl shadow-md transition flex items-center justify-center gap-1"
            >
              <Check size={14} className="stroke-[2.5]" />
              {initialRecordToEdit ? '儲存修改日誌' : '送出施工日誌'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
