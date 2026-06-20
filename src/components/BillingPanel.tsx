import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Project, DailyRecord, PaymentTransaction, Worker, MaterialPreset, WorkerAdvance, PettyCashTransaction } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Landmark, Plus, Trash2, ArrowRightLeft, DollarSign, Wallet, 
  Percent, ArrowUpDown, ChevronDown, ChevronUp, AlertCircle, 
  Check, Info, Calendar, Sparkles, Building2, UserCheck, Scale,
  TrendingUp, HardHat, FileText, Search, RefreshCw, Eye, Printer, Copy, Clock, Filter, Users, ClipboardList, Coins
} from 'lucide-react';

interface ProjectSummaryItem {
  id: string;
  serialNumber: string;
  name: string;
  clientId: string;
  clientName: string;
  contractQuote: number;
  actualCalculated: number; // 工料實報實銷 (業主牌價請款計費)
  actualConstructionCost: number; // 實際施工成本 (工時成本底價+進貨成本)
  selectedBilledBasis: number; // final chosen billing basis
  receivedPayment: number; // cumulative paid via transactions
  roundingPaid: number; // 去尾多給 values
  outstandingBalance: number;
  isCompleted: boolean;
  isEstimation: boolean;
}

interface BillingPanelProps {
  customers: Customer[];
  projects: Project[];
  records: DailyRecord[];
  transactions: PaymentTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<PaymentTransaction[]>>;
  workersPreset: Worker[];
  materialsPreset?: MaterialPreset[];
  workerAdvances: WorkerAdvance[];
  setWorkerAdvances: React.Dispatch<React.SetStateAction<WorkerAdvance[]>>;
  pettyCashTransactions: PettyCashTransaction[];
  setPettyCashTransactions: React.Dispatch<React.SetStateAction<PettyCashTransaction[]>>;
  onEditRecord?: (record: DailyRecord) => void;
  onDeleteRecord?: (recordId: string) => void;
  onSaveToast: (msg: string) => void;
  triggerAddPayment?: number;
}

