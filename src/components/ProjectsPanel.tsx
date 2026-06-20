import React, { useState } from 'react';
import { Project, DailyRecord, MaterialPreset, Supplier, RecordWorker, RecordMaterial } from '../types';
import { 
  FolderLock, CheckCircle, Clock, Search, ShieldCheck, HardHat, 
  Eye, Edit, Edit2, Trash2, Calendar, User, Hammer, ClipboardList, 
  Info, FileText, X, AlertTriangle, Phone, MapPin, Coins, ArrowRight, Plus, Trash, Sparkles, Scale
} from 'lucide-react';

interface ProjectsPanelProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  onSaveToast: (msg: string) => void;
  records: DailyRecord[];
  onEditRecord: (record: DailyRecord) => void;
  onDeleteRecord: (id: string) => void;
  materialsPreset: MaterialPreset[];
  suppliers: Supplier[];
}

export default function ProjectsPanel({
  projects,
  setProjects,
  onSaveToast,
  records,
  onEditRecord,
  onDeleteRecord,
  materialsPreset,
  suppliers
}: ProjectsPanelProps) {
  const activeSuppliers = (suppliers || []).filter(s => s.showInMaterialsDatabase !== false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | '報價中' | '施工進行中' | '已完工' | '未成'>('全部');
  const [sortMethod, setSortMethod] = useState<'newest' | 'oldest' | 'serial' | 'ownerName'>('newest');
  const [showOptimizationPanel, setShowOptimizationPanel] = useState<boolean>(true);

  // --- Estimation Page State Management ---
  const [estimationProject, setEstimationProject] = useState<Project | null>(null);
  const [estLabor, setEstLabor] = useState<RecordWorker[]>([]);
  const [estMaterials, setEstMaterials] = useState<RecordMaterial[]>([]);
  const [estQuoteAmount, setEstQuoteAmount] = useState<number>(0);
  const [estStatus, setEstStatus] = useState<'估價中' | '進行中施工'>('估價中');

  // New estimation quick add selection states
  const [estSelectedAddCategory, setEstSelectedAddCategory] = useState<string>('全部');
  const [estSelectedAddSupplier, setEstSelectedAddSupplier] = useState<string>('全部');

  const getEstUnitAndSupplierPrices = (preset: MaterialPreset, selectedUnit: string, storeName?: string) => {
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
      const supplierItem = preset.suppliers?.find(s => s.storeName === storeName);
      if (supplierItem) {
        return {
          unitPrice: supplierItem.listPrice,
          costPrice: supplierItem.costPrice
        };
      }
    }
    return {
      unitPrice: preset.defaultUnitPrice,
      costPrice: preset.defaultCostPrice !== undefined ? preset.defaultCostPrice : preset.defaultUnitPrice
    };
  };

  const handleStartEstimation = (p: Project) => {
    setEstimationProject(p);
    setEstLabor(p.estimationLabor || []);
    setEstMaterials(p.estimationMaterials || []);
    setEstQuoteAmount(p.estimationQuoteAmount || 0);
    setEstStatus(p.estimationStatus || '估價中');
    // Reset quick add filters
    setEstSelectedAddCategory('全部');
    setEstSelectedAddSupplier('全部');
  };

  const handleAddEstLabor = () => {
    const item: RecordWorker = {
      id: `est-crew-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      workerId: 'estimation_labor_item',
      name: '水電師傅',
      hoursWork: 8,
      hourlyRate: 375, // 3000 / 8
      isSupport: true,
      workerCount: 1,
      daysWork: 1.0,
      estimationSalary: 3000
    };
    setEstLabor([...estLabor, item]);
  };

  const handleUpdateEstLabor = (rowId: string, key: 'name' | 'workerCount' | 'daysWork' | 'estimationSalary', value: any) => {
    setEstLabor(prev => prev.map(w => {
      if (w.id === rowId) {
        const count = key === 'workerCount' ? value : (w.workerCount ?? 1);
        const days = key === 'daysWork' ? value : (w.daysWork ?? 1.0);
        const salary = key === 'estimationSalary' ? value : (w.estimationSalary ?? 3000);
        return {
          ...w,
          [key]: value,
          workerCount: count,
          daysWork: days,
          estimationSalary: salary,
          hoursWork: count * days * 8,
          hourlyRate: salary / 8
        };
      }
      return w;
    }));
  };

  const handleRemoveEstLabor = (rowId: string) => {
    setEstLabor(estLabor.filter(w => w.id !== rowId));
  };

  const handleAddEstMaterial = () => {
    const defaultPreset = materialsPreset[0] || { id: 'custom', name: '預設PVC管', defaultUnitPrice: 100, defaultCostPrice: 70, unit: '支' };
    const item: RecordMaterial = {
      id: `est-mat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      materialId: defaultPreset.id,
      name: defaultPreset.name,
      quantity: 10,
      unit: defaultPreset.unit || '個',
      unitPrice: defaultPreset.defaultUnitPrice || 100, // listPrice/牌價
      costPrice: defaultPreset.defaultCostPrice || 70, // costPrice/進用成本
      isNearbyPurchased: false
    };
    setEstMaterials([...estMaterials, item]);
  };

  const handleQuickAddEstPresetMaterial = (preset: MaterialPreset) => {
    const defaultUnit = preset.unit || '個';
    const activeSupplier = estSelectedAddSupplier === '全部' ? undefined : estSelectedAddSupplier;
    const prices = getEstUnitAndSupplierPrices(preset, defaultUnit, activeSupplier);
    const existingIndex = estMaterials.findIndex(
      m => m.materialId === preset.id && 
      !m.isNearbyPurchased && 
      m.unit === defaultUnit && 
      m.storeName === activeSupplier
    );
    if (existingIndex > -1) {
      setEstMaterials(prev => prev.map((m, idx) => idx === existingIndex ? {
        ...m,
        quantity: m.quantity + 10
      } : m));
    } else {
      const item: RecordMaterial = {
        id: `est-mat-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`,
        materialId: preset.id,
        name: preset.name,
        quantity: 10,
        unit: defaultUnit,
        unitPrice: prices.unitPrice,
        costPrice: prices.costPrice,
        isNearbyPurchased: false,
        storeName: activeSupplier
      };
      setEstMaterials([...estMaterials, item]);
    }
  };

  const handleUpdateEstMaterialChoice = (rowId: string, presetId: string) => {
    if (presetId === 'custom') {
      setEstMaterials(prev => prev.map(m => m.id === rowId ? {
        ...m,
        materialId: undefined,
        name: '',
        unit: '個',
        unitPrice: 0,
        costPrice: 0,
        isNearbyPurchased: true,
        storeName: undefined
      } : m));
    } else {
      const preset = materialsPreset.find(p => p.id === presetId);
      if (preset) {
        const defaultUnit = preset.unit || '個';
        const prices = getEstUnitAndSupplierPrices(preset, defaultUnit);
        setEstMaterials(prev => prev.map(m => m.id === rowId ? {
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

  const handleUpdateEstMaterialUnitChoiceInRow = (rowId: string, unitStr: string, preset: MaterialPreset) => {
    setEstMaterials(prev => prev.map(m => {
      if (m.id === rowId) {
        const prices = getEstUnitAndSupplierPrices(preset, unitStr, m.storeName);
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

  const handleUpdateEstMaterialSupplierChoice = (rowId: string, storeName: string, preset: MaterialPreset) => {
    setEstMaterials(prev => prev.map(m => {
      if (m.id === rowId) {
        const targetStore = storeName === 'default' ? undefined : storeName;
        const prices = getEstUnitAndSupplierPrices(preset, m.unit, targetStore);
        return {
          ...m,
          storeName: targetStore,
          unitPrice: prices.unitPrice,
          costPrice: prices.costPrice
        };
      }
      return m;
    }));
  };

  const handleUpdateEstMaterialField = (rowId: string, key: 'name' | 'quantity' | 'unit' | 'unitPrice' | 'costPrice' | 'storeName' | 'isNearbyPurchased', value: any) => {
    setEstMaterials(prev => prev.map(m => {
      if (m.id === rowId) {
        return {
          ...m,
          [key]: value
        };
       }
       return m;
     }));
   };

   const handleRemoveEstMaterial = (rowId: string) => {
     setEstMaterials(estMaterials.filter(m => m.id !== rowId));
   };

   const handleSaveEstimation = () => {
     if (!estimationProject) return;

     setProjects(prev => prev.map(p => {
       if (p.id === estimationProject.id) {
         // Generated name update prefix in case isEstimation switches to true
         const baseNameWithoutEstim = p.generatedName.startsWith('[估]') ? p.generatedName.substring(3) : p.generatedName;
         const updatedName = `[估]${baseNameWithoutEstim}`;

         return {
           ...p,
           isEstimation: true,
           generatedName: updatedName,
           estimationLabor: estLabor,
           estimationMaterials: estMaterials,
           estimationQuoteAmount: estQuoteAmount,
           estimationStatus: estStatus
         };
       }
       return p;
     }));

     onSaveToast(`✅ 案場【${estimationProject.companyOrOwner}】工程預估暨報價明細儲存成功！`);
     setEstimationProject(null);
   };

  // Interactive details modal states
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<Project | null>(null);
  const [convertConfirmProjectId, setConvertConfirmProjectId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirmRecordId, setDeleteConfirmRecordId] = useState<string | null>(null);
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null);

  // Editing Project basic info states
  const [editCompanyOrOwner, setEditCompanyOrOwner] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editFullAddress, setEditFullAddress] = useState('');
  const [editAddressAbbreviated, setEditAddressAbbreviated] = useState('');
  const [editProjectNotes, setEditProjectNotes] = useState('');
  const [editIsEstimation, setEditIsEstimation] = useState(false);
  const [editEstimationStatus, setEditEstimationStatus] = useState<'估價中' | '進行中施工' | '報價未成'>('估價中');

  const handleToggleProjectStatus = (id: string) => {
    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id === id) {
        const nextState = !p.isCompleted;
        let additionalFields: Partial<Project> = {};
        if (p.isEstimation) {
          if (!nextState) {
            additionalFields.estimationStatus = '進行中施工';
          } else {
            if (p.estimationStatus === '估價中' || p.estimationStatus === '報價未成') {
              additionalFields.estimationStatus = '進行中施工';
            }
          }
        }
        onSaveToast(nextState ? `✅ 案場【${p.companyOrOwner}】已完工結案！` : `⚡ 案場【${p.companyOrOwner}】已還原恢復施工狀態！`);
        return { ...p, isCompleted: nextState, ...additionalFields };
      }
      return p;
    }));
  };

  const handleUpdateEstimationStatus = (id: string, status: '估價中' | '進行中施工' | '報價未成') => {
    if (status === '報價未成') {
      const hasRecords = records.some(r => r.projectId === id);
      if (hasRecords) {
        alert('❌ 無法切換狀態！此估價案場下已有登錄的施工履歷（工務日誌記錄），無法切換為「報價未成」狀態！若要設為未成，請先刪除相應的工務日誌，或改設為「估價中」或完工結案。');
        return;
      }
    }

    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id === id) {
        let statusLabel = '';
        if (status === '估價中') statusLabel = '⏳ 報價中';
        else if (status === '進行中施工') statusLabel = '🏗️ 進行中施工';
        else if (status === '報價未成') statusLabel = '❌ 報價未成';
        
        onSaveToast(`📈 案場【${p.companyOrOwner}】已成功切換為【${statusLabel}】狀態！`);
        return { 
          ...p, 
          estimationStatus: status,
          isCompleted: status === '報價未成' ? true : (status === '估價中' ? false : p.isCompleted)
        };
      }
      return p;
    }));
  };

  const handleConvertEstimationToFormal = (p: Project, skipConfirm = false) => {
    if (!skipConfirm) {
      setConvertConfirmProjectId(p.id);
      return;
    }

    setProjects(prevProjects => prevProjects.map(item => {
      if (item.id === p.id) {
        // Assemble name using the exact estimation standard formula
        const prefixDate = item.createdAt ? item.createdAt.substring(0, 10).replace(/-/g, '') : new Date().toISOString().substring(0, 10).replace(/-/g, '');
        let clientPart = item.companyOrOwner.trim();
        const p_name = (item.contactPerson || '').trim();
        const ph = (item.contactPhone || '').trim();

        if (p_name && p_name !== '本人' && p_name !== item.companyOrOwner.trim()) {
          if (ph) {
            clientPart += `(${p_name}:${ph})`;
          } else {
            clientPart += `(${p_name})`;
          }
        } else {
          if (ph) {
            clientPart += `(${ph})`;
          }
        }

        const addrAbbrev = (item.addressAbbreviated || '').trim();
        const addressPart = addrAbbrev ? `(${addrAbbrev})${item.fullAddress.trim()}` : item.fullAddress.trim();

        let serial = item.serialNumber || '001';
        if (serial.includes('-')) {
          const parts = serial.split('-');
          serial = parts[parts.length - 1];
        }
        if (/^\d+$/.test(serial)) {
          serial = serial.padStart(3, '0');
        }

        const baseName = `${prefixDate}-${clientPart}-${addressPart}-${serial}`;
        // Ensure standard assembly name formula (with [估] prefix) is used
        const finalEstName = `[估]${baseName}`;

        return {
          ...item,
          isEstimation: false,
          estimationStatus: undefined,
          generatedName: finalEstName
        };
      }
      return item;
    }));

    onSaveToast(`⚡ 估價案場【${p.companyOrOwner}】已成功結轉為正式施工案場！工料與人力預估已成功保留作爲「施工算盤預算對比」追蹤依據，且名稱已採用估價黃金公式組裝儲存！`);
  };

  // Helper to trigger basic info editor
  const handleStartEditProject = (p: Project) => {
    setEditingProject(p);
    setEditCompanyOrOwner(p.companyOrOwner);
    setEditContactPerson(p.contactPerson || '');
    setEditContactPhone(p.contactPhone || '');
    setEditFullAddress(p.fullAddress);
    setEditAddressAbbreviated(p.addressAbbreviated || '');
    setEditProjectNotes(p.projectNotes || '');
    setEditIsEstimation(p.isEstimation || false);
    setEditEstimationStatus(p.estimationStatus || '估價中');
  };

  const handleSaveBasicInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    if (!editCompanyOrOwner.trim() || !editFullAddress.trim()) {
      onSaveToast('❌ 錯誤：業主名稱與完整地址為必填項目！');
      return;
    }

    if (editIsEstimation && editEstimationStatus === '報價未成') {
      const hasRecords = records.some(r => r.projectId === editingProject.id);
      if (hasRecords) {
        alert('❌ 無法變更狀態！此案場下已有登錄的施工履歷（工務日誌記錄），不可變更為「報價未成」狀態！請先移除相應的工務日誌記錄。');
        return;
      }
    }

    setProjects(prev => prev.map(p => {
      if (p.id === editingProject.id) {
        const prefixDate = p.createdAt ? p.createdAt.substring(0, 10).replace(/-/g, '') : '20260530';
        
        let clientPart = editCompanyOrOwner.trim();
        const p_name = editContactPerson.trim();
        const ph = editContactPhone.trim();
        
        if (p_name && p_name !== '本人' && p_name !== editCompanyOrOwner.trim()) {
          if (ph) {
            clientPart += `(${p_name}:${ph})`;
          } else {
            clientPart += `(${p_name})`;
          }
        } else {
          if (ph) {
            clientPart += `(${ph})`;
          }
        }

        const addrAbbrev = editAddressAbbreviated.trim();
        let addressPart = '';
        if (addrAbbrev) {
          addressPart = `(${addrAbbrev})${editFullAddress.trim()}`;
        } else {
          addressPart = editFullAddress.trim();
        }

        const baseName = `${prefixDate}-${clientPart}-${addressPart}-${p.serialNumber}`;
        const genName = editIsEstimation ? `[估]${baseName}` : baseName;

        return {
          ...p,
          companyOrOwner: editCompanyOrOwner,
          contactPerson: editContactPerson,
          contactPhone: editContactPhone,
          fullAddress: editFullAddress,
          addressAbbreviated: editAddressAbbreviated,
          projectNotes: editProjectNotes,
          isEstimation: editIsEstimation,
          estimationStatus: editIsEstimation ? editEstimationStatus : undefined,
          generatedName: genName
        };
      }
      return p;
    }));

    // Update state variables to match modified project basic details
    const updatedProj: Project = {
      ...editingProject,
      companyOrOwner: editCompanyOrOwner,
      contactPerson: editContactPerson,
      contactPhone: editContactPhone,
      fullAddress: editFullAddress,
      addressAbbreviated: editAddressAbbreviated,
      projectNotes: editProjectNotes,
      isEstimation: editIsEstimation,
      estimationStatus: editIsEstimation ? editEstimationStatus : undefined,
    };

    if (selectedProjectForDetail?.id === editingProject.id) {
      setSelectedProjectForDetail(updatedProj);
    }

    onSaveToast(`✅ 案場【${editCompanyOrOwner}】基本資料修改成功！`);
    setEditingProject(null);
  };

  // Stats calculation
  const countAll = projects.length;
  const countQuote = projects.filter(p => p.isEstimation && p.estimationStatus === '估價中').length;
  const countOngoing = projects.filter(p => !p.isCompleted && (!p.isEstimation || p.estimationStatus === '進行中施工')).length;
  const countCompleted = projects.filter(p => p.isCompleted).length;
  const countFailed = projects.filter(p => p.isEstimation && p.estimationStatus === '報價未成').length;

  // Filtered and sorted projects
  const filteredProjects = projects.filter(p => {
    // 1. Status Filter
    if (statusFilter === '報價中') {
      if (!p.isEstimation || p.estimationStatus !== '估價中') return false;
    } else if (statusFilter === '施工進行中') {
      if (p.isCompleted || (p.isEstimation && p.estimationStatus !== '進行中施工')) return false;
    } else if (statusFilter === '已完工') {
      if (!p.isCompleted) return false;
    } else if (statusFilter === '未成') {
      if (!p.isEstimation || p.estimationStatus !== '報價未成') return false;
    }

    // 2. Search Query
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    return (
      (p.serialNumber && p.serialNumber.toLowerCase().includes(q)) ||
      (p.companyOrOwner && p.companyOrOwner.toLowerCase().includes(q)) ||
      (p.contactPerson && p.contactPerson.toLowerCase().includes(q)) ||
      (p.fullAddress && p.fullAddress.toLowerCase().includes(q)) ||
      (p.addressAbbreviated && p.addressAbbreviated.toLowerCase().includes(q)) ||
      (p.generatedName && p.generatedName.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    if (sortMethod === 'oldest') {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    }
    if (sortMethod === 'serial') {
      return (a.serialNumber || '').localeCompare(b.serialNumber || '');
    }
    if (sortMethod === 'ownerName') {
      return (a.companyOrOwner || '').localeCompare(b.companyOrOwner || '');
    }
    // Default 'newest'
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

return (
    <div className="space-y-6">
      {/* Stats Cards Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-200/70 flex items-center justify-center text-neutral-700 shrink-0">
            <FolderLock size={15} />
          </div>
          <div>
            <span className="text-xs text-neutral-500 font-bold block">總案場</span>
            <span className="text-sm font-black text-neutral-800 font-mono">{countAll} 個</span>
          </div>
        </div>

        <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <Clock size={15} />
          </div>
          <div>
            <span className="text-xs text-amber-600 font-bold block">評估報價中</span>
            <span className="text-sm font-black text-amber-900 font-mono">{countQuote} 個</span>
          </div>
        </div>

        <div className="p-3 bg-sky-50/50 border border-sky-200 rounded-xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700 shrink-0">
            <HardHat size={15} />
          </div>
          <div>
            <span className="text-xs text-sky-600 font-bold block">常規施作中</span>
            <span className="text-sm font-black text-sky-900 font-mono">{countOngoing} 個</span>
          </div>
        </div>

        <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle size={15} />
          </div>
          <div>
            <span className="text-xs text-emerald-600 font-bold block">合同已竣工</span>
            <span className="text-sm font-black text-emerald-950 font-mono">{countCompleted} 個</span>
          </div>
        </div>

        <div className="p-3 bg-red-50/50 border border-red-200 rounded-xl flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-700 shrink-0">
            <AlertTriangle size={15} />
          </div>
          <div>
            <span className="text-xs text-red-650 font-bold block">議價未成交</span>
            <span className="text-sm font-black text-red-900 font-mono">{countFailed} 個</span>
          </div>
        </div>
      </div>




      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-center justify-between p-3.5 bg-neutral-100 rounded-xl border-2 border-neutral-300">
        <div className="flex gap-1.5 w-full lg:w-auto flex-wrap m-px">
          {(['全部', '報價中', '施工進行中', '已完工', '未成'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer border ${
                statusFilter === f
                  ? 'bg-amber-600 text-white border-amber-700 shadow-3xs'
                  : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto items-center">
          {/* 排序選擇器 */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 bg-white border-2 border-neutral-300 rounded-lg px-2.5 py-2 text-xs text-neutral-800 font-bold shadow-3xs">
            <span className="text-neutral-500 font-black">📅 排序顯示:</span>
            <select
              value={sortMethod}
              onChange={(e) => setSortMethod(e.target.value as any)}
              className="bg-transparent border-none font-extrabold text-xs text-neutral-800 focus:outline-none cursor-pointer p-0 pr-1.5"
            >
              <option value="newest">🆕 最新建立日期 (最新 ➔ 最舊)</option>
              <option value="oldest">⏳ 最最早建立日期 (最早 ➔ 最舊)</option>
              <option value="serial">🔢 案場流水編號 (按流水號排序)</option>
              <option value="ownerName">👤 依業主姓名名稱 (中文字順)</option>
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-3 text-neutral-500" />
            <input
              type="text"
              placeholder="搜尋案場、業主、地址或流水號..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border-2 border-neutral-300 bg-white rounded-lg text-sm text-neutral-900 font-sans font-bold focus:outline-none focus:border-amber-600 focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-200 rounded-xl text-neutral-400 text-xs italic bg-neutral-50/10">
          💡 目前沒有符合篩選條件的案場！
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredProjects.map(p => {
            const projectRecords = records.filter(r => r.projectId === p.id);
            
            // Calculate actual cost so far
            const actualRecordCost = projectRecords.reduce((total, r) => {
              const matSum = r.materials.reduce((sum, m) => sum + ((m.costPrice ?? m.unitPrice * 0.7) * m.quantity), 0);
              const laborSum = r.workers.reduce((sum, w) => {
                const reg = Math.min(w.hoursWork, 8);
                const ot1 = Math.min(Math.max(w.hoursWork - 8, 0), 2);
                const ot2 = Math.max(w.hoursWork - 10, 0);
                const wages = (reg * w.hourlyRate) + (ot1 * w.hourlyRate * 1.34) + (ot2 * w.hourlyRate * 1.34);
                return sum + Math.round(wages);
              }, 0);
              const expSum = r.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
              return total + matSum + laborSum + expSum;
            }, 0);

            // Cost for analytics / comparison
            const totalRecordCostForDisplay = projectRecords.reduce((total, r) => {
              const matSum = r.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
              const laborSum = r.workers.reduce((sum, w) => {
                const rate = w.billingHourlyRate ?? w.hourlyRate;
                const reg = Math.min(w.hoursWork, 8);
                const ot1 = Math.min(Math.max(w.hoursWork - 8, 0), 2);
                const ot2 = Math.max(w.hoursWork - 10, 0);
                const wages = (reg * rate) + (ot1 * rate * 1.34) + (ot2 * rate * 1.34);
                return sum + Math.round(wages);
              }, 0);
              const expSum = r.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
              return total + matSum + laborSum + expSum;
            }, 0);

            const quote = p.estimationQuoteAmount ?? 0;
            const estLaborCost = p.estimationLabor?.reduce((sum, w) => sum + ((w.workerCount ?? 1) * (w.daysWork ?? 1) * (w.estimationSalary ?? 3000)), 0) ?? 0;
            const estMatCost = p.estimationMaterials?.reduce((sum, m) => sum + (m.quantity * (m.costPrice ?? m.unitPrice * 0.7)), 0) ?? 0;
            const totalEstCost = estLaborCost + estMatCost;

            const costToCompare = p.isEstimation ? totalEstCost : (actualRecordCost > 0 ? actualRecordCost : totalEstCost);

            // Audit price alerts based strictly on items
            const priceWarningsList: string[] = [];

            // ⚠️ 建議二：自動化利潤毛利預警機制 (僅限估價案場)
            if (p.isEstimation) {
              if (quote > 0) {
                const estProfit = quote - totalEstCost;
                const profitMargin = (estProfit / quote) * 100;
                if (profitMargin < 20) {
                  priceWarningsList.push(`[毛利預警] 預估毛利率僅 ${profitMargin.toFixed(1)}% (預估成本 NT$ ${totalEstCost.toLocaleString()} 元)，低於安全防線 20%！請適當調度工資、選用更佳進貨成本材料或調整報帳牌價。`);
                }
              } else if (totalEstCost > 0) {
                priceWarningsList.push(`[報價缺失] 已配置預估成本 NT$ ${totalEstCost.toLocaleString()} 元，但尚未登錄「對客實際統包報價」，請點選✏️進行配置。`);
              }
            }

            // 1. Check estimation materials
            if (p.estimationMaterials && p.estimationMaterials.length > 0) {
              p.estimationMaterials.forEach(m => {
                const up = m.unitPrice ?? 0;
                const cp = m.costPrice ?? 0;
                if (up < cp) {
                  priceWarningsList.push(`材料 [${m.name}] 估算牌價($${up})小於進口成本($${cp})`);
                } else if (cp === 0) {
                  priceWarningsList.push(`材料 [${m.name}] 估算成本為 0 元`);
                }
              });
            }

            // 2. Check actual record materials
            projectRecords.forEach(r => {
              if (r.materials && r.materials.length > 0) {
                r.materials.forEach(m => {
                  const up = m.unitPrice ?? 0;
                  const cp = m.costPrice ?? 0;
                  if (up < cp) {
                    priceWarningsList.push(`施工日誌 (${r.date}) [${m.name}] 申報牌價($${up})小於成本($${cp})`);
                  } else if (cp === 0) {
                    priceWarningsList.push(`施工日誌 (${r.date}) [${m.name}] 採購成本為 0 元`);
                  }
                });
              }
            });

            // 3. Check estimation labor (預估派遣時薪/日工薪)
            if (p.estimationLabor && p.estimationLabor.length > 0) {
              p.estimationLabor.forEach(w => {
                const sal = w.estimationSalary ?? 0;
                const hr = w.hourlyRate ?? 0;
                if (sal === 0 && hr === 0) {
                  priceWarningsList.push(`預估工種 [${w.name}] 工酬或時薪未配置(為 0)`);
                }
              });
            }

            // 4. Check actual record workers (實際入帳派遣)
            projectRecords.forEach(r => {
              if (r.workers && r.workers.length > 0) {
                r.workers.forEach(w => {
                  const rate = w.hourlyRate ?? 0;
                  if (rate === 0) {
                    priceWarningsList.push(`日誌 (${r.date}) 師傅 [${w.name}] 實領時薪為 0 元`);
                  }
                });
              }
            });

            const hasBudgetWarning = priceWarningsList.length > 0;

            const isCompletedButNoDirectReceipt = p.isCompleted && 
              projectRecords.some(r => r.markAsCompleted && (!r.collectedAmount || r.collectedAmount <= 0));

            return (
              <div 
                key={p.id} 
                className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 bg-white ${
                  hasBudgetWarning
                    ? 'border-red-500 ring-2 ring-red-50 hover:shadow-md shadow-sm'
                    : p.isCompleted 
                      ? 'border-neutral-300 bg-neutral-100/50 opacity-80' 
                      : 'border-neutral-200 hover:border-amber-500 hover:shadow-md shadow-3xs'
                }`}
              >
                <div className="space-y-2 bg-white">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-neutral-200 px-1.5 py-0.5 rounded font-mono font-bold text-neutral-600">
                        #{p.serialNumber || '001'}
                      </span>
                      {p.isEstimation ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-150 rounded px-1.5 py-0.5">
                            📊 估價案場
                          </span>
                          {p.estimationStatus === '報價未成' && (
                            <span className="text-[9px] font-extrabold text-white bg-slate-605 border border-slate-700 rounded px-1.5 py-0.5">
                              評估未成交
                            </span>
                          )}
                          {p.estimationStatus === '估價中' && (
                            <span className="text-[9px] font-extrabold text-neutral-800 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 animate-pulse">
                              估值報價中
                            </span>
                          )}
                          {p.estimationStatus === '進行中施工' && (
                            <span className="text-[9px] font-extrabold text-indigo-800 bg-indigo-100 border border-indigo-350 rounded px-1.5 py-0.5">
                              核備施工中
                            </span>
                          )}
                        </div>
                      ) : (
                        p.isCompleted ? (
                          isCompletedButNoDirectReceipt ? (
                            <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 flex items-center gap-0.5 animate-pulse" title="已選擇完工，但完工日誌中沒有登錄現場直接收款金額">
                              竣工待結算
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                              <CheckCircle size={9} />
                              施工已竣工
                            </span>
                          )
                        ) : (
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                            <Clock size={9} />
                            核備施工中
                          </span>
                        )
                      )}
                      {hasBudgetWarning && (
                        <span className="text-[9px] font-extrabold text-white bg-rose-650 border border-rose-700 rounded px-1.5 py-0.5 animate-bounce">
                          利潤警戒
                        </span>
                      )}
                    </div>

                    {/* Basic Info Editor Trigger */}
                    <button
                      onClick={() => handleStartEditProject(p)}
                      className="p-1 text-neutral-400 hover:text-amber-600 hover:bg-neutral-50 rounded transition-colors cursor-pointer"
                      title="編輯案場基本資料"
                    >
                      <Edit2 size={12} />
                    </button>

                    {/* Delete Project Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmProjectId(p.id);
                      }}
                      className="p-1 text-neutral-400 hover:text-red-600 hover:bg-neutral-50 rounded transition-colors cursor-pointer ml-1"
                      title="永久刪除此案場與所有關聯工務日誌"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Budget Warning Inline Block */}
                  {hasBudgetWarning && (
                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-[10px] text-rose-800 font-extrabold flex items-start gap-1.5 leading-relaxed">
                      <span className="text-xs mt-0.5">⚠️</span>
                      <div className="space-y-1 w-full">
                        <span className="text-rose-950 font-black block">【牌價成本預警：工料單價或薪資計收未配置】</span>
                        <div className="space-y-1 mt-1 pl-1 border-l-2 border-rose-300">
                          {priceWarningsList.map((err, idx) => (
                            <div key={idx} className="text-rose-900 font-medium">
                              • {err}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <h3 className="text-sm sm:text-base font-extrabold text-neutral-900 leading-snug line-clamp-2" title={p.generatedName}>
                    {(p.generatedName?.startsWith('[估]') || p.isEstimation)
                      ? (p.generatedName?.startsWith('[估]') ? p.generatedName : `[估]${p.generatedName}`)
                      : p.generatedName || p.companyOrOwner}
                  </h3>

                  <div className="text-xs text-neutral-600 font-sans space-y-1.5 bg-neutral-50/50 p-2.5 rounded-lg border border-neutral-100">
                    <span className="block flex items-center gap-1.5">
                      <User size={12} className="text-neutral-400 shrink-0" />
                      <strong>聯絡人:</strong> {p.contactPerson || '業主本人'} {p.contactPhone ? `(${p.contactPhone})` : ''}
                    </span>
                    <span className="block flex items-start gap-1.5">
                      <MapPin size={12} className="text-neutral-400 shrink-0 mt-0.5" />
                      <span className="leading-tight"><strong>地址:</strong> {p.fullAddress} {p.addressAbbreviated && `(${p.addressAbbreviated})`}</span>
                    </span>
                    {p.projectNotes && (
                      <span className="block flex items-center gap-1.5 text-neutral-600">
                        <Info size={12} className="text-amber-600/80 shrink-0" />
                        <span className="font-semibold line-clamp-2"><strong>備註:</strong> {p.projectNotes}</span>
                      </span>
                    )}
                  </div>

                  {/* Summary of daily construction records */}
                  <div className="flex items-center justify-between text-xs border-t border-b border-dashed border-neutral-150 py-2 px-1 bg-neutral-50/35">
                    <span className="font-semibold text-neutral-500 flex items-center gap-1">
                      <ClipboardList size={13} className="text-amber-600" />
                      完工累計: <strong className="text-neutral-800 font-mono bg-white px-1.5 border rounded border-neutral-200">{projectRecords.length} 筆日誌</strong>
                    </span>
                    <span className="font-semibold text-neutral-500 flex items-center gap-1">
                      <Coins size={13} className="text-emerald-600" />
                      估算總工料費: <strong className="text-emerald-700 font-mono">${totalRecordCostForDisplay.toLocaleString()} 元</strong>
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex flex-col gap-2">
                  {/* Detailed inspector button */}
                  <button
                    onClick={() => setSelectedProjectForDetail(p)}
                    className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 border border-neutral-200/80 hover:text-neutral-900"
                  >
                    <Eye size={13} className="text-neutral-500" />
                    🔍 瀏覽歷史施工履歷 ({projectRecords.length})
                  </button>

                  {/* Button: 建立/編輯估價頁面 */}
                  <button
                    onClick={() => handleStartEstimation(p)}
                    className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 border border-amber-200"
                  >
                    <Scale size={13} className="text-amber-600 animate-pulse" />
                    📋 建立與編輯估價報價單
                    {p.estimationLabor?.length || p.estimationMaterials?.length ? (
                      <span className="ml-1 text-[10px] bg-amber-600 text-white rounded-full px-1.5 py-0.2 select-none font-sans font-black">
                        {(p.estimationLabor?.length || 0) + (p.estimationMaterials?.length || 0)} 項
                      </span>
                    ) : null}
                  </button>

                  <div className="flex flex-col gap-2 border-t border-neutral-100 pt-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs text-neutral-400 font-mono">
                        建立: {p.createdAt?.substring(0, 10) || '2026-05-30'}
                      </span>
                      
                      <div>
                        {p.isEstimation ? (
                          <div className="flex flex-col gap-1.5 items-stretch w-full">
                            {/* 報價中狀態提供一個醒目的獨立按鈕「一鍵標記報價未成」 */}
                            {p.estimationStatus === '估價中' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateEstimationStatus(p.id, '報價未成')}
                                className="w-full px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1"
                                title="一鍵快速標記本估價案場為『報價未成』狀態"
                              >
                                ❌ 標記報價未成
                              </button>
                            )}

                            {/* 報價未成狀態提供一鍵還原為報價中的按鈕 */}
                            {p.estimationStatus === '報價未成' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateEstimationStatus(p.id, '估價中')}
                                className="w-full px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-250 hover:border-emerald-600 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 animate-pulse"
                                title="點擊即可將原先標記未成的估價專案重新還原為「報價中」狀態"
                              >
                                🔄 還原為「報價中」
                              </button>
                            )}

                            {/* 結轉為正式施工專案按鈕 */}
                            {p.estimationStatus !== '報價未成' && (
                              convertConfirmProjectId === p.id ? (
                                <div className="space-y-1.5 p-2 bg-indigo-50/70 border border-indigo-200 rounded-lg animate-fadeIn text-left">
                                  <p className="text-[10px] text-indigo-950 font-black leading-tight">
                                    🤔 確定將估價【{p.companyOrOwner}】一鍵結轉為「正式施工案場」嗎？
                                  </p>
                                  <div className="flex gap-1 mt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleConvertEstimationToFormal(p, true);
                                        setConvertConfirmProjectId(null);
                                      }}
                                      className="flex-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-extrabold text-[10px] cursor-pointer shadow-3xs transition-all text-center"
                                    >
                                      ✔️ 確定結轉
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConvertConfirmProjectId(null)}
                                      className="px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 font-extrabold text-[10px] rounded-md cursor-pointer transition-all text-center"
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleConvertEstimationToFormal(p)}
                                  className="w-full px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1"
                                  title="一鍵轉為正式施工案場 (💡 系統提示：您只要在填報大廳直接登錄此案場的工務日誌，系統便會全自動自動結轉，不需手動點此按鈕！)"
                                >
                                  ⚡ 結轉施工專案
                                </button>
                              )
                            )}

                            {/* 其餘狀態切換跟其他案場狀態設置一樣 自動切換 */}
                            <div className="flex gap-1.5 justify-end mt-0.5">
                              {p.isCompleted ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleProjectStatus(p.id)}
                                  className="px-2.5 py-1 text-xs font-black text-emerald-800 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-250 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                                  title="點擊恢復成施工中，恢復在登記大廳填寫日誌"
                                >
                                  <HardHat size={12} />
                                  解鎖：恢復施工狀態
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleProjectStatus(p.id)}
                                  className="px-2.5 py-1 text-xs font-black text-amber-850 hover:text-white bg-amber-50 hover:bg-amber-600 border border-amber-205 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                                  title="標記完工，此案場將在填報大廳自動鎖定隱藏"
                                >
                                  <CheckCircle size={12} />
                                  標記結案：禁止日誌登記
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          p.isCompleted ? (
                            <button
                              type="button"
                              onClick={() => handleToggleProjectStatus(p.id)}
                              className="px-3 py-1.5 text-xs font-black text-emerald-800 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-250 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                              title="點擊恢復成施工中，恢復在登記大廳填寫日誌"
                            >
                              <HardHat size={12} />
                              解鎖：恢復施工狀態
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleProjectStatus(p.id)}
                              className="px-3 py-1.5 text-xs font-black text-amber-700 hover:text-white bg-amber-50 hover:bg-amber-600 border border-amber-200 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                              title="標記完工，此案場將在填報大廳自動鎖定隱藏"
                            >
                              <CheckCircle size={12} />
                              標記結案：禁止日誌登記
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: 📋 Construction history & daily records viewer */}
      {selectedProjectForDetail && (() => {
        const currentDetailedProject = projects.find(p => p.id === selectedProjectForDetail.id) || selectedProjectForDetail;
        const projRecords = records
          .filter(r => r.projectId === currentDetailedProject.id)
          .sort((a, b) => b.date.localeCompare(a.date)); // descending date order

        // Detailed Cost Calculations
        let materialTotal = 0;
        let workerTotal = 0;
        let expenseTotal = 0;
        projRecords.forEach(r => {
          materialTotal += r.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
          workerTotal += r.workers.reduce((sum, w) => sum + ((w.billingHourlyRate ?? w.hourlyRate) * w.hoursWork), 0);
          expenseTotal += r.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
        });
        const grandTotal = materialTotal + workerTotal + expenseTotal;

        return (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
              
              {/* Header */}
              <div className="bg-neutral-950 p-5 text-white flex items-center justify-between shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-amber-600/90 text-white font-black px-2 py-0.5 rounded tracking-wider">
                      📋 實施施作案場專案細目
                    </span>
                    {currentDetailedProject.isEstimation && (
                      <span className="text-[10px] font-black text-indigo-400 border border-indigo-500/30 bg-indigo-950/45 rounded px-2 py-0.5">
                        📊 估價案場
                      </span>
                    )}
                    {currentDetailedProject.isCompleted ? (
                      <span className="text-[10px] font-black text-emerald-400 border border-emerald-500/30 bg-emerald-950/45 rounded px-2 py-0.5">
                        ✅ 已結案
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-amber-400 border border-amber-500/30 bg-amber-950/45 rounded px-2 py-0.5 animate-pulse">
                        🛠️ 施工中
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white mt-1">
                    <span className="text-neutral-400 font-bold text-sm block">案場名稱：</span>
                    <span className="text-amber-400 text-lg font-sans font-black">
                      {(currentDetailedProject.generatedName?.startsWith('[估]') || currentDetailedProject.isEstimation)
                        ? (currentDetailedProject.generatedName?.startsWith('[估]') ? currentDetailedProject.generatedName : `[估]${currentDetailedProject.generatedName}`)
                        : currentDetailedProject.generatedName || currentDetailedProject.companyOrOwner}
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400 flex items-center gap-1">
                    <MapPin size={11} className="text-neutral-500 shrink-0" />
                    {currentDetailedProject.fullAddress}
                  </p>
                </div>

                <button 
                  onClick={() => {
                    setSelectedProjectForDetail(null);
                    setDeleteConfirmRecordId(null);
                  }}
                  className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Multi-bento Stats Area */}
              <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-150 grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 shadow-3xs">
                <div className="p-3 bg-white border border-neutral-200 rounded-xl">
                  <span className="text-[9px] text-neutral-400 font-bold block">歷史施工天數</span>
                  <span className="text-base font-black text-neutral-800 font-mono">{projRecords.length} 天</span>
                </div>
                <div className="p-3 bg-white border border-neutral-200 rounded-xl">
                  <span className="text-[9px] text-neutral-400 font-bold block">估算材料消耗</span>
                  <span className="text-base font-black text-neutral-800 font-mono">${materialTotal.toLocaleString()} 元</span>
                </div>
                <div className="p-3 bg-white border border-neutral-200 rounded-xl">
                  <span className="text-[9px] text-neutral-400 font-bold block">估算工班薪資</span>
                  <span className="text-base font-black text-neutral-800 font-mono">${workerTotal.toLocaleString()} 元</span>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <span className="text-[9px] text-amber-700 font-bold block">累計估算支出 (利潤脫敏)</span>
                  <span className="text-lg font-black text-amber-950 font-mono">${grandTotal.toLocaleString()} 元</span>
                </div>
              </div>

              {/* Records List Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <ClipboardList size={14} className="text-amber-600" />
                    施工日誌歷程明細 ({projRecords.length} 筆)
                  </h4>
                  <span className="text-[10px] text-neutral-400 italic font-mono">
                    由新到舊排序
                  </span>
                </div>

                {projRecords.length === 0 ? (
                  <div className="text-center py-16 text-neutral-500 space-y-3 bg-neutral-50/50 rounded-xl border border-dashed border-neutral-200">
                    <FileText size={40} className="mx-auto text-neutral-300" />
                    <p className="text-xs font-medium">此案場尚未登記過任何施工日誌紀錄！</p>
                    <p className="text-[11px] text-neutral-400 italic">請前往「施工登記大廳」登錄本日施工工料、車馬停車墊款。</p>
                  </div>
                ) : (
                  <div className="space-y-6 relative border-l-2 border-neutral-150 pl-4 sm:pl-6 ml-2 animate-fadeIn">
                    {projRecords.map((rec, index) => {
                      const recMatCost = rec.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
                      const recLaborCost = rec.workers.reduce((sum, w) => sum + ((w.billingHourlyRate ?? w.hourlyRate) * w.hoursWork), 0);
                      const recExpCost = rec.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
                      const recTotal = recMatCost + recLaborCost + recExpCost;

                      const isDeleting = deleteConfirmRecordId === rec.id;

                      return (
                        <div key={rec.id} className="relative group">
                          
                          {/* Chrono timeline bullet dot */}
                          <div className="absolute -left-7.5 sm:-left-9.5 top-1 w-3.5 h-3.5 rounded-full bg-amber-600 border-2 border-white group-hover:scale-125 transition-transform" />

                          {/* Daily Card */}
                          <div className="bg-white p-5 rounded-xl border border-neutral-200 hover:border-neutral-300 transition-all hover:shadow-xs space-y-4">
                            
                            {/* Card Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-black bg-neutral-150 text-neutral-800 px-2.5 py-0.5 rounded flex items-center gap-1">
                                    <Calendar size={11} className="text-amber-600" />
                                    {rec.date}
                                  </span>
                                  {rec.markAsCompleted ? (
                                    <span className="text-[9px] bg-emerald-100/80 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                      已完工結案宣告
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-amber-100/80 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                                      施工階段日誌
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Actions for this specific record */}
                              <div className="flex items-center gap-2 shrink-0">
                                {isDeleting ? (
                                  <div className="flex items-center gap-2 bg-red-50 p-1 px-2 rounded-lg border border-red-200 animate-fadeIn">
                                    <span className="text-[10px] text-red-600 font-bold">確定刪除此日誌？此動作不可還原！</span>
                                    <button
                                      onClick={() => {
                                        onDeleteRecord(rec.id);
                                        setDeleteConfirmRecordId(null);
                                        onSaveToast('🗑️ 日誌刪除成功！');
                                      }}
                                      className="px-2 py-1 bg-red-600 text-white rounded font-bold text-[9px] cursor-pointer"
                                    >
                                      確定
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmRecordId(null)}
                                      className="px-2 py-1 bg-neutral-200 text-neutral-700 rounded font-bold text-[9px] cursor-pointer"
                                    >
                                      取消
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedProjectForDetail(null); // Close this modal first to focus form
                                        onEditRecord(rec);
                                        onSaveToast(`✏️ 已載入日誌【${rec.date}】進行編輯！`);
                                      }}
                                      className="py-1 px-2.5 bg-neutral-100 hover:bg-neutral-200 font-extrabold text-[10px] text-neutral-700 rounded-md transition-all cursor-pointer flex items-center gap-1 border border-neutral-200"
                                      title="編輯修改這本日施工紀錄"
                                    >
                                      <Edit size={10} />
                                      修改日誌
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmRecordId(rec.id)}
                                      className="p-1 px-2 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                                      title="刪除本日施工紀錄"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Construction content details block */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              
                              {/* Left: Workers */}
                              <div className="space-y-1.5 p-3 bg-neutral-50/50 rounded-lg border border-neutral-100">
                                <span className="text-[10px] text-neutral-400 font-black flex items-center gap-1">
                                  <User size={11} className="text-amber-600" />
                                  👥 派遣工班師傅
                                </span>
                                {rec.workers.length === 0 ? (
                                  <span className="text-[10px] text-neutral-400 italic block">未登記派遣工</span>
                                ) : (
                                  <ul className="space-y-1 block">
                                    {rec.workers.map(w => (
                                      <li key={w.id} className="flex justify-between text-[11px] font-medium text-neutral-700 font-mono">
                                        <span>• {w.name} {w.isSupport && <span className="text-[8px] bg-sky-100 px-1 rounded text-sky-800">支援</span>}</span>
                                        <span className="font-bold text-neutral-900">{w.hoursWork} 小時</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              {/* Center: Materials */}
                              <div className="space-y-1.5 p-3 bg-neutral-50/50 rounded-lg border border-neutral-100">
                                <span className="text-[10px] text-neutral-400 font-black flex items-center gap-1">
                                  <Hammer size={11} className="text-amber-600" />
                                  🔧 耗用材料項目
                                </span>
                                {rec.materials.length === 0 ? (
                                  <span className="text-[10px] text-neutral-400 italic block">現場未耗用材料</span>
                                ) : (
                                  <ul className="space-y-1 block">
                                    {rec.materials.map(m => (
                                      <li key={m.id} className="flex justify-between text-[11px] font-medium text-neutral-700">
                                        <span className="line-clamp-1 flex-1">• {m.name}</span>
                                        <span className="font-bold text-neutral-900 shrink-0 ml-1 font-mono">{m.quantity}{m.unit}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                              {/* Right: Expenses */}
                              <div className="space-y-1.5 p-3 bg-neutral-50/50 rounded-lg border border-neutral-100">
                                <span className="text-[10px] text-neutral-400 font-black flex items-center gap-1">
                                  <Coins size={11} className="text-amber-600" />
                                  🪙 伙食車馬墊款
                                </span>
                                {rec.expenses.length === 0 ? (
                                  <span className="text-[10px] text-neutral-400 italic block">無墊付支出雜支</span>
                                ) : (
                                  <ul className="space-y-1 block">
                                    {rec.expenses.map(e => (
                                      <li key={e.id} className="flex justify-between text-[11px] font-medium text-neutral-700">
                                        <span className="line-clamp-1 flex-1">• {e.description}</span>
                                        <span className="font-bold text-neutral-900 shrink-0 ml-1 font-mono">${e.amount}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>

                            </div>

                            {/* Additional Notes */}
                            {rec.notes && (
                              <div className="p-3 bg-amber-50/30 border border-amber-205/15 rounded-lg text-[11px] text-neutral-600 leading-relaxed">
                                <strong>特別記錄/工程備忘:</strong> {rec.notes}
                              </div>
                            )}

                            {/* Cost subtotal */}
                            <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono bg-neutral-50 p-2 rounded-lg">
                              <span>工料及墊款明細統計 (保護利潤保護公司防護)</span>
                              <span className="font-bold text-neutral-800">
                                材料 ${recMatCost.toLocaleString()} + 工資 ${recLaborCost.toLocaleString()} + 墊款 ${recExpCost.toLocaleString()} = <strong className="text-amber-800 text-xs">${recTotal.toLocaleString()} 元</strong>
                              </span>
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200 flex justify-end shrink-0">
                <button
                  onClick={() => {
                    setSelectedProjectForDetail(null);
                    setDeleteConfirmRecordId(null);
                  }}
                  className="px-5 py-2 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition-all cursor-pointer border border-neutral-300 shadow-3xs"
                >
                  關閉本履歷視窗
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL 2: ✏️ Edit Project Basic Details */}
      {editingProject && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <form 
            onSubmit={handleSaveBasicInfo}
            className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn"
          >
            {/* Header */}
            <div className="bg-neutral-950 p-4 text-white flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] bg-amber-600 text-white font-black px-1.5 py-0.5 rounded font-mono uppercase">
                  EDIT BASIC PARAMETERS
                </span>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  ✏️ 修改案場基本資料 (編號: {editingProject.serialNumber})
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setEditingProject(null)}
                className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-5 space-y-4">
              {/* Company / Owner Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 block">
                  公司名稱 / 業主名稱 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  value={editCompanyOrOwner}
                  onChange={e => setEditCompanyOrOwner(e.target.value)}
                  className="w-full text-xs p-2.5 border border-neutral-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  placeholder="例如: 瑞興營造、陳先生官邸"
                />
              </div>

              {/* Grid: Contact & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    現場負責人 / 聯絡人
                  </label>
                  <input 
                    type="text"
                    value={editContactPerson}
                    onChange={e => setEditContactPerson(e.target.value)}
                    className="w-full text-xs p-2.5 border border-neutral-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="例如: 張主任、王太太"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 block">
                    聯絡電話 / 手機
                  </label>
                  <input 
                    type="text"
                    value={editContactPhone}
                    onChange={e => setEditContactPhone(e.target.value)}
                    className="w-full text-xs p-2.5 border border-neutral-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                    placeholder="例如: 0912-345-678"
                  />
                </div>
              </div>

              {/* Grid: Full address & Address abbreviation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 block">
                  完整施工地址 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text"
                  required
                  value={editFullAddress}
                  onChange={e => setEditFullAddress(e.target.value)}
                  className="w-full text-xs p-2.5 border border-neutral-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  placeholder="例如: 新北市新店區北新路三段88號"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 block bg-white">
                  施工簡稱 / 施工地址簡報
                </label>
                <input 
                  type="text"
                  value={editAddressAbbreviated}
                  onChange={e => setEditAddressAbbreviated(e.target.value)}
                  className="w-full text-xs p-2.5 border border-neutral-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  placeholder="例如: 新店大官邸 (用來生成專案自動名稱)"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 block">
                  工程備註 / 注意事項
                </label>
                <textarea 
                  value={editProjectNotes}
                  onChange={e => setEditProjectNotes(e.target.value)}
                  className="w-full text-xs p-2.5 border border-neutral-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white min-h-[80px]"
                  placeholder="例如: 需配合油漆退場後進場、屋主自備熱水器、隔壁有鄰損需特別小心..."
                />
              </div>

              {/* Estimation Mode Switch in Editor */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="block text-xs font-bold text-neutral-800">📋 啟用「預算估價案場」模式</span>
                  <span className="block text-[10px] text-neutral-500 leading-normal">此模式為估價或方案模擬使用。名稱前方將自動冠上 <strong className="text-amber-700 font-extrabold">[估]</strong> 識別，與系統拼裝格式一併存檔。</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4 select-none">
                  <input
                    type="checkbox"
                    checked={editIsEstimation}
                    onChange={(e) => setEditIsEstimation(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-neutral-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {editIsEstimation && (
                <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 flex flex-col gap-2 animate-fadeIn">
                  <label className="block text-xs font-bold text-amber-900">
                    📈 案場施工估價狀態
                  </label>
                  <select
                    value={editEstimationStatus}
                    onChange={(e) => setEditEstimationStatus(e.target.value as any)}
                    className="w-full text-xs p-2 border border-amber-205 rounded-lg bg-white font-bold text-neutral-850 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="估價中">⏳ 報價中 (比價/初擬階段)</option>
                    <option value="進行中施工">🏗️ 進行中施工 (已簽約施作為成本參考)</option>
                    <option value="報價未成">❌ 報價未成 (不同意施作 - 本案不納入請款和數據統計)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-neutral-50 px-4 py-3 border-t border-neutral-150 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="px-4 py-2 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-lg transition-all cursor-pointer border border-neutral-300"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-3xs"
              >
                儲存基本資料
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: 📊 Estimation Builder Modal */}
      {estimationProject && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-5xl my-8 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-amber-600 px-6 py-4 rounded-t-2xl flex items-center justify-between text-white shadow-sm">
              <div className="flex items-center gap-2">
                <Scale className="text-white animate-pulse" size={20} />
                <div>
                  <h3 className="text-sm font-black tracking-tight">📊 案場工程預估暨報價管理頁面</h3>
                  <p className="text-[10px] text-amber-100 font-sans mt-0.5">案場名稱: {((estimationProject.generatedName?.startsWith('[估]') || estimationProject.isEstimation) ? (estimationProject.generatedName?.startsWith('[估]') ? estimationProject.generatedName : `[估]${estimationProject.generatedName}`) : (estimationProject.generatedName || estimationProject.companyOrOwner))}</p>
                </div>
              </div>
              <button
                onClick={() => setEstimationProject(null)}
                className="p-1 hover:bg-amber-700/60 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-neutral-50/50">
              {/* Top Summary Banner */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-amber-800 block">👷 預估人力費用成本</span>
                  <span className="text-lg font-black text-amber-900 font-mono mt-1">
                    ${estLabor.reduce((sum, w) => sum + ((w.workerCount ?? 1) * (w.daysWork ?? 1) * (w.estimationSalary ?? 3000)), 0).toLocaleString()} 元
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-emerald-800 block">📦 預估材料進用成本</span>
                  <span className="text-lg font-black text-emerald-900 font-mono mt-1">
                    ${estMaterials.reduce((sum, m) => sum + (m.quantity * (m.costPrice ?? m.unitPrice * 0.7)), 0).toLocaleString()} 元
                  </span>
                </div>
                <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-blue-800 block">🏷️ 估算申報牌價總額</span>
                  <span className="text-lg font-black text-blue-900 font-mono mt-1">
                    ${estMaterials.reduce((sum, m) => sum + (m.quantity * m.unitPrice), 0).toLocaleString()} 元
                  </span>
                </div>
                <div className="bg-neutral-900 text-amber-400 rounded-xl p-3 flex flex-col justify-between shadow-sm">
                  <span className="text-[10px] font-bold text-neutral-400 block">💰 預估利潤分析 (申報-成本)</span>
                  <span className="text-lg font-black font-mono mt-1 text-emerald-400">
                    +${(
                      estMaterials.reduce((sum, m) => sum + (m.quantity * m.unitPrice), 0) -
                      estMaterials.reduce((sum, m) => sum + (m.quantity * (m.costPrice ?? m.unitPrice * 0.7)), 0) -
                      estLabor.reduce((sum, w) => sum + ((w.workerCount ?? 1) * (w.daysWork ?? 1) * (w.estimationSalary ?? 3000)), 0)
                    ).toLocaleString()} 元
                  </span>
                </div>
              </div>

              {/* Status and Active Quoted Amount inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-neutral-200/60 shadow-xs">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    📈 案場施工估價狀態
                  </label>
                  <select
                    value={estStatus}
                    onChange={(e) => setEstStatus(e.target.value as any)}
                    className="w-full text-xs p-2 border border-neutral-200 rounded-lg bg-white font-medium"
                  >
                    <option value="估價中">⏳ 估價中 (預設狀態)</option>
                    <option value="進行中施工">🏗️ 進行中施工 (作為實際成本參考)</option>
                    <option value="報價未成">❌ 報價未成 (不同意施作 - 本案不列入請款和數據統計)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    💵 總體對外報價總金額 (元)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={estQuoteAmount || ''}
                      onChange={(e) => setEstQuoteAmount(Number(e.target.value))}
                      className="w-full text-xs p-2 pl-6 border border-neutral-200 rounded-lg font-mono font-bold text-neutral-800"
                      placeholder="請輸入給業主的報價總額"
                    />
                    <Coins size={12} className="absolute left-2.5 top-[10px] text-neutral-400" />
                  </div>
                </div>
                <div className="flex items-end pb-[2px] justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const totalMaterialList = estMaterials.reduce((sum, m) => sum + (m.quantity * m.unitPrice), 0);
                      const totalLabor = estLabor.reduce((sum, w) => sum + ((w.workerCount ?? 1) * (w.daysWork ?? 1) * (w.estimationSalary ?? 3000)), 0);
                      setEstQuoteAmount(totalMaterialList + totalLabor);
                    }}
                    className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-800 text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    🚀 自動帶入: 材料牌價總計+人力成本 (${(
                      estMaterials.reduce((sum, m) => sum + (m.quantity * m.unitPrice), 0) +
                      estLabor.reduce((sum, w) => sum + ((w.workerCount ?? 1) * (w.daysWork ?? 1) * (w.estimationSalary ?? 3000)), 0)
                    ).toLocaleString()})
                  </button>
                </div>
              </div>

              {/* SECTION A: Human Labor Budget */}
              <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-3xs space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <span className="flex items-center gap-1.5 text-xs font-black text-neutral-900">
                    <Hammer size={14} className="text-amber-600" />
                    👷 預估人力費用預算填報 (工時半天為單位)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddEstLabor}
                    className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer shadow-3xs"
                  >
                    <Plus size={11} />
                    重複估估人力與工種
                  </button>
                </div>

                {estLabor.length === 0 ? (
                  <div className="text-center py-6 text-neutral-400 text-xs font-medium">
                    尚未填報任何人力預算項目，點選上方「重複估估人力與工種」按鈕開始。
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500 font-bold bg-neutral-50/50">
                          <th className="py-2 px-2">工種/職稱名稱</th>
                          <th className="py-2 px-2 w-24">估算人數 (員)</th>
                          <th className="py-2 px-2 w-28">估計工期 (天)</th>
                          <th className="py-2 px-2 w-32">薪資/天薪 (每人天額)</th>
                          <th className="py-2 px-2 text-right">費用預算小計</th>
                          <th className="py-2 px-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {estLabor.map((row) => (
                          <tr key={row.id}>
                            <td className="py-2 px-1">
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => handleUpdateEstLabor(row.id, 'name', e.target.value)}
                                className="w-full text-xs p-1 border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold text-neutral-800"
                                placeholder="例如: 水電師傅、半技工等"
                              />
                            </td>
                            <td className="py-2 px-1">
                              <input
                                type="number"
                                value={row.workerCount ?? 1}
                                min={1}
                                onChange={(e) => handleUpdateEstLabor(row.id, 'workerCount', Math.max(1, Number(e.target.value)))}
                                className="w-full text-xs p-1 border border-neutral-200 rounded font-mono font-bold text-neutral-800 text-center"
                              />
                            </td>
                            <td className="py-2 px-1">
                              <input
                                type="number"
                                step={0.5}
                                value={row.daysWork ?? 1.0}
                                min={0.5}
                                onChange={(e) => handleUpdateEstLabor(row.id, 'daysWork', Math.max(0.5, Number(e.target.value)))}
                                className="w-full text-xs p-1 border border-neutral-200 rounded font-mono font-bold text-neutral-800 text-center"
                              />
                            </td>
                            <td className="py-2 px-1">
                              <input
                                type="number"
                                value={row.estimationSalary ?? 3000}
                                min={0}
                                step={100}
                                onChange={(e) => handleUpdateEstLabor(row.id, 'estimationSalary', Math.max(0, Number(e.target.value)))}
                                className="w-full text-xs p-1 border border-neutral-200 rounded font-mono font-bold text-neutral-800 text-center"
                              />
                            </td>
                            <td className="py-2 px-1 text-right font-mono font-extrabold text-neutral-900">
                              ${((row.workerCount ?? 1) * (row.daysWork ?? 1) * (row.estimationSalary ?? 3000)).toLocaleString()} 元
                            </td>
                            <td className="py-2 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveEstLabor(row.id)}
                                className="p-1 hover:text-red-600 rounded hover:bg-neutral-100 text-neutral-400 transition-colors"
                              >
                                <Trash size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>              {/* SECTION B: Materials Budget */}
              <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-3xs space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <span className="flex items-center gap-1.5 text-xs font-black text-neutral-900">
                    <ClipboardList size={14} className="text-amber-600" />
                    📦 預估材料耗材與採購支出填報
                  </span>
                  <button
                    type="button"
                    onClick={handleAddEstMaterial}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-600 text-amber-900 hover:text-white border border-amber-200 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer shadow-3xs"
                  >
                    <Plus size={11} />
                    重複分配預估耗材
                  </button>
                </div>

                {/* Categorized Quick Add Material Tablet Dashboard */}
                <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-bold text-neutral-600 block flex items-center gap-1">
                      📂 【大庫耗材分類速選盤】 (點選施工項目，一鍵自動添加至預估材料登記清單，多次點擊可累加數量)
                    </span>
                    <span className="text-[9px] text-amber-700 font-bold bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-full">
                      💡 電工、水工、五金一目了然
                    </span>
                  </div>

                  {/* Category Filter Buttons */}
                  <div className="flex flex-wrap gap-1">
                    {['全部', '電路電材類', '水路管材類', '廚衛設備類', '五金緊固類', '工具與雜耗'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setEstSelectedAddCategory(cat);
                        }}
                        className={`px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          estSelectedAddCategory === cat
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

                  {/* Supplier Filter Buttons inside Project Quick Add Panel */}
                  <div className="space-y-1.5 border-t border-neutral-200/60 pt-2.5">
                    <span className="text-[10px] font-extrabold text-neutral-500 block flex items-center gap-1">
                      🏬 依配合之「特約材料行」快速限縮：
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => setEstSelectedAddSupplier('全部')}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          estSelectedAddSupplier === '全部'
                            ? 'bg-neutral-800 text-white shadow-3xs'
                            : 'bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-500'
                        }`}
                      >
                        🏬 全部聯配行
                      </button>
                      {activeSuppliers.map(sup => {
                        // Count matches dynamically
                        const matchedCount = materialsPreset.filter(p => {
                          const matchesCategory = estSelectedAddCategory === '全部' || p.category === estSelectedAddCategory;
                          if (!matchesCategory) return false;
                          
                          const unitOpts = p.unitOptions || [];
                          const hasStoreInUnit = unitOpts.some(uo => uo.suppliers?.some(s => s.storeName === sup.name && (s.listPrice > 0 || s.costPrice > 0)));
                          const hasStoreInLegacy = p.suppliers?.some(s => s.storeName === sup.name && (s.listPrice > 0 || s.costPrice > 0));
                          return hasStoreInUnit || hasStoreInLegacy;
                        }).length;

                        return (
                          <button
                            key={sup.id}
                            type="button"
                            onClick={() => setEstSelectedAddSupplier(sup.name)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                              estSelectedAddSupplier === sup.name
                                ? 'bg-amber-700 text-white shadow-3xs'
                                : 'bg-white hover:bg-neutral-150 border border-neutral-200 text-neutral-600'
                            }`}
                          >
                            <span>🏬 {sup.name}</span>
                            <span className={`text-[9px] font-mono px-1 rounded-sm ${estSelectedAddSupplier === sup.name ? 'bg-amber-800 text-amber-200' : 'bg-neutral-100 text-neutral-500'}`}>{matchedCount}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preset Buttons Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[170px] overflow-y-auto pr-1 border-t border-neutral-200/60 pt-2.5">
                    {materialsPreset
                      .filter(p => estSelectedAddCategory === '全部' || p.category === estSelectedAddCategory)
                      .filter(p => {
                        if (estSelectedAddSupplier === '全部') return true;
                        const unitOpts = p.unitOptions || [];
                        const hasStoreInUnit = unitOpts.some(uo => uo.suppliers?.some(s => s.storeName === estSelectedAddSupplier && (s.listPrice > 0 || s.costPrice > 0)));
                        const hasStoreInLegacy = p.suppliers?.some(s => s.storeName === estSelectedAddSupplier && (s.listPrice > 0 || s.costPrice > 0));
                        return hasStoreInUnit || hasStoreInLegacy;
                      })
                      .map(p => {
                        const uniqueSuppliers = p.suppliers?.length || 0;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleQuickAddEstPresetMaterial(p)}
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
                    {materialsPreset
                      .filter(p => estSelectedAddCategory === '全部' || p.category === estSelectedAddCategory)
                      .filter(p => {
                        if (estSelectedAddSupplier === '全部') return true;
                        const unitOpts = p.unitOptions || [];
                        const hasStoreInUnit = unitOpts.some(uo => uo.suppliers?.some(s => s.storeName === estSelectedAddSupplier && (s.listPrice > 0 || s.costPrice > 0)));
                        const hasStoreInLegacy = p.suppliers?.some(s => s.storeName === estSelectedAddSupplier && (s.listPrice > 0 || s.costPrice > 0));
                        return hasStoreInUnit || hasStoreInLegacy;
                      }).length === 0 && (
                      <div className="col-span-12 text-center py-4 text-[10px] text-neutral-400 italic">
                        💡 依此分類及材料行過濾，大庫中查無對應耗材。您可變更上方篩選條件。
                      </div>
                    )}
                  </div>
                </div>

                {estMaterials.length === 0 ? (
                  <div className="text-center py-6 text-neutral-400 text-xs font-medium">
                    尚未分配任何材料預算項目，點選上方「大庫耗材分類速選盤」快速添加，或按「重複分配預估耗材」填入。
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[700px] border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 text-neutral-500 font-bold bg-neutral-50/50">
                          <th className="py-2.5 px-3">材料品項與特約選擇</th>
                          <th className="py-2.5 px-2 w-[12%] text-center">預估數量</th>
                          <th className="py-2.5 px-2 w-[10%] text-center">單位</th>
                          <th className="py-2.5 px-3 w-[15%]">臨時現場特約採購</th>
                          <th className="py-2.5 px-2 w-[12%] text-center">進料成本單價</th>
                          <th className="py-2.5 px-2 w-[12%] text-center">申報牌價單價(可改)</th>
                          <th className="py-2.5 px-3 text-right">進用成本小計</th>
                          <th className="py-2.5 px-3 text-right">申報牌價小計</th>
                          <th className="py-2.5 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {estMaterials.map((row) => {
                          const matchingPreset = row.materialId ? materialsPreset.find(p => p.id === row.materialId) : null;
                          return (
                            <tr key={row.id} className="hover:bg-neutral-50/20">
                              {/* Material Preset Name Selector */}
                              <td className="py-3 px-3">
                                <div className="space-y-1.5">
                                  <select
                                    value={row.materialId || 'custom'}
                                    onChange={(e) => handleUpdateEstMaterialChoice(row.id, e.target.value)}
                                    className="w-full px-2 py-1.5 border border-neutral-200 rounded text-xs bg-white text-neutral-700 font-bold"
                                  >
                                    <option value="custom">-- ⚙️ 現場自定義自填材料 (例如臨採) --</option>
                                    {(() => {
                                      const grouped: { [key: string]: typeof materialsPreset } = {};
                                      materialsPreset.forEach(wp => {
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
                                                {wp.name} ({wp.unit}) {uniqueSuppliers > 0 ? `[特約店家 x${uniqueSuppliers}]` : ''}
                                              </option>
                                            );
                                          })}
                                        </optgroup>
                                      ));
                                    })()}
                                  </select>

                                  {row.materialId && !row.isNearbyPurchased && (() => {
                                    const preset = materialsPreset.find(p => p.id === row.materialId);
                                    if (!preset) return null;
                                    
                                    const unitOptions = preset.unitOptions || [];
                                    const matchedOption = unitOptions.find(uo => uo.unit === row.unit);
                                    const relevantSuppliers = matchedOption 
                                      ? (matchedOption.suppliers || [])
                                      : (preset.suppliers || []);

                                    const activeSuppliers = relevantSuppliers.filter(s => s.listPrice > 0 || s.costPrice > 0);
                                    const currentStore = row.storeName || 'default';
                                    return (
                                      <div className="flex flex-col gap-1 bg-amber-50/25 border border-amber-200/50 p-2 rounded-lg text-[10px] text-neutral-600 mt-1 shadow-2xs">
                                        {activeSuppliers.length > 0 ? (
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-extrabold flex-shrink-0 text-amber-900">🏬 配合材料行報價:</span>
                                            <select
                                              value={currentStore}
                                              onChange={(e) => handleUpdateEstMaterialSupplierChoice(row.id, e.target.value, preset)}
                                              className="px-1.5 py-0.5 border border-amber-250 bg-white rounded font-bold text-amber-900 text-[10px] w-full focus:ring-1 focus:ring-amber-500"
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
                                        <div className="text-[9px] pl-0.5 leading-snug font-sans text-neutral-550 scale-95 origin-left italic font-bold">
                                          已鎖定報價：{row.storeName ? `🏬 【${row.storeName}】特約價格連動` : '📦 預設大庫供貨價格'}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {(!row.materialId || row.isNearbyPurchased) && (
                                    <input
                                      type="text"
                                      required
                                      placeholder="請輸入自打材料品名 (如：廚房止水閥)"
                                      value={row.name}
                                      onChange={(e) => handleUpdateEstMaterialField(row.id, 'name', e.target.value)}
                                      className="w-full px-2 py-1 border border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 rounded text-xs bg-amber-50/15 placeholder-neutral-400 text-amber-900 font-bold"
                                    />
                                  )}
                                </div>
                              </td>

                              {/* Quantity */}
                              <td className="py-3 px-2">
                                <div className="space-y-1">
                                  <input
                                    type="number"
                                    value={row.quantity}
                                    min={0.1}
                                    step="any"
                                    onChange={(e) => handleUpdateEstMaterialField(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="w-full text-xs p-1 border border-neutral-200 rounded font-mono font-bold text-neutral-800 text-center"
                                  />
                                  {(() => {
                                    if (!row.materialId) return null;
                                    const preset = materialsPreset.find(p => p.id === row.materialId);
                                    if (!preset) return null;
                                    const uos = preset.unitOptions || [];
                                    const matcheduo = uos.find(u => u.unit === row.unit);
                                    if (matcheduo && matcheduo.conversionFactor && matcheduo.conversionFactor !== 1) {
                                      const baseQty = matcheduo.conversionInverse 
                                        ? (row.quantity / matcheduo.conversionFactor)
                                        : (row.quantity * matcheduo.conversionFactor);
                                      const totalBase = baseQty.toFixed(2).replace(/\.00$/, '');
                                      return (
                                        <div className="text-[9px] text-amber-900 bg-amber-50/70 border border-amber-200/60 px-1 py-0.5 rounded text-center font-black flex items-center justify-center gap-0.5 scale-90 origin-center" title={matcheduo.conversionInverse ? `換算比: ${matcheduo.conversionFactor}${row.unit} = 1${preset.unit}` : `換算比: 1${row.unit} = ${matcheduo.conversionFactor}${preset.unit}`}>
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
                              <td className="py-3 px-2">
                                {(() => {
                                  const preset = row.materialId ? materialsPreset.find(p => p.id === row.materialId) : null;
                                  if (preset) {
                                    const unitOptions = preset.unitOptions || [];
                                    const uniqueUnits = Array.from(new Set([
                                      preset.unit,
                                      ...unitOptions.map(uo => uo.unit)
                                    ])).filter(Boolean);

                                    return (
                                      <select
                                        value={row.unit}
                                        onChange={(e) => handleUpdateEstMaterialUnitChoiceInRow(row.id, e.target.value, preset)}
                                        className="w-full px-1 py-1 border border-neutral-200 rounded text-xs font-bold text-neutral-800 bg-white cursor-pointer focus:ring-1 focus:ring-amber-500"
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
                                      placeholder="個/組/單"
                                      value={row.unit}
                                      onChange={(e) => handleUpdateEstMaterialField(row.id, 'unit', e.target.value)}
                                      className="w-full px-1.5 py-1 border border-neutral-200 rounded text-xs text-neutral-700 text-center font-bold"
                                    />
                                  );
                                })()}
                              </td>

                              {/* Nearby Purchasing Checkbox inside Estimate Table */}
                              <td className="py-3 px-3">
                                <div className="space-y-1">
                                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-neutral-600 select-none">
                                    <input
                                      type="checkbox"
                                      checked={row.isNearbyPurchased}
                                      onChange={(e) => handleUpdateEstMaterialField(row.id, 'isNearbyPurchased', e.target.checked)}
                                      className="w-3.5 h-3.5 text-amber-600 focus:ring-amber-400 rounded border-neutral-300"
                                    />
                                    <span>現場臨時零購</span>
                                  </label>

                                  {row.isNearbyPurchased && (
                                    <input
                                      type="text"
                                      placeholder="填寫採購店家 (自選)"
                                      value={row.storeName || ''}
                                      onChange={(e) => handleUpdateEstMaterialField(row.id, 'storeName', e.target.value)}
                                      className="w-full px-1 bg-white border border-neutral-200 rounded text-[9px] text-neutral-600 focus:ring-1 focus:ring-amber-500"
                                    />
                                  )}
                                </div>
                              </td>

                              {/* Target Cost Price */}
                              <td className="py-3 px-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-0.5 bg-neutral-50 px-1 py-0.5 border border-neutral-200 rounded-md">
                                    <span className="text-neutral-400 font-extrabold text-[10px]">$</span>
                                    <input
                                      type="number"
                                      value={row.costPrice ?? 0}
                                      min={0}
                                      onChange={(e) => handleUpdateEstMaterialField(row.id, 'costPrice', Math.max(0, Number(e.target.value)))}
                                      className="w-full text-xs p-0 border-none bg-transparent font-mono font-bold text-neutral-800 text-center focus:outline-none"
                                    />
                                  </div>
                                  {matchingPreset && (
                                    <span className="block text-[8px] text-neutral-400 text-center font-bold font-sans">原庫成本: ${matchingPreset.defaultCostPrice}</span>
                                  )}
                                </div>
                              </td>

                              {/* Target List Price (申報牌價單價 - can be manually modified) */}
                              <td className="py-3 px-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-0.5 bg-amber-50/30 px-1 py-0.5 border border-amber-200 rounded-md">
                                    <span className="text-amber-700 font-extrabold text-[10px]">$</span>
                                    <input
                                      type="number"
                                      value={row.unitPrice}
                                      min={0}
                                      onChange={(e) => handleUpdateEstMaterialField(row.id, 'unitPrice', Math.max(0, Number(e.target.value)))}
                                      className="w-full text-xs p-0 border-none bg-transparent font-mono font-bold text-neutral-900 text-center focus:outline-none focus:ring-1 focus:ring-amber-300"
                                    />
                                  </div>
                                  {matchingPreset && (
                                    <span className="block text-[8px] text-neutral-400 text-center font-bold font-sans">原庫牌價: ${matchingPreset.defaultUnitPrice}</span>
                                  )}
                                </div>
                              </td>

                              {/* Subtotals */}
                              <td className="py-3 px-3 text-right font-mono font-semibold text-neutral-550">
                                ${(row.quantity * (row.costPrice ?? 0)).toLocaleString()} 元
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-black text-amber-950">
                                ${(row.quantity * row.unitPrice).toLocaleString()} 元
                              </td>

                              {/* Delete Action */}
                              <td className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEstMaterial(row.id)}
                                  className="p-1 hover:text-red-600 rounded hover:bg-neutral-100 text-neutral-400 transition-colors"
                                >
                                  <Trash size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200 flex flex-col sm:flex-row gap-3 justify-between items-center rounded-b-2xl">
              <span className="text-[11px] text-amber-800 bg-amber-50 px-3 py-1.5 border border-amber-200 rounded-lg font-semibold flex items-center gap-1 leading-normal">
                <Info size={12} className="shrink-0" />
                儲存工程預算後，於填報本日工時日誌點選此案場時，將自動轉為【進行中施工】並預先載入本估計項目！
              </span>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEstimationProject(null)}
                  className="px-4 py-2 hover:bg-neutral-200 text-neutral-700 font-extrabold text-xs rounded-lg transition-all border border-neutral-300 bg-white cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveEstimation}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle size={13} />
                  儲存本案工程估價報價
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ 刪除專案安全二次確認彈窗 */}
      {deleteConfirmProjectId && (() => {
        const p = projects.find(proj => proj.id === deleteConfirmProjectId);
        if (!p) return null;
        
        // 找出關聯此案場的日誌筆數
        const relatedRecords = records.filter(r => r.projectId === p.id);

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-md w-full border border-neutral-200 shadow-2xl p-6 space-y-5 animate-scaleIn">
              
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-xs border border-red-100">
                  <Trash2 size={22} className="stroke-[2.5]" />
                </div>
                <h3 className="text-base font-black text-neutral-900">⚠️ 確定永久刪除此工程案場專案？</h3>
                <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
                  您目前正在執行工程案場刪除。此動作將會抹除該專案所有紀錄，且【完全無法還原】。
                </p>
              </div>

              {/* Warnings details */}
              <div className="bg-red-50/50 rounded-2xl border border-red-100 p-4 space-y-2.5">
                <div className="text-[11px] font-bold text-red-900 border-b border-red-100 pb-1.5 flex items-center gap-1.5">
                  🏮 關聯受影響數據清單：
                </div>
                <div className="text-[11px] text-red-950 font-semibold space-y-1">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-neutral-505">• 施工案場名稱：</span>
                    <span className="font-extrabold text-neutral-800 text-right truncate max-w-[200px]" title={p.generatedName}>
                      {(p.generatedName?.startsWith('[估]') || p.isEstimation)
                        ? (p.generatedName?.startsWith('[估]') ? p.generatedName : `[估]${p.generatedName}`)
                        : p.generatedName || p.companyOrOwner}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-505">• 關聯工務日誌：</span>
                    <span className="font-mono font-black text-red-600">{relatedRecords.length} 筆 (將一併永久刪除)</span>
                  </div>
                </div>
                <p className="text-[9px] text-red-500 leading-normal font-semibold">
                  * 提示：專案刪除後，它在「請款沖帳簿」、「出工考勤時數」與「財務大盤分析」中的數據均會被抹除。
                </p>
              </div>

              {/* Actions buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmProjectId(null)}
                  className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                >
                  安全返回 (保留專案)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // 1. 刪除關聯施工日誌
                    relatedRecords.forEach(rec => {
                      onDeleteRecord(rec.id);
                    });
                    // 2. 刪除專案本身
                    setProjects(prev => prev.filter(proj => proj.id !== p.id));
                    onSaveToast(`🗑️ 案場【${p.companyOrOwner}】以及關聯 ${relatedRecords.length} 筆日誌，已永久刪除！`);
                    setDeleteConfirmProjectId(null);
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs text-center"
                >
                  確認刪除 (永久抹除)
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
