import React, { useState } from 'react';
import { Worker, EmergencyContact, SalaryAdjustment } from '../types';
import { 
  Plus, Trash2, Edit, HardHat, Phone, Mail, CreditCard, MapPin, 
  User, ShieldAlert, BadgeInfo, TrendingUp, DollarSign, Briefcase, 
  ArrowRight, Check, X, ChevronDown, ChevronUp, Users, AlertCircle, Sparkles
} from 'lucide-react';

interface WorkersPanelProps {
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  onSaveToast: (msg: string) => void;
}

export default function WorkersPanel({
  workers,
  setWorkers,
  onSaveToast
}: WorkersPanelProps) {
  // New worker registration state
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('專業師傅');
  const [newWorkerRate, setNewWorkerRate] = useState(300);
  const [newWorkerBillingRate, setNewWorkerBillingRate] = useState(400);
  const [newWorkerStatus, setNewWorkerStatus] = useState<'在職' | '離職'>('在職');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [newWorkerIdNumber, setNewWorkerIdNumber] = useState('');
  const [newWorkerAddress, setNewWorkerAddress] = useState('');
  const [newWorkerNotes, setNewWorkerNotes] = useState('');
  const [newWorkerJoinDate, setNewWorkerJoinDate] = useState(new Date().toISOString().substring(0, 10));
  const [newWorkerLeaveDate, setNewWorkerLeaveDate] = useState('');
  
  // New employee fields
  const [newWorkerBirthDate, setNewWorkerBirthDate] = useState('');
  const [newWorkerRegisteredAddress, setNewWorkerRegisteredAddress] = useState('');
  const [newWorkerIdPhotos, setNewWorkerIdPhotos] = useState<string[]>([]);
  const [newEmergencyContacts, setNewEmergencyContacts] = useState<EmergencyContact[]>([
    { id: '1', name: '', phone: '', relation: '' }
  ]);

  // 勞健保、提撥與代扣款 State (註冊新員工)
  const [newLaborSelfPay, setNewLaborSelfPay] = useState<number | ''>('');
  const [newHealthSelfPay, setNewHealthSelfPay] = useState<number | ''>('');
  const [newPensionSelfPay, setNewPensionSelfPay] = useState<number | ''>('');
  const [newPensionEmployer, setNewPensionEmployer] = useState<number | ''>('');
  const [newOtherWithholding, setNewOtherWithholding] = useState<number | ''>('');
  const [newLaborEmployer, setNewLaborEmployer] = useState<number | ''>('');
  const [newHealthEmployer, setNewHealthEmployer] = useState<number | ''>('');

  // 動態工班職稱 / 階級快選名單
  const [workerRoles, setWorkerRoles] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_worker_roles');
      return stored ? JSON.parse(stored) : ['專業師傅', '水電工頭', '半技工', '技術工', '粗工/助手', '學徒/助理', '臨時支援'];
    } catch {
      return ['專業師傅', '水電工頭', '半技工', '技術工', '粗工/助手', '學徒/助理', '臨時支援'];
    }
  });

  const saveWorkerRoles = (newRoles: string[]) => {
    setWorkerRoles(newRoles);
    localStorage.setItem('engineering_worker_roles', JSON.stringify(newRoles));
  };

  // 職稱編輯管理員之顯示控制
  const [showRoleConfig, setShowRoleConfig] = useState(false);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [renamingRoleIndex, setRenamingRoleIndex] = useState<number | null>(null);
  const [renamingRoleInput, setRenamingRoleInput] = useState('');

  // Editing state
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editWorkerName, setEditWorkerName] = useState('');
  const [editWorkerRole, setEditWorkerRole] = useState('');
  const [editWorkerRate, setEditWorkerRate] = useState(0);
  const [editWorkerBillingRate, setEditWorkerBillingRate] = useState(0);
  const [editWorkerStatus, setEditWorkerStatus] = useState<'在職' | '離職'>('在職');
  const [editWorkerPhone, setEditWorkerPhone] = useState('');
  const [editWorkerIdNumber, setEditWorkerIdNumber] = useState('');
  const [editWorkerAddress, setEditWorkerAddress] = useState('');
  const [editWorkerNotes, setEditWorkerNotes] = useState('');
  const [editWorkerJoinDate, setEditWorkerJoinDate] = useState('');
  const [editWorkerLeaveDate, setEditWorkerLeaveDate] = useState('');
  
  // New edit fields
  const [editWorkerBirthDate, setEditWorkerBirthDate] = useState('');
  const [editWorkerRegisteredAddress, setEditWorkerRegisteredAddress] = useState('');
  const [editWorkerIdPhotos, setEditWorkerIdPhotos] = useState<string[]>([]);
  const [editEmergencyContacts, setEditEmergencyContacts] = useState<EmergencyContact[]>([]);

  // 勞健保、提撥與代扣款 State (編輯現有員工)
  const [editLaborSelfPay, setEditLaborSelfPay] = useState<number | ''>('');
  const [editHealthSelfPay, setEditHealthSelfPay] = useState<number | ''>('');
  const [editPensionSelfPay, setEditPensionSelfPay] = useState<number | ''>('');
  const [editPensionEmployer, setEditPensionEmployer] = useState<number | ''>('');
  const [editOtherWithholding, setEditOtherWithholding] = useState<number | ''>('');
  const [editLaborEmployer, setEditLaborEmployer] = useState<number | ''>('');
  const [editHealthEmployer, setEditHealthEmployer] = useState<number | ''>('');

  // 換算符合水電年資之計算器 (X年 Y個月 Z天)
  const calculateSeniorityStr = (join?: string, leave?: string): string => {
    if (!join) return '尚未設定入職日期';
    
    const start = new Date(join);
    if (isNaN(start.getTime())) return '日期無效';

    const end = leave ? new Date(leave) : new Date();
    if (isNaN(end.getTime())) return '計算中';

    if (end < start) {
      return '尚未到職';
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const segments: string[] = [];
    if (years > 0) segments.push(`${years}年`);
    if (months > 0) segments.push(`${months}個月`);
    if (days > 0 || (years === 0 && months === 0)) segments.push(`${days}天`);

    return segments.join('') + (leave ? ' (已折算至離職結算)' : '');
  };

  // Special Adjustment (Salary & promotion) inline state
  const [adjustingWorkerId, setAdjustingWorkerId] = useState<string | null>(null);
  const [adjNewRole, setAdjNewRole] = useState('');
  const [adjNewRate, setAdjNewRate] = useState(0);
  const [adjReason, setAdjReason] = useState('');
  const [adjType, setAdjType] = useState<'both' | 'salary' | 'role'>('both');

  // Interactive expanded info worker card status
  const [expandedWorkerIds, setExpandedWorkerIds] = useState<Record<string, boolean>>({});

  // List filters
  const [listStatusFilter, setListStatusFilter] = useState<'全部' | '在職' | '離職'>('全部');
  const [listSearchQuery, setListSearchQuery] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedWorkerIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const files = e.target.files;
    if (!files) return;
    const loadedB64: string[] = [];
    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (isEdit) {
            setEditWorkerIdPhotos(prev => [...prev, reader.result as string]);
          } else {
            setNewWorkerIdPhotos(prev => [...prev, reader.result as string]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAutoMockPhotos = (isEdit: boolean) => {
    const mockFront = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'><rect width='100%' height='100%' fill='%23f1f5f9' stroke='%23cbd5e1' stroke-width='4'/><rect x='10' y='10' width='280' height='160' fill='%23eff6ff' rx='6'/><text x='20' y='40' font-family='sans-serif' font-size='14' font-weight='black' fill='%231e3a8a'>中華民國國民身分證 (正面複本)</text><rect x='210' y='55' width='70' height='85' fill='%2394a3b8' rx='4'/><text x='245' y='100' font-family='sans-serif' font-size='11' text-anchor='middle' fill='%23ffffff' font-weight='bold'>📷 證照相片</text><text x='20' y='80' font-family='sans-serif' font-size='12' fill='%231e293b' font-weight='bold'>姓名：認證合格技師</text><text x='20' y='110' font-family='sans-serif' font-size='12' fill='%231e293b' font-weight='bold'>生日：1988年08月08日</text><text x='20' y='140' font-family='sans-serif' font-size='12' fill='%233b82f6' font-weight='mono' font-weight='bold'>施工許可證</text></svg>`;
    const mockBack = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180' viewBox='0 0 300 180'><rect width='100%' height='100%' fill='%23f1f5f9' stroke='%23cbd5e1' stroke-width='4'/><rect x='10' y='10' width='280' height='160' fill='%23fefaf8' rx='6'/><text x='20' y='40' font-family='sans-serif' font-size='14' font-weight='black' fill='%23b45309'>身分證/水電專業牌照 (背面複本)</text><text x='20' y='80' font-family='sans-serif' font-size='12' fill='%231e293b' font-weight='bold'>安全卡編號：SEC-9981502</text><text x='20' y='110' font-family='sans-serif' font-size='12' fill='%231e293b' font-weight='bold'>戶籍地址：新北市板橋區工藝名錄特區</text><text x='20' y='140' font-family='sans-serif' font-size='12' fill='%23e11d48' font-weight='bold'>⭐ 勞安特衛認證</text></svg>`;
    if (isEdit) {
      setEditWorkerIdPhotos([mockFront, mockBack]);
    } else {
      setNewWorkerIdPhotos([mockFront, mockBack]);
    }
    onSaveToast("📸 已成功自動生成極速高科技臺灣專屬雙證件（正面與背面備份）封包！");
  };

  const addEmergencyContactRow = (isEdit: boolean) => {
    const newRow = { id: `ec-${Date.now()}-${Math.random()}`, name: '', phone: '', relation: '' };
    if (isEdit) {
      setEditEmergencyContacts(prev => [...prev, newRow]);
    } else {
      setNewEmergencyContacts(prev => [...prev, newRow]);
    }
  };

  const removeEmergencyContactRow = (id: string, isEdit: boolean) => {
    if (isEdit) {
      setEditEmergencyContacts(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev);
    } else {
      setNewEmergencyContacts(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev);
    }
  };

  const updateEmergencyContactField = (id: string, field: keyof EmergencyContact, value: string, isEdit: boolean) => {
    const updater = (prev: EmergencyContact[]) => prev.map(c => c.id === id ? { ...c, [field]: value } : c);
    if (isEdit) {
      setEditEmergencyContacts(updater);
    } else {
      setNewEmergencyContacts(updater);
    }
  };

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName.trim()) return;
    
    if (newWorkerStatus === '離職' && !newWorkerLeaveDate) {
      onSaveToast("⚠️ 同仁處於離職/暫停派遣狀態，請務必點選或填寫「離職日期」！");
      return;
    }

    const filteredEC = newEmergencyContacts.filter(c => c.name.trim() || c.phone.trim());

    const item: Worker = {
      id: `w-${Date.now()}`,
      name: newWorkerName.trim(),
      role: newWorkerRole.trim(),
      defaultHourlyRate: newWorkerRate,
      billingHourlyRate: newWorkerBillingRate,
      status: newWorkerStatus,
      phone: newWorkerPhone.trim() || undefined,
      idNumber: newWorkerIdNumber.trim() || undefined,
      address: newWorkerAddress.trim() || undefined,
      birthDate: newWorkerBirthDate || undefined,
      registeredAddress: newWorkerRegisteredAddress.trim() || undefined,
      doubleIdPhotos: newWorkerIdPhotos.length > 0 ? newWorkerIdPhotos : undefined,
      emergencyContacts: filteredEC.length > 0 ? filteredEC : undefined,
      notes: newWorkerNotes.trim() || undefined,
      joinDate: newWorkerJoinDate || undefined,
      leaveDate: newWorkerStatus === '離職' ? (newWorkerLeaveDate || undefined) : undefined,
      salaryHistory: [],
      
      laborInsuranceSelfPay: newLaborSelfPay !== '' ? Number(newLaborSelfPay) : undefined,
      healthInsuranceSelfPay: newHealthSelfPay !== '' ? Number(newHealthSelfPay) : undefined,
      laborPensionSelfPay: newPensionSelfPay !== '' ? Number(newPensionSelfPay) : undefined,
      laborPensionEmployerUnit: newPensionEmployer !== '' ? Number(newPensionEmployer) : undefined,
      otherWithholding: newOtherWithholding !== '' ? Number(newOtherWithholding) : undefined,
      laborInsuranceEmployerPay: newLaborEmployer !== '' ? Number(newLaborEmployer) : undefined,
      healthInsuranceEmployerPay: newHealthEmployer !== '' ? Number(newHealthEmployer) : undefined,
    };

    setWorkers([...workers, item]);
    
    // Reset fields
    setNewWorkerName('');
    setNewWorkerRole('專業師傅');
    setNewWorkerRate(300);
    setNewWorkerBillingRate(400);
    setNewWorkerStatus('在職');
    setNewWorkerPhone('');
    setNewWorkerIdNumber('');
    setNewWorkerAddress('');
    setNewWorkerNotes('');
    setNewWorkerBirthDate('');
    setNewWorkerRegisteredAddress('');
    setNewWorkerIdPhotos([]);
    setNewWorkerJoinDate(new Date().toISOString().substring(0, 10));
    setNewWorkerLeaveDate('');
    setNewEmergencyContacts([{ id: '1', name: '', phone: '', relation: '' }]);
    setNewLaborSelfPay('');
    setNewHealthSelfPay('');
    setNewPensionSelfPay('');
    setNewPensionEmployer('');
    setNewOtherWithholding('');
    setNewLaborEmployer('');
    setNewHealthEmployer('');

    onSaveToast(`✅ 已成功將員工 [${item.name}] 登錄進入人事體系並精算起始年資！`);
  };

  const handleStartEditWorker = (w: Worker) => {
    setEditingWorkerId(w.id);
    setEditWorkerName(w.name);
    setEditWorkerRole(w.role || '');
    setEditWorkerRate(w.defaultHourlyRate);
    setEditWorkerBillingRate(w.billingHourlyRate || w.defaultHourlyRate);
    setEditWorkerStatus(w.status || '在職');
    setEditWorkerPhone(w.phone || '');
    setEditWorkerIdNumber(w.idNumber || '');
    setEditWorkerAddress(w.address || '');
    setEditWorkerNotes(w.notes || '');
    
    // New fields loader
    setEditWorkerBirthDate(w.birthDate || '');
    setEditWorkerRegisteredAddress(w.registeredAddress || '');
    setEditWorkerIdPhotos(w.doubleIdPhotos || []);
    setEditWorkerJoinDate(w.joinDate || new Date().toISOString().substring(0, 10));
    setEditWorkerLeaveDate(w.leaveDate || '');
    setEditLaborSelfPay(w.laborInsuranceSelfPay !== undefined ? w.laborInsuranceSelfPay : '');
    setEditHealthSelfPay(w.healthInsuranceSelfPay !== undefined ? w.healthInsuranceSelfPay : '');
    setEditPensionSelfPay(w.laborPensionSelfPay !== undefined ? w.laborPensionSelfPay : '');
    setEditPensionEmployer(w.laborPensionEmployerUnit !== undefined ? w.laborPensionEmployerUnit : '');
    setEditOtherWithholding(w.otherWithholding !== undefined ? w.otherWithholding : '');
    setEditLaborEmployer(w.laborInsuranceEmployerPay !== undefined ? w.laborInsuranceEmployerPay : '');
    setEditHealthEmployer(w.healthInsuranceEmployerPay !== undefined ? w.healthInsuranceEmployerPay : '');
    
    // Load emergencyContacts array
    if (w.emergencyContacts && w.emergencyContacts.length > 0) {
      setEditEmergencyContacts(w.emergencyContacts);
    } else {
      const legacyName = (w as any).emergencyContactName || '';
      const legacyPhone = (w as any).emergencyContactPhone || '';
      const legacyRelation = (w as any).emergencyContactRelation || '';
      
      setEditEmergencyContacts([
        {
          id: `ec-${Date.now()}`,
          name: legacyName,
          phone: legacyPhone,
          relation: legacyRelation
        }
      ]);
    }
  };

  const handleSaveEditWorker = () => {
    if (!editWorkerName.trim()) return;

    if (editWorkerStatus === '離職' && !editWorkerLeaveDate) {
      onSaveToast("⚠️ 同仁狀態切換為離職，請指定「離職日期」以供清算年資！");
      return;
    }

    const filteredEC = editEmergencyContacts.filter(c => c.name.trim() || c.phone.trim());

    setWorkers(workers.map(w => w.id === editingWorkerId ? {
      ...w,
      name: editWorkerName.trim(),
      role: editWorkerRole.trim(),
      defaultHourlyRate: editWorkerRate,
      billingHourlyRate: editWorkerBillingRate,
      status: editWorkerStatus,
      phone: editWorkerPhone.trim() || undefined,
      idNumber: editWorkerIdNumber.trim() || undefined,
      address: editWorkerAddress.trim() || undefined,
      notes: editWorkerNotes.trim() || undefined,
      birthDate: editWorkerBirthDate || undefined,
      registeredAddress: editWorkerRegisteredAddress.trim() || undefined,
      doubleIdPhotos: editWorkerIdPhotos.length > 0 ? editWorkerIdPhotos : undefined,
      emergencyContacts: filteredEC.length > 0 ? filteredEC : undefined,
      joinDate: editWorkerJoinDate || undefined,
      leaveDate: editWorkerStatus === '離職' ? (editWorkerLeaveDate || undefined) : undefined,
      laborInsuranceSelfPay: editLaborSelfPay !== '' ? Number(editLaborSelfPay) : undefined,
      healthInsuranceSelfPay: editHealthSelfPay !== '' ? Number(editHealthSelfPay) : undefined,
      laborPensionSelfPay: editPensionSelfPay !== '' ? Number(editPensionSelfPay) : undefined,
      laborPensionEmployerUnit: editPensionEmployer !== '' ? Number(editPensionEmployer) : undefined,
      otherWithholding: editOtherWithholding !== '' ? Number(editOtherWithholding) : undefined,
      laborInsuranceEmployerPay: editLaborEmployer !== '' ? Number(editLaborEmployer) : undefined,
      healthInsuranceEmployerPay: editHealthEmployer !== '' ? Number(editHealthEmployer) : undefined,
    } : w));
    
    setEditingWorkerId(null);
    onSaveToast('✅ 員工詳細、入離職年月、出生日期與多位緊急聯絡人資歷更新成功！');
  };

  // Start special promoting or salary adjustments
  const handleStartAdjustment = (w: Worker) => {
    setAdjustingWorkerId(w.id);
    setAdjNewRole(w.role || '專業師傅');
    setAdjNewRate(w.defaultHourlyRate);
    setAdjReason('配合能力提升調整薪級/認證職稱');
    setAdjType('both');
  };

  const handleSaveAdjustment = (w: Worker) => {
    // Modify based on adjType setting
    const updatedRole = (adjType === 'both' || adjType === 'role') ? adjNewRole : w.role;
    const updatedRate = (adjType === 'both' || adjType === 'salary') ? adjNewRate : w.defaultHourlyRate;

    const todayStr = new Date().toISOString().substring(0, 10);
    const newAdj: SalaryAdjustment = {
      id: `adj-${Date.now()}-${Math.random()}`,
      date: todayStr,
      oldRate: w.defaultHourlyRate,
      newRate: updatedRate,
      oldRole: w.role,
      newRole: updatedRole,
      reason: adjReason || '考核晉薪'
    };

    setWorkers(workers.map(item => {
      if (item.id === w.id) {
        const history = item.salaryHistory || [];
        return {
          ...item,
          role: updatedRole,
          defaultHourlyRate: updatedRate,
          notes: `${item.notes || ''}\n[晉升調薪記錄 ${todayStr}]：類型為 ${
            adjType === 'both' ? '同時晉升與調薪' : adjType === 'salary' ? '單獨薪資微調' : '單獨派工頭銜變更'
          }。調整後為 [${updatedRole}]，時薪變為 $${updatedRate}/h。原因：${adjReason}`.trim(),
          salaryHistory: [...history, newAdj]
        };
      }
      return item;
    }));

    setAdjustingWorkerId(null);
    onSaveToast(`🚀 已成功針對 ${w.name} 登載歷史薪級與晉升日誌，時薪變更為 $${updatedRate}/hr 生效！`);
  };

  // Filter application
  const filteredWorkers = workers.filter(w => {
    const statusMatch = 
      listStatusFilter === '全部' ||
      (listStatusFilter === '在職' && (w.status === '在職' || !w.status)) ||
      (listStatusFilter === '離職' && w.status === '離職');

    const searchStr = (w.name + ' ' + (w.role || '') + ' ' + (w.phone || '') + ' ' + (w.notes || '')).toLowerCase();
    const qMatch = !listSearchQuery.trim() || searchStr.includes(listSearchQuery.toLowerCase());

    return statusMatch && qMatch;
  });

  return (
    <div id="workers-panel" className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-600 block">Dispatch Labor Management System</span>
          <h2 className="text-base font-black text-neutral-800 flex items-center gap-2">
            <HardHat className="text-amber-600 animate-pulse" size={20} />
            水電工班人事資料與薪資晉升
          </h2>
        </div>
      </div>

      {/* Advanced Register Form */}
      <div className="bg-neutral-50 p-5 border border-neutral-150 rounded-xl">
        <div className="flex items-center gap-1.5 mb-4 pb-2 border-b border-neutral-200">
          <Sparkles size={14} className="text-amber-500" />
          <h3 className="text-xs font-black text-neutral-800 uppercase tracking-tight">➕ 新增派工同仁 (詳細人事登錄與緊急聯絡人)</h3>
        </div>
        
        <form onSubmit={handleAddWorker} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-[10px] text-neutral-500 font-bold mb-1">同仁姓名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                placeholder="例如: 謝長廷"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-semibold focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] text-neutral-500 font-bold mb-1">派工職稱 / 階級</label>
              <input
                type="text"
                list="new-worker-roles"
                value={newWorkerRole}
                onChange={(e) => setNewWorkerRole(e.target.value)}
                placeholder="例如: 專業師傅 (可自行命名)"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-808 font-semibold focus:border-amber-500 focus:outline-none"
              />
              <datalist id="new-worker-roles">
                {workerRoles.map(r => (
                  <option key={r} value={r} />
                ))}
              </datalist>
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowRoleConfig(!showRoleConfig)}
                  className="text-[9px] font-extrabold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 cursor-pointer flex items-center gap-0.5 transition"
                >
                  ⚙️ 管理職稱快選
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-neutral-500 font-bold mb-1">對內派工時薪 ($/hr)</label>
                <input
                  type="number"
                  value={newWorkerRate}
                  onChange={(e) => setNewWorkerRate(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-mono font-bold text-center focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-amber-700 font-bold mb-1">對客報價時薪 ($/hr)</label>
                <input
                  type="number"
                  value={newWorkerBillingRate}
                  onChange={(e) => setNewWorkerBillingRate(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg text-xs bg-white text-amber-900 font-mono font-bold text-center focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-neutral-500 font-bold mb-1">在職派遣狀態</label>
              <select
                value={newWorkerStatus}
                onChange={(e) => setNewWorkerStatus(e.target.value as '在職' | '離職')}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-850 font-bold focus:border-amber-500 focus:outline-none"
              >
                <option value="在職">🟢 在職可派遣</option>
                <option value="離職">🔴 離職/暫停派遣</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-neutral-550 font-bold mb-1">入職日期 <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={newWorkerJoinDate}
                onChange={(e) => setNewWorkerJoinDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-mono font-bold focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] text-neutral-500 font-bold mb-1">離職結算日期 {newWorkerStatus === '離職' && <span className="text-red-500">*</span>}</label>
              <input
                type="date"
                value={newWorkerLeaveDate}
                onChange={(e) => setNewWorkerLeaveDate(e.target.value)}
                disabled={newWorkerStatus !== '離職'}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white disabled:bg-neutral-100 disabled:text-neutral-400 text-rose-800 font-mono font-bold focus:border-rose-500 focus:outline-none"
                required={newWorkerStatus === '離職'}
              />
            </div>
          </div>

          {/* Collapsible/expanded extra info registration fields */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 space-y-4">
            <div className="pb-1 border-b border-neutral-100 text-[11px] font-black text-neutral-600 flex items-center gap-1.5">
              <User size={13} className="text-amber-600" />
              <span>① 居住 / 戶籍、出生資訊與健保認證雙證件</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-0.5">聯絡電話</label>
                <input
                  type="text"
                  placeholder="例如: 0912-345-678"
                  value={newWorkerPhone}
                  onChange={(e) => setNewWorkerPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs text-neutral-800"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-0.5">出生年月日</label>
                <input
                  type="date"
                  value={newWorkerBirthDate}
                  onChange={(e) => setNewWorkerBirthDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs text-neutral-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 font-bold mb-0.5">身分證字號</label>
                <input
                  type="text"
                  placeholder="例如: A123456789"
                  value={newWorkerIdNumber}
                  onChange={(e) => setNewWorkerIdNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs text-neutral-850 font-mono"
                />
              </div>

              <div className="md:col-span-1.5">
                <label className="block text-[10px] text-neutral-400 font-bold mb-0.5">居住地址 (通訊地)</label>
                <input
                  type="text"
                  placeholder="例如: 北市大安區新生南路一段..."
                  value={newWorkerAddress}
                  onChange={(e) => setNewWorkerAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs text-neutral-800"
                />
              </div>

              <div className="md:col-span-1.5">
                <label className="block text-[10px] text-neutral-400 font-bold mb-0.5">戶籍地址 (登記地址)</label>
                <input
                  type="text"
                  placeholder="例如: 宜蘭市中山路二段10號"
                  value={newWorkerRegisteredAddress}
                  onChange={(e) => setNewWorkerRegisteredAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs text-neutral-800"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] text-neutral-400 font-bold mb-0.5">專長或入社認證歷程備註</label>
                <input
                  type="text"
                  placeholder="例如: 擅長暗管漏水查驗、具備甲級室內配線技術士證証"
                  value={newWorkerNotes}
                  onChange={(e) => setNewWorkerNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs text-neutral-800"
                />
              </div>
            </div>

            {/* 勞健保、提撥與固定代扣款設定 (NEW!) */}
            <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-xl space-y-3">
              <div className="border-b border-neutral-200 pb-1 flex items-center justify-between">
                <span className="text-xs font-extrabold text-neutral-700 flex items-center gap-1">🏦 員工勞健保、退休提撥與代扣預設</span>
                <span className="text-[10px] text-amber-600 font-extrabold">※ 月底算薪各同仁結帳時可自動扣繳沖抵</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                <div>
                  <label className="block text-neutral-500 font-bold mb-0.5">勞保個人自付 (月扣額)</label>
                  <input
                    type="number"
                    placeholder="例如: 1150"
                    value={newLaborSelfPay}
                    onChange={(e) => setNewLaborSelfPay(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500 font-bold mb-0.5">健保個人自付 (月扣額)</label>
                  <input
                    type="number"
                    placeholder="例如: 980"
                    value={newHealthSelfPay}
                    onChange={(e) => setNewHealthSelfPay(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500 font-bold mb-0.5">勞退代扣個人自提額</label>
                  <input
                    type="number"
                    placeholder="無提繳不扣除"
                    value={newPensionSelfPay}
                    onChange={(e) => setNewPensionSelfPay(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500 font-bold mb-0.5">其它每月固定代扣款</label>
                  <input
                    type="number"
                    placeholder="無則免填"
                    value={newOtherWithholding}
                    onChange={(e) => setNewOtherWithholding(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500 font-bold mb-0.5">勞保雇主負擔 (單位負擔)</label>
                  <input
                    type="number"
                    placeholder="例如: 4050"
                    value={newLaborEmployer}
                    onChange={(e) => setNewLaborEmployer(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-500 font-bold mb-0.5">健保雇主負擔 (單位負擔)</label>
                  <input
                    type="number"
                    placeholder="例如: 3100"
                    value={newHealthEmployer}
                    onChange={(e) => setNewHealthEmployer(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-neutral-500 font-bold mb-0.5">勞退公司提撥金 (雇主強制提撥 6%)</label>
                  <input
                    type="number"
                    placeholder="例如: 2160"
                    value={newPensionEmployer}
                    onChange={(e) => setNewPensionEmployer(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 雙證件照片上傳與極速生成 */}
            <div className="bg-neutral-50 p-4 border border-neutral-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                <span className="text-[11px] font-black text-neutral-700 flex items-center gap-1">
                  📸 雙證件存檔證照檔案 (勞保/職災與安全隔離申報) {newWorkerIdPhotos.length > 0 ? `(已載入 ${newWorkerIdPhotos.length} 張)` : '(尚無存檔)'}
                </span>
                <button
                  type="button"
                  onClick={() => handleAutoMockPhotos(false)}
                  className="text-[10px] bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-extrabold px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer"
                >
                  ⚙️ 快速模擬極速生成合格證照五重奏
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-4 border-2 border-dashed border-neutral-300 rounded-xl p-3 flex flex-col justify-center items-center h-24 bg-white cursor-pointer hover:border-neutral-400 transition relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFilesUpload(e, false)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="選取圖片"
                  />
                  <div className="text-center space-y-1">
                    <span className="text-xs text-neutral-500 font-bold">📂 點擊或拖曳上傳</span>
                    <p className="text-[9px] text-neutral-400 font-medium">身份證與健保卡/職安認證照片</p>
                  </div>
                </div>

                <div className="md:col-span-8 flex flex-wrap gap-2 items-center">
                  {newWorkerIdPhotos.length === 0 ? (
                    <span className="text-[10px] text-neutral-400 italic">💡 尚未放置雙證件檔案。可自行本機上傳或點擊右上方「模擬快速生成」。</span>
                  ) : (
                    newWorkerIdPhotos.map((p, pIdx) => (
                      <div key={pIdx} className="relative group rounded border border-neutral-200 overflow-hidden bg-white shadow-3xs">
                        <img src={p} alt={`證件-${pIdx}`} className="h-16 w-28 object-contain bg-neutral-900" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setNewWorkerIdPhotos(prev => prev.filter((_, i) => i !== pIdx))}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 shadow-md hover:bg-red-700 transition"
                          title="移出該相片"
                        >
                          <X size={8} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Info block */}
            <div className="pb-1 border-b border-neutral-100 text-[11px] font-black text-rose-800 flex items-center gap-1.5 pt-2">
              <ShieldAlert size={13} className="text-rose-600 animate-pulse" />
              <span>② 複數緊急聯絡人資訊 (工安聯防與家屬聯繫，允許複選或登載多位)</span>
            </div>

            <div className="space-y-2">
              {newEmergencyContacts.map((contact, index) => (
                <div key={contact.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-rose-50/10 p-3 border border-rose-100 rounded-lg animate-fadeIn">
                  <div className="md:col-span-4">
                    <label className="block text-[9px] text-rose-900 font-bold mb-0.5">緊急聯絡人姓名</label>
                    <input
                      type="text"
                      placeholder="例如: 王美麗"
                      value={contact.name}
                      onChange={(e) => updateEmergencyContactField(contact.id, 'name', e.target.value, false)}
                      className="w-full px-2 py-1.5 border border-rose-200 bg-white rounded-lg text-xs text-neutral-800"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[9px] text-rose-900 font-bold mb-0.5">緊急聯絡電話</label>
                    <input
                      type="text"
                      placeholder="例如: 0911-222-333"
                      value={contact.phone}
                      onChange={(e) => updateEmergencyContactField(contact.id, 'phone', e.target.value, false)}
                      className="w-full px-2 py-1.5 border border-rose-200 bg-white rounded-lg text-xs text-neutral-800 font-mono"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[9px] text-rose-900 font-bold mb-0.5">與員工關係</label>
                    <input
                      type="text"
                      placeholder="例如: 配偶 / 父母 / 兄妹 / 摯友"
                      value={contact.relation}
                      onChange={(e) => updateEmergencyContactField(contact.id, 'relation', e.target.value, false)}
                      className="w-full px-2 py-1.5 border border-rose-200 bg-white rounded-lg text-xs text-neutral-800"
                    />
                  </div>

                  <div className="md:col-span-1 flex justify-end pt-3 md:pt-4">
                    <button
                      type="button"
                      onClick={() => removeEmergencyContactRow(contact.id, false)}
                      disabled={newEmergencyContacts.length === 1}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
                      title="刪除此緊急聯絡人"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => addEmergencyContactRow(false)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-250 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus size={12} />
                  ➕ 建立另一位緊急聯絡人
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus size={15} />
              建立新同仁人事檔
            </button>
          </div>
        </form>

        {/* 職稱/階級快選設定器面板 */}
        {showRoleConfig && (
          <div className="mt-4 p-5 bg-amber-50/30 border border-amber-200/80 rounded-xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                <Briefcase size={14} />
                ⚙️ 水電派工職稱與階級快選名單管理員
              </h4>
              <button
                type="button"
                onClick={() => setShowRoleConfig(false)}
                className="text-neutral-400 hover:text-neutral-600 transition"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[11px] text-amber-800 leading-relaxed">
              💡 系統預設水電常見對照。您可以在下方新增您工班特有的階級（如：資深特技、半師、備工等），也可以直接更新既有階級名稱，或移除不常使用的職稱。
            </p>

            {/* 新增職稱輸入 */}
            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                placeholder="輸入新職稱 (例如: 高級學徒)"
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs bg-white focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  const val = newRoleInput.trim();
                  if (!val) return;
                  if (workerRoles.includes(val)) {
                    onSaveToast('⚠️ 名單中已存在相同職稱名稱！');
                    return;
                  }
                  saveWorkerRoles([...workerRoles, val]);
                  setNewRoleInput('');
                  onSaveToast(`➕ 成功新增快選職稱：【${val}】！`);
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                新增職位
              </button>
            </div>

            {/* 職稱列表 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
              {workerRoles.map((role, idx) => {
                const isRenaming = renamingRoleIndex === idx;
                return (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-neutral-200 shadow-3xs">
                    {isRenaming ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={renamingRoleInput}
                          onChange={(e) => setRenamingRoleInput(e.target.value)}
                          className="w-full px-2 py-0.5 border border-amber-300 rounded text-xs focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = renamingRoleInput.trim();
                            if (!val) {
                              setRenamingRoleIndex(null);
                              return;
                            }
                            if (workerRoles.includes(val) && workerRoles[idx] !== val) {
                              onSaveToast('⚠️ 已有名稱相同的職稱！');
                              return;
                            }
                            const updated = [...workerRoles];
                            updated[idx] = val;
                            saveWorkerRoles(updated);
                            setRenamingRoleIndex(null);
                            onSaveToast(`✏️ 職稱已更新為：【${val}】！`);
                          }}
                          className="p-1 bg-green-500 text-white rounded hover:bg-green-600 transition flex items-center justify-center cursor-pointer"
                        >
                          <Check size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingRoleIndex(null)}
                          className="p-1 bg-neutral-200 text-neutral-600 rounded hover:bg-neutral-300 transition flex items-center justify-center cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-neutral-755">{role}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingRoleIndex(idx);
                              setRenamingRoleInput(role);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-amber-600 hover:bg-neutral-50 rounded transition cursor-pointer"
                            title="變更此職稱名稱"
                          >
                            <Edit size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = workerRoles.filter((_, i) => i !== idx);
                              saveWorkerRoles(updated);
                              onSaveToast(`🗑️ 已成功移除職稱快選：【${role}】！`);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                            title="刪除此職稱"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Roster list query and filter header */}
      <div className="bg-neutral-50 px-4 py-3 rounded-xl border border-neutral-200/60 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-neutral-500" />
          <span className="text-xs font-extrabold text-neutral-700">派遣同仁篩選</span>
          <div className="flex bg-white rounded-lg p-0.5 border border-neutral-250 text-xs">
            <button
              onClick={() => setListStatusFilter('全部')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                listStatusFilter === '全部' ? 'bg-neutral-800 text-white shadow-3xs' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              全部 ({workers.length})
            </button>
            <button
              onClick={() => setListStatusFilter('在職')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                listStatusFilter === '在職' ? 'bg-emerald-600 text-white shadow-3xs' : 'text-neutral-500 hover:text-emerald-600'
              }`}
            >
              在職 ({workers.filter(w => w.status !== '離職').length})
            </button>
            <button
              onClick={() => setListStatusFilter('離職')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                listStatusFilter === '離職' ? 'bg-rose-600 text-white shadow-3xs' : 'text-neutral-500 hover:text-rose-600'
              }`}
            >
              已離職 ({workers.filter(w => w.status === '離職').length})
            </button>
          </div>
        </div>

        <div className="w-full md:w-64">
          <input
            type="text"
            placeholder="搜尋同仁、電話、專長或備註..."
            value={listSearchQuery}
            onChange={(e) => setListSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white placeholder-neutral-400 text-neutral-800 font-medium"
          />
        </div>
      </div>

      {/* Main Employee list cards */}
      <div className="space-y-3">
        {filteredWorkers.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-neutral-200 rounded-xl text-neutral-400 text-xs italic">
            💡 目前找不到符合篩選條件的同仁資料。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkers.map(w => {
              const isEditing = editingWorkerId === w.id;
              const isAdjusting = adjustingWorkerId === w.id;
              const isExpanded = !!expandedWorkerIds[w.id];
              const isActive = w.status !== '離職';

              return (
                <div 
                  key={w.id} 
                  className={`p-4 bg-white border rounded-xl flex flex-col justify-between shadow-xs transition-all duration-200 ${
                    isActive ? 'border-neutral-200 hover:shadow-md' : 'border-neutral-200 bg-neutral-50/60 opacity-80'
                  }`}
                >
                  {isEditing ? (
                    /* General Info Edit */
                    <div className="space-y-3.5 w-full bg-amber-50/5 p-3 rounded-xl border border-amber-250">
                      <div className="pb-1.5 border-b border-amber-200 font-extrabold text-neutral-800 text-xs flex justify-between items-center">
                        <span className="flex items-center gap-1">📝 編輯員工基本與人事檔案</span>
                        <span className="text-[9px] bg-amber-600/10 text-amber-700 px-1.5 py-0.2 rounded font-mono">ID: {w.id}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-neutral-500 font-bold mb-0.5">員工姓名</label>
                          <input
                            type="text"
                            value={editWorkerName}
                            onChange={(e) => setEditWorkerName(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-500 font-bold mb-0.5">目前職稱 / 階級</label>
                          <input
                            type="text"
                            list="edit-worker-roles"
                            value={editWorkerRole}
                            onChange={(e) => setEditWorkerRole(e.target.value)}
                            placeholder="例如: 半技工 (可自行命名)"
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-808 font-bold focus:border-amber-500 focus:outline-none"
                          />
                          <datalist id="edit-worker-roles">
                            {workerRoles.map(r => (
                              <option key={r} value={r} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-neutral-500 font-bold mb-0.5">對內時薪</label>
                          <input
                            type="number"
                            value={editWorkerRate}
                            onChange={(e) => setEditWorkerRate(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs font-mono text-center bg-white text-neutral-805 font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-amber-700 font-bold mb-0.5">對外報價</label>
                          <input
                            type="number"
                            value={editWorkerBillingRate}
                            onChange={(e) => setEditWorkerBillingRate(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs font-mono text-center bg-white text-amber-900 font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-500 font-bold mb-0.5">派遣狀態</label>
                          <select
                            value={editWorkerStatus}
                            onChange={(e) => setEditWorkerStatus(e.target.value as '在職' | '離職')}
                            className="w-full px-1.5 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-bold"
                          >
                            <option value="在職">🟢 在職可派遣</option>
                            <option value="離職">🔴 離職/暫退</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-neutral-500 font-bold mb-0.5">入職日期 <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            value={editWorkerJoinDate}
                            onChange={(e) => setEditWorkerJoinDate(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-bold font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className={`block text-[10px] font-bold mb-0.5 ${editWorkerStatus === '離職' ? 'text-rose-600' : 'text-neutral-400'}`}>
                            離職日期 {editWorkerStatus === '離職' && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type="date"
                            value={editWorkerLeaveDate}
                            onChange={(e) => setEditWorkerLeaveDate(e.target.value)}
                            disabled={editWorkerStatus !== '離職'}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white disabled:bg-neutral-150 disabled:text-neutral-400 text-rose-800 font-bold font-mono"
                            required={editWorkerStatus === '離職'}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">聯絡電話</label>
                          <input
                            type="text"
                            value={editWorkerPhone}
                            onChange={(e) => setEditWorkerPhone(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">出生年月日</label>
                          <input
                            type="date"
                            value={editWorkerBirthDate}
                            onChange={(e) => setEditWorkerBirthDate(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-800 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">身分證字號</label>
                          <input
                            type="text"
                            value={editWorkerIdNumber}
                            onChange={(e) => setEditWorkerIdNumber(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-850 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">居住地址 (通訊地)</label>
                          <input
                            type="text"
                            value={editWorkerAddress}
                            onChange={(e) => setEditWorkerAddress(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-800"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-0.5">戶籍地址 (身份證登記地址)</label>
                        <input
                          type="text"
                          value={editWorkerRegisteredAddress}
                          onChange={(e) => setEditWorkerRegisteredAddress(e.target.value)}
                          className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-0.5">專長或調度歷程備註</label>
                        <input
                          type="text"
                          value={editWorkerNotes}
                          onChange={(e) => setEditWorkerNotes(e.target.value)}
                          className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-800"
                        />
                      </div>

                      {/* 勞健保與代扣提撥編輯 (NEW!) */}
                      <div className="bg-amber-50/15 p-2.5 border border-amber-200/50 rounded-lg space-y-2 text-[10px]">
                        <div className="border-b border-amber-200 pb-1 font-extrabold text-amber-850 flex items-center justify-between">
                          <span>🏦 編輯同仁之勞健保、提撥與固定代扣款</span>
                          <span className="text-[8px] text-neutral-400">供期末發薪清算折抵</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-neutral-500 font-bold mb-0.5">勞保個人自付 (代扣額)</label>
                            <input
                              type="number"
                              value={editLaborSelfPay}
                              onChange={(e) => setEditLaborSelfPay(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-1.5 py-1 border border-neutral-250 rounded text-xs bg-white text-neutral-800 font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-neutral-500 font-bold mb-0.5">健保個人自付 (代扣額)</label>
                            <input
                              type="number"
                              value={editHealthSelfPay}
                              onChange={(e) => setEditHealthSelfPay(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-1.5 py-1 border border-neutral-250 rounded text-xs bg-white text-neutral-800 font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-neutral-500 font-bold mb-0.5">勞退自繳自提額</label>
                            <input
                              type="number"
                              value={editPensionSelfPay}
                              onChange={(e) => setEditPensionSelfPay(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-1.5 py-1 border border-neutral-250 rounded text-xs bg-white text-neutral-800 font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-neutral-500 font-bold mb-0.5">其它每月固定代扣</label>
                            <input
                              type="number"
                              value={editOtherWithholding}
                              onChange={(e) => setEditOtherWithholding(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-1.5 py-1 border border-neutral-250 rounded text-xs bg-white text-neutral-800 font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-neutral-500 font-bold mb-0.5">勞保公司負擔 (單位負擔)</label>
                            <input
                              type="number"
                              value={editLaborEmployer}
                              onChange={(e) => setEditLaborEmployer(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-1.5 py-1 border border-neutral-250 rounded text-xs bg-white text-neutral-800 font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-neutral-500 font-bold mb-0.5">健保公司負擔 (單位負擔)</label>
                            <input
                              type="number"
                              value={editHealthEmployer}
                              onChange={(e) => setEditHealthEmployer(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-1.5 py-1 border border-neutral-250 rounded text-xs bg-white text-neutral-800 font-mono font-bold"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-neutral-500 font-bold mb-0.5">勞退公司提撥 (雇主強制撥付 6%)</label>
                            <input
                              type="number"
                              value={editPensionEmployer}
                              onChange={(e) => setEditPensionEmployer(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full px-1.5 py-1 border border-neutral-250 rounded text-xs bg-white text-neutral-800 font-mono font-semibold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 編輯雙證件 */}
                      <div className="bg-neutral-50 p-2.5 border border-neutral-200 rounded-lg space-y-2">
                        <div className="flex items-center justify-between gap-1 border-b border-neutral-200 pb-1.5">
                          <span className="text-[10px] font-bold text-neutral-700">📸 技工雙證件檔案 ({editWorkerIdPhotos.length} 張)</span>
                          <button
                            type="button"
                            onClick={() => handleAutoMockPhotos(true)}
                            className="text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-100"
                          >
                            ⚡ 模擬快生
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <div className="relative border border-dashed border-neutral-300 w-16 h-10 rounded flex items-center justify-center bg-white cursor-pointer overflow-hidden text-[9px] text-neutral-400 text-center">
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => handleFilesUpload(e, true)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <span>上傳</span>
                          </div>
                          {editWorkerIdPhotos.map((p, i) => (
                            <div key={i} className="relative rounded border border-neutral-250 overflow-hidden">
                              <img src={p} alt="證" className="h-10 w-16 object-contain bg-neutral-900" />
                              <button
                                type="button"
                                onClick={() => setEditWorkerIdPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                className="absolute -top-0.5 -right-0.5 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition"
                              >
                                <X size={6} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 複數緊急聯絡人編輯及增加 */}
                      <div className="bg-rose-50/10 p-2.5 rounded border border-rose-150 space-y-2">
                        <span className="text-[10px] font-black text-rose-800 flex items-center gap-1">🚨 編輯多位緊急聯絡人家屬資訊</span>
                        
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {editEmergencyContacts.map((c) => (
                            <div key={c.id} className="grid grid-cols-12 gap-1 items-center bg-white p-1.5 border border-rose-100 rounded">
                              <div className="col-span-4">
                                <input
                                  type="text"
                                  placeholder="姓名"
                                  value={c.name}
                                  onChange={(e) => updateEmergencyContactField(c.id, 'name', e.target.value, true)}
                                  className="w-full px-1 py-0.5 text-[10px] border rounded"
                                />
                              </div>
                              <div className="col-span-5">
                                <input
                                  type="text"
                                  placeholder="電話"
                                  value={c.phone}
                                  onChange={(e) => updateEmergencyContactField(c.id, 'phone', e.target.value, true)}
                                  className="w-full px-1 py-0.5 text-[10px] border rounded font-mono"
                                />
                              </div>
                              <div className="col-span-2">
                                <input
                                  type="text"
                                  placeholder="關係"
                                  value={c.relation}
                                  onChange={(e) => updateEmergencyContactField(c.id, 'relation', e.target.value, true)}
                                  className="w-full px-1 py-0.5 text-[10px] border rounded"
                                />
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeEmergencyContactRow(c.id, true)}
                                  disabled={editEmergencyContacts.length === 1}
                                  className="text-red-600 hover:text-red-700 disabled:opacity-30"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => addEmergencyContactRow(true)}
                          className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold rounded flex items-center gap-1 transition"
                        >
                          <Plus size={10} />
                          新增聯絡人
                        </button>
                      </div>

                      <div className="flex gap-1.5 justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleSaveEditWorker}
                          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 flex items-center gap-1"
                        >
                          <Check size={12} />
                          更新儲存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWorkerId(null)}
                          className="px-3 py-1.5 bg-neutral-200 text-neutral-600 rounded-lg text-xs font-semibold hover:bg-neutral-300"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : isAdjusting ? (
                    /* Promotion & Salary Adjustments Form */
                    <div className="space-y-3.5 w-full animate-fadeIn font-sans p-1">
                      <div className="flex items-center gap-1.5 pb-2 border-b border-indigo-100 text-indigo-900">
                        <TrendingUp size={14} className="text-indigo-600" />
                        <span className="text-xs font-black">⚡ 調薪時薪與派工職稱調整</span>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[10px] text-neutral-500 font-bold">調整對象類型：</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAdjType('both')}
                            className={`px-1.5 py-1 text-[10px] rounded border font-semibold ${
                              adjType === 'both' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-neutral-100 border-neutral-250 text-neutral-600'
                            }`}
                          >
                            職等與薪水
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjType('salary')}
                            className={`px-1.5 py-1 text-[10px] rounded border font-semibold ${
                              adjType === 'salary' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-neutral-100 border-neutral-250 text-neutral-600'
                            }`}
                          >
                            僅調整薪資
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjType('role')}
                            className={`px-1.5 py-1 text-[10px] rounded border font-semibold ${
                              adjType === 'role' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-neutral-100 border-neutral-250 text-neutral-600'
                            }`}
                          >
                            僅調整職權
                          </button>
                        </div>
                      </div>

                      {(adjType === 'both' || adjType === 'role') && (
                        <div>
                          <label className="block text-[10px] text-neutral-400 mb-0.5">晉升/變更後職稱</label>
                          <input
                            type="text"
                            list="adj-worker-roles"
                            value={adjNewRole}
                            onChange={(e) => setAdjNewRole(e.target.value)}
                            placeholder="例如: 資深技術大工 (可自行命名)"
                            className="w-full px-2 py-1.5 border border-indigo-200 rounded text-xs bg-white text-neutral-808 font-bold focus:border-indigo-500 focus:outline-none"
                          />
                          <datalist id="adj-worker-roles">
                            {workerRoles.map(r => (
                              <option key={r} value={r} />
                            ))}
                          </datalist>
                        </div>
                      )}

                      {(adjType === 'both' || adjType === 'salary') && (
                        <div>
                          <label className="block text-[10px] text-neutral-400 mb-0.5">調整後派遣標準時薪 ($/hr)</label>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-neutral-500 font-bold">$</span>
                            <input
                              type="number"
                              value={adjNewRate}
                              onChange={(e) => setAdjNewRate(parseInt(e.target.value, 10) || 0)}
                              className="w-full px-2 py-1.5 border border-indigo-200 rounded text-xs font-mono font-black text-center bg-white text-neutral-800 focus:outline-none"
                            />
                            <span className="text-xs text-neutral-400">/ hr</span>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] text-neutral-400 mb-0.5">更動事由與公告說明</label>
                        <input
                          type="text"
                          value={adjReason}
                          onChange={(e) => setAdjReason(e.target.value)}
                          placeholder="例如: 派工滿一季成效佳或通過水電證照考核"
                          className="w-full px-2 py-1 border border-neutral-200 rounded text-xs text-neutral-800 bg-neutral-50"
                        />
                      </div>

                      <div className="flex gap-1 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveAdjustment(w)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold"
                        >
                          確定調度生效
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustingWorkerId(null)}
                          className="px-3 py-1.5 bg-neutral-200 text-neutral-600 rounded text-xs hover:bg-neutral-300"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : deleteConfirmId === w.id ? (
                    <div className="space-y-3.5 w-full animate-fadeIn font-sans">
                      <div className="flex gap-1.5 text-red-950 font-bold text-[11.5px] leading-snug">
                        <span>🚨</span>
                        <span>確定要將此同仁【{w.name}】移出名冊嗎？這不會影響已存入歷史日誌。</span>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setWorkers(workers.filter(item => item.id !== w.id));
                            setDeleteConfirmId(null);
                            onSaveToast(`🗑️ 員工【${w.name}】已成功從預設名冊中撤銷！`);
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11.5px] font-bold cursor-pointer transition shadow-xs"
                        >
                          確定移出
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2.5 py-1 bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200 rounded text-[11.5px] font-medium hover:text-neutral-800 transition"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Worker Card */
                    <>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-neutral-900 text-sm sm:text-base">{w.name}</span>
                            {isActive ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">在職</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-neutral-250 text-neutral-500">已離職</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            <span className="inline-flex text-[10px] px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-600 rounded-md font-bold">
                              💼 {w.role || '派遣同仁'}
                            </span>
                            {w.joinDate && (
                              <span className="inline-flex text-[10px] px-1.5 py-0.5 bg-neutral-50 border border-amber-200 text-amber-850 rounded-md font-bold" title="入職日期">
                                📅 入職: {w.joinDate}
                              </span>
                            )}
                            {w.status === '離職' && w.leaveDate && (
                              <span className="inline-flex text-[10px] px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-md font-bold" title="離職日期">
                                🚪 離職: {w.leaveDate}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {/* Promoted trigger */}
                          <button
                            onClick={() => handleStartAdjustment(w)}
                            disabled={!isActive}
                            className={`p-1 flex items-center gap-0.5 rounded transition ${
                              isActive ? 'text-indigo-600 hover:bg-indigo-50' : 'text-neutral-300 cursor-not-allowed'
                            }`}
                            title="人事晉升與時薪微調"
                          >
                            <TrendingUp size={13} />
                            <span className="text-[9px] font-black">調薪/晉升</span>
                          </button>

                          <button
                            onClick={() => handleStartEditWorker(w)}
                            className="p-1 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                            title="修改人事資料與緊急聯絡人"
                          >
                            <Edit size={13} />
                          </button>
                          
                          <button
                            onClick={() => setDeleteConfirmId(w.id)}
                            className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                            title="自名冊撤換"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Calculated Seniority label */}
                      <div className="border-t border-neutral-100 pt-2.5 mt-2 flex justify-between items-center text-xs">
                        <span className="text-neutral-500 font-medium">換算在職年資：</span>
                        <span className="font-sans text-emerald-800 font-extrabold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-150 animate-fadeIn">
                          {calculateSeniorityStr(w.joinDate, w.status === '離職' ? w.leaveDate : undefined)}
                        </span>
                      </div>

                      {/* Expandable Extra Details Panel */}
                      <div className="border-t border-dashed border-neutral-150 mt-2 pt-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(w.id)}
                          className="w-full flex items-center justify-between text-[10px] text-neutral-500 font-bold hover:text-neutral-800 transition"
                        >
                          <span className="flex items-center gap-1">
                            <BadgeInfo size={11} className="text-neutral-400" />
                            {isExpanded ? '關閉同仁詳情與薪資時薪' : '👀 展開同仁詳情與薪資時薪'}
                          </span>
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 text-[11px] space-y-2.5 bg-neutral-50 p-3 rounded-lg border border-neutral-150 text-neutral-700 animate-slideDown">
                            {/* Salary & Billing Details */}
                            <div className="grid grid-cols-2 gap-2 border-b border-neutral-200/60 pb-2 text-xs">
                              <div className="bg-white p-2 rounded border border-neutral-200 flex flex-col">
                                <span className="text-neutral-500 text-[10px] font-bold">預約派工時薪 (對內):</span>
                                <strong className="text-neutral-800 font-mono mt-0.5 text-xs">${w.defaultHourlyRate} / hr</strong>
                              </div>
                              <div className="bg-amber-50/55 p-2 rounded border border-amber-200 flex flex-col">
                                <span className="text-amber-800 text-[10px] font-bold">對客報價時薪 (對外):</span>
                                <strong className="text-amber-900 font-mono mt-0.5 text-xs">${w.billingHourlyRate || w.defaultHourlyRate} / hr</strong>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {w.phone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone size={10} className="text-neutral-400 shrink-0" />
                                  <span className="font-bold">聯絡話:</span> 
                                  <span className="text-neutral-800 font-mono select-all">{w.phone}</span>
                                </div>
                              )}
                              {w.birthDate && (
                                <div className="flex items-center gap-1.5">
                                  <Sparkles size={10} className="text-amber-500 shrink-0" />
                                  <span className="font-bold">出生年月日:</span> 
                                  <span className="text-neutral-800 font-mono">{w.birthDate}</span>
                                </div>
                              )}
                              {w.idNumber && (
                                <div className="flex items-center gap-1.5">
                                  <CreditCard size={10} className="text-neutral-400 shrink-0" />
                                  <span className="font-bold">身分證:</span> 
                                  <span className="text-neutral-800 font-mono select-all bg-neutral-200/50 px-1 rounded text-[10px]">{w.idNumber}</span>
                                </div>
                              )}
                            </div>

                            {w.address && (
                              <div className="flex items-start gap-1.5 border-t border-neutral-200/60 pt-1.5">
                                <MapPin size={10} className="text-neutral-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">居住址:</span> <span className="text-neutral-800 font-medium">{w.address}</span>
                                </div>
                              </div>
                            )}

                            {w.registeredAddress && (
                              <div className="flex items-start gap-1.5 border-t border-neutral-200/60 pt-1.5">
                                <MapPin size={10} className="text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">戶籍地:</span> <span className="text-neutral-800 font-medium">{w.registeredAddress}</span>
                                </div>
                              </div>
                            )}

                            {/* Registered ID Photos display */}
                            {w.doubleIdPhotos && w.doubleIdPhotos.length > 0 && (
                              <div className="border-t border-neutral-200/60 pt-1.5 space-y-1">
                                <span className="font-bold text-neutral-600 block text-[10px]">📸 已存檔雙證件證照 ({w.doubleIdPhotos.length} 張):</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {w.doubleIdPhotos.map((photo, pIdx) => (
                                    <div key={pIdx} className="rounded border border-neutral-200 overflow-hidden bg-white shadow-3xs hover:brightness-95 transition">
                                      <img src={photo} alt="證" className="h-10 w-16 object-contain bg-neutral-900" referrerPolicy="no-referrer" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Emergency Contact details */}
                            <div className="mt-2 text-rose-900 bg-rose-50/20 p-2 rounded border border-rose-100 space-y-1">
                              <span className="text-[10px] font-extrabold text-rose-800 flex items-center gap-1 mb-1">
                                <AlertCircle size={10} className="text-rose-600" />
                                緊急聯絡人資訊 ({w.emergencyContacts?.length || 0} 位防災存證)
                              </span>
                              {w.emergencyContacts && w.emergencyContacts.length > 0 ? (
                                <div className="space-y-1">
                                  {w.emergencyContacts.map((contact) => (
                                    <div key={contact.id} className="text-[10px] flex flex-wrap justify-between pt-1 first:pt-0 border-t first:border-0 border-rose-100/40">
                                      <div>
                                        <span className="font-bold">姓名:</span> <strong className="text-rose-950">{contact.name || '無'}</strong>
                                        <span className="mx-1 text-rose-200">|</span>
                                        <span className="font-bold">關係:</span> <strong className="text-neutral-800">{contact.relation || '無'}</strong>
                                      </div>
                                      <div>
                                        <span className="font-bold">電話:</span> <span className="text-rose-950 font-mono font-bold select-all">{contact.phone}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-rose-600 italic">⚠️ 尚無緊急連絡人家屬登載。</span>
                              )}
                            </div>

                            {/* 勞健保特別設定指標與明細顯示 (NEW!) */}
                            <div className="mt-2 text-slate-800 bg-amber-50/15 p-2.5 rounded border border-amber-250/55 space-y-1">
                              <span className="text-[10px] font-extrabold text-amber-850 flex items-center gap-1 mb-1">
                                <DollarSign size={10} className="text-amber-600" />
                                勞健保、提撥與薪資預扣件詳情
                              </span>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                                <div>
                                  <span className="text-neutral-500">👷 勞保代扣:</span>{' '}
                                  <span className="font-extrabold font-mono text-neutral-800">
                                    {w.laborInsuranceSelfPay !== undefined ? `NT$ ${w.laborInsuranceSelfPay.toLocaleString()} 元` : '未代扣'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-neutral-500">🏥 健保代扣:</span>{' '}
                                  <span className="font-extrabold font-mono text-neutral-800">
                                    {w.healthInsuranceSelfPay !== undefined ? `NT$ ${w.healthInsuranceSelfPay.toLocaleString()} 元` : '未代扣'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-neutral-500">🪙 自提勞退:</span>{' '}
                                  <span className="font-extrabold font-mono text-neutral-800">
                                    {w.laborPensionSelfPay !== undefined ? `NT$ ${w.laborPensionSelfPay.toLocaleString()} 元` : '無自提'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-neutral-500">🏢 公司勞退提撥:</span>{' '}
                                  <span className="font-extrabold font-mono text-neutral-800">
                                    {w.laborPensionEmployerUnit !== undefined ? `NT$ ${w.laborPensionEmployerUnit.toLocaleString()} 元` : '未設定公司提撥'}
                                  </span>
                                </div>
                                <div className="col-span-2 border-t border-dashed border-amber-200/50 pt-1 mt-1 flex flex-wrap justify-between text-[9px] text-neutral-550 gap-y-1">
                                  <span>⚙️ 個人額外代扣: <strong className="text-rose-600 font-mono">${w.otherWithholding || 0} 元</strong></span>
                                  <span>💼 公司負擔保費額：勞保: <strong className="text-neutral-700 font-mono">${w.laborInsuranceEmployerPay || 0}</strong> | 健保: <strong className="text-neutral-700 font-mono">${w.healthInsuranceEmployerPay || 0}</strong></span>
                                </div>
                              </div>
                            </div>

                            {w.notes && (
                              <div className="pt-1.5 border-t border-neutral-200 text-[10px] text-neutral-500 italic leading-snug">
                                📝 特別歷程備註:
                                <div className="text-neutral-600 mt-0.5 bg-neutral-200/20 p-1 rounded font-sans max-h-24 overflow-y-auto whitespace-pre-wrap">
                                  {w.notes}
                                </div>
                              </div>
                            )}

                            {/* 晉升/調薪紀錄 track */}
                            <div className="pt-1.5 border-t border-neutral-200 space-y-1">
                              <span className="font-extrabold text-neutral-600 block text-[10px] uppercase tracking-wider flex items-center gap-1">
                                📈 薪資/職等晉升歷程軌跡 ({w.salaryHistory?.length || 0} 筆)
                              </span>
                              {w.salaryHistory && w.salaryHistory.length > 0 ? (
                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                  {w.salaryHistory.map((adj, ridx) => (
                                    <div key={adj.id || ridx} className="p-1 px-2 text-[10px] bg-white border border-neutral-150 rounded leading-relaxed space-y-0.5 animate-fadeIn">
                                      <div className="flex justify-between font-bold text-neutral-700">
                                        <span>📅 {adj.date}</span>
                                        <span className="text-indigo-700 bg-indigo-50 px-1 rounded text-[9px]">
                                          時薪: ${adj.oldRate} → ${adj.newRate} /h
                                        </span>
                                      </div>
                                      {adj.newRole && adj.oldRole !== adj.newRole && (
                                        <div className="text-neutral-550 font-semibold">
                                          晉升職等: <span className="line-through">{adj.oldRole}</span> → <span className="text-emerald-700 font-bold">{adj.newRole}</span>
                                        </div>
                                      )}
                                      {adj.reason && (
                                        <div className="text-neutral-400 text-[9px] italic">
                                          事由: {adj.reason}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-neutral-400 italic block">💡 尚無系統化晉升調薪日誌紀錄。</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