export default function BillingPanel({
  customers,
  projects,
  records,
  transactions,
  setTransactions,
  workersPreset,
  materialsPreset = [],
  workerAdvances,
  setWorkerAdvances,
  pettyCashTransactions,
  setPettyCashTransactions,
  onEditRecord,
  onDeleteRecord,
  onSaveToast,
  triggerAddPayment = 0
}: BillingPanelProps) {
  // Navigation internal Unified tabs
  const [activeSubTab, setActiveSubTab] = useState<'billing_records' | 'operating_analytics' | 'worker_attendance' | 'worker_advances' | 'petty_cash'>('billing_records');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [showAddPaymentModal, setShowAddPaymentModal] = useState<boolean>(false);

  // Custom Elegant Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: () => {}
        });
      }
    });
  };
  
  // Create state for adding a payment
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [payCustId, setPayCustId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('銀行轉帳');
  
  // SIMPLIFIED Selection options: 
  // 'single' - 指定單一案場 (後續可選為一般專款、預付保障金、或去尾抹零)
  // 'pool'   - 暫存預收池 (後續可選存入未來合扣、或由系統自動沖抵舊案)
  // 'multi'  - 多案場手動分配
  const [simplifiedAllocType, setSimplifiedAllocType] = useState<'single' | 'pool' | 'multi'>('single');
  const [singleAllocSubMode, setSingleAllocSubMode] = useState<'normal' | 'advance' | 'rounding'>('normal');
  const [poolAllocSubMode, setPoolAllocSubMode] = useState<'pool_store' | 'old_debt_auto'>('pool_store');
  const [payStage, setPayStage] = useState<string>('一般單次/實收工程款');
  
  const [payTargetProjId, setPayTargetProjId] = useState<string>('');
  const [payDescription, setPayDescription] = useState<string>('');
  
  // Custom manual multi-project split values: projectId -> amount
  const [multiAllocSplits, setMultiAllocSplits] = useState<{ [projId: string]: number }>({});

  // Daily Engineering reports filters
  const [reportSelectedProjectId, setReportSelectedProjectId] = useState<string>('all');
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
  const [reportExpandedId, setReportExpandedId] = useState<string | null>(null);
  const [reportCopiedId, setReportCopiedId] = useState<string | null>(null);
  const [reportDeleteConfirmId, setReportDeleteConfirmId] = useState<string | null>(null);

  // Worker Attendance Filters
  const [attendanceWorkerId, setAttendanceWorkerId] = useState<string>('all');
  const [attendanceStartDate, setAttendanceStartDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [attendanceEndDate, setAttendanceEndDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [attendanceSortBy, setAttendanceSortBy] = useState<string>('dateDesc');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState<string>('');

  // 考勤對帳明細表虛擬滾動 (Virtual Scroll) 狀態與配置
  const [tableScrollTop, setTableScrollTop] = useState<number>(0);
  const tableContainerHeight = 520; // 固定的可視高度 520px
  const rowHeight = 72; // 預估平均每列高度 72px

  // 快速切換考勤月份 Helper 函數
  const handlePrevMonth = () => {
    const currentRef = attendanceStartDate ? new Date(attendanceStartDate) : new Date();
    currentRef.setMonth(currentRef.getMonth() - 1);
    const year = currentRef.getFullYear();
    const month = String(currentRef.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${month}-01`;
    const lastDayObj = new Date(year, currentRef.getMonth() + 1, 0);
    const lastDay = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
    setAttendanceStartDate(firstDay);
    setAttendanceEndDate(lastDay);
  };

  const handleNextMonth = () => {
    const currentRef = attendanceStartDate ? new Date(attendanceStartDate) : new Date();
    currentRef.setMonth(currentRef.getMonth() + 1);
    const year = currentRef.getFullYear();
    const month = String(currentRef.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${month}-01`;
    const lastDayObj = new Date(year, currentRef.getMonth() + 1, 0);
    const lastDay = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
    setAttendanceStartDate(firstDay);
    setAttendanceEndDate(lastDay);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${month}-01`;
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    setAttendanceStartDate(firstDay);
    setAttendanceEndDate(today);
  };

  // ---- 預支借支建立表單 States ----
  const [addAdvWorkerId, setAddAdvWorkerId] = useState<string>('');
  const [addAdvDate, setAddAdvDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [addAdvAmount, setAddAdvAmount] = useState<number | ''>('');
  const [addAdvType, setAddAdvType] = useState<'borrow' | 'repay'>('borrow');
  const [addAdvDescription, setAddAdvDescription] = useState<string>('');

  // ---- 零用金與公基金表單 States ----
  const [addPcDate, setAddPcDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [addPcType, setAddPcType] = useState<'income' | 'expense'>('expense');
  const [addPcAmount, setAddPcAmount] = useState<number | ''>('');
  const [addPcCategory, setAddPcCategory] = useState<'feed' | 'tool' | 'parking' | 'fuel' | 'fund_in' | 'other'>('feed');
  const [addPcPayer, setAddPcPayer] = useState<string>('');
  const [addPcProjId, setAddPcProjId] = useState<string>('');
  const [addPcDescription, setAddPcDescription] = useState<string>('');

  // 統一專案顯示名稱格式化 (確保一體性)
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

  useEffect(() => {
    if (triggerAddPayment > 0) {
      if (selectedCustomerId !== 'all') {
        setPayCustId(selectedCustomerId);
      } else if (customers.length > 0) {
        setPayCustId(customers[0].id);
      }
      setPayDate(new Date().toISOString().substring(0, 10));
      setPayAmount(0);
      setSimplifiedAllocType('single');
      setSingleAllocSubMode('normal');
      setShowAddPaymentModal(true);
    }
  }, [triggerAddPayment]);

  // Get active and completed projects for a selected customer in form
  const targetCustomerProjects = useMemo(() => {
    if (!payCustId) return [];
    return projects.filter(p => p.clientId === payCustId);
  }, [payCustId, projects]);

  // Handle calculation of a single project's total billed amount and actual payments
  const projectSummaries = useMemo<Record<string, ProjectSummaryItem>>(() => {
    const summaryMap: Record<string, ProjectSummaryItem> = {};

    // 1. Initialize for all projects
    projects.forEach(p => {
      // 業主不同意施工（報價未成）：不納入請款、工程餘額和付款對帳統計
      if (p.isEstimation && p.estimationStatus === '報價未成') {
        return;
      }
      const pId = p.id;
      const client = customers.find(c => c.id === p.clientId);
      const clientName = client ? client.name : p.companyOrOwner;
      
      const contractQuote = p.estimationQuoteAmount || 0;
      
      // Calculate actual calculated (materials list price + labor wages + expenses)
      // And calculate actual construction costs (materials cost price + labor cost wage rates + expenses)
      const projectRecords = records.filter(r => r.projectId === pId);
      let materialsBilledSum = 0;
      let materialsCostSum = 0;
      let laborBilledSum = 0;
      let laborCostSum = 0;
      let expensesSum = 0;
      let journalCollectedSum = 0;
      
      projectRecords.forEach(r => {
        // Material Billing and Cost
        materialsBilledSum += r.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
        materialsCostSum += r.materials.reduce((sum, m) => sum + ((m.costPrice !== undefined && m.costPrice > 0 ? m.costPrice : m.unitPrice) * m.quantity), 0);
        
        // Labor Billing
        laborBilledSum += r.workers.reduce((sum, w) => {
          const rate = w.billingHourlyRate ?? w.hourlyRate;
          const reg = Math.min(w.hoursWork, 8);
          const ot1 = Math.min(Math.max(w.hoursWork - 8, 0), 2);
          const ot2 = Math.max(w.hoursWork - 10, 0);
          const wages = (reg * rate) + (ot1 * rate * 1.34) + (ot2 * rate * 1.34);
          return sum + Math.round(wages);
        }, 0);

        // Labor Cost
        laborCostSum += r.workers.reduce((sum, w) => {
          const rate = w.hourlyRate; //公司給同仁的時薪底價(底層成本)
          const reg = Math.min(w.hoursWork, 8);
          const ot1 = Math.min(Math.max(w.hoursWork - 8, 0), 2);
          const ot2 = Math.max(w.hoursWork - 10, 0);
          const wages = (reg * rate) + (ot1 * rate * 1.34) + (ot2 * rate * 1.34);
          return sum + Math.round(wages);
        }, 0);

        expensesSum += r.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
        journalCollectedSum += (r.collectedAmount || 0); // 加總現場現場追加特收款
      });
      
      const actualCalculated = materialsBilledSum + laborBilledSum + expensesSum;
      const actualConstructionCost = materialsCostSum + laborCostSum + expensesSum;
      
      // AUTOMATIC ACCOUNTING ENGINE:
      // 1. 若現場直接收款 (journalCollectedSum > 0) 有輸入，依據客戶需求，直接以此作為工程款請款基數，不計算牌價。
      // 2. 對於工料估價案場，工程款基數（selectedBilledBasis）一律使用總體對外報價總金額 (contractQuote)，無論是否完工。
      // 3. 常規工料實報實銷案場，則依施工狀態而定：完工後若有合約金額則用合約，若無或進行中則用實際累計牌價。
      let selectedBilledBasis = 0;
      if (journalCollectedSum > 0) {
        selectedBilledBasis = journalCollectedSum;
      } else if (p.isEstimation || p.generatedName?.startsWith('[估]') || contractQuote > 0) {
        selectedBilledBasis = contractQuote;
      } else {
        selectedBilledBasis = p.isCompleted
          ? (contractQuote > 0 ? contractQuote : actualCalculated)
          : actualCalculated;
      }

      summaryMap[pId] = {
        id: pId,
        serialNumber: p.serialNumber,
        name: p.generatedName,
        clientId: p.clientId || '',
        clientName,
        contractQuote,
        actualCalculated,
        actualConstructionCost,
        selectedBilledBasis,
        receivedPayment: 0,
        roundingPaid: 0,
        outstandingBalance: selectedBilledBasis,
        isCompleted: p.isCompleted,
        isEstimation: (p.isEstimation || p.generatedName?.startsWith('[估]')) ? true : false
      };
    });

    // 2. Add payments from daily journals records (當下直接收款 collectedAmount)
    records.forEach(r => {
      if (r.collectedAmount && r.collectedAmount > 0 && summaryMap[r.projectId]) {
        summaryMap[r.projectId].receivedPayment += r.collectedAmount;
      }
    });

    // 3. Apply normal compiled billing transactions
    transactions.forEach(t => {
      if (t.projectNameOrId && summaryMap[t.projectNameOrId]) {
        if (t.allocationType === 'round_adjustment') {
          summaryMap[t.projectNameOrId].roundingPaid += t.amount;
        } else {
          summaryMap[t.projectNameOrId].receivedPayment += t.amount;
        }
      }
    });

    // 4. Calculate final balances (deduct receipts and adjustments)
    Object.keys(summaryMap).forEach(id => {
      const item = summaryMap[id];
      item.outstandingBalance = item.selectedBilledBasis - item.receivedPayment - item.roundingPaid;
    });

    return summaryMap;
  }, [projects, customers, records, transactions]);

  // A typed array of project summaries
  const projectSummariesList = useMemo<ProjectSummaryItem[]>(() => {
    return Object.values(projectSummaries) as ProjectSummaryItem[];
  }, [projectSummaries]);

  // Calculate Customer Pools (Prepayments Pool = total assigned to pool - total applied to projects)
  const customerCredits = useMemo(() => {
    const poolMap: { [custId: string]: { totalGained: number; totalAssignedToProjects: number; netPoolBalance: number } } = {};
    
    // Initialize pool for all clients
    customers.forEach(c => {
      poolMap[c.id] = { totalGained: 0, totalAssignedToProjects: 0, netPoolBalance: 0 };
    });

    // Add pool transactions
    transactions.forEach(t => {
      const cId = t.customerId;
      if (!poolMap[cId]) return;
      
      if (t.allocationType === 'client_pool' || t.allocationType === 'advance') {
        poolMap[cId].totalGained += t.amount;
      }
      
      // If payment comes from credit pool to draw, we record it
      if (t.allocationType === 'specific_project' && t.method === '從預收款溢收抵扣') {
        poolMap[cId].totalAssignedToProjects += t.amount;
      }
    });

    // Net Pool balance = what they paid in minus what's withdrawn
    Object.keys(poolMap).forEach(cId => {
      poolMap[cId].netPoolBalance = poolMap[cId].totalGained - poolMap[cId].totalAssignedToProjects;
    });

    return poolMap;
  }, [customers, transactions]);

  // Aggregate Customer Overall stats
  const customerAggregateLedger = useMemo(() => {
    const list: Array<{
      customerId: string;
      customerName: string;
      contactPerson?: string;
      phone?: string;
      totalProjectsCount: number;
      activeProjectsCount: number;
      totalBilled: number; // For completed projects
      totalReceived: number; // For completed projects
      totalRounding: number; // For completed projects
      totalOutstanding: number; // Under-payment for completed projects
      activeProjectsBilled: number; // "目前進行中的累積金額" (ongoing accumulated amount)
      activeProjectsReceived: number;
      activeProjectsOutstanding: number;
      prepaidBalance: number; 
    }> = [];

    customers.forEach(c => {
      const clientProjects = projectSummariesList.filter(p => p.clientId === c.id);
      
      let totalBilled = 0;
      let totalReceived = 0;
      let totalRounding = 0;
      let totalOutstanding = 0;

      let activeProjectsBilled = 0;
      let activeProjectsReceived = 0;
      let activeProjectsOutstanding = 0;

      clientProjects.forEach(p => {
        if (p.isCompleted) {
          totalBilled += p.selectedBilledBasis;
          totalReceived += p.receivedPayment;
          totalRounding += p.roundingPaid;
          totalOutstanding += p.outstandingBalance;
        } else {
          // Ongoing project accumulated engineering balance
          activeProjectsBilled += p.selectedBilledBasis; // is actualCalculated
          activeProjectsReceived += p.receivedPayment;
          activeProjectsOutstanding += p.outstandingBalance;
        }
      });

      const prepaid = customerCredits[c.id]?.netPoolBalance || 0;

      list.push({
        customerId: c.id,
        customerName: c.name,
        contactPerson: c.contactPerson,
        phone: c.phone,
        totalProjectsCount: clientProjects.length,
        activeProjectsCount: clientProjects.filter(p => !p.isCompleted).length,
        totalBilled,
        totalReceived,
        totalRounding,
        totalOutstanding,
        activeProjectsBilled,
        activeProjectsReceived,
        activeProjectsOutstanding,
        prepaidBalance: prepaid
      });
    });

    return list;
  }, [customers, projectSummariesList, customerCredits]);

  // Filter customers based on select selector
  const filteredAggregateLedger = useMemo(() => {
    if (selectedCustomerId === 'all') return customerAggregateLedger;
    return customerAggregateLedger.filter(c => c.customerId === selectedCustomerId);
  }, [customerAggregateLedger, selectedCustomerId]);

  // Filter transaction log history
  const filteredTransactionsLog = useMemo(() => {
    let list = [...transactions];
    if (selectedCustomerId !== 'all') {
      list = list.filter(t => t.customerId === selectedCustomerId);
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [transactions, selectedCustomerId]);

  // 建立新的工班預支金額或還款紀錄
  const handleCreateWorkerAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAdvWorkerId) {
      alert('請先選定借款或是還薪同仁！');
      return;
    }
    const amount = Number(addAdvAmount);
    if (!amount || amount <= 0) {
      alert('請填入正確大於 0 的金額！');
      return;
    }

    const tWorker = workersPreset.find(w => w.id === addAdvWorkerId);
    const workerName = tWorker ? tWorker.name : '外調同仁';

    const newAdvance: WorkerAdvance = {
      id: `adv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workerId: addAdvWorkerId,
      workerName,
      date: addAdvDate,
      amount,
      type: addAdvType,
      status: addAdvType === 'repay' ? 'settled' : 'pending',
      description: addAdvDescription.trim() || (addAdvType === 'borrow' ? '預支借用款項' : '薪資扣帳/還款登記'),
      createdAt: new Date().toISOString()
    };

    setWorkerAdvances(prev => [newAdvance, ...prev]);
    onSaveToast(`💸 ${workerName} [${addAdvType === 'borrow' ? '預支' : '扣還'}] NT$ ${amount.toLocaleString()} 元登記完成！`);
    
    // reset states
    setAddAdvWorkerId('');
    setAddAdvAmount('');
    setAddAdvDescription('');
  };

  // 刪除工班預支紀錄
  const handleDeleteWorkerAdvance = (id: string) => {
    triggerConfirm('確認刪除預支紀錄', '您確定要刪除這筆預支/借還款明細嗎？此動作無法復原。', () => {
      setWorkerAdvances(prev => prev.filter(a => a.id !== id));
      onSaveToast('🗑️ 預支相關明細已安全刪除！');
    });
  };

  // 變更預支紀錄之結清狀態 (例如財務實扣或私付還款)
  const toggleAdvanceStatus = (id: string) => {
    setWorkerAdvances(prev => prev.map(a => {
      if (a.id === id) {
        const nextStatus = a.status === 'pending' ? 'settled' : 'pending';
        return { ...a, status: nextStatus };
      }
      return a;
    }));
    onSaveToast('🔄 明細結算狀態變更成功！');
  };

  // 建立新的零用金（公基金）收支紀錄
  const handleCreatePettyCashTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(addPcAmount);
    if (!amount || amount <= 0) {
      alert('請填入正確大於 0 的金額！');
      return;
    }
    if (!addPcDescription.trim()) {
      alert('請輸入款項之詳細說明，利於記帳！');
      return;
    }

    const newPc: PettyCashTransaction = {
      id: `pc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: addPcDate,
      type: addPcType,
      amount,
      category: addPcType === 'income' ? 'fund_in' : addPcCategory,
      projectNameOrId: addPcProjId || undefined,
      description: addPcDescription.trim(),
      payerName: addPcPayer.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    setPettyCashTransactions(prev => [newPc, ...prev]);
    onSaveToast(`🪙 [${addPcType === 'income' ? '補進零用金' : '零用金支出'}] NT$ ${amount.toLocaleString()} 元登記成功！`);
    
    // reset states
    setAddPcAmount('');
    setAddPcDescription('');
    setAddPcPayer('');
    setAddPcProjId('');
  };

  // 刪除零用金紀錄
  const handleDeletePettyCashTransaction = (id: string) => {
    triggerConfirm('確認刪除零用金帳目', '您確定要刪除此筆零用金帳目收支嗎？', () => {
      setPettyCashTransactions(prev => prev.filter(t => t.id !== id));
      onSaveToast('🗑️ 零用金帳目已安全移除。');
    });
  };

  // 1. Core action: Add Payment transaction with Simplified Allocation Mechanism
  const handleAddNewPaymentSimplified = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCustId) {
      alert('請先選擇配合客戶！');
      return;
    }
    if (payAmount <= 0) {
      alert('請填入大於 0 元的實收金額！');
      return;
    }

    const tCust = customers.find(c => c.id === payCustId);
    const clientName = tCust ? tCust.name : '未知客戶';

    const newTxIdBase = `tx-${Date.now()}`;
    const newTxs: PaymentTransaction[] = [];

    // Map simplified selection types to standard database keys:
    if (simplifiedAllocType === 'single') {
      if (!payTargetProjId) {
        alert('請指定收款沖抵之案場專案！');
        return;
      }
      
      if (singleAllocSubMode === 'rounding') {
        // Option 1B: Going-to-zero round adjust (去尾抹零調整)
        newTxs.push({
          id: `${newTxIdBase}-0`,
          customerId: payCustId,
          projectNameOrId: payTargetProjId,
          date: payDate,
          amount: payAmount,
          method: '去尾抹零調整',
          allocationType: 'round_adjustment',
          description: payDescription.trim() || `配合零錢去尾多給抹零調整`,
          paymentStage: '去尾抹零調整',
          createdAt: new Date().toISOString()
        });
        onSaveToast(`🔩 成功登記「去尾抹零調整」 NT$ ${payAmount.toLocaleString()} 元，已調降此案場應收尾款！`);
      } else if (singleAllocSubMode === 'advance') {
        // Option 1C: Advance Deposit Guarantee (保障保證金)
        newTxs.push({
          id: `${newTxIdBase}-0`,
          customerId: payCustId,
          projectNameOrId: payTargetProjId,
          date: payDate,
          amount: payAmount,
          method: payMethod,
          allocationType: 'advance',
          description: payDescription.trim() || `預支保證訂金 (未施工先給)`,
          paymentStage: '簽約訂金/開工保證金',
          createdAt: new Date().toISOString()
        });
        onSaveToast(`🎬 登記未施工前付款訂金/保證款 NT$ ${payAmount.toLocaleString()} 元！`);
      } else {
        // Option 1A: Regular Project specific cash payment (一般工程收款)
        newTxs.push({
          id: `${newTxIdBase}-0`,
          customerId: payCustId,
          projectNameOrId: payTargetProjId,
          date: payDate,
          amount: payAmount,
          method: payMethod,
          allocationType: 'specific_project',
          description: payDescription.trim() || `指定案場工程款`,
          paymentStage: payStage,
          createdAt: new Date().toISOString()
        });
        onSaveToast(`💰 成功對特定案場登記工程款 [${payStage}] NT$ ${payAmount.toLocaleString()} 元！`);
      }

    } else if (simplifiedAllocType === 'pool') {
      // Option 2: Prepayment balance pool config
      if (poolAllocSubMode === 'old_debt_auto') {
        // Option 2B: System auto-allocates to old debts first (優先沖銷舊案)
        const customerUnpaidProjects = projectSummariesList
          .filter(p => p.clientId === payCustId && p.outstandingBalance > 0)
          .sort((a, b) => a.serialNumber.localeCompare(b.serialNumber)); // Sort oldest serial first

        if (customerUnpaidProjects.length === 0) {
          // If no debts, automatically save to local pool!
          newTxs.push({
            id: `${newTxIdBase}-0`,
            customerId: payCustId,
            date: payDate,
            amount: payAmount,
            method: payMethod,
            allocationType: 'client_pool',
            description: `隨機存入預收款帳戶 (目前無任何工程欠款)`,
            createdAt: new Date().toISOString()
          });
          onSaveToast(`💡 客戶目前無任何欠款案！已自動轉存溢收 NT$ ${payAmount.toLocaleString()} 元至預收款儲存池。`);
        } else {
          let remainingToAllocate = payAmount;
          let index = 0;
          
          while (remainingToAllocate > 0 && index < customerUnpaidProjects.length) {
            const proj = customerUnpaidProjects[index];
            const canAbsorb = Math.min(proj.outstandingBalance, remainingToAllocate);
            
            if (canAbsorb > 0) {
              newTxs.push({
                id: `${newTxIdBase}-auto-${index}`,
                customerId: payCustId,
                projectNameOrId: proj.id,
                date: payDate,
                amount: canAbsorb,
                method: payMethod,
                allocationType: 'specific_project',
                description: `配合簡化沖帳：系統按工期先後折抵舊案款`,
                createdAt: new Date().toISOString()
              });
              remainingToAllocate -= canAbsorb;
            }
            index++;
          }

          if (remainingToAllocate > 0) {
            newTxs.push({
              id: `${newTxIdBase}-auto-leftover`,
              customerId: payCustId,
              date: payDate,
              amount: remainingToAllocate,
              method: payMethod,
              allocationType: 'client_pool',
              description: `隨機分配案場後溢收餘額自動存入`,
              createdAt: new Date().toISOString()
            });
            onSaveToast(`舊案沖底：已自動分期抵扣完成 ${index} 個歷史老工程，剩下 NT$ ${remainingToAllocate.toLocaleString()} 元存回預收池！`);
          } else {
            onSaveToast(`成功依序自動折抵沖銷 ${index} 個歷史未付款舊案，金額 NT$ ${payAmount.toLocaleString()} 元。`);
          }
        }
      } else {
        // Option 2A: Store inside client credit pool (存入預收款零頭池)
        newTxs.push({
          id: `${newTxIdBase}-0`,
          customerId: payCustId,
          date: payDate,
          amount: payAmount,
          method: payMethod,
          allocationType: 'client_pool',
          description: payDescription.trim() || `存入客戶預收款帳戶`,
          createdAt: new Date().toISOString()
        });
        onSaveToast(`🏦 成功儲值預收款餘額 NT$ ${payAmount.toLocaleString()} 元，可用於隨時抵扣日後工程！`);
      }

    } else if (simplifiedAllocType === 'multi') {
      // Option 3: Manual splittable multi-project split
      const validSplits = (Object.entries(multiAllocSplits) as [string, number][]).filter(([_, val]) => val > 0);
      const totalSplitApplied = validSplits.reduce((sum, [_, amt]) => sum + amt, 0);
      
      if (validSplits.length === 0) {
        alert('請輸入至少一間施工案場的指派分配金額！');
        return;
      }
      if (totalSplitApplied > payAmount) {
        alert(`分配總額 ($${totalSplitApplied.toLocaleString()}元) 超出實收款項金額 ($${payAmount.toLocaleString()}元)！`);
        return;
      }

      validSplits.forEach(([projId, amt], index) => {
        newTxs.push({
          id: `${newTxIdBase}-${index}`,
          customerId: payCustId,
          projectNameOrId: projId,
          date: payDate,
          amount: amt,
          method: payMethod,
          allocationType: 'specific_project',
          description: payDescription.trim() || `多案場合併付款 (手動拆分)`,
          createdAt: new Date().toISOString()
        });
      });

      const leftover = payAmount - totalSplitApplied;
      if (leftover > 0) {
        newTxs.push({
          id: `${newTxIdBase}-leftover`,
          customerId: payCustId,
          date: payDate,
          amount: leftover,
          method: payMethod,
          allocationType: 'client_pool',
          description: `多案場分配之剩餘溢收金額 (存入預收抵扣池) ` + (payDescription ? `[${payDescription}]` : ''),
          createdAt: new Date().toISOString()
        });
        onSaveToast(`多工地分配！剩餘 NT$ ${leftover.toLocaleString()} 元已自動儲值為客戶預收款。`);
      } else {
        onSaveToast(`多工地合併實收分配入帳，累計 NT$ ${payAmount.toLocaleString()} 元拆帳完成。`);
      }
    }

    setTransactions(prev => [...newTxs, ...prev]);
    
    // Cleanup form state
    setPayAmount(0);
    setPayDescription('');
    setPayTargetProjId('');
    setMultiAllocSplits({});
    setSimplifiedAllocType('single');
    setSingleAllocSubMode('normal');
    setPoolAllocSubMode('pool_store');
    setPayStage('一般單次/實收工程款');
    setShowAddPaymentModal(false);
  };

  // Draw money from credit pool to pay specific project (多給未來合抵扣)
  const handleApplyPoolCredits = (custId: string, projId: string, amount: number) => {
    const netPool = customerCredits[custId]?.netPoolBalance || 0;
    if (netPool <= 0) {
      alert('該客戶預收溢領池目前餘額不足折抵！');
      return;
    }
    
    const applyAmt = Math.min(netPool, amount);
    if (applyAmt <= 0) return;

    const newTx: PaymentTransaction = {
      id: `tx-apply-pool-${Date.now()}`,
      customerId: custId,
      projectNameOrId: projId,
      date: new Date().toISOString().substring(0, 10),
      amount: applyAmt,
      method: '從預收款溢收抵扣',
      allocationType: 'specific_project',
      description: `從客戶暫收 pool 中扣減折抵此案場欠款`,
      createdAt: new Date().toISOString()
    };

    setTransactions(prev => [newTx, ...prev]);
    onSaveToast(`🔄 生態抵扣成功！自預收帳戶中劃撥 NT$ ${applyAmt.toLocaleString()} 元內扣此工程！`);
  };

  // Remove billing logic record
  const handleDeleteTransaction = (txId: string) => {
    triggerConfirm('確認作廢收付款紀錄', '您確定要取消/作廢此筆收付款紀錄嗎？該帳額將退回原帳款餘額中。', () => {
      setTransactions(prev => prev.filter(t => t.id !== txId));
      onSaveToast('🗑️ 該筆帳務與其案場金流分配數據已抹除。');
    });
  };


  // ----------------------------------------------------
  // REPORT STUFF & OPERATING ANALYTICS LOGIC (UNLOCKED!)
  // ----------------------------------------------------
  
  // Filter records based on UI configurations
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // 若該日誌所屬案場為「報價未成」狀態，則完全過濾排除，不計入其費用與日誌報表統計！
      const p = projects.find(proj => proj.id === r.projectId);
      if (p && p.isEstimation && p.estimationStatus === '報價未成') {
        return false;
      }

      if (reportSelectedProjectId !== 'all' && r.projectId !== reportSelectedProjectId) return false;
      if (reportStartDate && r.date < reportStartDate) return false;
      if (reportEndDate && r.date > reportEndDate) return false;
      
      if (reportSearchQuery.trim() !== '') {
        const query = reportSearchQuery.toLowerCase();
        const matchesProject = r.projectName.toLowerCase().includes(query);
        const matchesNotes = r.notes.toLowerCase().includes(query);
        const matchesMaterials = r.materials.some(m => m.name.toLowerCase().includes(query));
        const matchesWorkers = r.workers.some(w => w.name.toLowerCase().includes(query));
        return matchesProject || matchesNotes || matchesMaterials || matchesWorkers;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, projects, reportSelectedProjectId, reportStartDate, reportEndDate, reportSearchQuery]);

  // Financial aggregates (UNLOCKED & ALWAYS ACCESSIBLE)
  const reportStats = useMemo(() => {
    let materialsCost = 0; 
    let materialsActualCost = 0; 
    let laborCost = 0;
    let expensesCost = 0;
    let totalHours = 0;
    
    filteredRecords.forEach(r => {
      materialsCost += r.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
      materialsActualCost += r.materials.reduce((sum, m) => sum + ((m.costPrice !== undefined ? m.costPrice : m.unitPrice) * m.quantity), 0);
      laborCost += r.workers.reduce((sum, w) => sum + (w.hourlyRate * w.hoursWork), 0);
      expensesSumCheck(r);
      expensesCost += r.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
      totalHours += r.workers.reduce((sum, w) => sum + w.hoursWork, 0);
    });

    function expensesSumCheck(r: any) {
      return r.expenses;
    }

    const grandTotal = materialsCost + laborCost + expensesCost; 
    const grandActualCost = materialsActualCost + laborCost + expensesCost; 
    const profitAmount = grandTotal - grandActualCost; 
    const profitMargin = grandTotal > 0 ? Math.round((profitAmount / grandTotal) * 105) : 0; // optimized factor

    return {
      materialsCost,
      materialsActualCost,
      laborCost,
      expensesCost,
      totalHours,
      grandTotal,
      grandActualCost,
      profitAmount,
      profitMargin: profitMargin > 100 ? 100 : profitMargin,
      recordCount: filteredRecords.length
    };
  }, [filteredRecords]);

  // Aggregate data for Recharts Pie Chart (Cost proportions)
  const pieChartData = useMemo(() => {
    return [
      { name: '材料大宗成本', value: reportStats.materialsActualCost, color: '#f59e0b' },
      { name: '工班時數支出', value: reportStats.laborCost, color: '#0ea5e9' },
      { name: '伙食及車馬開支', value: reportStats.expensesCost, color: '#ef4444' }
    ].filter(item => item.value > 0);
  }, [reportStats]);

  // Aggregate data for Recharts Bar Chart (Expenses by Project)
  const projectComparisonData = useMemo(() => {
    const projMap: { [key: string]: { name: string, materials: number, labor: number, expenses: number } } = {};
    
    filteredRecords.forEach(r => {
      const name = r.projectName.split('-')[1] || r.projectName.split('-')[0] || r.projectName;
      if (!projMap[r.projectId]) {
        projMap[r.projectId] = { name, materials: 0, labor: 0, expenses: 0 };
      }
      
      projMap[r.projectId].materials += r.materials.reduce((sum, m) => sum + (((m.costPrice !== undefined ? m.costPrice : m.unitPrice) * m.quantity)), 0);
      projMap[r.projectId].labor += r.workers.reduce((sum, w) => sum + (w.hourlyRate * w.hoursWork), 0);
      projMap[r.projectId].expenses += r.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
    });

    return Object.values(projMap);
  }, [filteredRecords]);

  // Copy standard reports formatted optimally for corporate LINE messenger groups - SENSITIVE WAGE HOURLY RATE HIDDEN!
  const handleCopyReporterLine = (record: DailyRecord) => {
    const laborDetails = record.workers.length > 0 
      ? record.workers.map(w => `   - ${w.name} (${w.hoursWork}小時)${w.isSupport ? ' (臨時外調)' : ''}`).join('\n')
      : '   - 無登記出勤工班';

    const materialDetails = record.materials.length > 0
      ? record.materials.map(m => `   - ${m.name} x ${m.quantity} ${m.unit}`).join('\n')
      : '   - 本日無消耗材料';

    const expenseDetails = record.expenses.length > 0
      ? record.expenses.map(e => `   - [現場雜支] ${e.description ? e.description : '施工雜費'}: $${e.amount}元`).join('\n')
      : '   - 本日無代墊開銷費';

    const textReport = `📝 【現場施工進度與出勤回報單】
━━━━━━━━━━━━━━━━━━
📅 施工日期：${record.date}
🏢 施作案場：${record.projectName}
━━━━━━━━━━━━━━━━━━
👷 本日出勤派遣人員時數：
${laborDetails}

🛠️ 本日施作耗用管路耗品：
${materialDetails}

💰 現場代墊車馬與雜資開支：
${expenseDetails}

⚠️ 現場施工備忘備註：
${record.notes || '   (無特殊異常，配管配線施工一切順利。)'}

📅 完工進度狀態：${record.markAsCompleted ? '🎉 報告：已完工結案！' : '📅 施工未完，明日預定續作'}
━━━━━━━━━━━━━━━━━━
填報日期：${new Date(record.createdAt).toLocaleString('zh-TW')}
(本資料由水電工程管理通整合格式化複製)`;

    navigator.clipboard.writeText(textReport).then(() => {
      setReportCopiedId(record.id);
      setTimeout(() => setReportCopiedId(null), 2500);
    }).catch(err => {
      console.error('複製失敗: ', err);
    });
  };

  // Export raw data to instant CSV format (Includes money for owner analysis)
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('無資料可匯出！');
      return;
    }

    const headers = ['施工日期', '案場專案名稱', '材料清單', '材料費合計', '施工人員工時', '工資費用合計', '額外開銷費用明細', '總累計成本', '完工狀態', '當日記號摘要'];
    
    const rows = filteredRecords.map(r => {
      const matStr = r.materials.map(m => `${m.name}(${m.quantity}${m.unit})`).join('; ');
      const matPrice = r.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
      
      const workerStr = r.workers.map(w => `${w.name}(${w.hoursWork}h)`).join('; ');
      const workerPrice = r.workers.reduce((sum, w) => sum + ((w.billingHourlyRate ?? w.hourlyRate) * w.hoursWork), 0);
      
      const expStr = r.expenses.filter(e => e.isProjectExpense !== false).map(e => `${e.description}($${e.amount})`).join('; ');
      const expPrice = r.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
      
      const grand = matPrice + workerPrice + expPrice;

      return [
        r.date,
        `"${r.projectName.replace(/"/g, '""')}"`,
        `"${matStr.replace(/"/g, '""')}"`,
        matPrice,
        `"${workerStr.replace(/"/g, '""')}"`,
        workerPrice,
        `"${expStr.replace(/"/g, '""')}"`,
        grand,
        r.markAsCompleted ? '已完工' : '未完工',
        `"${(r.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `水電核算日誌賬目-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setReportSelectedProjectId('all');
    setReportStartDate('');
    setReportEndDate('');
    setReportSearchQuery('');
  };


  // ----------------------------------------------------
  // WORKER ATTENDANCE & WAGES RECORD TAB (NEWLY ADDED!)
  // ----------------------------------------------------
  
  // Base multi-worker sequential allocation list
  const baseAttendanceList = useMemo(() => {
    const list: Array<{
      id: string;
      recordId: string;
      date: string;
      projectId: string;
      projectName: string;
      workerId: string;
      name: string;
      hoursWork: number;
      hourlyRate: number;
      totalWage: number;
      isSupport?: boolean;
      supportRole?: string;
      dailyNotes: string;
      regularHours: number;
      otFirstTwo: number;
      otAfterTwo: number;
    }> = [];

    // Sort records chronologically by date and id for sequential allocation, excluding reports from rejected (報價未成) projects
    const sortedRecords = records.filter(r => {
      const p = projects.find(proj => proj.id === r.projectId);
      if (p && p.isEstimation && p.estimationStatus === '報價未成') {
        return false;
      }
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

    // 1. Calculate daily total hours per worker
    const dailyTotalsMap: Record<string, { [date: string]: number }> = {};
    sortedRecords.forEach(r => {
      r.workers.forEach(w => {
        if (!dailyTotalsMap[w.workerId]) {
          dailyTotalsMap[w.workerId] = {};
        }
        dailyTotalsMap[w.workerId][r.date] = (dailyTotalsMap[w.workerId][r.date] || 0) + w.hoursWork;
      });
    });

    // 2. Track allocated hours per worker per day
    const dailyAllocatedReg: Record<string, { [date: string]: number }> = {};
    const dailyAllocatedOt1: Record<string, { [date: string]: number }> = {};
    const dailyAllocatedOt2: Record<string, { [date: string]: number }> = {};

    sortedRecords.forEach(r => {
      r.workers.forEach(w => {
        const matchedProject = projects.find(p => p.id === r.projectId);
        const pDisplay = matchedProject ? getProjectDisplayName(matchedProject) : r.projectName;

        const totalDailyHours = dailyTotalsMap[w.workerId]?.[r.date] || 0;
        const totalRegular = Math.min(totalDailyHours, 8);
        const totalOtFirstTwo = Math.min(Math.max(totalDailyHours - 8, 0), 2);
        const totalOtAfterTwo = Math.max(totalDailyHours - 10, 0);

        if (!dailyAllocatedReg[w.workerId]) dailyAllocatedReg[w.workerId] = {};
        if (!dailyAllocatedOt1[w.workerId]) dailyAllocatedOt1[w.workerId] = {};
        if (!dailyAllocatedOt2[w.workerId]) dailyAllocatedOt2[w.workerId] = {};

        const currentReg = dailyAllocatedReg[w.workerId][r.date] || 0;
        const currentOt1 = dailyAllocatedOt1[w.workerId][r.date] || 0;
        const currentOt2 = dailyAllocatedOt2[w.workerId][r.date] || 0;

        const maxRegAllowed = Math.max(totalRegular - currentReg, 0);
        const regularHours = Math.min(w.hoursWork, maxRegAllowed);

        const maxOt1Allowed = Math.max(totalOtFirstTwo - currentOt1, 0);
        const otFirstTwo = Math.min(w.hoursWork - regularHours, maxOt1Allowed);

        const maxOt2Allowed = Math.max(totalOtAfterTwo - currentOt2, 0);
        const otAfterTwo = Math.min(w.hoursWork - regularHours - otFirstTwo, maxOt2Allowed);

        // Update allocated trackers
        dailyAllocatedReg[w.workerId][r.date] = currentReg + regularHours;
        dailyAllocatedOt1[w.workerId][r.date] = currentOt1 + otFirstTwo;
        dailyAllocatedOt2[w.workerId][r.date] = currentOt2 + otAfterTwo;

        const normalPayroll = regularHours * w.hourlyRate;
        const otFirstTwoPayroll = otFirstTwo * w.hourlyRate * 1.34;
        const otAfterTwoPayroll = otAfterTwo * w.hourlyRate * 1.34;
        const computedOvertimeWage = Math.round(normalPayroll + otFirstTwoPayroll + otAfterTwoPayroll);

        list.push({
          id: `${r.id}-${w.id}-${w.workerId}`,
          recordId: r.id,
          date: r.date,
          projectId: r.projectId,
          projectName: pDisplay,
          workerId: w.workerId,
          name: w.name,
          hoursWork: w.hoursWork,
          hourlyRate: w.hourlyRate,
          totalWage: computedOvertimeWage,
          isSupport: w.isSupport,
          supportRole: w.supportRole,
          dailyNotes: r.notes || '',
          regularHours,
          otFirstTwo,
          otAfterTwo
        });
      });
    });

    return list;
  }, [records, projects]);

  // Aggregate worker timesheets - with exact date filters for Monthly Payroll summaries and KPIs
  const attendanceList = useMemo(() => {
    // Apply FILTERS
    const filteredList = baseAttendanceList.filter(item => {
      if (attendanceStartDate && item.date < attendanceStartDate) return false;
      if (attendanceEndDate && item.date > attendanceEndDate) return false;

      if (attendanceWorkerId !== 'all') {
        if (attendanceWorkerId === 'support') {
          if (!item.isSupport) return false;
        } else {
          if (item.workerId !== attendanceWorkerId) return false;
        }
      }

      if (attendanceSearchQuery.trim()) {
        const q = attendanceSearchQuery.toLowerCase();
        const searchMatched = item.name.toLowerCase().includes(q) ||
                              item.projectName.toLowerCase().includes(q) ||
                              item.dailyNotes.toLowerCase().includes(q);
        if (!searchMatched) return false;
      }

      return true;
    });

    // Apply SORTING
    filteredList.sort((a, b) => {
      if (attendanceSortBy === 'dateDesc') {
        return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
      } else if (attendanceSortBy === 'dateAsc') {
        return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      } else if (attendanceSortBy === 'hoursDesc') {
        return b.hoursWork - a.hoursWork;
      } else if (attendanceSortBy === 'hoursAsc') {
        return a.hoursWork - b.hoursWork;
      } else if (attendanceSortBy === 'wageDesc') {
        return b.totalWage - a.totalWage;
      } else if (attendanceSortBy === 'wageAsc') {
        return a.totalWage - b.totalWage;
      }
      return b.date.localeCompare(a.date);
    });

    return filteredList;
  }, [baseAttendanceList, attendanceWorkerId, attendanceStartDate, attendanceEndDate, attendanceSortBy, attendanceSearchQuery]);

  // Filtered list specifically for bottom verification table - matches the active date range filters!
  const tableAttendanceList = useMemo(() => {
    // Apply FILTERS
    const filteredList = baseAttendanceList.filter(item => {
      // NOW COVERS DATE RANGE FILTERS FOR SYNCHRONIZED RECONCILIATION!
      if (attendanceStartDate && item.date < attendanceStartDate) return false;
      if (attendanceEndDate && item.date > attendanceEndDate) return false;

      if (attendanceWorkerId !== 'all') {
        if (attendanceWorkerId === 'support') {
          if (!item.isSupport) return false;
        } else {
          if (item.workerId !== attendanceWorkerId) return false;
        }
      }

      if (attendanceSearchQuery.trim()) {
        const q = attendanceSearchQuery.toLowerCase();
        const searchMatched = item.name.toLowerCase().includes(q) ||
                              item.projectName.toLowerCase().includes(q) ||
                              item.dailyNotes.toLowerCase().includes(q);
        if (!searchMatched) return false;
      }

      return true;
    });

    // Apply SORTING
    filteredList.sort((a, b) => {
      if (attendanceSortBy === 'dateDesc') {
        return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
      } else if (attendanceSortBy === 'dateAsc') {
        return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      } else if (attendanceSortBy === 'hoursDesc') {
        return b.hoursWork - a.hoursWork;
      } else if (attendanceSortBy === 'hoursAsc') {
        return a.hoursWork - b.hoursWork;
      } else if (attendanceSortBy === 'wageDesc') {
        return b.totalWage - a.totalWage;
      } else if (attendanceSortBy === 'wageAsc') {
        return a.totalWage - b.totalWage;
      }
      return b.date.localeCompare(a.date);
    });

    return filteredList;
  }, [baseAttendanceList, attendanceWorkerId, attendanceStartDate, attendanceEndDate, attendanceSortBy, attendanceSearchQuery]);

  // 考勤對帳表的虛擬滾動 (Virtual Scroll) 可視範圍切片與高度補白計算 (Optimization 1)
  const visibleCount = Math.ceil(tableContainerHeight / rowHeight);
  const startIndex = Math.max(0, Math.floor(tableScrollTop / rowHeight) - 3);
  const endIndex = Math.min(tableAttendanceList.length, startIndex + visibleCount + 6);

  const visibleTableItems = useMemo(() => {
    return tableAttendanceList.slice(startIndex, endIndex);
  }, [tableAttendanceList, startIndex, endIndex]);

  const paddingTopHeight = startIndex * rowHeight;
  const paddingBottomHeight = (tableAttendanceList.length - endIndex) * rowHeight;

  // 計算每個工班同仁的預支、借支與還款餘額彙整
  const workerAdvancesSummary = useMemo(() => {
    const summary: Record<string, { totalBorrowed: number; totalRepaid: number; balance: number }> = {};
    
    // 初始化系統內預設的所有在職工班人員
    workersPreset.forEach(w => {
      summary[w.id] = { totalBorrowed: 0, totalRepaid: 0, balance: 0 };
    });
    
    workerAdvances.forEach(adv => {
      if (!summary[adv.workerId]) {
        summary[adv.workerId] = { totalBorrowed: 0, totalRepaid: 0, balance: 0 };
      }
      if (adv.type === 'borrow') {
        summary[adv.workerId].totalBorrowed += adv.amount;
      } else {
        summary[adv.workerId].totalRepaid += adv.amount;
      }
    });

    Object.keys(summary).forEach(workerId => {
      summary[workerId].balance = summary[workerId].totalBorrowed - summary[workerId].totalRepaid;
    });

    return summary;
  }, [workerAdvances, workersPreset]);

  // 計算工地車載零用金（公基金）之總存入、總支出與當前水位餘額
  const pettyCashSummary = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    
    pettyCashTransactions.forEach(t => {
      if (t.type === 'income') {
        totalInflow += t.amount;
      } else {
        totalOutflow += t.amount;
      }
    });
    
    return {
      totalInflow,
      totalOutflow,
      currentBalance: totalInflow - totalOutflow
    };
  }, [pettyCashTransactions]);

  // Aggregate worker attendance stats
  const attendanceKPIs = useMemo(() => {
    let totalHours = 0;
    let totalWages = 0;
    const uniqueDates = new Set<string>();

    attendanceList.forEach(item => {
      totalHours += item.hoursWork;
      totalWages += item.totalWage;
      uniqueDates.add(item.date);
    });

    return {
      totalHours,
      totalWages,
      workDaysCount: uniqueDates.size,
      avgHoursPerDay: uniqueDates.size > 0 ? (totalHours / uniqueDates.size).toFixed(1) : '0'
    };
  }, [attendanceList]);

  // 期末與出勤時數發薪日：自動彙整每個同仁的應領工資、預支借貸、勞健保、提撥、與代扣款，計算最終實發薪資與公司營運負擔
  const consolidatedPayrollList = useMemo(() => {
    const summaryMap: Record<string, {
      workerId: string;
      name: string;
      totalHours: number;
      totalWages: number;
      borrowBalance: number;
      laborSelfPay: number;
      healthSelfPay: number;
      pensionSelfPay: number;
      pensionEmployer: number;
      otherWithholding: number;
      laborEmployer: number;
      healthEmployer: number;
    }> = {};

    // 1. 累計加總當前篩選日期期間的工資與工時
    attendanceList.forEach(item => {
      if (!summaryMap[item.workerId]) {
        const wPreset = workersPreset.find(w => w.id === item.workerId);
        summaryMap[item.workerId] = {
          workerId: item.workerId,
          name: item.name,
          totalHours: 0,
          totalWages: 0,
          borrowBalance: workerAdvancesSummary[item.workerId]?.balance || 0,
          laborSelfPay: wPreset?.laborInsuranceSelfPay || 0,
          healthSelfPay: wPreset?.healthInsuranceSelfPay || 0,
          pensionSelfPay: wPreset?.laborPensionSelfPay || 0,
          pensionEmployer: wPreset?.laborPensionEmployerUnit || 0,
          otherWithholding: wPreset?.otherWithholding || 0,
          laborEmployer: wPreset?.laborInsuranceEmployerPay || 0,
          healthEmployer: wPreset?.healthInsuranceEmployerPay || 0
        };
      }
      summaryMap[item.workerId].totalHours += item.hoursWork;
      summaryMap[item.workerId].totalWages += item.totalWage;
    });

    // 2. 確保那些雖無當前日期出勤、但有借支/未清款項的同仁也列入提醒，避免未結餘額遺漏
    Object.keys(workerAdvancesSummary).forEach(workerId => {
      const advBal = workerAdvancesSummary[workerId].balance;
      if (advBal !== 0 && !summaryMap[workerId]) {
        const wPreset = workersPreset.find(w => w.id === workerId);
        if (wPreset) {
          summaryMap[workerId] = {
            workerId: workerId,
            name: wPreset.name,
            totalHours: 0,
            totalWages: 0,
            borrowBalance: advBal,
            laborSelfPay: wPreset.laborInsuranceSelfPay || 0,
            healthSelfPay: wPreset.healthInsuranceSelfPay || 0,
            pensionSelfPay: wPreset.laborPensionSelfPay || 0,
            pensionEmployer: wPreset.laborPensionEmployerUnit || 0,
            otherWithholding: wPreset.otherWithholding || 0,
            laborEmployer: wPreset.laborInsuranceEmployerPay || 0,
            healthEmployer: wPreset.healthInsuranceEmployerPay || 0
          };
        }
      }
    });

    return Object.values(summaryMap);
  }, [attendanceList, workerAdvancesSummary, workersPreset]);


  return (
    <div className="space-y-6">
      
      {/* 🚀 SUB-TAB VIEW HEADER NAVIGATION */}
      <div className="flex border border-[#2C2C2C] bg-[#1E1E1E] p-1.5 rounded-xl max-w-4xl select-none gap-2 shadow-3xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubTab('billing_records')}
          className={`flex-1 py-2 px-3.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
            activeSubTab === 'billing_records' 
              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold' 
              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
          }`}
        >
          <Landmark size={14} className="stroke-[2]" />
          款項對帳
        </button>

        <button
          onClick={() => setActiveSubTab('operating_analytics')}
          className={`flex-1 py-2 px-3.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
            activeSubTab === 'operating_analytics' 
              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold' 
              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
          }`}
        >
          <TrendingUp size={14} className="stroke-[2]" />
          利潤分析
        </button>

        <button
          onClick={() => setActiveSubTab('worker_attendance')}
          className={`flex-1 py-2 px-3.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
            activeSubTab === 'worker_attendance' 
              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold' 
              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
          }`}
        >
          <HardHat size={14} className="stroke-[2]" />
          工班考勤
        </button>

        <button
          onClick={() => setActiveSubTab('worker_advances')}
          className={`flex-1 py-2 px-3.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
            activeSubTab === 'worker_advances' 
              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold' 
              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
          }`}
        >
          <DollarSign size={14} className="stroke-[2]" />
          預支借支
        </button>

        <button
          onClick={() => setActiveSubTab('petty_cash')}
          className={`flex-1 py-2 px-3.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
            activeSubTab === 'petty_cash' 
              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold' 
              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
          }`}
        >
          <Wallet size={14} className="stroke-[2]" />
          零用金簿
        </button>
      </div>


      {/* ---------------------------------------------------- */}
      {/* SECTION 1: CUSTOMER BILLING LEDGER */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'billing_records' && (
        <div className="space-y-6">

          <div className="bg-[#1E1E1E] p-4 rounded-xl border border-[#2C2C2C] shadow-3xs flex items-center justify-between gap-4">
            <span className="text-xs font-bold text-neutral-400">
              篩選及速覽客戶應收未收：
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="px-3 py-1.5 border border-[#3A3A3A] rounded-lg text-xs font-bold bg-[#252525] text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="all" className="bg-[#1E1E1E]">🔍 顯示所有配合中客戶 ({customers.length} 家)</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#1E1E1E]">👤 {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-6">
            {filteredAggregateLedger.map(ledger => {
              const clientProjs = projectSummariesList.filter(p => p.clientId === ledger.customerId);
              
              return (
                <div key={ledger.customerId} className="bg-[#1E1E1E] rounded-2xl border border-[#2C2C2C] shadow-3xs overflow-hidden text-neutral-300">
                  
                  {/* Ledger client bar header */}
                  <div className="bg-[#212121] px-5 py-4 border-b border-[#2C2C2C] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#252525] text-[#D4AF37] border border-[#3A3A3A] rounded-xl flex items-center justify-center font-black shrink-0">
                        {ledger.customerName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white">{ledger.customerName}</h4>
                        <div className="flex items-center gap-2.5 text-[11px] text-neutral-400 mt-0.5">
                          <span>配合工地數：{ledger.totalProjectsCount} 家</span>
                          <span>•</span>
                          <span>施工中：{ledger.activeProjectsCount} 家</span>
                          <span>•</span>
                          {ledger.phone && <span>聯絡: {ledger.phone}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Customer prepayment balance */}
                      <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-right">
                        <span className="block text-[9px] font-black text-emerald-400 uppercase leading-none">預收溢領沖抵池餘額</span>
                        <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                          NT$ {ledger.prepaidBalance.toLocaleString()} 元
                        </span>
                      </div>

                      {/* Cumulative finalized completed projects outstanding */}
                      <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg text-right">
                        <span className="block text-[9px] font-black text-rose-400 uppercase leading-none">已完工案應收款餘額(最終帳)</span>
                        <span className="text-xs sm:text-sm font-bold text-rose-400 font-mono">
                          NT$ {ledger.totalOutstanding.toLocaleString()} 元
                        </span>
                      </div>

                      {/* Ongoing projects accumulated amount to date */}
                      <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg text-right">
                        <span className="block text-[9px] font-black text-blue-400 uppercase leading-none">施工進行中(目前累積估計金流)</span>
                        <span className="text-xs sm:text-sm font-bold text-blue-400 font-mono">
                          NT$ {ledger.activeProjectsBilled.toLocaleString()} 元
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Client project list detail lists */}
                  <div className="p-4 border-b border-[#2C2C2C] bg-[#1E1E1E]">
                    {clientProjs.length === 0 ? (
                      <p className="text-xs text-neutral-500 italic text-center py-4">該配合客戶名下目前尚未登記任何開工專案。</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#2C2C2C] text-[10px] text-neutral-400 font-black uppercase text-center bg-[#212121]">
                              <th className="py-2 px-3 text-left">施工案場/合約編號</th>
                              <th className="py-2 px-3">計價模式</th>
                              <th className="py-2 px-3">工程款基數</th>
                              <th className="py-2 px-3 text-emerald-400">已實收工程款</th>
                              <th className="py-2 px-3 text-amber-500">去尾/折扣折抵</th>
                              <th className="py-2 px-3 text-rose-400">應收未收餘額</th>
                              <th className="py-2 px-3">狀態</th>
                              <th className="py-2 px-3">預收沖帳</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientProjs.map(proj => {
                              const isCompleted = proj.isCompleted;
                              const curMode = proj.contractQuote > 0 ? 'quote' : 'actual';
                              const isDebted = proj.outstandingBalance > 0;
                              const isFullyPaid = proj.outstandingBalance <= 0;
                              
                              // Check if completed but direct payment collected is missing / empty
                              const isCompletedButNoDirectReceipt = isCompleted && 
                                records.some(r => r.projectId === proj.id && r.markAsCompleted && (!r.collectedAmount || r.collectedAmount <= 0));

                              return (
                                <tr key={proj.id} className="border-b border-[#2C2C2C] hover:bg-[#252525] text-xs text-center text-neutral-300">
                                  <td className="py-3 px-3 text-left font-mono text-[11px] font-bold text-white select-all max-w-[325px] break-all leading-normal" title={proj.name}>
                                    <div className="bg-[#252525] border border-[#2C2C2C] p-1.5 rounded hover:bg-[#2C2C2C] transition-colors text-[#D4AF37]">
                                      {proj.name}
                                    </div>

                                    {/* 📈 收款軌跡記錄 (Stage Payments Audit Trail) */}
                                    {(() => {
                                      const projTxs = transactions.filter(t => t.projectNameOrId === proj.id);
                                      if (projTxs.length > 0) {
                                        return (
                                          <div className="mt-2 p-1.5 bg-[#212121] border border-[#2C2C2C] rounded-lg space-y-1">
                                            <div className="text-[9px] font-black tracking-tight text-neutral-400 uppercase border-b border-[#2C2C2C] pb-0.5 flex justify-between items-center">
                                              <span>📈 收款分期歷史軌跡:</span>
                                              <span className="text-indigo-400 bg-indigo-950/40 px-1.5 py-0.2 rounded-full text-[8px]">{projTxs.length} 次</span>
                                            </div>
                                            <div className="space-y-0.5 max-h-[1100px] overflow-y-auto">
                                              {projTxs.map(t => (
                                                <div key={t.id} className="text-[8.5px] text-neutral-300 flex items-center justify-between font-bold gap-1 bg-[#252525] p-1 px-1.5 border border-[#2C2C2C] rounded shadow-4xs">
                                                  <span className="text-neutral-500 shrink-0 font-mono font-normal">{t.date}</span>
                                                  <span className="text-indigo-400 bg-indigo-950/40 border border-[#3A3A3A] px-1.5 py-0.2 rounded-full text-[8px] font-black truncate max-w-[130px]" title={t.paymentStage || '一般收款'}>
                                                    {t.paymentStage || '一般收款'}
                                                  </span>
                                                  <span className="font-mono text-emerald-400 ml-auto shrink-0 font-extrabold">${t.amount.toLocaleString()}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </td>
                                  
                                  <td className="py-3 px-3">
                                    <div className="flex items-center justify-center gap-1">
                                      {proj.isEstimation ? (
                                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-extrabold bg-indigo-950 text-indigo-300 border border-indigo-900 shadow-3xs" title="估價計價案場">
                                          📊 工料估價
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-extrabold bg-amber-950 text-[#D4AF37] border border-[#D4AF37]/30 shadow-3xs" title="實報實銷案場">
                                          💧 工料實報實銷
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="py-3 px-3 font-mono font-bold text-neutral-200">
                                    ${proj.selectedBilledBasis.toLocaleString()}
                                    <span className="text-[9px] text-neutral-400 font-normal block mt-0.5">
                                      {isCompleted 
                                        ? (curMode === 'quote' ? `已完工結案：$${proj.contractQuote.toLocaleString()}` : `已完工結案: $${proj.actualCalculated.toLocaleString()}`) 
                                        : `施工進行中累積: $${proj.actualCalculated.toLocaleString()}`}
                                    </span>
                                    <span className="text-[10px] text-emerald-400 font-bold block mt-1 hover:underline decoration-emerald-600 cursor-help" title="依據工務日誌（標準工時成本底價＋材料進貨進價＋現場雜支）計算之公司實際施工成本">
                                      🪵 實際施工成本: ${proj.actualConstructionCost.toLocaleString()}
                                    </span>
                                  </td>

                                  <td className="py-3 px-3 font-mono text-emerald-400 font-extrabold bg-[#252525]">
                                    ${proj.receivedPayment.toLocaleString()}
                                  </td>

                                  <td className="py-3 px-3 font-mono text-amber-500 font-extrabold">
                                    ${proj.roundingPaid.toLocaleString()}
                                  </td>

                                  <td className={`py-3 px-3 font-mono font-black ${isDebted ? 'text-rose-400 bg-rose-950/20' : 'text-neutral-500'}`}>
                                    ${proj.outstandingBalance.toLocaleString()}
                                  </td>

                                  <td className="py-3 px-3">
                                    {(() => {
                                      const isFailed = proj.isEstimation && proj.estimationStatus === '報價未成';
                                      if (isFailed) {
                                        return (
                                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[#252525] text-neutral-500 border border-[#3A3A3A]">
                                            ❌ 報價未成 (無帳)
                                          </span>
                                        );
                                      }
                                      if (isCompleted) {
                                        if (isFullyPaid) {
                                          return (
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-900 flex items-center justify-center gap-0.5">
                                              ✅ 已完工 (已結收款)
                                            </span>
                                          );
                                        } else {
                                          return (
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-950 text-rose-450 border border-rose-900 flex flex-col items-center justify-center gap-0.5 animate-pulse" title={`完工待解餘額: $${proj.outstandingBalance}`}>
                                              <span>⚠️ 已完工 (未收款)</span>
                                              <span className="text-[8px] font-mono font-bold opacity-80">欠款: ${proj.outstandingBalance.toLocaleString()}</span>
                                            </span>
                                          );
                                        }
                                      } else {
                                        if (isFullyPaid) {
                                          return (
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-sky-950 text-sky-400 border border-sky-900 flex items-center justify-center gap-0.5">
                                              👷 施工中 (已付訖)
                                            </span>
                                          );
                                        } else {
                                          return (
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-950 text-blue-400 border border-blue-900 flex flex-col items-center justify-center gap-0.5">
                                              <span>👷 施工中 (未收款)</span>
                                              <span className="text-[8px] font-mono font-bold opacity-80">尚欠: ${proj.outstandingBalance.toLocaleString()}</span>
                                            </span>
                                          );
                                        }
                                      }
                                    })()}
                                  </td>

                                  <td className="py-3 px-3">
                                    {ledger.prepaidBalance > 0 && isDebted ? (
                                      <button
                                        type="button"
                                        onClick={() => handleApplyPoolCredits(ledger.customerId, proj.id, proj.outstandingBalance)}
                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-black font-black text-[10px] rounded-lg transition-all cursor-pointer"
                                      >
                                        扣抵餘額 ${Math.min(ledger.prepaidBalance, proj.outstandingBalance).toLocaleString()}
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-neutral-500 italic font-medium">不須抵扣</span>
                                    )}
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
              );
            })}
          </div>

          {/* Detailed Transaction Ledger Logs Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-3xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h4 className="text-xs sm:text-sm font-black text-neutral-800 flex items-center gap-1.5">
                <ArrowRightLeft size={16} className="text-neutral-500" />
                款項交易核銷歷史流水帳目 (收款與沖帳日誌)
              </h4>
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase font-mono">
                {filteredTransactionsLog.length} 筆流水
              </span>
            </div>

            {filteredTransactionsLog.length === 0 ? (
              <p className="text-xs text-neutral-400 italic text-center py-6">目前此客戶篩選條件下，無任何收款與折抵歷史大卡。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-100 text-[10px] text-neutral-400 font-bold bg-neutral-50">
                      <th className="py-2 px-3">收帳時間</th>
                      <th className="py-2 px-3">客戶名稱</th>
                      <th className="py-2 px-3">涉及工地/沖抵目的</th>
                      <th className="py-2 px-3">收帳金額(實收)</th>
                      <th className="py-2 px-3">記帳類別</th>
                      <th className="py-2 px-3">金流管道</th>
                      <th className="py-2 px-3">備註事項</th>
                      <th className="py-2 px-3 text-center">刪除</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactionsLog.map(t => {
                      const client = customers.find(c => c.id === t.customerId);
                      const proj = t.projectNameOrId ? projects.find(p => p.id === t.projectNameOrId) : null;
                      
                      const tType = t.allocationType;
                      let typeBadge = '';
                      if (tType === 'specific_project') typeBadge = '🏢 特定工程配款';
                      if (tType === 'client_pool') typeBadge = '🏦 存入預收池';
                      if (tType === 'round_adjustment') typeBadge = '🔩 抹零/去尾調整';
                      if (tType === 'advance') typeBadge = '🎬 保證/定金溢付';
                      if (tType === 'old_debt') typeBadge = '随機自動抵舊';

                      return (
                        <tr key={t.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className="py-3 px-3 font-mono text-neutral-500">{t.date}</td>
                          <td className="py-3 px-3 font-black text-neutral-800">{client ? client.name : '未知客戶'}</td>
                          <td className="py-3 px-3 text-neutral-600 select-all font-medium">
                            {proj ? (
                              <div className="space-y-1 text-left">
                                <span className="bg-neutral-50 border border-neutral-150 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold block max-w-[280px] break-all leading-normal text-neutral-750">
                                  工地: {proj.generatedName}
                                </span>
                                {t.paymentStage && (
                                  <span className="inline-block bg-indigo-50 text-indigo-800 border border-indigo-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-4xs">
                                    📊 期款標記：{t.paymentStage}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-neutral-400 italic">全配合戶通用暫收款</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-black text-emerald-600 bg-emerald-500/5">
                            ${t.amount.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-bold text-[11px]">{typeBadge}</td>
                          <td className="py-3 px-3 font-bold text-neutral-500">{t.method || '銀行轉帳'}</td>
                          <td className="py-3 px-3 text-neutral-400 italic select-all">{t.description || '無'}</td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(t.id)}
                              className="p-1 text-neutral-400 hover:text-red-500 cursor-pointer"
                              title="取消這筆收帳紀錄"
                            >
                              <Trash2 size={13} />
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

          {/* 各戶所有未收款施工案場明細列表 */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-3xs overflow-hidden mt-6">
            <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={16} className="text-rose-600" />
                <h4 className="text-xs sm:text-sm font-black text-rose-900">
                  ⚠️ 各配合客戶名下所有未收訖(仍有欠款)施工案場對帳明細
                </h4>
              </div>
              <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-2.5 py-0.5 rounded-full uppercase">
                未收工程帳務查核
              </span>
            </div>
            
            <div className="p-4 sm:p-5 space-y-4 bg-neutral-50/20">
              {filteredAggregateLedger.filter(l => projectSummariesList.some(p => p.clientId === l.customerId && p.outstandingBalance > 0)).length === 0 ? (
                <div className="text-center py-8 text-neutral-400 italic text-xs">
                  🎉 太棒了！目前所有客戶的完工與施工案場皆已結完清帳，無應收未收餘額。
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAggregateLedger
                    .filter(l => projectSummariesList.some(p => p.clientId === l.customerId && p.outstandingBalance > 0))
                    .map(l => {
                      const unpaidProjects = projectSummariesList.filter(p => p.clientId === l.customerId && p.outstandingBalance > 0);
                      const totalOutstandingSum = unpaidProjects.reduce((sum, p) => sum + p.outstandingBalance, 0);

                      return (
                        <div key={l.customerId} className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-3xs">
                          {/* Inner Header */}
                          <div className="px-4 py-2.5 bg-neutral-100 border-b border-neutral-200 flex flex-wrap justify-between items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="font-extrabold text-neutral-800 text-xs">
                                👤 客戶負責配合戶：
                              </span>
                              <span className="text-xs font-black text-neutral-900 border-l pl-1.5 border-neutral-300">
                                {l.customerName}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-mono font-medium text-neutral-500">
                              <span>
                                未收款案場數：<strong className="text-rose-600 font-extrabold">{unpaidProjects.length} 個</strong>
                              </span>
                              <span>|</span>
                              <span>
                                客戶餘額存池：<strong className={`${l.prepaidBalance > 0 ? 'text-emerald-600 font-extrabold' : 'text-neutral-400'}`}>${l.prepaidBalance.toLocaleString()} 元</strong>
                              </span>
                              <span>|</span>
                              <span>
                                該戶累計欠款：<strong className="text-rose-600 font-extrabold text-xs">${totalOutstandingSum.toLocaleString()} 元</strong>
                              </span>
                            </div>
                          </div>
                          
                          {/* Project Mini Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-center text-[11px] border-collapse">
                              <thead>
                                <tr className="border-b border-neutral-100 text-[10px] text-neutral-400 font-bold bg-neutral-50 text-center">
                                  <th className="py-2 px-3 text-left">施做案場/案序</th>
                                  <th className="py-2 px-3">計價模式</th>
                                  <th className="py-2 px-3">當前基數/合約</th>
                                  <th className="py-2 px-3 text-emerald-600">已實收款額</th>
                                  <th className="py-2 px-3 text-amber-600">去尾折抵</th>
                                  <th className="py-2 px-3 text-rose-600">應收未收餘額</th>
                                  <th className="py-2 px-3">案場狀態</th>
                                </tr>
                              </thead>
                              <tbody>
                                {unpaidProjects.map(up => {
                                  const isCompleted = up.isCompleted;
                                  const curMode = up.contractQuote > 0 ? 'quote' : 'actual';
                                  const isCompletedButNoDirectReceipt = isCompleted && 
                                    records.some(r => r.projectId === up.id && r.markAsCompleted && (!r.collectedAmount || r.collectedAmount <= 0));

                                  return (
                                    <tr key={up.id} className="border-b border-neutral-50 hover:bg-neutral-50/50 text-[11px]">
                                      <td className="py-2.5 px-3 text-left font-mono font-bold text-neutral-850 select-all max-w-[320px] break-all leading-normal" title={up.name}>
                                        <div className="bg-neutral-50 border border-neutral-100 p-1 rounded hover:bg-neutral-100 transition-colors">
                                          {up.name}
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                          curMode === 'quote' ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'
                                        }`}>
                                          {curMode === 'quote' ? '合約報價計費' : '實報實銷計費'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 font-mono text-neutral-600">${up.selectedBilledBasis.toLocaleString()}</td>
                                      <td className="py-2.5 px-3 font-mono text-emerald-600 font-bold bg-emerald-550/5">${up.receivedPayment.toLocaleString()}</td>
                                      <td className="py-2.5 px-3 font-mono text-amber-600 font-bold bg-amber-550/5">${up.roundingPaid.toLocaleString()}</td>
                                      <td className="py-2.5 px-3 font-mono font-black text-rose-600 bg-rose-550/5">${up.outstandingBalance.toLocaleString()} 元</td>
                                      <td className="py-2.5 px-3">
                                        {isCompleted ? (
                                          <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse flex flex-col items-center gap-0.5">
                                            <span>⚠️ 已完工 (未收款)</span>
                                            <span className="text-[8px] font-mono text-rose-600 font-bold">欠: ${up.outstandingBalance.toLocaleString()}</span>
                                          </span>
                                        ) : (
                                          <span className="px-2.5 py-1 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex flex-col items-center gap-0.5">
                                            <span>👷 施工中 (未收款)</span>
                                            <span className="text-[8px] font-mono text-blue-600 font-bold">欠: ${up.outstandingBalance.toLocaleString()}</span>
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ---------------------------------------------------- */}
      {/* SECTION 2: OPERATING ANALYTICS PANEL (UNLOCKED!) */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'operating_analytics' && (
        <div className="space-y-6">
          
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-white p-4.5 rounded-xl border border-neutral-200 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                <Coins size={22} />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-neutral-400 mb-0.5">對外估算總值 (牌價小計)</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black text-neutral-900 font-mono">
                    NT$ {reportStats.grandTotal.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-neutral-400">元</span>
                </div>
                <span className="text-[9px] text-neutral-400 block">
                  含耗材出廠牌價與工酬
                </span>
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-xl border border-neutral-200 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                <Wallet size={22} />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-neutral-400 mb-0.5">對內工程總支出 (實際成本)</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black text-neutral-900 font-mono">
                    NT$ {reportStats.grandActualCost.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-neutral-400">元</span>
                </div>
                <span className="text-[9px] text-amber-700 block font-bold">
                  含材料進價成本與工資
                </span>
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-xl border border-neutral-200 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                <UserCheck size={22} />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-neutral-400 mb-0.5">預估工程淨利潤</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                    NT$ {reportStats.profitAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">元</span>
                </div>
                <span className="text-[9px] text-emerald-600 block font-bold">
                  毛利率：{reportStats.profitMargin}% (精算利潤)
                </span>
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-xl border border-neutral-200 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-sky-50 rounded-lg text-sky-600">
                <Clock size={22} />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-neutral-400 mb-0.5">累計派遣出勤總工時</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black text-neutral-900 font-mono">
                    {reportStats.totalHours}
                  </span>
                  <span className="text-xs text-neutral-500 font-bold">小時</span>
                </div>
                <span className="text-[9px] text-neutral-400 block">
                  累計施工：{reportStats.recordCount} 個工作日誌
                </span>
              </div>
            </div>

          </div>

          {/* 🎯 案場毛利與全面經營剖析看板 (含有：支出、收入、代收款、已收款之數據整合圖表) */}
          <div className="bg-neutral-900 text-neutral-100 p-5 rounded-2xl border border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="text-amber-500 shrink-0" size={18} />
                <div>
                  <h4 className="text-sm font-black text-white">💰 案場經營與金流收支大盤 (支出・收入・代收款・已收款五重奏)</h4>
                  <p className="text-[10px] text-neutral-400">依據您所篩選的時間區間，整合現場日誌與系統交易明細進行複式會計剖析</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-500 px-2 py-0.5 rounded font-bold font-mono">
                  財務精算 (已解鎖)
                </span>
              </div>
            </div>

            {/* Data comparison block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. 總收入 (Income) */}
              <div className="p-4 bg-indigo-950/40 border border-indigo-500/20 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-indigo-400 block pb-1 border-b border-indigo-500/10">📈 總預估工程收入 (牌價總款)</span>
                <div className="text-xl font-mono font-black text-indigo-300">NT$ {reportStats.grandTotal.toLocaleString()} 元</div>
                <p className="text-[9px] text-indigo-400">以當期施工用料及派遣工酬對外牌價之加總值</p>
              </div>

              {/* 2. 總支出 (Expenses) */}
              <div className="p-4 bg-orange-950/40 border border-orange-500/20 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-orange-400 block pb-1 border-b border-orange-500/10">📉 總工程支出 (實際工料成本)</span>
                <div className="text-xl font-mono font-black text-orange-300">NT$ {reportStats.grandActualCost.toLocaleString()} 元</div>
                <p className="text-[9px] text-orange-400">材料進口底價成本 + 師傅實際出勤薪資總酬</p>
              </div>

              {/* 3. 代收款 (Collections on site) */}
              <div className="p-4 bg-sky-950/40 border border-sky-500/20 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-sky-400 block pb-1 border-b border-sky-500/10">🛠️ 現場工程代收款 (工地現場直收)</span>
                <div className="text-xl font-mono font-black text-sky-300">NT$ {filteredRecords.reduce((s, r) => s + (r.collectedAmount || 0), 0).toLocaleString()} 元</div>
                <p className="text-[9px] text-sky-400">當期由師傅於案場直接收受、登錄之工程預支代收款</p>
              </div>

              {/* 4. 已收款 (Total Received) */}
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/20 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-emerald-400 block pb-1 border-b border-emerald-500/10">🏦 實到公款已收款 (帳戶實收累計)</span>
                <div className="text-xl font-mono font-black text-emerald-300">
                  NT$ {projectSummariesList.reduce((sum, p) => sum + p.receivedPayment, 0).toLocaleString()} 元
                </div>
                <p className="text-[9px] text-emerald-400">含上述現場直接收款與所有經客戶繳付至銀行之工程款</p>
              </div>
            </div>

            {/* Graphical representation: A multi-colored custom Bar chart comparing Income, Cost, Collections, Received Payments */}
            <div className="bg-neutral-950/60 p-4 border border-neutral-800 rounded-xl">
              <div className="text-xs font-bold text-neutral-300 mb-3 flex items-center gap-1.5 justify-between">
                <span>📊 各案場 收入 vs 支出 vs 現場直收 vs 實收工程款 (營業對比分析)</span>
                <span className="text-[10px] text-neutral-500 font-mono">單位：新台幣 (NTD)</span>
              </div>
              
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={projectSummariesList.map(p => {
                      // Gather site direct collected for this single project
                      const siteCol = filteredRecords.filter(r => r.projectId === p.id).reduce((s, r) => s + (r.collectedAmount || 0), 0);
                      return {
                        name: p.name.split('-')[3] || '案場',
                        '預估收入 (牌價)': p.selectedBilledBasis,
                        '工程實際成本': p.actualCalculated,
                        '現場直收代收款': siteCol,
                        '實收工程款': p.receivedPayment
                      };
                    })}
                    margin={{ top: 15, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="name" stroke="#525252" tick={{ fontSize: 9, fill: '#a3a3a3' }} />
                    <YAxis stroke="#525252" tick={{ fontSize: 9, fill: '#a3a3a3' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                      labelStyle={{ color: '#ffffff', fontWeight: 'bold', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="預估收入 (牌價)" fill="#D4AF37" stroke="#AA7C11" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="工程實際成本" fill="#8C7040" stroke="#684F25" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="現場直收代收款" fill="#E6CA65" stroke="#BF9A30" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="實收工程款" fill="#EAD2AC" stroke="#B89765" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Visual Analytics Charts */}
          {filteredRecords.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-neutral-200 shadow-3xs">
              
              {/* Proportions */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-100">
                  <TrendingUp size={16} className="text-neutral-500" />
                  <h4 className="text-xs font-black text-neutral-700">營運實際支出成分佔比 (Pie Chart)</h4>
                </div>
                
                {pieChartData.length === 0 ? (
                  <div className="h-[240px] flex items-center justify-center text-xs text-neutral-400 italic">無任何費用支出可以統計。</div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                    <div className="w-[180px] h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`NT$ ${value.toLocaleString()}元`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-1.5 shrink-0 text-xs">
                      {pieChartData.map((item, idx) => {
                        const total = pieChartData.reduce((s, v) => s + v.value, 0);
                        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-md block" style={{ backgroundColor: item.color }} />
                            <span className="font-bold text-neutral-700">{item.name}:</span>
                            <span className="font-mono text-neutral-500">${item.value.toLocaleString()} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bar Comparison charting */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-neutral-100">
                  <Scale size={16} className="text-neutral-500" />
                  <h4 className="text-xs font-black text-neutral-700">各案場工地成本支出對比 (Bar Chart)</h4>
                </div>
                
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projectComparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(value) => [`NT$ ${value.toLocaleString()}元`, '']} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="materials" name="材料成本支出" fill="#D4AF37" stackId="a" />
                      <Bar dataKey="labor" name="工資支出" fill="#9C804B" stackId="a" />
                      <Bar dataKey="expenses" name="現場報支支出" fill="#7F6C4C" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-8 bg-neutral-50 rounded-xl border border-neutral-200 text-center italic text-neutral-400 text-xs">
              ⚠️ 請先在左側過濾器重新選取其他日期範圍，目前查無匹配的直條圖形統計。
            </div>
          )}

        </div>
      )}


      {/* ---------------------------------------------------- */}
      {/* SECTION 3: DAILY TIMELINE & SHIELD REPORTS LOGS */}
      {/* ---------------------------------------------------- */}
      {false && (
        <div className="space-y-6">
          
          {/* Filtering HUB search */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-3xs">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-neutral-100 mb-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-amber-500 stroke-[2.5]" />
                <span className="font-extrabold text-neutral-800">核對檢索日誌欄位</span>
              </div>
              
              <div className="flex items-center gap-2">
                {(reportSelectedProjectId !== 'all' || reportStartDate !== '' || reportEndDate !== '' || reportSearchQuery !== '') && (
                  <button
                    onClick={handleResetFilters}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={12} />
                    重現所有日誌
                  </button>
                )}
                
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1 bg-neutral-900 border border-neutral-950 text-amber-400 font-bold rounded-lg hover:scale-105 transition-all text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <FileText size={12} />
                  導出Excel-CSV備查
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Project Select */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-500 mb-1">對口工地案場</label>
                <select
                  value={reportSelectedProjectId}
                  onChange={(e) => setReportSelectedProjectId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-850"
                >
                  <option value="all">所有工地案場 (不限)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.isCompleted ? '【已完】' : '【施工】'} {getProjectDisplayName(p)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-500 mb-1">起始日期</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-500 mb-1">結束日期</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs"
                />
              </div>

              {/* Query filter */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-500 mb-1">原料/工人名/備註檢索</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="輸入如南亞管、陳師傅..."
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-neutral-200 rounded-lg text-xs"
                  />
                  <Search className="absolute left-2.5 top-2.5 text-neutral-400" size={12} />
                </div>
              </div>
            </div>
          </div>

          {/* Timeline record entries list */}
          <div className="space-y-4">
            {filteredRecords.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center text-neutral-400 text-xs italic">
                📋 目前日誌歷史篩選下，查無任何派遣配備紀錄。
              </div>
            ) : (
              filteredRecords.map(record => {
                const isExpanded = reportExpandedId === record.id;
                
                // Calculate record individual costs
                const totalMat = record.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
                const totalMatCost = record.materials.reduce((sum, m) => sum + ((m.costPrice !== undefined ? m.costPrice : m.unitPrice) * m.quantity), 0);
                const totalLabor = record.workers.reduce((sum, w) => sum + ((w.billingHourlyRate ?? w.hourlyRate) * w.hoursWork), 0);
                const totalLaborCost = record.workers.reduce((sum, w) => sum + (w.hourlyRate * w.hoursWork), 0);
                const totalExp = record.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
                
                const recBill = totalMat + totalLabor + totalExp;
                const recCost = totalMatCost + totalLaborCost + totalExp;
                const profitText = recBill - recCost;

                return (
                  <div key={record.id} className="bg-white rounded-2xl border border-neutral-200 shadow-3xs overflow-hidden transition-all duration-200 hover:shadow-xs">
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Left: General metadata */}
                      <div className="flex items-start gap-3">
                        <div className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-950 text-amber-400 rounded-xl text-center shrink-0">
                          <Calendar size={14} className="mx-auto block mb-0.5" />
                          <span className="font-mono text-[10px] font-black">{record.date.substring(5)}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono bg-neutral-100 text-neutral-500 font-extrabold px-1.5 py-0.5 rounded text-[10px]">
                              {record.date} 工作日
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              record.markAsCompleted ? 'bg-neutral-100 text-neutral-400' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {record.markAsCompleted ? '🎉 案已辦結完工' : '施工持續中'}
                            </span>
                          </div>
                          
                          <h4 className="text-xs sm:text-sm font-black text-neutral-800 mt-1 select-all break-all">{record.projectName}</h4>
                          <p className="text-xs text-neutral-400 mt-1.5 select-all font-medium py-1 px-2.5 bg-neutral-50 rounded border border-neutral-200/50">
                            📢 進度摘要: {record.notes || '現場正常。'}
                          </p>
                        </div>
                      </div>

                      {/* Right: Quick actions and Unlocked prices figures */}
                      <div className="flex flex-col md:items-end justify-between gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          {/* Financial values directly displayed - Completely Unlocked! */}
                          <div className="bg-neutral-50 px-2 py-1 rounded-lg text-right font-mono text-[10px]">
                            <span className="text-neutral-400 font-sans block text-[9px]">對外牌契價</span>
                            <span className="font-black text-neutral-750">${recBill.toLocaleString()}元</span>
                          </div>
                          <div className="bg-neutral-50 px-2 py-1 rounded-lg text-right font-mono text-[10px]">
                            <span className="text-neutral-400 font-sans block text-[9px]">對內真成本支出</span>
                            <span className="font-black text-amber-700">${recCost.toLocaleString()}元</span>
                          </div>
                          <div className="bg-emerald-500/10 px-2 py-1 rounded-lg text-right font-mono text-[10px]">
                            <span className="text-emerald-700 font-sans block text-[9px]">日預估獲利</span>
                            <span className="font-black text-emerald-800">+${profitText.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Expandable buttons logs */}
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleCopyReporterLine(record)}
                            className="px-2.5 py-1 hover:scale-105 bg-neutral-100 text-neutral-700 hover:text-neutral-950 font-bold rounded-lg text-[10px] flex items-center gap-1 transition"
                            title="複製至群組 (自動遮薪屏蔽時薪)"
                          >
                            <Copy size={11} />
                            {reportCopiedId === record.id ? '已複製' : 'Line 回報複製'}
                          </button>

                          <button
                            onClick={() => setReportExpandedId(isExpanded ? null : record.id)}
                            className="px-2 py-1 bg-neutral-90 px-1 border border-neutral-200 hover:bg-neutral-100 font-extrabold rounded-lg text-[10px] flex items-center transition"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {isExpanded ? '收納' : '展開工料'}
                          </button>

                          {/* Quick Admin Actions */}
                          {onEditRecord && (
                            <button
                              onClick={() => {
                                triggerConfirm('確認編輯工作日誌', '您確定要變更及編輯此工作日誌嗎？', () => {
                                  onEditRecord(record);
                                });
                              }}
                              className="p-1 px-1.5 hover:bg-neutral-100 text-neutral-500 hover:text-amber-600 rounded transition"
                              title="編輯日誌"
                            >
                              <Printer size={13} />
                            </button>
                          )}

                          {onDeleteRecord && (
                            <div className="relative">
                              {reportDeleteConfirmId === record.id ? (
                                <div className="absolute right-0 bottom-full mb-1 bg-white p-2 border border-neutral-300 rounded-lg shadow-sm z-10 flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="text-[9px] text-red-600 font-bold">確認刪除？</span>
                                  <button
                                    onClick={() => { onDeleteRecord(record.id); setReportDeleteConfirmId(null); onSaveToast('🗑️ 日誌安全移除成功。'); }}
                                    className="bg-red-500 text-slate-950 font-bold px-1.5 py-0.5 rounded text-[10px]"
                                  >
                                    是
                                  </button>
                                  <button
                                    onClick={() => setReportDeleteConfirmId(null)}
                                    className="bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded text-[10px]"
                                  >
                                    否
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setReportDeleteConfirmId(record.id)}
                                  className="p-1 text-neutral-400 hover:text-red-600 transition"
                                  title="刪除施工日誌"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* Expand details for record工料支出 */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-3 border-t border-neutral-150 bg-neutral-50/50 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          
                          {/* Materials */}
                          <div className="bg-white p-3 rounded-lg border border-neutral-200">
                            <span className="text-[11px] font-black text-amber-800 block mb-2 border-b pb-1">🔧 本日消耗材料明細</span>
                            {record.materials.length === 0 ? (
                              <p className="text-[11px] text-neutral-400 italic">本日未登記任何水電管材。</p>
                            ) : (
                              <div className="space-y-1 text-[11px]">
                                {record.materials.map((m, idx) => (
                                  <div key={idx} className="flex justify-between text-neutral-600">
                                    <span>• {m.name} (x{m.quantity}{m.unit})</span>
                                    <span className="font-mono">
                                      牌: ${m.unitPrice * m.quantity} | 
                                      <span className="text-amber-700 font-bold">進: ${(m.costPrice !== undefined ? m.costPrice : m.unitPrice) * m.quantity}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Workers */}
                          <div className="bg-white p-3 rounded-lg border border-neutral-200">
                            <span className="text-[11px] font-black text-sky-800 block mb-2 border-b pb-1">👷 本日派遣工班出席與自付時薪</span>
                            {record.workers.length === 0 ? (
                              <p className="text-[11px] text-neutral-400 italic">本日未指派任何出勤員工。</p>
                            ) : (
                              <div className="space-y-1 text-[11px]">
                                {record.workers.map((w, idx) => (
                                  <div key={idx} className="flex justify-between text-neutral-600">
                                    <span>• {w.name} ({w.hoursWork}h)</span>
                                    {(() => {
                                      const reg = Math.min(w.hoursWork, 8);
                                      const ot1 = Math.min(Math.max(w.hoursWork - 8, 0), 2);
                                      const ot2 = Math.max(w.hoursWork - 10, 0);
                                      const calc = Math.round((reg * w.hourlyRate) + (ot1 * w.hourlyRate * 1.34) + (ot2 * w.hourlyRate * 1.34));
                                      return (
                                        <div className="text-right">
                                          <span className="font-mono font-bold text-sky-800">
                                            ${calc.toLocaleString()}元
                                          </span>
                                          {w.hoursWork > 8 && (
                                            <span className="block text-[8px] text-amber-600 font-bold bg-amber-50 px-1 rounded scale-90 translate-x-1">
                                              含加班 (前2後2皆) 1.34 倍
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Expenses */}
                          <div className="bg-white p-3 rounded-lg border border-neutral-200">
                            <span className="text-[11px] font-black text-red-800 block mb-2 border-b pb-1">🍱 現場雜費車馬伙食代墊報支</span>
                            {record.expenses.length === 0 ? (
                              <p className="text-[11px] text-neutral-400 italic">本日無代墊雜支發票收據。</p>
                            ) : (
                              <div className="space-y-1 text-[11px]">
                                {record.expenses.map((e, idx) => (
                                  <div key={idx} className="flex justify-between text-neutral-600">
                                    <span>• {e.description}</span>
                                    <span className="font-mono text-red-700 font-bold">${e.amount}元</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

        </div>
      )}


      {/* ---------------------------------------------------- */}
      {/* SECTION 4: WORKER ATTENDANCE & PAYROLL ACCOUNT (NEW!) */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'worker_attendance' && (
        <div className="space-y-6">
          
          {/* Query Form & filters */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-3xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-4 text-xs">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-amber-500 stroke-[2.5]" />
                <span className="font-extrabold text-sm md:text-base text-neutral-900">工班時數校對與工資審查條件</span>
              </div>
              <button
                onClick={() => {
                  setAttendanceWorkerId('all');
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, '0');
                  setAttendanceStartDate(`${year}-${month}-01`);
                  setAttendanceEndDate(`${year}-${month}-${String(now.getDate()).padStart(2, '0')}`);
                  setAttendanceSortBy('dateDesc');
                  setAttendanceSearchQuery('');
                }}
                className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-300 font-extrabold transition flex items-center gap-1 cursor-pointer select-none"
              >
                🔄 重設篩選與排序
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Worker select selector */}
              <div>
                <label className="block text-xs md:text-sm font-extrabold text-neutral-850 mb-1.5">派遣員工姓名</label>
                <select
                  value={attendanceWorkerId}
                  onChange={(e) => setAttendanceWorkerId(e.target.value)}
                  className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg text-xs md:text-sm bg-white text-neutral-900 font-black focus:border-amber-500 focus:outline-hidden"
                >
                  <option value="all">👥 所有出勤與外調人員 (不限)</option>
                  {workersPreset.map(w => (
                    <option key={w.id} value={w.id}>
                      👷 {w.name} {w.role ? `(${w.role})` : ''}
                    </option>
                  ))}
                  {/* Option for temporary support workers */}
                  <option value="support">👤 僅看臨時外調人員</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs md:text-sm font-extrabold text-neutral-850 mb-1.5">考勤開始日期</label>
                <input
                  type="date"
                  value={attendanceStartDate}
                  onChange={(e) => setAttendanceStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs md:text-sm bg-white font-bold text-neutral-900 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs md:text-sm font-extrabold text-neutral-850 mb-1.5">考勤截止日期</label>
                <input
                  type="date"
                  value={attendanceEndDate}
                  onChange={(e) => setAttendanceEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs md:text-sm bg-white font-bold text-neutral-900 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Search Query */}
              <div>
                <label className="block text-xs md:text-sm font-extrabold text-neutral-850 mb-1.5">搜尋關鍵字 (員工/案場/備註)</label>
                <input
                  type="text"
                  placeholder="請輸入關鍵字搜尋..."
                  value={attendanceSearchQuery}
                  onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs md:text-sm bg-white font-bold text-neutral-900 placeholder-neutral-450 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Sorting conditions */}
              <div>
                <label className="block text-xs md:text-sm font-extrabold text-neutral-850 mb-1.5">排序規則</label>
                <select
                  value={attendanceSortBy}
                  onChange={(e) => setAttendanceSortBy(e.target.value)}
                  className="w-full px-2.5 py-2 border border-neutral-300 rounded-lg text-xs md:text-sm bg-white text-neutral-900 font-black focus:border-amber-500 focus:outline-hidden"
                >
                  <option value="dateDesc">📅 日期 (由新到舊)</option>
                  <option value="dateAsc">📅 日期 (由舊到新)</option>
                  <option value="hoursDesc">⏱️ 派工時數 (由大到小)</option>
                  <option value="hoursAsc">⏱️ 派工時數 (由小到大)</option>
                  <option value="wageDesc">💰 工資金額 (由高到低)</option>
                  <option value="wageAsc">💰 工資金額 (由低到高)</option>
                </select>
              </div>
            </div>

            {/* 快速切換月份工具列 (New Month Switching Toolbar) */}
            <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3.5 border-t border-neutral-200 text-xs md:text-sm">
              <span className="text-neutral-700 font-extrabold mr-1">📅 快速月份切換:</span>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-250 rounded-lg font-black transition flex items-center gap-1 select-none cursor-pointer"
              >
                ◀ 上個月
              </button>
              <button
                type="button"
                onClick={handleCurrentMonth}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 border border-amber-650 rounded-lg font-black transition flex items-center gap-1 select-none cursor-pointer shadow-3xs"
              >
                📅 回本月
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-250 rounded-lg font-black transition flex items-center gap-1 select-none cursor-pointer"
              >
                下個月 ▶
              </button>

              {(() => {
                const buttons = [];
                const now = new Date();
                for (let i = 0; i < 4; i++) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const year = d.getFullYear();
                  const monthNum = d.getMonth() + 1;
                  const monthStr = String(monthNum).padStart(2, '0');
                  const label = `${monthNum}月`;
                  // Check if selected range matches this month's limits or similar
                  const active = attendanceStartDate === `${year}-${monthStr}-01`;
                  buttons.push(
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const firstDay = `${year}-${monthStr}-01`;
                        const lastDayObj = new Date(year, d.getMonth() + 1, 0);
                        const lastDay = `${year}-${monthStr}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
                        if (i === 0) {
                          const todayObj = new Date();
                          const todayStr = `${year}-${monthStr}-${String(todayObj.getDate()).padStart(2, '0')}`;
                          setAttendanceStartDate(firstDay);
                          setAttendanceEndDate(todayStr);
                        } else {
                          setAttendanceStartDate(firstDay);
                          setAttendanceEndDate(lastDay);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition select-none cursor-pointer ${
                        active
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 font-extrabold shadow-3xs'
                          : 'bg-white hover:bg-neutral-50 text-neutral-600 border border-neutral-200'
                      }`}
                    >
                      {year !== now.getFullYear() ? `${year}年${label}` : label}
                    </button>
                  );
                }
                return (
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-neutral-400 font-bold hidden sm:inline mr-1">月份快捷:</span>
                    {buttons.reverse()}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Aggregated Payroll KPIs for workers verification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                <Clock size={20} />
              </div>
              <div>
                <span className="block text-xs font-black text-neutral-600 mb-1">累計核對總工時</span>
                <span className="text-base md:text-lg font-black font-mono text-slate-950">
                  {attendanceKPIs.totalHours} 小時
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <DollarSign size={20} />
              </div>
              <div>
                <span className="block text-xs font-black text-neutral-600 mb-1">應領總薪資報酬</span>
                <span className="text-base md:text-lg font-black font-mono text-emerald-950">
                  NT$ {attendanceKPIs.totalWages.toLocaleString()} 元
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <Calendar size={20} />
              </div>
              <div>
                <span className="block text-xs font-black text-neutral-600 mb-1">出勤累計天數</span>
                <span className="text-base md:text-lg font-black font-mono text-slate-950">
                  {attendanceKPIs.workDaysCount} 天
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-red-50 text-red-650 rounded-lg">
                <Clock size={20} />
              </div>
              <div>
                <span className="block text-xs font-black text-neutral-600 mb-1">平均每日派遣時數</span>
                <span className="text-base md:text-lg font-black font-mono text-slate-950">
                  {attendanceKPIs.avgHoursPerDay} 小時
                </span>
              </div>
            </div>
          </div>

          {/* List verification table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-3xs overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <h4 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-1.5">
                <UserCheck size={18} className="text-amber-500 stroke-[2.5]" />
                排班明細核對對帳表
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black font-mono bg-amber-50 text-amber-850 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1 shrink-0 shadow-3xs">
                  ⚡ 已同步篩選：共 {tableAttendanceList.length} 筆
                </span>
              </div>
            </div>

            {/* 即時對帳表專屬篩選排序工具列 (僅保留搜尋) */}
            <div className="bg-neutral-50 px-5 py-3 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* 1. 即時文字關鍵字搜尋 */}
              <div className="relative w-full max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Search size={14} className="stroke-[2.5]" />
                </span>
                <input
                  type="text"
                  placeholder="在目前對帳表中，搜尋姓名、工地案場或施作備註..."
                  value={attendanceSearchQuery}
                  onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs md:text-sm font-bold text-neutral-900 placeholder-neutral-400 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all shadow-3xs"
                  id="direct-attendance-search-input"
                />
              </div>
              <div className="text-xs text-neutral-600 font-extrabold flex items-center gap-1.5 bg-neutral-105 px-3 py-1.5 rounded-lg border border-neutral-200">
                <span className="text-amber-500">💡</span>
                <span>考勤同仁、日期與排序，均已即時同步上方「工班時數校對與工資審查條件」控制台。</span>
              </div>
            </div>

            {/* Chips indicators */}
            {attendanceSearchQuery && (
              <div className="bg-amber-500/5 px-5 py-2.5 border-b border-neutral-200/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-800 font-bold">
                  <span className="bg-amber-500/10 text-amber-900 px-2.5 py-0.5 rounded-lg border border-amber-200/40 flex items-center gap-1">
                    <Filter size={12} />
                    <span>對帳表過濾已套用</span>
                  </span>
                  <span className="bg-white border border-neutral-200 text-neutral-900 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 font-bold shadow-3xs">
                    搜尋關鍵字: "{attendanceSearchQuery}"
                    <button onClick={() => setAttendanceSearchQuery('')} className="hover:text-red-700 font-black cursor-pointer font-sans text-xs shrink-0 self-center">×</button>
                  </span>
                </div>
                
                <button
                  onClick={() => {
                    setAttendanceSearchQuery('');
                  }}
                  className="text-xs text-amber-900 hover:text-amber-950 font-black cursor-pointer underline underline-offset-2 flex items-center gap-0.5 select-none"
                >
                  清除搜尋條件
                </button>
              </div>
            )}

            {tableAttendanceList.length === 0 ? (
              <p className="text-xs text-neutral-400 italic text-center py-10">此篩選條件下，無任何出勤派遣考勤對帳明細。</p>
            ) : (
              <div
                className="overflow-x-auto overflow-y-auto max-h-[520px] relative scroll-smooth scrollbar-thin scrollbar-thumb-neutral-200"
                onScroll={(e) => setTableScrollTop(e.currentTarget.scrollTop)}
                id="virtualized-attendance-table-container"
              >
                <table className="w-full text-left text-xs md:text-sm border-collapse relative">
                  <thead>
                    <tr className="border-b-2 border-neutral-300 text-xs text-neutral-900 font-black bg-neutral-100 sticky top-0 z-10 shadow-sm">
                      <th className="py-3 px-4 font-black bg-neutral-100 text-neutral-900">日期</th>
                      <th className="py-3 px-4 font-black bg-neutral-100 text-neutral-900">配合員工姓名</th>
                      <th className="py-3 px-4 font-black bg-neutral-100 text-neutral-900">施作工地/案場序號</th>
                      <th className="py-3 px-4 text-center font-black bg-neutral-100 text-neutral-900">當日派工時數</th>
                      <th className="py-3 px-4 text-center font-black bg-neutral-100 text-neutral-900">預設結算時薪</th>
                      <th className="py-3 px-4 text-right font-black bg-neutral-100 text-neutral-900">應核付工資金額</th>
                      <th className="py-3 px-4 font-black bg-neutral-100 text-neutral-900">當日交代要職與施作記述</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paddingTopHeight > 0 && (
                      <tr style={{ height: paddingTopHeight }} key="virtual-padding-top" className="border-0">
                        <td colSpan={7} className="p-0 border-0 pointer-events-none" />
                      </tr>
                    )}
                    {visibleTableItems.map(item => (
                      <tr key={item.id} className="border-b border-neutral-200 hover:bg-amber-500/5 transition-colors h-[76px] bg-white">
                        <td className="py-3.5 px-4 font-mono text-neutral-900 font-extrabold text-xs md:text-sm">{item.date}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-neutral-950 text-xs md:text-sm select-all">{item.name}</span>
                            {item.isSupport && (
                              <span className="text-[10px] bg-red-100 text-rose-700 border border-rose-300 px-2 py-0.5 rounded-lg font-black shrink-0 shadow-3xs">
                                臨時外調{item.supportRole ? ` • ${item.supportRole}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 select-all max-w-[320px] break-all" title={item.projectName}>
                          <span className="text-xs md:text-sm text-neutral-950 font-extrabold block font-mono bg-neutral-100 p-1.5 border border-neutral-300 rounded-lg leading-normal">
                            {item.projectName}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-black text-neutral-950">
                          <div className="flex flex-col items-center">
                            <span className="font-black text-neutral-950 text-xs md:text-sm">{item.hoursWork} 小時</span>
                            {(item.otFirstTwo + item.otAfterTwo) > 0 ? (
                              <span className="text-[10px] text-amber-800 font-extrabold bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md mt-1 whitespace-nowrap shadow-3xs">
                                正常 {item.regularHours}h + 加班 {(item.otFirstTwo + item.otAfterTwo).toFixed(1)}h
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-500 font-bold bg-neutral-50 border border-neutral-200 px-1.5 py-0.5 rounded-md mt-1">全正常時數 ({item.hoursWork}h)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-neutral-900 font-black text-xs md:text-sm bg-neutral-50/50">
                          ${item.hourlyRate} / h
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-900 bg-emerald-500/5">
                          <div className="flex flex-col items-end">
                            <span className="font-black text-xs md:text-sm text-emerald-700">${item.totalWage.toLocaleString()} 元</span>
                            <span className="text-[10px] font-black text-neutral-700 bg-neutral-150 border border-neutral-250 rounded px-1.5 py-0.5 mt-1 whitespace-nowrap scale-95 origin-right shadow-3xs">
                              正常(${Math.round(item.regularHours * item.hourlyRate).toLocaleString()})
                              { (item.otFirstTwo + item.otAfterTwo) > 0 ? ` + 加班(${Math.round((item.otFirstTwo + item.otAfterTwo) * item.hourlyRate * 1.34).toLocaleString()})` : '' }
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-neutral-800 text-xs md:text-sm max-w-[280px] break-words whitespace-normal select-all font-semibold" title={item.dailyNotes}>
                          {item.dailyNotes || <span className="text-neutral-400 italic">無特殊派遣施作記事</span>}
                        </td>
                      </tr>
                    ))}
                    {paddingBottomHeight > 0 && (
                      <tr style={{ height: paddingBottomHeight }} key="virtual-padding-bottom" className="border-0">
                        <td colSpan={7} className="p-0 border-0 pointer-events-none" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}


      {/* ---------------------------------------------------- */}
      {/* SECTION 5: WORKER ADVANCES AND LOANS MANAGEMENT */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'worker_advances' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Summary Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 text-white p-4.5 rounded-xl border border-slate-950 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-lg">
                <DollarSign size={20} />
              </div>
              <div className="font-sans">
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">累計預支借出總額</span>
                <span className="text-sm font-black font-mono text-red-400">
                  NT$ {workerAdvances.filter(a => a.type === 'borrow').reduce((sum, a) => sum + a.amount, 0).toLocaleString()} 元
                </span>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4.5 rounded-xl border border-slate-950 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Check size={20} />
              </div>
              <div className="font-sans">
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">同仁已扣還薪總額</span>
                <span className="text-sm font-black font-mono text-emerald-400">
                  NT$ {workerAdvances.filter(a => a.type === 'repay' || a.status === 'settled').reduce((sum, a) => sum + a.amount, 0).toLocaleString()} 元
                </span>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4.5 rounded-xl border border-slate-900 shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg">
                <Scale size={20} />
              </div>
              <div className="font-sans">
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">未沖抵同仁借款殘額 (待扣除)</span>
                <span className="text-sm font-black font-mono text-amber-500">
                  NT$ {Object.values(workerAdvancesSummary).reduce((s, v: any) => s + v.balance, 0).toLocaleString()} 元
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form for registering cash advances / loans */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-3xs h-fit space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                <Plus size={16} className="text-amber-500" />
                <h4 className="text-xs sm:text-sm font-black text-neutral-800">登記同仁預支與還款</h4>
              </div>

              <form onSubmit={handleCreateWorkerAdvance} className="space-y-3 text-[11px]">
                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    指定借貸/還款同仁 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={addAdvWorkerId}
                    onChange={(e) => setAddAdvWorkerId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-bold"
                    required
                  >
                    <option value="">-- 請選擇同仁 --</option>
                    {workersPreset.map(w => (
                      <option key={w.id} value={w.id}>👷 {w.name} {w.role ? `(${w.role})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-black text-neutral-600 mb-1">
                      記帳日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={addAdvDate}
                      onChange={(e) => setAddAdvDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-neutral-600 mb-1">
                      款項類型 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={addAdvType}
                      onChange={(e) => setAddAdvType(e.target.value as 'borrow' | 'repay')}
                      className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-bold"
                    >
                      <option value="borrow">💸 預支借款 / 工事借用</option>
                      <option value="repay">💵 領薪扣還 / 同仁還款</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    金額 (新台幣 NT) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="如: 1500"
                    value={addAdvAmount}
                    onChange={(e) => setAddAdvAmount(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs font-mono font-bold text-neutral-900 bg-amber-50/40"
                    required
                  />
                  {/* 快速加計金額按鈕 (水電工程現場極速輸入) */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[500, 1000, 2000, 3000, 5000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          const current = Number(addAdvAmount) || 0;
                          setAddAdvAmount(current + val);
                        }}
                        className="text-[9px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-md font-extrabold transition cursor-pointer"
                      >
                        +{val.toLocaleString()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAddAdvAmount('')}
                      className="text-[9px] bg-rose-50 hover:bg-rose-100 text-rose-600 px-2 py-0.5 rounded-md font-bold transition cursor-pointer"
                    >
                      重置
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    備註事由說明 (推薦說明)
                  </label>
                  <textarea
                    placeholder="如: 團體團購特種防爆五金工具、預支私人生活支借等事由。"
                    value={addAdvDescription}
                    onChange={(e) => setAddAdvDescription(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs h-18 resize-none bg-white text-neutral-800 font-medium"
                  />
                  {/* 快速事由事由快捷標籤 (免打字極速選取) */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(addAdvType === 'borrow'
                      ? ['生活急需支借', '購買電動工具代墊', '中途預支車馬費', '工事現場代墊']
                      : ['薪資轉帳代扣償還', '同仁現場繳還現金', '材料退回款項扣抵']
                    ).map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAddAdvDescription(preset)}
                        className="text-[9px] bg-amber-50 hover:bg-amber-100 text-amber-850 hover:border-amber-400 px-1.5 py-0.5 rounded border border-amber-200/50 font-bold transition cursor-pointer"
                      >
                        📌 {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check size={14} className="stroke-[2.5]" />
                  安全確認登記送出
                </button>
              </form>
            </div>

            {/* List / Table of raw advances */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-3xs overflow-hidden lg:col-span-2 space-y-4">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-black text-neutral-800 flex items-center gap-1.5">
                  <DollarSign size={16} className="text-rose-500" />
                  預支借貸與還薪沖扣明細流水簿 (工班借支往來)
                </h4>
                <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded font-bold">
                  共 {workerAdvances.length} 筆明細往來
                </span>
              </div>

              {workerAdvances.length === 0 ? (
                <div className="text-center py-12 italic text-neutral-400 text-xs">
                  目前尚無任何預支借款與還薪扣抵明細。
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-neutral-50 text-neutral-500 uppercase tracking-wider text-[10px] font-bold border-b border-neutral-200">
                        <th className="py-2.5 px-4">對帳日期</th>
                        <th className="py-2.5 px-4">同仁姓名</th>
                        <th className="py-2.5 px-4">款項性質</th>
                        <th className="py-2.5 px-4 text-right">交易金額</th>
                        <th className="py-2.5 px-4">事由備份</th>
                        <th className="py-2.5 px-4">財務核銷狀態</th>
                        <th className="py-2.5 px-4 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-150">
                      {workerAdvances.map(adv => (
                        <tr key={adv.id} className="hover:bg-neutral-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-neutral-600 whitespace-nowrap">{adv.date}</td>
                          <td className="py-3 px-4 font-black text-neutral-800 whitespace-nowrap">{adv.workerName}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {adv.type === 'borrow' ? (
                              <span className="text-red-700 font-extrabold bg-red-100/60 px-2 py-0.5 rounded text-[10px]">
                                💸 預支借用
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-extrabold bg-emerald-100/60 px-2 py-0.5 rounded text-[10px]">
                                💵 薪資扣還
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-extrabold text-neutral-950 text-xs whitespace-nowrap">
                            ${adv.amount.toLocaleString()} 元
                          </td>
                          <td className="py-3 px-4 text-neutral-500 max-w-[150px] truncate" title={adv.description}>
                            {adv.description}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {adv.status === 'settled' ? (
                              <button
                                onClick={() => toggleAdvanceStatus(adv.id)}
                                className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition text-[9px] cursor-pointer"
                              >
                                ● 已抵扣核銷完結
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleAdvanceStatus(adv.id)}
                                className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-full hover:bg-amber-100 transition text-[9px] cursor-pointer"
                                title="點擊快速變更為已算薪抵扣完成"
                              >
                                ● 待薪資扣除沖抵
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteWorkerAdvance(adv.id)}
                              className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer"
                              title="刪除紀錄"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SECTION 6: PETTY CASH MANAGEMENT (COINS) */}
      {/* ---------------------------------------------------- */}
      {activeSubTab === 'petty_cash' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Outflow / Inflow Summary Gauge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-950 text-white p-4.5 rounded-xl shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-amber-550/10 text-amber-400 rounded-lg">
                <Coins size={20} />
              </div>
              <div className="font-sans">
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">累計撥入零用公基金</span>
                <span className="text-sm font-black font-mono text-amber-300">
                  NT$ {pettyCashSummary.totalInflow.toLocaleString()} 元
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-950 text-white p-4.5 rounded-xl shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-lg">
                <Plus size={20} className="rotate-45" />
              </div>
              <div className="font-sans">
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">累計車用耗材落帳支出</span>
                <span className="text-sm font-black font-mono text-red-400">
                  NT$ {pettyCashSummary.totalOutflow.toLocaleString()} 元
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-950 text-white p-4.5 rounded-xl shadow-3xs flex items-center gap-3.5">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Wallet size={20} />
              </div>
              <div className="font-sans">
                <span className="block text-[10px] font-bold text-slate-400 mb-0.5">當前車載公用金水位餘額</span>
                <span className={`text-sm font-black font-mono ${
                  pettyCashSummary.currentBalance < 1000 ? 'text-red-400 animate-pulse font-black' : 'text-emerald-400 font-extrabold'
                }`}>
                  NT$ {pettyCashSummary.currentBalance.toLocaleString()} 元 {pettyCashSummary.currentBalance < 1000 && '⚠️ 水位低'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create new petty cash ledger */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-3xs h-fit space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                <Plus size={16} className="text-amber-500" />
                <h4 className="text-xs sm:text-sm font-black text-neutral-800">登記零用金撥補或現場開銷</h4>
              </div>

              <form onSubmit={handleCreatePettyCashTransaction} className="space-y-3 text-[11px]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-black text-neutral-600 mb-1">
                      異動登記日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={addPcDate}
                      onChange={(e) => setAddPcDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-neutral-600 mb-1">
                      資金異動方向 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={addPcType}
                      onChange={(e) => {
                        const val = e.target.value as 'income' | 'expense';
                        setAddPcType(val);
                        if (val === 'income') setAddPcCategory('fund_in');
                        else setAddPcCategory('feed');
                      }}
                      className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-850 font-bold"
                    >
                      <option value="expense">📉 現場雜支（零用支出）</option>
                      <option value="income">📈 公金提撥（基金存入）</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-black text-neutral-600 mb-1">
                      實動金額 (NTD) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="如: 300"
                      value={addPcAmount}
                      onChange={(e) => setAddPcAmount(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs font-mono font-bold bg-amber-50/40 text-neutral-900"
                      required
                    />
                    {/* 快速金額累加器 */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[100, 200, 500, 1000, 2000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            const current = Number(addPcAmount) || 0;
                            setAddPcAmount(current + val);
                          }}
                          className="text-[9px] bg-neutral-105 hover:bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded transition cursor-pointer"
                        >
                          +{val}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAddPcAmount('')}
                        className="text-[9px] bg-rose-50 hover:bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded transition cursor-pointer font-bold"
                      >
                        重置
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-neutral-600 mb-1">
                      對應細帳分類
                    </label>
                    {addPcType === 'income' ? (
                      <select
                        value="fund_in"
                        disabled
                        className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-neutral-100 text-neutral-500 cursor-not-allowed font-semibold"
                      >
                        <option value="fund_in">領補公用預存基金 📥</option>
                      </select>
                    ) : (
                      <select
                        value={addPcCategory}
                        onChange={(e) => setAddPcCategory(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-850 font-bold"
                      >
                        <option value="feed">🍱 現場消暑伙食茶飲</option>
                        <option value="tool">🔨 臨採急用五金零配件</option>
                        <option value="parking">🚗 工事路邊收費停車費</option>
                        <option value="fuel">⛽ 工程貨車油資採購</option>
                        <option value="other">💬 其他急採現場開支</option>
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    經手同仁姓名 / 出納
                  </label>
                  <input
                    type="text"
                    placeholder="如: 林冠宇、陳建志等"
                    value={addPcPayer}
                    onChange={(e) => setAddPcPayer(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-bold"
                  />
                  {/* 可快速點擊代入當前同仁 */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {workersPreset.slice(0, 5).map(w => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setAddPcPayer(w.name)}
                        className="text-[9px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded transition cursor-pointer"
                      >
                        👷 {w.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    關聯工事案場 (非必填，填寫便於精算特定案場雜費)
                  </label>
                  <select
                    value={addPcProjId}
                    onChange={(e) => setAddPcProjId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-medium"
                  >
                    <option value="">-- 無特定工地 / 公司全公用 --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{getProjectDisplayName(p)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    細項摘要與材料規格描述 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="如: 新店現場師傅午後加購沙士3罐、南亞水管膠1罐"
                    value={addPcDescription}
                    onChange={(e) => setAddPcDescription(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white text-neutral-800 font-medium"
                    required
                  />
                  {/* 動態智慧事由預設標籤 */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {addPcType === 'income' ? (
                      ['撥補公用金新台幣備用', '銀行提領現金入公金袋', '負責人代付存入營運']
                    ) : (
                      addPcCategory === 'feed' ? ['購買冰品飲料消暑', '午餐買便當配餐', '午後點心/咖啡']
                      : addPcCategory === 'tool' ? ['買止洩帶與塑膠硬油', '五金行補螺絲零件', '購置臨時鋸片/鑽尾']
                      : addPcCategory === 'parking' ? ['工事路邊繳納停車費', '工地臨時停車卡計費']
                      : addPcCategory === 'fuel' ? ['公司工程貨車加柴油', '機車臨時跑件加汽油']
                      : ['現場垃圾清理代墊費', '雜頂零星行政零用金支出']
                    ).map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setAddPcDescription(item)}
                        className="text-[9px] bg-amber-50 hover:bg-amber-100 text-amber-850 hover:border-amber-400 px-1.5 py-0.5 rounded border border-amber-200/50 font-bold transition cursor-pointer"
                      >
                        ⚡ {item}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check size={14} className="stroke-[2.5]" />
                  安全核實登錄公金帳
                </button>
              </form>
            </div>

            {/* List Table of Petty cash details */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-3xs overflow-hidden lg:col-span-2 space-y-4">
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-black text-neutral-800 flex items-center gap-1.5 font-sans">
                  <Wallet size={16} className="text-amber-500" />
                  手備零用金與公基金收支帳目往來登記
                </h4>
                <span className="text-[10px] font-mono bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded font-bold">
                  共 {pettyCashTransactions.length} 筆帳目明細
                </span>
              </div>

              {pettyCashTransactions.length === 0 ? (
                <div className="text-center py-12 italic text-neutral-400 text-xs">
                  目前零用金出入記錄中尚無數據。
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-neutral-50 text-neutral-500 uppercase tracking-wider text-[10px] font-bold border-b border-neutral-200">
                        <th className="py-2.5 px-4">對帳日期</th>
                        <th className="py-2.5 px-4">主分類</th>
                        <th className="py-2.5 px-4 font-bold text-right border-r border-neutral-100">金額流動</th>
                        <th className="py-2.5 px-4">交易名目規格敘事</th>
                        <th className="py-2.5 px-4">經手同仁</th>
                        <th className="py-2.5 px-4">歸屬特定工地</th>
                        <th className="py-2.5 px-4 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-150">
                      {pettyCashTransactions.map(t => {
                        const relProj = projects.find(p => p.id === t.projectNameOrId);
                        const relProjName = relProj ? (relProj.addressAbbreviated || relProj.companyOrOwner) : '🚚 貨車公備';
                        
                        return (
                          <tr key={t.id} className="hover:bg-neutral-50/50">
                            <td className="py-3 px-4 font-mono font-bold text-neutral-600 whitespace-nowrap">{t.date}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {t.type === 'income' ? (
                                <span className="text-emerald-700 bg-emerald-100 font-extrabold px-2 py-0.5 rounded text-[10px]">
                                  📥 存入公金
                                </span>
                              ) : (
                                <span className="text-red-700 bg-red-100 font-extrabold px-2 py-0.5 rounded text-[10px]">
                                  {t.category === 'feed' ? '🍱 伙食涼水' :
                                   t.category === 'tool' ? '🔨 臨採五金' :
                                   t.category === 'parking' ? '🚗 停車代墊' :
                                   t.category === 'fuel' ? '⛽ 車用油資' : '💬 其它雜支'}
                                </span>
                              )}
                            </td>
                            <td className={`py-3 px-4 text-right font-mono font-extrabold text-xs border-r border-neutral-100 whitespace-nowrap ${
                              t.type === 'income' ? 'text-emerald-600 font-black' : 'text-neutral-900'
                            }`}>
                              {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()} 元
                            </td>
                            <td className="py-3 px-4 text-neutral-700 font-medium max-w-[170px] truncate" title={t.description}>
                              {t.description}
                            </td>
                            <td className="py-3 px-4 text-neutral-600 font-extrabold whitespace-nowrap">{t.payerName || <span className="text-neutral-300">系統提撥</span>}</td>
                            <td className="py-3 px-4 text-xs font-semibold text-neutral-500 max-w-[120px] truncate whitespace-nowrap" title={relProj ? getProjectDisplayName(relProj) : ''}>
                              {relProjName}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleDeletePettyCashTransaction(t.id)}
                                className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer transition"
                                title="移除帳目"
                              >
                                <Trash2 size={12} />
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
        </div>
      )}


      {/* ---------------------------------------------------- */}
      {/* ADD PAYMENT MODAL WITH SIMPLIFIED OPTIONS */}
      {/* ---------------------------------------------------- */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[95vh] flex flex-col border border-neutral-200">
            
            {/* Modal header */}
            <div className="bg-neutral-900 text-white px-5 py-4 flex items-center justify-between border-b border-neutral-950 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-slate-950">
                  <Landmark size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black">登錄客戶實收水電工程款項</h3>
                  <p className="text-[10px] text-neutral-400 mt-0.5">錄款入帳沖鎖與多工程拆帳自動化</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPaymentModal(false)}
                className="w-6 h-6 rounded-full hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal forms body */}
            <form onSubmit={handleAddNewPaymentSimplified} className="p-5 space-y-4 overflow-y-auto">
              
              {/* Select Customer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    配合客戶商戶 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={payCustId}
                    onChange={(e) => {
                      setPayCustId(e.target.value);
                      setPayTargetProjId(''); // Reset project on customer switch
                      setMultiAllocSplits({});
                    }}
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 font-bold"
                    required
                  >
                    <option value="">-- 請選定繳款配合戶 --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>👤 {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    入帳收款日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs font-bold"
                    required
                  />
                </div>
              </div>

              {/* Amount and Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    實收繳款金額 (新台幣 NT) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="例如: 35000"
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs font-mono font-bold text-neutral-900 bg-amber-50"
                    required
                  />
                  {/* 快速金額加成按鈕 */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[10000, 30000, 50000, 100000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          const current = payAmount || 0;
                          setPayAmount(current + val);
                        }}
                        className="text-[9px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded font-extrabold transition cursor-pointer"
                      >
                        +{val >= 10000 ? `${val/10000}萬` : val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPayAmount(0)}
                      className="text-[9px] bg-rose-50 hover:bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded transition cursor-pointer font-bold"
                    >
                      重置
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-neutral-600 mb-1">
                    入網金流管道
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800"
                  >
                    <option value="銀行轉帳">⚡ 配合銀行虛擬代收 / 網銀轉帳</option>
                    <option value="工務現場收取(現金)">💵 工務直接收取 (現金袋)</option>
                    <option value="客戶交付本票支票">🎫 交付支票本票 / 期票</option>
                    <option value="材料代採退佣內扣">🔄 上游材料退佣內扣折抵</option>
                    <option value="其它抵算折扣">💬 其它折算 / 口頭特例折扣</option>
                  </select>
                </div>
              </div>


              {/* ======================================================== */}
              {/* SIMPLIFIED SCHEMES - STREAMLINED TO THREE INTUITIVE CATEGORIES */}
              {/* ======================================================== */}
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/80 space-y-2.5">
                <span className="block text-xs font-black text-neutral-750">
                  🧬 選擇沖帳目的分配選項（已精簡）：
                </span>

                <div className="grid grid-cols-3 gap-1.5">
                  <label className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center cursor-pointer transition ${
                    simplifiedAllocType === 'single' 
                      ? 'bg-amber-100/50 border-amber-500 text-amber-900' 
                      : 'bg-white border-neutral-200 hover:border-amber-300 text-neutral-600'
                  }`}>
                    <input
                      type="radio"
                      name="simpleAlloc"
                      checked={simplifiedAllocType === 'single'}
                      onChange={() => setSimplifiedAllocType('single')}
                      className="sr-only"
                    />
                    <span className="text-[14px]">🎯</span>
                    <span className="text-[10px] font-bold mt-1">單一案場沖抵</span>
                  </label>

                  <label className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center cursor-pointer transition ${
                    simplifiedAllocType === 'pool' 
                      ? 'bg-amber-100/50 border-amber-500 text-amber-900' 
                      : 'bg-white border-neutral-200 hover:border-amber-300 text-neutral-600'
                  }`}>
                    <input
                      type="radio"
                      name="simpleAlloc"
                      checked={simplifiedAllocType === 'pool'}
                      onChange={() => setSimplifiedAllocType('pool')}
                      className="sr-only"
                    />
                    <span className="text-[14px]">🏦</span>
                    <span className="text-[10px] font-bold mt-1">預收或自動沖舊</span>
                  </label>

                  <label className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center cursor-pointer transition ${
                    simplifiedAllocType === 'multi' 
                      ? 'bg-amber-100/50 border-amber-500 text-amber-900' 
                      : 'bg-white border-neutral-200 hover:border-amber-300 text-neutral-600'
                  }`}>
                    <input
                      type="radio"
                      name="simpleAlloc"
                      checked={simplifiedAllocType === 'multi'}
                      onChange={() => setSimplifiedAllocType('multi')}
                      className="sr-only"
                    />
                    <span className="text-[14px]">📦</span>
                    <span className="text-[10px] font-bold mt-1">手動多案拆帳</span>
                  </label>
                </div>


                {/* 1. DYNAMIC SECONDARY FIELDS FOR SINGLE */}
                {simplifiedAllocType === 'single' && (
                  <div className="space-y-3 pt-1 border-t border-neutral-200/50">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-500 mb-1">
                        指定繳款沖銷之工地案場 <span className="text-red-500">*</span>
                      </label>
                      {targetCustomerProjects.length === 0 ? (
                        <p className="text-[10px] text-red-500 font-bold italic">該配合客名下目前無任何登載案場！請改存預收款池。</p>
                      ) : (
                        <select
                          value={payTargetProjId}
                          onChange={(e) => setPayTargetProjId(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs bg-white text-neutral-800 font-bold"
                          required={simplifiedAllocType === 'single'}
                        >
                          <option value="">-- 請選擇指定工地 --</option>
                          {targetCustomerProjects.map(p => {
                            const sum = projectSummaries[p.id];
                            const unpaid = sum ? sum.outstandingBalance : 0;
                            return (
                              <option key={p.id} value={p.id}>
                                {getProjectDisplayName(p)} (未結欠款: ${unpaid.toLocaleString()}元)
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>

                    {/* Sub modes under single */}
                    <div>
                      <label className="block text-[10px] font-black text-neutral-500 mb-1">沖抵特定案場屬性子選項：</label>
                      <div className="grid grid-cols-3 gap-2">
                        <label className={`flex items-center gap-1.5 p-1.5 bg-white rounded border cursor-pointer text-[10px] hover:border-amber-400 ${
                          singleAllocSubMode === 'normal' ? 'border-amber-500 bg-amber-50/20' : 'border-neutral-200'
                        }`}>
                          <input
                            type="radio"
                            name="singleSub"
                            checked={singleAllocSubMode === 'normal'}
                            onChange={() => setSingleAllocSubMode('normal')}
                            className="sr-only"
                          />
                          <span>💵 工程標準款</span>
                        </label>

                        <label className={`flex items-center gap-1.5 p-1.5 bg-white rounded border cursor-pointer text-[10px] hover:border-amber-400 ${
                          singleAllocSubMode === 'advance' ? 'border-amber-500 bg-amber-50/20' : 'border-neutral-200'
                        }`}>
                          <input
                            type="radio"
                            name="singleSub"
                            checked={singleAllocSubMode === 'advance'}
                            onChange={() => setSingleAllocSubMode('advance')}
                            className="sr-only"
                          />
                          <span>🎬 開工保證金/訂金</span>
                        </label>

                        <label className={`flex items-center gap-1.5 p-1.5 bg-white rounded border cursor-pointer text-[10px] hover:border-amber-400 ${
                          singleAllocSubMode === 'rounding' ? 'border-amber-500 bg-amber-50/20' : 'border-neutral-200'
                        }`}>
                          <input
                            type="radio"
                            name="singleSub"
                            checked={singleAllocSubMode === 'rounding'}
                            onChange={() => setSingleAllocSubMode('rounding')}
                            className="sr-only"
                          />
                          <span>🔩 去尾抹零特調</span>
                        </label>
                      </div>
                    </div>

                    {/* Part/Stage of Partial Payments Indicator */}
                    {singleAllocSubMode === 'normal' && (
                      <div className="p-2.5 bg-amber-50/20 rounded-lg border border-dashed border-amber-250 animate-fadeIn space-y-1">
                        <label className="block text-[10px] font-black text-amber-900 mb-0.5">
                          📊 部分收款 / 階段期款 (Stage Payment) 軌跡標記：
                        </label>
                        <select
                          value={payStage}
                          onChange={(e) => setPayStage(e.target.value)}
                          className="w-full px-2 py-1 border border-neutral-300 rounded text-xs bg-white text-neutral-850 font-bold"
                        >
                          <option value="一般單次/實收工程款">💵 一般單次 / 實收工程進度款</option>
                          <option value="第一期款 (簽約訂金)">🥇 第一期 : 簽約與定金期款</option>
                          <option value="第二期款 (施工開工款)">🥈 第二期 : 工程開工進場款</option>
                          <option value="第三期款 (階段進度款)">🥉 第三期 : 工程中段進度款</option>
                          <option value="第四期款 (尾款與驗收款)">🏆 第四期 : 尾款與驗收結案款</option>
                          <option value="其他分期收款">💬 其他自訂分期部分收款</option>
                        </select>
                        <p className="text-[9px] text-neutral-400 leading-normal">
                          此標記會登錄在本筆收款之「期款軌跡」中，便於案場對帳核對。
                        </p>
                      </div>
                    )}
                  </div>
                )}


                {/* 2. DYNAMIC SECONDARY FIELDS FOR PREPAYMENTS POOL */}
                {simplifiedAllocType === 'pool' && (
                  <div className="space-y-3 pt-1 border-t border-neutral-200/50">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-500 mb-1">
                        存入/折銷模式指定：
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-start gap-2 p-2 bg-white rounded-lg border border-neutral-200 hover:border-amber-300 cursor-pointer">
                          <input
                            type="radio"
                            name="poolSub"
                            checked={poolAllocSubMode === 'pool_store'}
                            onChange={() => setPoolAllocSubMode('pool_store')}
                            className="mt-0.5 text-amber-600 focus:ring-amber-500 shrink-0"
                          />
                          <div className="text-[11px] leading-tight">
                            <span className="font-bold text-neutral-800 block">儲存至客戶預收款帳戶 (備用合扣)</span>
                            <span className="text-neutral-400 text-[10px]">款項不限案子，將存入此配合戶的溢領餘額中，未來隨時手工指定抵扣。</span>
                          </div>
                        </label>

                        <label className="flex items-start gap-2 p-2 bg-white rounded-lg border border-neutral-200 hover:border-amber-300 cursor-pointer">
                          <input
                            type="radio"
                            name="poolSub"
                            checked={poolAllocSubMode === 'old_debt_auto'}
                            onChange={() => setPoolAllocSubMode('old_debt_auto')}
                            className="mt-0.5 text-amber-600 focus:ring-amber-500 shrink-0"
                          />
                          <div className="text-[11px] leading-tight">
                            <span className="font-bold text-neutral-800 block">由系統優先自動沖銷最舊欠款</span>
                            <span className="text-neutral-400 text-[10px]">自動按照工程流水開案順序，由舊到新優先折抵此客戶名下的未繳欠款案，溢收部分仍自動存入預收池。</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}


                {/* 3. DYNAMIC MULTI PROJECT MANUAL SPLIT */}
                {simplifiedAllocType === 'multi' && (
                  <div className="space-y-2 pt-1 border-t border-neutral-200/50">
                    <span className="text-[10px] font-bold text-amber-950 block">手動指定金額分配給各個工地 (實收: ${payAmount.toLocaleString()})</span>
                    
                    {targetCustomerProjects.length === 0 ? (
                      <p className="text-[10px] text-neutral-400 italic">該配合客戶名下目前尚未開立任何案場工程。</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {targetCustomerProjects.map(p => {
                          const unpaid = projectSummaries[p.id]?.outstandingBalance || 0;
                          const alloc = multiAllocSplits[p.id] || 0;
                          return (
                            <div key={p.id} className="flex items-center justify-between gap-2 text-[10px] bg-white p-1.5 rounded border border-neutral-200">
                              <span className="font-bold text-neutral-700 truncate max-w-[220px]" title={getProjectDisplayName(p)}>
                                {getProjectDisplayName(p)}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="text-neutral-400">未結: ${unpaid} | 分配:</span>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={alloc || ''}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseInt(e.target.value) || 0);
                                    setMultiAllocSplits(prev => ({ ...prev, [p.id]: val }));
                                  }}
                                  className="w-16 border rounded text-center py-0.5 font-bold font-mono px-0.5"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] text-neutral-500 font-bold border-t pt-1.5">
                      <span>已分配金額小計：</span>
                      <span className="font-mono bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                        ${(Object.values(multiAllocSplits) as number[]).reduce((s, v) => s + v, 0).toLocaleString()} 元
                      </span>
                    </div>
                  </div>
                )}

              </div>


              {/* Core Description Remark */}
              <div>
                <label className="block text-[11px] font-black text-neutral-600 mb-1">
                  帳務核銷日誌描述備忘 (選填)
                </label>
                <input
                  type="text"
                  placeholder="如: 張慶祥中山自宅訂金、去尾不找零累計、退佣抵扣等"
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-xs"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-xs font-bold cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black shadow flex items-center gap-1 cursor-pointer"
                >
                  <Check size={14} className="stroke-[2.5]" />
                  安全核實記帳入帳
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Custom Elegant Confirm Dialog */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-neutral-100 p-6 transform scale-100 transition-all">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-full mt-0.5">
                <AlertCircle size={22} className="stroke-[2]" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-neutral-950">{confirmModal.title}</h3>
                <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed font-medium">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex justify-end items-center gap-2.5 border-t border-neutral-100 pt-4">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black shadow transition cursor-pointer"
              >
                確認執行
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
