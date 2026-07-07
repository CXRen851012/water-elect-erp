import React, { useState, useEffect, useRef } from 'react';
import { Project, Worker, MaterialPreset, DailyRecord, Customer, Supplier, PaymentTransaction, WorkerAdvance, PettyCashTransaction } from './types';
import { DEFAULT_WORKERS, DEFAULT_MATERIALS, DEFAULT_SUPPLIERS } from './data';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, TrendingUp, Plus, Landmark, Users,
  Check, Info, FileSpreadsheet, Sparkles, Building2, Calendar, HardHat,
  ShoppingBag, FolderLock, Store, Coins, History,
  Database, AlertTriangle, Download, Upload, Trash2, Settings, ShieldAlert,
  Cloud, CloudOff, RefreshCw, LogOut, LogIn, Search, ArrowUpDown, SlidersHorizontal, Clock
} from 'lucide-react';

import { onAuthStateChanged } from 'firebase/auth';
import { auth, recordTombstone } from './firebase';

import ProjectForm from './components/ProjectForm';
import RecordForm from './components/RecordForm';
import CustomerPanel from './components/CustomerPanel';
import WorkersPanel from './components/WorkersPanel';
import MaterialsPanel from './components/MaterialsPanel';
import ProjectsPanel from './components/ProjectsPanel';
import SuppliersPanel from './components/SuppliersPanel';
import BillingPanel from './components/BillingPanel';
import FirebaseSyncPanel from './components/FirebaseSyncPanel';
import BookingForm from './components/BookingForm';
import BookingsPanel from './components/BookingsPanel';

export default function App() {
  // ---- 1. Initialize State with Local Storage fallback ----
  const bypassTrackingRef = useRef(false);

  // Helper function to track insertions, modifications, and deletions for incremental sync with tombstones
  function trackStateChanges<T extends { id: string; updatedAt?: string }>(
    prev: T[],
    next: T[],
    collectionName: string
  ): T[] {
    if (bypassTrackingRef.current) return next;
    if (prev === next) return prev;

    const prevMap = new Map<string, T>(prev.map(item => [item.id, item]));
    const nextIds = new Set<string>(next.map(item => item.id));

    // 1. Detect deletions and write to local tombstones
    prev.forEach(item => {
      if (!nextIds.has(item.id)) {
        recordTombstone(collectionName, item.id);
      }
    });

    // 2. Detect additions and modifications, updating updatedAt timestamps
    const nowStr = new Date().toISOString();
    let changed = prev.length !== next.length;

    const updatedList = next.map(nextItem => {
      const prevItem = prevMap.get(nextItem.id);
      if (!prevItem) {
        changed = true;
        return { ...nextItem, updatedAt: nowStr };
      } else {
        const cleanCompare = (obj: any) => {
          if (!obj) return '';
          const copy = { ...obj };
          delete copy.updatedAt;
          return JSON.stringify(copy);
        };

        if (cleanCompare(prevItem) !== cleanCompare(nextItem)) {
          changed = true;
          return { ...nextItem, updatedAt: nowStr };
        }
        return prevItem; // preserve reference
      }
    });

    return changed ? updatedList : prev;
  }
  
  // Existing Workers List
  const [workers, setRawWorkers] = useState<Worker[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_workers');
      return stored ? JSON.parse(stored) : DEFAULT_WORKERS;
    } catch {
      return DEFAULT_WORKERS;
    }
  });
  const setWorkers = (val: React.SetStateAction<Worker[]>) => {
    setRawWorkers(prev => trackStateChanges(prev, typeof val === 'function' ? (val as any)(prev) : val, 'workers'));
  };

  // Material Suppliers Directory
  const [suppliers, setRawSuppliers] = useState<Supplier[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_suppliers');
      return stored ? JSON.parse(stored) : DEFAULT_SUPPLIERS;
    } catch {
      return DEFAULT_SUPPLIERS;
    }
  });
  const setSuppliers = (val: React.SetStateAction<Supplier[]>) => {
    setRawSuppliers(prev => trackStateChanges(prev, typeof val === 'function' ? (val as any)(prev) : val, 'suppliers'));
  };

  // Material Templates
  const [materials, setRawMaterials] = useState<MaterialPreset[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_materials');
      return stored ? JSON.parse(stored) : DEFAULT_MATERIALS;
    } catch {
      return DEFAULT_MATERIALS;
    }
  });
  const setMaterials = (val: React.SetStateAction<MaterialPreset[]>) => {
    setRawMaterials(prev => trackStateChanges(prev, typeof val === 'function' ? (val as any)(prev) : val, 'materials'));
  };

  // New persistent Customers address list
  const [customers, setRawCustomers] = useState<Customer[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_customers');
      if (stored) {
        const parsed = JSON.parse(stored) as any[];
        return parsed.map(c => {
          // Dynamic migration from old string[] addresses to CustomerAddress[]
          const updatedAddresses = (c.addresses || []).map((addr: any, idx: number) => {
            if (typeof addr === 'string') {
              return {
                id: `addr-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
                fullAddress: addr,
                addressAbbreviated: '',
                contactPerson: c.contactPerson || '',
                contactPhone: c.phone || '',
                addressNotes: ''
              };
            }
            return addr;
          });
          return {
            ...c,
            addresses: updatedAddresses
          };
        });
      }
      
      // Standalone starters matching initial demo projects
      return [
        {
          id: 'cust-initial-1',
          name: '合悅室內設計',
          contactPerson: '陳主任',
          phone: '0912-345678',
          notes: '北部老牌大公司，付款一律月結。注意施工作業安全規範。',
          addresses: [
            {
              id: 'addr-init-1-1',
              fullAddress: '新北市新店區北新路三段88號',
              addressAbbreviated: '新店官邸',
              contactPerson: '陳主任',
              contactPhone: '0912-345678',
              addressNotes: '現場主管要求管路完工時粉筆記號完好，並拍照留底。環境需每日清掃。'
            },
            {
              id: 'addr-init-1-2',
              fullAddress: '台北市信義區信義路五段7號',
              addressAbbreviated: '合悅信義店',
              contactPerson: '李協理',
              contactPhone: '0933-222111',
              addressNotes: '台北101商辦改修。夜間八點過後方可施作音波大之切孔或鑽牆，每日收工需覆膜保護完工建材。'
            }
          ]
        },
        {
          id: 'cust-initial-2',
          name: '張慶祥先生',
          contactPerson: '本人',
          phone: '0988-777666',
          notes: '業主先生自身對工法要求極高，付款阿莎力但作工需細。',
          addresses: [
            {
              id: 'addr-init-2-1',
              fullAddress: '台北市中山區吉林路200號5樓',
              addressAbbreviated: '中山吉林自宅',
              contactPerson: '張慶祥先生',
              contactPhone: '0988-777666',
              addressNotes: '老屋翻修。冷熱水明暗管均需完備保溫防止冷凝水結露。周末禁大噪音。'
            }
          ]
        }
      ];
    } catch {
      return [];
    }
  });
  const setCustomers = (val: React.SetStateAction<Customer[]>) => {
    setRawCustomers(prev => trackStateChanges(prev, typeof val === 'function' ? (val as any)(prev) : val, 'customers'));
  };

  // Projects / Sites Management
  const [projects, setRawProjects] = useState<Project[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_projects');
      if (stored) {
        return JSON.parse(stored);
      }
      
      // Init starter projects (Proper client bindings)
      return [
        {
          id: 'proj-initial-1',
          clientId: 'cust-initial-1',
          serialNumber: '202605-001',
          companyOrOwner: '合悅室內設計',
          contactPerson: '陳主任',
          addressAbbreviated: '新店官邸',
          fullAddress: '新北市新店區北新路三段88號',
          contactPhone: '0912-345678',
          projectNotes: '現場管路需做防爆隔音處理',
          generatedName: '20260526-合悅室內設計-陳主任-新店官邸-新北市新店區北新路三段88號-202605-001',
          isCompleted: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'proj-initial-2',
          clientId: 'cust-initial-2',
          serialNumber: '202605-002',
          companyOrOwner: '張慶祥先生',
          contactPerson: '本人',
          addressAbbreviated: '中山雅居',
          fullAddress: '台北市中山區吉林路200號5樓',
          contactPhone: '0988-777666',
          projectNotes: '週末禁止搬運，避免大樓主委阻擋',
          generatedName: '20260526-張慶祥先生-本人-中山雅居-台北市中山區吉林路200號5樓-202605-002',
          isCompleted: false,
          createdAt: new Date().toISOString()
        }
      ];
    } catch {
      return [];
    }
  });
  const setProjects = (val: React.SetStateAction<Project[]>) => {
    setRawProjects(prev => trackStateChanges(prev, typeof val === 'function' ? (val as any)(prev) : val, 'projects'));
  };

  // Daily Engineering Records
  const [records, setRawRecords] = useState<DailyRecord[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_records');
      if (stored) {
        return JSON.parse(stored);
      }

      // Starter daily records mapping the demo project
      const today = new Date().toISOString().substring(0, 10);
      return [
        {
          id: 'rec-1',
          date: today,
          projectId: 'proj-initial-1',
          projectName: '20260526-合悅室內設計-陳主任-新店官邸-新北市新店區北新路三段88號-202605-001',
          materials: [
            { name: '1英吋 PVC 南亞管', quantity: 4, unit: '支', unitPrice: 180, isNearbyPurchased: false },
            { name: '止洩帶 (貼布西魯)', quantity: 2, unit: '個', unitPrice: 15, isNearbyPurchased: false }
          ],
          expenses: [
            { id: 'exp-init-1', type: 'parking', description: '新店路邊收費停車格', amount: 160 },
            { id: 'exp-init-2', type: 'meal', description: '排骨便當4個加飲料', amount: 480 }
          ],
          workers: [
            { id: 'rw-1', workerId: 'w-1', name: '陳建志', hoursWork: 8, hourlyRate: 400, isSupport: false },
            { id: 'rw-2', workerId: 'w-2', name: '林冠宇', hoursWork: 8, hourlyRate: 280, isSupport: false }
          ],
          notes: '本日完成浴室冷熱水管打石與配管作業，並施作管路加壓試漏測試，穩壓檢驗一切安全合格。明日預定進行水泥填平。',
          markAsCompleted: false,
          createdAt: new Date().toISOString()
        }
      ];
    } catch {
      return [];
    }
  });
  const setRecords = (val: React.SetStateAction<DailyRecord[]>) => {
    setRawRecords(prev => trackStateChanges(prev, typeof val === 'function' ? (val as any)(prev) : val, 'records'));
  };

  const getWorkerTotalHoursForDate = (workerName: string, dateStr: string) => {
    return records
      .filter(r => r.date === dateStr)
      .reduce((sum, r) => {
        const w = r.workers?.find(wk => wk.name === workerName);
        return sum + (w ? w.hoursWork : 0);
      }, 0);
  };

  // ---- 2. Synchronization effects to clients Local Storage ----
  useEffect(() => {
    localStorage.setItem('engineering_workers', JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem('engineering_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('engineering_materials', JSON.stringify(materials));
  }, [materials]);

  useEffect(() => {
    localStorage.setItem('engineering_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('engineering_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('engineering_records', JSON.stringify(records));
  }, [records]);

  // 同步估價案場其施工紀錄狀態的 Effect
  useEffect(() => {
    setProjects(prevProjects => {
      let changed = false;
      const nextProjects = prevProjects.map(p => {
        const projectRecords = records.filter(r => r.projectId === p.id);
        const hasRecords = projectRecords.length > 0;

        // 判斷此專案是否為或曾經是估價案場
        const isOrWasEstimation = p.isEstimation || 
                                  p.generatedName.startsWith('[估]') || 
                                  (p.estimationLabor && p.estimationLabor.length > 0) || 
                                  (p.estimationMaterials && p.estimationMaterials.length > 0) || 
                                  (p.estimationQuoteAmount !== undefined && p.estimationQuoteAmount > 0);

        if (!isOrWasEstimation) return p;

        const anyRecordCompleted = projectRecords.some(r => r.markAsCompleted);

        let nextIsEstimation = p.isEstimation;
        let nextEstimationStatus = p.estimationStatus;
        let nextIsCompleted = p.isCompleted;
        let nextGenName = p.generatedName;

        if (!hasRecords) {
          // 若沒有施工紀錄：
          // - 除非當前是 '報價未成'，否則自動跳回 '估價中'
          if (nextEstimationStatus === '報價未成') {
            nextIsEstimation = true;
            nextIsCompleted = true; // 保持已完工 (未成) 狀態
          } else {
            nextIsEstimation = true;
            nextEstimationStatus = '估價中';
            nextIsCompleted = false;
            if (!nextGenName.startsWith('[估]')) {
              nextGenName = `[估]${nextGenName}`;
            }
          }
        } else {
          // 若有施工紀錄：
          // - 自動結轉為正式施作案場
          nextIsEstimation = false;
          nextEstimationStatus = undefined;
          
          if (nextGenName.startsWith('[估]')) {
            nextGenName = nextGenName.substring(3); // 移除 [估]
          }

          // - 若施工紀錄勾選今日已完工，則標記為已完工
          if (anyRecordCompleted) {
            nextIsCompleted = true;
          }
        }

        if (
          p.isEstimation !== nextIsEstimation || 
          p.estimationStatus !== nextEstimationStatus || 
          p.isCompleted !== nextIsCompleted ||
          p.generatedName !== nextGenName
        ) {
          changed = true;
          return {
            ...p,
            isEstimation: nextIsEstimation,
            estimationStatus: nextEstimationStatus,
            isCompleted: nextIsCompleted,
            generatedName: nextGenName
          };
        }
        return p;
      });

      return changed ? nextProjects : prevProjects;
    });
  }, [records]);

  // Persistent Client Transactions List (Billing Receipts Ledger)
  const [transactions, setRawTransactions] = useState<PaymentTransaction[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_transactions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const setTransactions = (val: React.SetStateAction<PaymentTransaction[]>) => {
    setRawTransactions(prev => trackStateChanges(prev, typeof val === 'function' ? (val as any)(prev) : val, 'transactions'));
  };

  useEffect(() => {
    localStorage.setItem('engineering_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Worker Cash Advances (預支借支管理)
  const [workerAdvances, setRawWorkerAdvances] = useState<WorkerAdvance[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_worker_advances');
      if (stored) return JSON.parse(stored);
      
      return [
        {
          id: 'adv-1',
          workerId: 'w-1',
          workerName: '陳建志',
          date: '2026-06-08',
          amount: 1500,
          type: 'borrow',
          status: 'pending',
          description: '預支借用：購買特種拆管扳手與量尺工具',
          createdAt: new Date().toISOString()
        }
      ];
    } catch {
      return [];
    }
  });
  const setWorkerAdvances = (val: React.SetStateAction<WorkerAdvance[]>) => {
    setRawWorkerAdvances(prev => trackStateChanges(prev, typeof val === 'function' ? (val as any)(prev) : val, 'worker_advances'));
  };

  useEffect(() => {
    localStorage.setItem('engineering_worker_advances', JSON.stringify(workerAdvances));
  }, [workerAdvances]);

  // Petty Cash / Public fund Ledger (零用金與公基金收支記帳)
  const [pettyCashTransactions, setRawPettyCashTransactions] = useState<PettyCashTransaction[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_petty_cash');
      if (stored) return JSON.parse(stored);
      
      const today = new Date().toISOString().substring(0, 10);
      return [
        {
          id: 'pc-1',
          date: '2026-06-05',
          type: 'income',
          amount: 5000,
          category: 'fund_in',
          payerName: '張老闆',
          description: '補提公基金：提撥新店與中山案場開盤備用金',
          createdAt: new Date().toISOString()
        },
        {
          id: 'pc-2',
          date: '2026-06-07',
          type: 'expense',
          amount: 480,
          category: 'feed',
          payerName: '建志',
          description: '現場費用：採購師傅現場午後消暑涼水與補給',
          projectNameOrId: 'proj-initial-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'pc-3',
          date: '2026-06-08',
          type: 'expense',
          amount: 120,
          category: 'parking',
          payerName: '冠宇',
          description: '雜支開銷：現場吉林路路邊收費停車格登記',
          createdAt: new Date().toISOString()
        }
      ];
    } catch {
      return [];
    }
  });
  const setPettyCashTransactions = (val: React.SetStateAction<PettyCashTransaction[]>) => {
    setRawPettyCashTransactions(prev => trackStateChanges(prev, typeof val === 'function' ? (val as any)(prev) : val, 'petty_cash'));
  };

  useEffect(() => {
    localStorage.setItem('engineering_petty_cash', JSON.stringify(pettyCashTransactions));
  }, [pettyCashTransactions]);

  // ---- 3. Navigation Controls & Modal states ----
  const [activeTab, setActiveTab] = useState<'construction' | 'billing' | 'workers' | 'materials' | 'supabase-excel'>('construction');
  const [recordsSubTab, setRecordsSubTab] = useState<'today' | 'projects' | 'bookings' | 'history' | 'customers'>('today');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Project | undefined>(undefined);
  const [preselectedProjectId, setPreselectedProjectId] = useState<string | undefined>(undefined);
  const [progressSelectedDate, setProgressSelectedDate] = useState<string>(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const localToday = new Date(local.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().substring(0, 10);
  });

  const handlePrevDay = () => {
    const parts = progressSelectedDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      d.setDate(d.getDate() - 1);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      setProgressSelectedDate(`${yStr}-${mStr}-${dStr}`);
    }
  };

  const handleNextDay = () => {
    const parts = progressSelectedDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      d.setDate(d.getDate() + 1);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const dStr = String(d.getDate()).padStart(2, '0');
      setProgressSelectedDate(`${yStr}-${mStr}-${dStr}`);
    }
  };

  const handleSetToToday = () => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const localToday = new Date(local.getTime() - (offset * 60 * 1000));
    setProgressSelectedDate(localToday.toISOString().substring(0, 10));
  };

  // ---- 2.5 Firebase 雲端狀態監測 ----
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseConnected(!!user);
    });
    return () => unsubscribe();
  }, []);
  const [materialsSubTab, setMaterialsSubTab] = useState<'records' | 'suppliers'>('records');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historyProjectFilter, setHistoryProjectFilter] = useState<string>('all');
  const [historySortBy, setHistorySortBy] = useState<string>('date_desc');
  const [historyVisibleLimit, setHistoryVisibleLimit] = useState<number>(30);

  const getInitHistoryStartDate = () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prevMonth.getFullYear();
    const m = String(prevMonth.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  };

  const getInitHistoryEndDate = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const y = lastDay.getFullYear();
    const m = String(lastDay.getMonth() + 1).padStart(2, '0');
    const d = String(lastDay.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [historyStartDate, setHistoryStartDate] = useState<string>(getInitHistoryStartDate);
  const [historyEndDate, setHistoryEndDate] = useState<string>(getInitHistoryEndDate);

  useEffect(() => {
    setHistoryVisibleLimit(30);
  }, [historySearch, historyStatusFilter, historyProjectFilter, historySortBy, historyStartDate, historyEndDate]);
  const [showRecordForm, setShowRecordForm] = useState<boolean>(false);
  const [recordFormAnimDone, setRecordFormAnimDone] = useState<boolean>(false);

  useEffect(() => {
    if (!showRecordForm) {
      setRecordFormAnimDone(false);
    }
  }, [showRecordForm]);
  const [recordToEdit, setRecordToEdit] = useState<DailyRecord | undefined>(undefined);
  const [collapsedRecordDetails, setCollapsedRecordDetails] = useState<Record<string, boolean>>({});
  const [deleteConfirmRecordId, setDeleteConfirmRecordId] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);

  const handleJumpToProjectLogs = (projectId: string) => {
    setActiveTab('construction');
    setRecordsSubTab('history');
    setHistoryProjectFilter(projectId);
    setHistorySearch('');
    setHistoryStatusFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  // 計算並取得本地 LocalStorage 使用率 (警報機制)
  const getLocalStorageUsage = () => {
    let totalChars = 0;
    const keys = [
      'engineering_workers',
      'engineering_suppliers',
      'engineering_materials',
      'engineering_customers',
      'engineering_projects',
      'engineering_records',
      'engineering_transactions',
      'engineering_worker_advances',
      'engineering_petty_cash',
      'engineering_material_categories',
      'engineering_worker_roles'
    ];
    let breakdown: { keyName: string, label: string, sizeKb: number }[] = [];
    
    const keyLabels: Record<string, string> = {
      'engineering_workers': '同仁名冊與點工率',
      'engineering_suppliers': '特約材料行名冊',
      'engineering_materials': '材料工料對價預設表',
      'engineering_customers': '客戶位址關聯簿',
      'engineering_projects': '工程案場專案庫',
      'engineering_records': '每日施作工務日誌',
      'engineering_transactions': '請款收支交易流水帳',
      'engineering_worker_advances': '師傅預支借支紀錄表',
      'engineering_petty_cash': '案場零用金支出帳',
      'engineering_material_categories': '材料自訂分類清單',
      'engineering_worker_roles': '同仁工種角色預設值'
    };

    keys.forEach(k => {
      const val = localStorage.getItem(k) || '';
      totalChars += val.length;
      breakdown.push({
        keyName: k,
        label: keyLabels[k] || k,
        sizeKb: parseFloat((val.length * 2 / 1024).toFixed(3))
      });
    });

    const totalKb = parseFloat((totalChars * 2 / 1024).toFixed(2));
    const limitKb = 5120; // 5MB limit
    const usagePercent = parseFloat((totalKb / limitKb * 100).toFixed(2));
    
    return {
      totalKb,
      limitKb,
      usagePercent,
      breakdown
    };
  };

  // 匯出一鍵強制磁碟備份 JSON
  const handleExportBackup = () => {
    try {
      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        workers,
        suppliers,
        materials,
        customers,
        projects,
        records,
        transactions,
        workerAdvances,
        pettyCashTransactions,
        materialCategories: (() => {
          try { return JSON.parse(localStorage.getItem('engineering_material_categories') || 'null'); } catch { return null; }
        })(),
        workerRoles: (() => {
          try { return JSON.parse(localStorage.getItem('engineering_worker_roles') || 'null'); } catch { return null; }
        })()
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      const timeStamp = new Date().toISOString().substring(0, 10) + '_' + new Date().toTimeString().slice(0, 8).replace(/:/g, '');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `家庭水電維修工務系統_磁碟強制備份_${timeStamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      triggerToast('🎉 磁碟備份成功！已生成備份 JSON 檔案，請妥善保存。');
    } catch (err) {
      console.error(err);
      triggerToast('❌ 備份失敗！請檢查瀏覽器儲存權限。');
    }
  };

  // 匯入備份 JSON 並更新狀態與 LocalStorage
  const handleImportBackup = (fileEvent: React.ChangeEvent<HTMLInputElement>) => {
    const file = fileEvent.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const backupData = JSON.parse(text);

        if (!backupData.records && !backupData.projects && !backupData.customers) {
          triggerToast('❌ 錯誤：不符合系統格式的備份檔案！');
          return;
        }

        // 寫入 React States (這會觸發相應的 useEffect 自動儲存到 LocalStorage)
        if (backupData.workers) setWorkers(backupData.workers);
        if (backupData.suppliers) setSuppliers(backupData.suppliers);
        if (backupData.materials) setMaterials(backupData.materials);
        if (backupData.customers) setCustomers(backupData.customers);
        if (backupData.projects) setProjects(backupData.projects);
        if (backupData.records) setRecords(backupData.records);
        if (backupData.transactions) setTransactions(backupData.transactions);
        if (backupData.workerAdvances) setWorkerAdvances(backupData.workerAdvances);
        if (backupData.pettyCashTransactions) setPettyCashTransactions(backupData.pettyCashTransactions);

        if (backupData.materialCategories) {
          localStorage.setItem('engineering_material_categories', JSON.stringify(backupData.materialCategories));
        }
        if (backupData.workerRoles) {
          localStorage.setItem('engineering_worker_roles', JSON.stringify(backupData.workerRoles));
        }

        triggerToast('⚡ 系統資料還原成功！所有案場、日誌、點工與材料價格已順利歸檔。');
      } catch (err) {
        console.error(err);
        triggerToast('❌ 還原失敗：JSON 檔案解析錯誤，請確認檔案是否損毀。');
      }
    };
    reader.readAsText(file);
  };

  // Auto preset fields when triggering project modal from customer panels
  const [preSelCustomer, setPreSelCustomer] = useState<Customer | null>(null);
  const [preSelAddress, setPreSelAddress] = useState<string | undefined>(undefined);
  const [billingTriggerStamp, setBillingTriggerStamp] = useState<number>(0);

  // Floating Interactive Toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 統一專案顯示名稱格式化 (確保不論新舊專案且不論在哪個分頁顯示皆符合同一個新標準)
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

  // ---- 4. Save Record handler (New or Edit) ----
  const handleSaveRecord = (recordData: Omit<DailyRecord, 'id' | 'createdAt'>) => {
    const targetId = recordToEdit ? recordToEdit.id : `rec-${Date.now()}`;

    if (recordToEdit) {
      // Edit existing
      setRecords(prev => prev.map(r => r.id === recordToEdit.id ? {
        ...r,
        ...recordData,
        createdAt: r.createdAt
      } : r));

      triggerToast('💾 工務日誌修改成功，修改紀錄已成功存檔！');
    } else {
      // New record
      const newRec: DailyRecord = {
        ...recordData,
        id: targetId,
        createdAt: new Date().toISOString()
      };
      setRecords(prev => [newRec, ...prev]);

      triggerToast('✅ 工務日誌已順利成功送出登錄！');
    }

    // Convert booking to active project if needed
    if (recordData.projectId) {
      const matchedProj = projects.find(p => p.id === recordData.projectId);
      if (matchedProj && matchedProj.isBooking) {
        setProjects(prev => prev.map(p => p.id === recordData.projectId ? {
          ...p,
          isBooking: false,
          bookingStatus: 'converted',
          isCompleted: false,
          isEstimation: false
        } : p));
        triggerToast(`🎉 預約案場已成功轉換為「施工進行中案場」，並已從預約待辦池移出！`);
      }
    }

    // Auto-sync non-project expenses to petty cash transactions
    const nonProjExpenses = (recordData.expenses || []).filter(e => e.isProjectExpense === false);
    const newPcTransactions: PettyCashTransaction[] = nonProjExpenses.map((exp, index) => {
      const isNegative = exp.amount < 0;
      
      let cat: PettyCashTransaction['category'] = 'other';
      if (isNegative) {
        cat = 'fund_in';
      } else {
        if (exp.type === 'meal') cat = 'feed';
        else if (exp.type === 'parking') cat = 'parking';
        else if (exp.type === 'tool') cat = 'tool';
        else if (exp.type === 'fuel') cat = 'fuel';
        else if (exp.type === 'hardware') cat = 'hardware';
      }

      return {
        id: `pc-from-rec-${targetId}-${exp.id || index}`,
        date: recordData.date,
        type: isNegative ? 'income' : 'expense',
        amount: Math.abs(exp.amount),
        category: cat,
        projectNameOrId: recordData.projectId,
        description: isNegative 
          ? (exp.description || '非案場公務存入')
          : (exp.description || '非案場公務開銷'),
        sourceRecordId: targetId,
        createdAt: new Date().toISOString()
      };
    });

    setPettyCashTransactions(prev => {
      const filtered = prev.filter(t => t.sourceRecordId !== targetId);
      return [...newPcTransactions, ...filtered];
    });

    // Synchronize project status: Update completion and auto-convert estimation to formal project
    setProjects(prev => prev.map(p => {
      if (p.id === recordData.projectId) {
        let nextIsEstimation = p.isEstimation;
        let nextGenName = p.generatedName;
        
        if (p.isEstimation) {
          nextIsEstimation = false;
          // 套用標準估價拼裝公式計算案場專案名
          const prefixDate = p.createdAt ? p.createdAt.substring(0, 10).replace(/-/g, '') : new Date().toISOString().substring(0, 10).replace(/-/g, '');
          let clientPart = p.companyOrOwner.trim();
          const p_name = (p.contactPerson || '').trim();
          const ph = (p.contactPhone || '').trim();

          if (p_name && p_name !== '本人' && p_name !== p.companyOrOwner.trim()) {
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

          const addrAbbrev = (p.addressAbbreviated || '').trim();
          const addressPart = addrAbbrev ? `(${addrAbbrev})${p.fullAddress.trim()}` : p.fullAddress.trim();

          let serial = p.serialNumber || '001';
          if (serial.includes('-')) {
            const parts = serial.split('-');
            serial = parts[parts.length - 1];
          }
          if (/^\d+$/.test(serial)) {
            serial = serial.padStart(3, '0');
          }

          const baseName = `${prefixDate}-${clientPart}-${addressPart}-${serial}`;
          nextGenName = baseName;

          setTimeout(() => {
            triggerToast('⚡ 偵測到登錄日誌：已自動結轉為「正式施作工程」！原預估工料預算已保留作爲比對基準。');
          }, 850);
        }

        return {
          ...p,
          isEstimation: nextIsEstimation,
          estimationStatus: undefined,
          generatedName: nextGenName,
          isCompleted: recordData.markAsCompleted ? true : p.isCompleted
        };
      }
      return p;
    }));

    setShowRecordForm(false);
    setRecordToEdit(undefined);
  };

  // ---- 5. Save Project handler (Handles synchronized client auto-persisting) ----
  const handleSaveProject = (
    projectData: Omit<Project, 'id' | 'createdAt'> & { createdAt?: string }, 
    updatedCustomer?: Customer
  ) => {
    // Check duplication of full project name
    const duplicated = projects.find(p => p.generatedName === projectData.generatedName);
    if (duplicated) {
      triggerToast('⚠️ 警告：相同工程名稱已存在，請微動內容以作區分！');
      return;
    }

    const newProject: Project = {
      ...projectData,
      id: `proj-${Date.now()}`,
      createdAt: projectData.createdAt || new Date().toISOString(),
      estimationStatus: projectData.isEstimation ? (projectData.estimationStatus || '估價中') : undefined
    } as Project;

    setProjects(prev => [newProject, ...prev]);

    // Handle Client database appending
    if (updatedCustomer) {
      setCustomers(prev => {
        const foundIdx = prev.findIndex(c => c.id === updatedCustomer.id);
        if (foundIdx > -1) {
          // Edit existing - updating addresses mapping
          return prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c);
        } else {
          // New - prepend to index
          return [updatedCustomer, ...prev];
        }
      });
      triggerToast(`🎉 已成功建立了新案場，並同步將客戶【${updatedCustomer.name}】追加至名下地址簿及客戶簿！`);
    } else {
      triggerToast(`🎉 成功建立新開施做案場：${newProject.companyOrOwner}`);
    }

    setShowProjectModal(false);
    setPreSelCustomer(null);
    setPreSelAddress(undefined);
  };

  const handleSaveBooking = (
    bookingData: Omit<Project, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
    updatedCustomer?: Customer
  ) => {
    if (!bookingData.id) {
      const duplicated = projects.find(p => p.generatedName === bookingData.generatedName);
      if (duplicated) {
        triggerToast('⚠️ 警告：相同工程名稱已存在，請微動內容以作區分！');
        return;
      }
    }

    if (bookingData.id) {
      setProjects(prev => prev.map(p => p.id === bookingData.id ? {
        ...p,
        ...bookingData,
        createdAt: bookingData.createdAt || p.createdAt
      } as Project : p));
      triggerToast(`💾 預約排程【${bookingData.companyOrOwner}】已成功更新修改！`);
    } else {
      const newBooking: Project = {
        ...bookingData,
        id: `proj-booking-${Date.now()}`,
        createdAt: bookingData.createdAt || new Date().toISOString()
      } as Project;
      setProjects(prev => [newBooking, ...prev]);
      triggerToast(`📅 已順利將【${bookingData.companyOrOwner}】新增加入預約待辦池！`);
    }

    if (updatedCustomer) {
      setCustomers(prev => {
        const foundIdx = prev.findIndex(c => c.id === updatedCustomer.id);
        if (foundIdx > -1) {
          return prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c);
        } else {
          return [updatedCustomer, ...prev];
        }
      });
    }

    setShowBookingModal(false);
    setBookingToEdit(undefined);
  };

  // Quick dispatch action keys
  const handleAddProjectForCustomer = (customer: Customer, initialAddress: string) => {
    setPreSelCustomer(customer);
    setPreSelAddress(initialAddress);
    setShowProjectModal(true);
  };

  const handleEditRecordTrigger = (record: DailyRecord) => {
    setRecordToEdit(record);
    setShowRecordForm(true);
    setActiveTab('construction'); // auto focus Tab
  };

  const handleDeleteRecord = (recordId: string) => {
    setRecords(prev => prev.filter(r => r.id !== recordId));
    setPettyCashTransactions(prev => prev.filter(t => t.sourceRecordId !== recordId));
    triggerToast('🗑️ 本日施作紀錄日誌已永久清除抹消');
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500/25 antialiased pb-12 dark">
      {/* Upper Navigation Header bar */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo area */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-600/15 animate-fadeIn">
                <Landmark size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-amber-500 font-mono leading-none block">
                  水電工程專業管理系統
                </span>
                <h1 className="text-base font-black text-white tracking-tight mt-0.5 animate-fadeIn">
                  水電工務通 <span className="text-xs text-amber-500 font-extrabold font-mono ml-1 px-1.5 py-0.5 bg-neutral-850 rounded">PRO</span>
                </h1>
              </div>
            </div>

            {/* Quick action for new project and app overview stats */}
            <div className="flex items-center gap-3">
              <button
                id="header-supabase-status"
                onClick={() => { setActiveTab('supabase-excel'); setShowRecordForm(false); setRecordToEdit(undefined); }}
                className={`flex text-xs font-bold px-3.5 py-2 rounded-lg border items-center gap-1.5 transition-all cursor-pointer ${
                  firebaseConnected 
                    ? 'text-amber-400 bg-amber-950/80 border-amber-800/80 hover:bg-amber-900/60' 
                    : 'text-neutral-300 bg-neutral-800 border-neutral-700/80 hover:bg-neutral-750'
                }`}
                title={firebaseConnected ? "Firebase 雲端已登入連線，點擊開啟備份與對控管理" : "目前為離線或未登入模式，點擊至管理分頁對齊 Google 雲端庫"}
              >
                {firebaseConnected ? (
                  <>
                    <Cloud size={14} className="text-amber-500 shrink-0 select-none animate-pulse" />
                    <span className="hidden sm:inline">Firebase 雲端已接通</span>
                    <span className="inline sm:hidden font-medium">已接通</span>
                  </>
                ) : (
                  <>
                    <CloudOff size={14} className="text-neutral-450 shrink-0" />
                    <span className="hidden sm:inline">Firebase 未登入 (離線)</span>
                    <span className="inline sm:hidden font-medium">離線模式</span>
                  </>
                )}
              </button>

              <button
                id="header-add-project"
                onClick={() => {
                  setPreSelCustomer(null);
                  setPreSelAddress(undefined);
                  setShowProjectModal(true);
                }}
                className="hidden sm:flex text-xs font-bold text-amber-400 bg-amber-950 hover:bg-amber-900/40 px-3.5 py-2 rounded-lg border border-amber-800/85 items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={14} className="text-amber-450" />
                新開案場專案
              </button>
              
              <div className="hidden md:flex flex-col text-right pl-3 border-l border-neutral-800 text-xs">
                <span className="text-neutral-500 font-semibold block uppercase text-[8px] tracking-wider font-mono">SERVER REAL DATE</span>
                <span className="font-mono text-neutral-300 font-bold">{new Date().toISOString().substring(0, 10)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Interactive Toast Message */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#121212] text-white font-medium text-xs py-2.5 px-5 rounded-full shadow-xl flex items-center gap-2 border border-neutral-800"
          >
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </  AnimatePresence>

      {/* Main Container workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Tab Selection Navigation */}
        <nav className="flex space-x-2 border-b border-neutral-850 mb-6 pb-px overflow-x-auto select-none no-scrollbar scrollbar-none">
          <button
            id="tab-construction"
            onClick={() => { setActiveTab('construction'); setRecordsSubTab('today'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'construction'
                ? 'border-amber-500 text-amber-500 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <ClipboardList size={16} />
            工程施作與案場管控
          </button>

          {/* TAB 3: billing */}
          <button
            id="tab-billing"
            onClick={() => { setActiveTab('billing'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'billing'
                ? 'border-amber-500 text-amber-500 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Coins size={16} className="text-amber-500 font-black" />
            請款撥付與收支管理
          </button>

          {/* TAB 4: workers */}
          <button
            id="tab-workers"
            onClick={() => { setActiveTab('workers'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'workers'
                ? 'border-amber-500 text-amber-500 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <HardHat size={16} />
            工班部署與考勤清冊
          </button>

          {/* TAB 5: materials & suppliers */}
          <button
            id="tab-materials"
            onClick={() => { setActiveTab('materials'); setMaterialsSubTab('records'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'materials'
                ? 'border-amber-500 text-amber-500 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <ShoppingBag size={16} />
            資材物料與供應商簿
          </button>

          {/* TAB 6: supabase-excel */}
          <button
            id="tab-supabase-excel"
            onClick={() => { setActiveTab('supabase-excel'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'supabase-excel'
                ? 'border-amber-500 text-amber-500 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-300 font-semibold'
            }`}
          >
            <Cloud size={16} className="text-amber-500 animate-pulse" />
            雲端數據備份對照
          </button>
        </nav>

        {/* Dynamic Display area */}
        <div className="space-y-6 min-h-[750px]">
          <AnimatePresence mode="wait">
            {/* RECORD FORM SCREEN */}
            {showRecordForm ? (
              <motion.div
                key="record-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <RecordForm
                  projects={projects}
                  setProjects={setProjects}
                  onSaveToast={triggerToast}
                  workersPreset={workers}
                  materialsPreset={materials}
                  suppliersPreset={suppliers}
                  onSaveRecord={handleSaveRecord}
                  onOpenNewProjectModal={() => setShowProjectModal(true)}
                  initialRecordToEdit={recordToEdit}
                  initialProjectId={preselectedProjectId}
                  onCancel={() => { setShowRecordForm(false); setRecordToEdit(undefined); setPreselectedProjectId(undefined); }}
                  setMaterialsPreset={setMaterials}
                  records={records}
                />
              </motion.div>
            ) : (
              /* TAB RENDERS */
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                {activeTab === 'construction' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Unified Executive Header */}
                    <div className="bg-[#1E1E1E] border border-[#2C2C2C] p-6 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#D4AF37] bg-[rgba(212,175,55,0.08)] px-2.5 py-1 rounded border border-[rgba(212,175,55,0.15)]">CONSTRUCTION HUB</span>
                        </div>
                        <h1 className="text-xl font-black text-white tracking-widest">
                          工務施作與工程案場調度主控台
                        </h1>
                        <p className="text-xs text-[#A0A0A0] mt-1.5 leading-relaxed">
                          整合自每日現場派遣日誌登錄、工程預算精算、歷史工期回報與業主聯繫歸檔。提供全方位現場實績比對。
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => {
                            setPreSelCustomer(null);
                            setPreSelAddress(undefined);
                            setShowProjectModal(true);
                          }}
                          className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#bfa032] text-black font-extrabold text-xs rounded-xl transition-all border border-[#D4AF37] shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Plus size={14} className="stroke-[3]" />
                          新開案場專案
                        </button>
                      </div>
                    </div>



                    {/* Integrated Sub-Navigation Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
                      <div className="flex border border-[#2D2D2D] bg-[#1E1E1E] p-1.5 rounded-xl flex-1 max-w-4xl gap-2 shadow-sm overflow-x-auto scrollbar-none">
                        <button
                          onClick={() => { setRecordsSubTab('today'); setShowRecordForm(false); }}
                          className={`flex-1 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
                            recordsSubTab === 'today'
                              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold'
                              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
                          }`}
                        >
                          <Calendar size={15} className="shrink-0 stroke-[2.5]" />
                          <span>
                            <span className="hidden sm:inline">當日施工進度</span>
                            <span className="inline sm:hidden">當日施工</span>
                          </span>
                        </button>
                        
                        <button
                          onClick={() => { setRecordsSubTab('projects'); setShowRecordForm(false); }}
                          className={`flex-1 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
                            recordsSubTab === 'projects'
                              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold'
                              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
                          }`}
                        >
                          <FolderLock size={15} className="shrink-0 stroke-[2.5]" />
                          <span>
                            <span className="hidden sm:inline">工程案場總覽</span>
                            <span className="inline sm:hidden">案場總覽</span>
                          </span>
                        </button>

                        <button
                          onClick={() => { setRecordsSubTab('bookings'); setShowRecordForm(false); }}
                          className={`flex-1 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
                            recordsSubTab === 'bookings'
                              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold'
                              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
                          }`}
                        >
                          <Clock size={15} className="shrink-0 stroke-[2.5]" />
                          <span>
                            <span className="hidden sm:inline">預約工作排程</span>
                            <span className="inline sm:hidden">預約待辦</span>
                          </span>
                        </button>

                        <button
                          onClick={() => { setRecordsSubTab('history'); setShowRecordForm(false); }}
                          className={`flex-1 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
                            recordsSubTab === 'history'
                              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold'
                              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
                          }`}
                        >
                          <History size={15} className="shrink-0 stroke-[2.5]" />
                          <span>
                            <span className="hidden sm:inline">歷史工務日誌簿</span>
                            <span className="inline sm:hidden">歷史日誌</span>
                          </span>
                        </button>

                        <button
                          onClick={() => { setRecordsSubTab('customers'); setShowRecordForm(false); }}
                          className={`flex-1 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
                            recordsSubTab === 'customers'
                              ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold'
                              : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
                          }`}
                        >
                          <Users size={15} className="shrink-0 stroke-[2.5]" />
                          <span>
                            <span className="hidden sm:inline">合作業主名錄</span>
                            <span className="inline sm:hidden">業主名錄</span>
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => { setRecordToEdit(undefined); setShowRecordForm(true); }}
                          className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#bfa032] text-black font-extrabold text-xs rounded-xl transition-all border border-[#D4AF37] shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Plus size={14} className="stroke-[3]" />
                          登錄本日施工與調度日誌
                        </button>
                      </div>
                    </div>

                    {/* SUB-TAB: TODAY'S CONSTRUCTION */}
                    {recordsSubTab === 'today' && (
                      <div className="space-y-6">

                        {/* Interactive Date Switcher Widget */}
                        <div className="bg-[#1E1E1E] border border-[#2D2D2D] p-4.5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm select-none">
                          <div className="flex items-center gap-2.5">
                            <Calendar className="text-[#D4AF37] stroke-[2.5]" size={18} />
                            <div>
                              <span className="text-xs text-neutral-400 block font-bold">目前查看日期施工進度</span>
                              <span className="text-sm font-black text-white font-mono">{progressSelectedDate}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={handlePrevDay}
                              className="px-3.5 py-2 bg-[#252525] hover:bg-[#2C2C2C] text-neutral-300 hover:text-white border border-[#3A3A3A] hover:border-[#D4AF37]/50 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <span>⬅️ 前一天</span>
                            </button>
                            <input
                              type="date"
                              value={progressSelectedDate}
                              onChange={(e) => setProgressSelectedDate(e.target.value)}
                              className="px-3.5 py-1.5 border border-[#3A3A3A] rounded-xl text-xs font-bold text-white bg-[#121212] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                            />
                            <button
                              onClick={handleNextDay}
                              className="px-3.5 py-2 bg-[#252525] hover:bg-[#2C2C2C] text-neutral-300 hover:text-white border border-[#3A3A3A] hover:border-[#D4AF37]/50 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <span>後一天 ➡️</span>
                            </button>
                            <button
                              onClick={handleSetToToday}
                              className="px-3.5 py-2 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/20 text-xs font-bold rounded-xl transition-all cursor-pointer"
                            >
                              回今天
                            </button>
                          </div>
                        </div>

                        {/* Today Stats Summary */}
                        {(() => {
                          const targetDate = progressSelectedDate;
                          const todayRecords = records.filter(r => r.date === targetDate);
                          
                          const todayWorkersCount = todayRecords.reduce((sum, r) => sum + (r.workers?.length || 0), 0);
                          const todayEstimatedCost = todayRecords.reduce((sum, r) => {
                            if (r.internalCostOnly) return sum;
                            const matSum = r.materials.reduce((s, m) => s + (m.unitPrice * m.quantity), 0);
                            const laborSum = r.workers.reduce((s, w) => s + ((w.billingHourlyRate ?? w.hourlyRate) * w.hoursWork), 0);
                            const expSum = r.expenses.filter(e => e.isProjectExpense !== false).reduce((s, e) => s + e.amount, 0);
                            return sum + matSum + laborSum + expSum;
                          }, 0);

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-750">
                                  <FolderLock size={20} />
                                </div>
                                <div>
                                  <span className="text-xs text-neutral-400 block font-bold">選定日施工進場</span>
                                  <span className="text-lg font-black text-neutral-800 font-mono">
                                    {todayRecords.length} <span className="text-xs font-bold text-neutral-500">處案場</span>
                                  </span>
                                </div>
                              </div>

                              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-750">
                                  <HardHat size={20} />
                                </div>
                                <div>
                                  <span className="text-xs text-neutral-400 block font-bold">選定日調派工班</span>
                                  <span className="text-lg font-black text-neutral-800 font-mono">
                                    {todayWorkersCount} <span className="text-xs font-bold text-neutral-500">人次</span>
                                  </span>
                                </div>
                              </div>

                              <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-750">
                                  <Coins size={20} />
                                </div>
                                <div>
                                  <span className="text-xs text-neutral-400 block font-bold">選定日預估工料成本</span>
                                  <span className="text-lg font-black text-neutral-800 font-mono">
                                    ${todayEstimatedCost.toLocaleString()} <span className="text-xs font-bold text-neutral-500">元</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Today Worker Attendance Hours Summary */}
                        {(() => {
                          const targetDate = progressSelectedDate;
                          const todayRecords = records.filter(r => r.date === targetDate);
                          
                          const workerHoursMap: Record<string, number> = {};
                          todayRecords.forEach(r => {
                            r.workers?.forEach(w => {
                              workerHoursMap[w.name] = (workerHoursMap[w.name] || 0) + w.hoursWork;
                            });
                          });

                          const workersList = Object.entries(workerHoursMap);
                          if (workersList.length === 0) return null;

                          return (
                            <div className="bg-[#1E1E1E] border border-[#2D2D2D] p-5 rounded-2xl shadow-sm space-y-3.5 select-none">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-[#D4AF37]/10 text-[#D4AF37] rounded-lg">
                                  <Users size={16} className="stroke-[2.5]" />
                                </span>
                                <div>
                                  <span className="block text-xs font-black text-[#D4AF37] uppercase tracking-wider">
                                    👥 本日各別同仁累計派工總時數
                                  </span>
                                  <span className="text-[10px] text-neutral-400 block font-bold mt-0.5">
                                    統計選定日期在所有施工日誌中的累積出勤時數 (用以核對加班/考勤)
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {workersList.map(([name, hours]) => (
                                  <div key={name} className="flex items-center gap-2 bg-[#252525] hover:bg-[#2C2C2C] border border-[#3A3A3A] px-3.5 py-1.5 rounded-xl transition-all">
                                    <span className="text-xs font-extrabold text-[#F3E5AB]">{name}</span>
                                    <span className="h-3 w-[1px] bg-neutral-700"></span>
                                    <span className="text-[#10B981] font-mono text-xs font-black">{hours} hr</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Today Records List */}
                        <div className="space-y-3">

                          {(() => {
                            const targetDate = progressSelectedDate;
                            const todayRecords = records.filter(r => r.date === targetDate);

                            const activeProjects = projects.filter(p => {
                              if (p.isCompleted) return false;
                              if (p.isEstimation) {
                                return p.estimationStatus === '進行中施工';
                              }
                              return true;
                            });

                            if (todayRecords.length === 0) {
                              return (
                                <div className="text-center py-10 bg-[#1E1E1E] border border-[#2C2C2C] rounded-2xl border-dashed flex flex-col items-center justify-center">
                                  <p className="text-sm text-neutral-400 font-extrabold mb-1">【{targetDate}】尚未登錄任何施工日誌！</p>
                                  <button
                                    onClick={() => { setRecordToEdit(undefined); setShowRecordForm(true); }}
                                    className="mt-3 px-5 py-2.5 bg-[#D4AF37] hover:bg-[#bfa032] text-black font-extrabold text-xs rounded-xl transition-all border border-[#D4AF37] shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <Plus size={14} className="stroke-[3]" />
                                    <span>登錄該日工務日誌</span>
                                  </button>
                                </div>
                              );
                            }

                             return (
                              <div className="space-y-4">
                                <div className="space-y-4">
                                  {todayRecords.map(record => {
                                    const matSum = record.internalCostOnly ? 0 : record.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
                                    const laborSum = record.internalCostOnly ? 0 : record.workers.reduce((sum, w) => sum + ((w.billingHourlyRate ?? w.hourlyRate) * w.hoursWork), 0);
                                    const expSum = record.internalCostOnly ? 0 : record.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
                                    const recordTotalCost = matSum + laborSum + expSum;

                                    const matchedProj = projects.find(p => p.id === record.projectId);
                                    const formattedProjName = matchedProj ? getProjectDisplayName(matchedProj) : record.projectName;
                                    const isExpanded = !!collapsedRecordDetails[record.id];

                                    return (
                                      <div key={record.id} className="p-4.5 rounded-xl border transition-all bg-[#1E1E1E] border-[#D4AF37]/20 shadow-xs space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                          <div className="space-y-1.5 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-mono text-[10px] font-black bg-[#D4AF37]/10 text-[#F3E5AB] border border-[#D4AF37]/20 px-2 py-0.5 rounded">
                                                {record.date} 🔥 本日施工
                                              </span>
                                              {record.markAsCompleted ? (
                                                <span className="text-[10px] px-2 py-0.5 bg-emerald-950/80 text-[#10B981] font-bold border border-emerald-900/40 rounded-full">已宣告結案</span>
                                              ) : (
                                                <span className="text-[10px] px-2 py-0.5 bg-[#D4AF37]/5 text-[#D4AF37] font-bold border border-[#D4AF37]/20 rounded-full">持續施作中</span>
                                              )}
                                              {record.internalCostOnly && (
                                                <span className="text-[10px] px-2 py-0.5 bg-rose-955/80 text-[#EF4444] font-extrabold border border-rose-900/40 rounded-full animate-pulse">
                                                  🛡️ 僅計公司內部成本
                                                </span>
                                              )}
                                            </div>
                                            <h4 className="text-xs sm:text-sm font-extrabold text-[#F3E5AB]">
                                              {formattedProjName}
                                            </h4>
                                            <p className="text-xs text-neutral-300 font-medium leading-relaxed font-sans">
                                              📌 施工說明：{record.notes ? record.notes : '工作正常，無特殊狀況。'}
                                            </p>

                                            {/* Show Worker Hours */}
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-neutral-300">
                                              <span className="font-extrabold text-[#D4AF37] text-[11px]">👥 出勤人員與時數：</span>
                                              {record.workers && record.workers.length > 0 ? (
                                                record.workers.map((w, idx) => (
                                                  <span key={idx} className="bg-[#2a2a2a] px-2 py-0.5 rounded border border-neutral-800 font-mono text-xs font-semibold text-neutral-200">
                                                    <span><span className="font-extrabold text-[#F3E5AB]">{w.name}</span> <span className="text-neutral-400">({w.hoursWork}h)</span>{getWorkerTotalHoursForDate(w.name, record.date) > w.hoursWork && <span className="text-[10px] text-[#10B981] font-bold bg-[#10B981]/10 px-1.5 py-0.5 rounded ml-1.5" title="當天個人累計總時數">本日累計 {getWorkerTotalHoursForDate(w.name, record.date)}h</span>}</span>
                                                  </span>
                                                ))
                                              ) : (
                                                <span className="italic text-neutral-500 text-xs">無派遣人員</span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#D4AF37]/15">
                                            <div className="text-left sm:text-right">
                                              <span className="text-[10px] text-neutral-400 font-bold block leading-relaxed">日誌工料估算費用</span>
                                              <span className="text-xs sm:text-sm font-black text-[#F3E5AB] font-mono">
                                                ${recordTotalCost.toLocaleString()} 元
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() => handleEditRecordTrigger(record)}
                                                className="px-3.5 py-1.5 bg-[#121212] hover:bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-3xs"
                                              >
                                                詳細與修改
                                              </button>
                                              {deleteConfirmRecordId === record.id ? (
                                                <div className="flex items-center gap-1.5 bg-rose-950/40 p-1 px-2 rounded-xl border border-rose-900/50 animate-fadeIn">
                                                  <span className="text-[10px] text-rose-400 font-extrabold shrink-0">確認刪除及對應帳目？</span>
                                                  <button
                                                    onClick={() => {
                                                      handleDeleteRecord(record.id);
                                                      setDeleteConfirmRecordId(null);
                                                    }}
                                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer shrink-0"
                                                  >
                                                    確定
                                                  </button>
                                                  <button
                                                    onClick={() => setDeleteConfirmRecordId(null)}
                                                    className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer shrink-0"
                                                  >
                                                    取消
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  onClick={() => setDeleteConfirmRecordId(record.id)}
                                                  className="px-3 py-1.5 bg-rose-950/25 hover:bg-rose-900/40 text-rose-400 border border-rose-900/30 font-bold text-xs rounded-xl transition-all cursor-pointer"
                                                >
                                                  刪除日誌
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Collapsible Materials and Expenses Section */}
                                        <div className="pt-2.5 border-t border-[#2c2c2c] bg-neutral-950/20 rounded-lg p-2.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCollapsedRecordDetails(prev => ({
                                                ...prev,
                                                [record.id]: !prev[record.id]
                                              }));
                                            }}
                                            className="text-[11.5px] font-bold text-neutral-400 hover:text-[#D4AF37] transition-colors flex items-center gap-1.5 cursor-pointer select-none"
                                          >
                                            📋 {isExpanded ? '🔼 收合耗材與費用詳情' : '🔽 展開耗材與費用詳情'} 
                                            <span className="text-[10.5px] text-neutral-500">
                                              ({record.materials?.length || 0} 品項材料, {record.expenses?.length || 0} 雜項費用)
                                            </span>
                                          </button>

                                          {isExpanded && (
                                            <div className="mt-2.5 space-y-2.5 pl-2 border-l-2 border-[#D4AF37]/30 animate-fadeIn text-[11px] text-neutral-400 font-sans leading-relaxed">
                                              {/* Materials List */}
                                              <div>
                                                <span className="font-bold text-[#F3E5AB] block mb-1">🛠️ 耗用材料明細：</span>
                                                {record.materials && record.materials.length > 0 ? (
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                    {record.materials.map((m, idx) => (
                                                      <div key={idx} className="bg-[#252525] p-1.5 rounded border border-[#333] flex justify-between items-center text-neutral-300">
                                                        <span>{m.name || m.materialName || '未命名材料'} ({m.quantity} {m.unit})</span>
                                                        <span className="text-[10.5px] font-mono text-[#D4AF37]">${(m.unitPrice * m.quantity).toLocaleString()} 元</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <span className="text-neutral-500 italic">無使用材料紀錄</span>
                                                )}
                                              </div>

                                              {/* Expenses List */}
                                              <div>
                                                <span className="font-bold text-emerald-400 block mb-1">💰 當日雜項與工程支出費用：</span>
                                                {record.expenses && record.expenses.length > 0 ? (
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                    {record.expenses.map((e, idx) => (
                                                      <div key={idx} className="bg-[#252525] p-1.5 rounded border border-[#333] flex justify-between items-center text-neutral-300">
                                                        <span>{e.description || '工程雜支'} ({e.isProjectExpense ? '案場雜項' : '內部費用'})</span>
                                                        <span className="text-[10.5px] font-mono text-emerald-400">${e.amount.toLocaleString()} 元</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <span className="text-neutral-500 italic">無雜項支出紀錄</span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB: PROJECT MASTER PANEL */}
                    {recordsSubTab === 'projects' && (
                      <div className="animate-fadeIn">
                        <ProjectsPanel
                          projects={projects}
                          setProjects={setProjects}
                          onSaveToast={triggerToast}
                          records={records}
                          onEditRecord={handleEditRecordTrigger}
                          onDeleteRecord={handleDeleteRecord}
                          materialsPreset={materials}
                          suppliers={suppliers}
                        />
                      </div>
                    )}

                    {/* SUB-TAB: BOOKINGS LIST PANEL */}
                    {recordsSubTab === 'bookings' && (
                      <div className="animate-fadeIn">
                        <BookingsPanel
                          projects={projects}
                          setProjects={setProjects}
                          customers={customers}
                          onSaveToast={triggerToast}
                          onConvertBookingToRecord={(booking) => {
                            setPreselectedProjectId(booking.id);
                            setShowRecordForm(true);
                            setRecordsSubTab('today');
                            triggerToast(`🎯 已自動加載預約案場【${booking.companyOrOwner}】至本次工務日誌中！`);
                          }}
                          onEditBooking={(booking) => {
                            setBookingToEdit(booking);
                            setShowBookingModal(true);
                          }}
                          onAddBooking={() => {
                            setBookingToEdit(undefined);
                            setShowBookingModal(true);
                          }}
                        />
                      </div>
                    )}

                    {/* SUB-TAB: HISTORY LOGS LIST */}
                    {recordsSubTab === 'history' && (
                      <div className="space-y-4">

                        {/* Search and Filters bar */}
                        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-3xs space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            {/* 1. Keyword Search */}
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                                <Search size={14} />
                              </span>
                              <input
                                type="text"
                                placeholder="搜尋日期、案場、施工說明..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-neutral-50 hover:bg-neutral-100/40 focus:bg-white text-xs text-neutral-800 font-semibold rounded-xl border border-neutral-200 outline-hidden focus:border-amber-500 transition-all placeholder:text-neutral-450"
                              />
                            </div>

                            {/* 2. Status Filter */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-extrabold text-neutral-400 shrink-0 uppercase tracking-widest hidden lg:inline">狀態:</span>
                              <select
                                value={historyStatusFilter}
                                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                                className="w-full bg-neutral-50 hover:bg-neutral-100/40 border border-neutral-200 rounded-xl text-xs px-2.5 py-2 font-bold text-neutral-700 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                              >
                                <option value="all">📁 結案狀態：全部</option>
                                <option value="completed">✔ 已宣告結案</option>
                                <option value="ongoing">🏗️ 持續施作中</option>
                              </select>
                            </div>

                            {/* 3. Project Filter */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-extrabold text-neutral-400 shrink-0 uppercase tracking-widest hidden lg:inline">案場:</span>
                              <select
                                value={historyProjectFilter}
                                onChange={(e) => setHistoryProjectFilter(e.target.value)}
                                className="w-full bg-neutral-50 hover:bg-neutral-100/40 border border-neutral-200 rounded-xl text-xs px-2.5 py-2 font-bold text-neutral-700 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                              >
                                <option value="all">🏗️ 指定工程案場：全部</option>
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    🏢 {getProjectDisplayName(p)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* 4. Sorting Selector */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-extrabold text-neutral-400 shrink-0 uppercase tracking-widest hidden lg:inline">排序:</span>
                              <select
                                value={historySortBy}
                                onChange={(e) => setHistorySortBy(e.target.value)}
                                className="w-full bg-neutral-50 hover:bg-neutral-100/40 border border-neutral-200 rounded-xl text-xs px-2.5 py-2 font-bold text-neutral-700 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                              >
                                <option value="date_desc">📅 日期：由新到舊 (最新優先)</option>
                                <option value="date_asc">📅 日期：由舊到新 (歷史優先)</option>
                                <option value="cost_desc">💰 估計費用：由高到低</option>
                                <option value="cost_asc">💰 估計費用：由低到高</option>
                              </select>
                            </div>
                          </div>

                          {/* 5. Date Range Filter & Presets */}
                          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between border-t border-neutral-100 pt-3.5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
                              <span className="text-[11px] font-extrabold text-neutral-500 shrink-0 uppercase tracking-wider flex items-center gap-1">
                                📅 查找時段區間:
                              </span>
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <input
                                  type="date"
                                  value={historyStartDate}
                                  onChange={(e) => setHistoryStartDate(e.target.value)}
                                  className="bg-neutral-50 hover:bg-neutral-100/40 border border-neutral-200 rounded-xl text-xs px-2.5 py-1.5 font-bold text-neutral-700 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                                />
                                <span className="text-xs text-neutral-400 font-bold">至</span>
                                <input
                                  type="date"
                                  value={historyEndDate}
                                  onChange={(e) => setHistoryEndDate(e.target.value)}
                                  className="bg-neutral-50 hover:bg-neutral-100/40 border border-neutral-200 rounded-xl text-xs px-2.5 py-1.5 font-bold text-neutral-700 focus:outline-hidden focus:border-amber-500 cursor-pointer"
                                />
                              </div>
                            </div>
                            
                            {/* Preset Buttons for easy selection */}
                            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  setHistoryStartDate(getInitHistoryStartDate());
                                  setHistoryEndDate(getInitHistoryEndDate());
                                }}
                                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                                  historyStartDate === getInitHistoryStartDate() && historyEndDate === getInitHistoryEndDate()
                                    ? 'bg-amber-500/15 text-amber-800 border border-amber-200'
                                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-150 border border-transparent'
                                }`}
                              >
                                預設 (本月 + 上月)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const now = new Date();
                                  const y = now.getFullYear();
                                  const m = String(now.getMonth() + 1).padStart(2, '0');
                                  setHistoryStartDate(`${y}-${m}-01`);
                                  
                                  const lastDay = new Date(y, now.getMonth() + 1, 0);
                                  const d = String(lastDay.getDate()).padStart(2, '0');
                                  setHistoryEndDate(`${y}-${m}-${d}`);
                                }}
                                className="px-2.5 py-1 text-[11px] font-extrabold bg-neutral-100 text-neutral-500 hover:bg-neutral-150 rounded-lg border border-transparent transition-all cursor-pointer"
                              >
                                單獨本月
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const end = new Date();
                                  const start = new Date();
                                  start.setDate(end.getDate() - 30);
                                  
                                  const format = (d: Date) => {
                                    const yyyy = d.getFullYear();
                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                    const dd = String(d.getDate()).padStart(2, '0');
                                    return `${yyyy}-${mm}-${dd}`;
                                  };
                                  setHistoryStartDate(format(start));
                                  setHistoryEndDate(format(end));
                                }}
                                className="px-2.5 py-1 text-[11px] font-extrabold bg-neutral-100 text-neutral-500 hover:bg-neutral-150 rounded-lg border border-transparent transition-all cursor-pointer"
                              >
                                過去 30 天
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const now = new Date();
                                  const y = now.getFullYear();
                                  setHistoryStartDate(`${y}-01-01`);
                                  setHistoryEndDate(`${y}-12-31`);
                                }}
                                className="px-2.5 py-1 text-[11px] font-extrabold bg-neutral-100 text-neutral-500 hover:bg-neutral-150 rounded-lg border border-transparent transition-all cursor-pointer"
                              >
                                今年整年
                              </button>
                            </div>
                          </div>

                          {/* Active Filters Clear Indicators */}
                          {(historySearch || historyStatusFilter !== 'all' || historyProjectFilter !== 'all' || historySortBy !== 'date_desc' || historyStartDate !== getInitHistoryStartDate() || historyEndDate !== getInitHistoryEndDate()) && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-100 select-none">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] bg-amber-500/10 text-amber-850 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <SlidersHorizontal size={10} />
                                  <span>篩選條件已套用</span>
                                </span>
                                {historySearch && (
                                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-lg border border-neutral-200 flex items-center gap-1 font-medium">
                                    關鍵字: "{historySearch}"
                                    <button onClick={() => setHistorySearch('')} className="hover:text-neutral-900 font-extrabold cursor-pointer ml-1">×</button>
                                  </span>
                                )}
                                {historyStatusFilter !== 'all' && (
                                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-lg border border-neutral-200 flex items-center gap-1 font-medium">
                                    狀態: {historyStatusFilter === 'completed' ? '已結案' : '施工中'}
                                    <button onClick={() => setHistoryStatusFilter('all')} className="hover:text-neutral-900 font-extrabold cursor-pointer ml-1">×</button>
                                  </span>
                                )}
                                {historyProjectFilter !== 'all' && (
                                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-lg border border-neutral-200 flex items-center gap-1 font-medium">
                                    特定案場限制
                                    <button onClick={() => setHistoryProjectFilter('all')} className="hover:text-neutral-900 font-extrabold cursor-pointer ml-1">×</button>
                                  </span>
                                )}
                                {(historyStartDate !== getInitHistoryStartDate() || historyEndDate !== getInitHistoryEndDate()) && (
                                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-lg border border-neutral-200 flex items-center gap-1 font-medium">
                                    時段: {historyStartDate} 至 {historyEndDate}
                                    <button onClick={() => {
                                      setHistoryStartDate(getInitHistoryStartDate());
                                      setHistoryEndDate(getInitHistoryEndDate());
                                    }} className="hover:text-neutral-900 font-extrabold cursor-pointer ml-1">×</button>
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={() => {
                                  setHistorySearch('');
                                  setHistoryStatusFilter('all');
                                  setHistoryProjectFilter('all');
                                  setHistorySortBy('date_desc');
                                  setHistoryStartDate(getInitHistoryStartDate());
                                  setHistoryEndDate(getInitHistoryEndDate());
                                }}
                                className="text-[10px] text-amber-700 hover:text-amber-850 font-black cursor-pointer underline underline-offset-2 flex items-center gap-0.5 select-none"
                              >
                                重設全部篩選項目
                              </button>
                            </div>
                          )}
                        </div>

                        {/* List rendering with complex filtering and sorting logic */}
                        {(() => {
                          // 1. Filter
                          const filteredHistoryRecords = records.filter(r => {
                            // Date range filter
                            if (historyStartDate && r.date < historyStartDate) return false;
                            if (historyEndDate && r.date > historyEndDate) return false;

                            // Keyword search
                            if (historySearch) {
                              const matchSearch = historySearch.toLowerCase();
                              const matchedProj = projects.find(p => p.id === r.projectId);
                              const projName = matchedProj ? getProjectDisplayName(matchedProj).toLowerCase() : (r.projectName || '').toLowerCase();
                              const notesMatch = (r.notes || '').toLowerCase().includes(matchSearch);
                              const dateMatch = r.date.includes(matchSearch);
                              if (!projName.includes(matchSearch) && !notesMatch && !dateMatch) {
                                return false;
                              }
                            }

                            // StatusFilter
                            if (historyStatusFilter !== 'all') {
                              if (historyStatusFilter === 'completed' && !r.markAsCompleted) return false;
                              if (historyStatusFilter === 'ongoing' && r.markAsCompleted) return false;
                            }

                            // ProjectFilter
                            if (historyProjectFilter !== 'all') {
                              if (r.projectId !== historyProjectFilter) return false;
                            }

                            return true;
                          });

                          // Map with computed costs to perform sorting
                          const recordWithCosts = filteredHistoryRecords.map(record => {
                            const matSum = record.internalCostOnly ? 0 : record.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
                            const laborSum = record.internalCostOnly ? 0 : record.workers.reduce((sum, w) => sum + ((w.billingHourlyRate ?? w.hourlyRate) * w.hoursWork), 0);
                            const expSum = record.internalCostOnly ? 0 : record.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
                            const recordTotalCost = matSum + laborSum + expSum;
                            return { record, recordTotalCost };
                          });

                          // 2. Sort
                          recordWithCosts.sort((a, b) => {
                            if (historySortBy === 'date_desc') {
                              return b.record.date.localeCompare(a.record.date);
                            } else if (historySortBy === 'date_asc') {
                              return a.record.date.localeCompare(b.record.date);
                            } else if (historySortBy === 'cost_desc') {
                              return b.recordTotalCost - a.recordTotalCost;
                            } else if (historySortBy === 'cost_asc') {
                              return a.recordTotalCost - b.recordTotalCost;
                            }
                            return 0;
                          });

                          if (recordWithCosts.length === 0) {
                            return (
                              <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200 border-dashed space-y-2">
                                <p className="text-sm text-neutral-500 font-bold">🔍 找不到符合目前篩選條件的歷史施工日誌！</p>
                                <p className="text-xs text-neutral-400">試著更換關鍵字，或重設上方的多維度篩選選項。</p>
                              </div>
                            );
                          }

                          const hasMore = recordWithCosts.length > historyVisibleLimit;
                          const slicedRecords = recordWithCosts.slice(0, historyVisibleLimit);

                          return (
                            <div className="space-y-3">
                              {/* Summary status tag */}
                              <div className="flex items-center justify-between px-1 text-xs text-neutral-500 font-bold font-mono">
                                <span>顯示派工日誌：{slicedRecords.length} / {recordWithCosts.length} 筆 (虛擬快取加速作用中)</span>
                                <span>按：{historySortBy === 'date_desc' || historySortBy === 'date_asc' ? '日期排序' : '估算費用排序'}</span>
                              </div>

                              {slicedRecords.map(({ record, recordTotalCost }) => {
                                const matchedProj = projects.find(p => p.id === record.projectId);
                                const formattedProjName = matchedProj ? getProjectDisplayName(matchedProj) : record.projectName;
                                const isExpanded = !!collapsedRecordDetails[record.id];

                                return (
                                  <div key={record.id} className="p-4 bg-white hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-xl transition-all space-y-3 shadow-3xs">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                      <div className="space-y-1.5 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-mono text-xs font-semibold bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded">
                                            {record.date}
                                          </span>
                                          {record.markAsCompleted ? (
                                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full">已宣告結案</span>
                                          ) : (
                                            <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-850 font-bold rounded-full">持續施作中</span>
                                          )}
                                          {record.internalCostOnly && (
                                            <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-800 font-extrabold border border-rose-200 rounded-full animate-pulse">
                                              🛡️ 僅計公司內部成本
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="text-xs sm:text-sm font-extrabold text-neutral-800">
                                          {formattedProjName}
                                        </h4>
                                        <p className="text-xs text-neutral-600 font-semibold font-sans leading-relaxed">
                                          📌 施工說明：{record.notes ? record.notes : '工作正常，無特殊狀況。'}
                                        </p>

                                        {/* Show Worker Hours */}
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-neutral-600">
                                          <span className="font-extrabold text-amber-800 text-[11px]">👥 出勤人員與時數：</span>
                                          {record.workers && record.workers.length > 0 ? (
                                            record.workers.map((w, idx) => (
                                              <span key={idx} className="bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 font-mono text-xs font-bold text-neutral-800">
                                                <span><span className="font-extrabold text-neutral-800">{w.name}</span> <span className="text-neutral-500">({w.hoursWork}h)</span>{getWorkerTotalHoursForDate(w.name, record.date) > w.hoursWork && <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 ml-1.5" title="當天個人累計總時數">本日累計 {getWorkerTotalHoursForDate(w.name, record.date)}h</span>}</span>
                                              </span>
                                            ))
                                          ) : (
                                            <span className="italic text-neutral-450 text-xs">無派遣人員</span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-150">
                                        <div className="text-left sm:text-right">
                                          <span className="text-[10px] text-neutral-400 font-bold block leading-relaxed">日誌估算費用</span>
                                          <span className="text-xs sm:text-sm font-black text-neutral-800 font-mono">
                                            ${recordTotalCost.toLocaleString()} 元
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handleEditRecordTrigger(record)}
                                            className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-250 text-neutral-800 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-3xs border border-neutral-250"
                                          >
                                            詳細與修改
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Collapsible Materials and Expenses Section */}
                                    <div className="pt-2.5 border-t border-neutral-150 bg-neutral-50/50 rounded-lg p-2.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCollapsedRecordDetails(prev => ({
                                            ...prev,
                                            [record.id]: !prev[record.id]
                                          }));
                                        }}
                                        className="text-[11.5px] font-bold text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1.5 cursor-pointer select-none"
                                      >
                                        📋 {isExpanded ? '🔼 收合耗材與費用詳情' : '🔽 展開耗材與費用詳情'} 
                                        <span className="text-[10.5px] text-neutral-400">
                                          ({record.materials?.length || 0} 品項材料, {record.expenses?.length || 0} 雜項費用)
                                        </span>
                                      </button>

                                      {isExpanded && (
                                        <div className="mt-2.5 space-y-2.5 pl-2 border-l-2 border-amber-500/40 animate-fadeIn text-[11px] text-neutral-600 font-sans leading-relaxed">
                                          {/* Materials List */}
                                          <div>
                                            <span className="font-extrabold text-neutral-800 block mb-1">🛠️ 耗用材料明細：</span>
                                            {record.materials && record.materials.length > 0 ? (
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {record.materials.map((m, idx) => (
                                                  <div key={idx} className="bg-white p-1.5 rounded border border-neutral-200 flex justify-between items-center text-neutral-700">
                                                    <span>{m.name || m.materialName || '未命名材料'} ({m.quantity} {m.unit})</span>
                                                    <span className="text-[10.5px] font-mono text-amber-800 font-black">${(m.unitPrice * m.quantity).toLocaleString()} 元</span>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-neutral-400 italic">無使用材料紀錄</span>
                                            )}
                                          </div>

                                          {/* Expenses List */}
                                          <div>
                                            <span className="font-extrabold text-emerald-800 block mb-1">💰 當日雜項與工程支出費用：</span>
                                            {record.expenses && record.expenses.length > 0 ? (
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {record.expenses.map((e, idx) => (
                                                  <div key={idx} className="bg-white p-1.5 rounded border border-neutral-200 flex justify-between items-center text-neutral-700">
                                                    <span>{e.description || '工程雜支'} ({e.isProjectExpense ? '案場雜項' : '內部費用'})</span>
                                                    <span className="text-[10.5px] font-mono text-emerald-700 font-black">${e.amount.toLocaleString()} 元</span>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-neutral-400 italic">無雜項支出紀錄</span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {hasMore && (
                                <div className="pt-4 flex flex-col items-center justify-center gap-2 border-t border-neutral-150">
                                  <p className="text-[11px] text-neutral-400 font-bold text-center">
                                    💡 虛擬加速技術已作用：系統自動截取快顯前 {historyVisibleLimit} 筆，以防瀏覽器 DOM 過載卡頓 🚀
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setHistoryVisibleLimit(prev => prev + 50)}
                                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition-all shadow-3xs cursor-pointer select-none"
                                    >
                                      ⏳ 載入下 50 筆紀錄
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setHistoryVisibleLimit(recordWithCosts.length)}
                                      className="px-4 py-2 border border-neutral-300 hover:border-neutral-400 text-neutral-700 hover:bg-neutral-50 font-bold text-xs rounded-xl transition-all cursor-pointer select-none"
                                    >
                                      🚀 載入全部 ({recordWithCosts.length}筆)
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* SUB-TAB: CUSTOMERS CARD PANEL */}
                    {recordsSubTab === 'customers' && (
                      <div className="animate-fadeIn">
                        <CustomerPanel
                          customers={customers}
                          setCustomers={setCustomers}
                          projects={projects}
                          setProjects={setProjects}
                          records={records}
                          setRecords={setRecords}
                          onAddProjectForCustomer={handleAddProjectForCustomer}
                          onSaveToast={triggerToast}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2.5 Display: BillingPanel */}
                {activeTab === 'billing' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Unified Executive Header */}
                    <div className="bg-[#1E1E1E] border border-[#2C2C2C] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#D4AF37] bg-[rgba(212,175,55,0.08)] px-2.5 py-1 rounded border border-[rgba(212,175,55,0.15)]">FINANCE & BILLING</span>
                        </div>
                        <h1 className="text-xl font-black text-white tracking-widest text-[#D4AF37]">
                          工程請款與收支帳務主控台
                        </h1>
                        <p className="text-xs text-[#A0A0A0] mt-1.5 leading-relaxed">
                          核算與對銷各案場的外部工程應收款、實收金額、現場代墊、師傅出勤工資派發及公司營運雜支，實現精準利潤分析與金流對接。
                        </p>
                      </div>
                      <button
                        onClick={() => setBillingTriggerStamp(Date.now())}
                        className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#bfa032] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer border border-[#D4AF37]"
                      >
                        <Plus size={16} className="stroke-[2.5]" />
                        登錄客戶水電款項
                      </button>
                    </div>

                    <BillingPanel
                      customers={customers}
                      projects={projects}
                      setProjects={setProjects}
                      records={records}
                      setRecords={setRecords}
                      transactions={transactions}
                      setTransactions={setTransactions}
                      workersPreset={workers}
                      materialsPreset={materials}
                      workerAdvances={workerAdvances}
                      setWorkerAdvances={setWorkerAdvances}
                      pettyCashTransactions={pettyCashTransactions}
                      setPettyCashTransactions={setPettyCashTransactions}
                      onEditRecord={handleEditRecordTrigger}
                      onDeleteRecord={handleDeleteRecord}
                      onSaveToast={triggerToast}
                      triggerAddPayment={billingTriggerStamp}
                      onJumpToProjectLogs={handleJumpToProjectLogs}
                    />
                  </div>
                )}

                {/* TAB 4 Display: WorkersPanel */}
                {activeTab === 'workers' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Unified Executive Header */}
                    <div className="bg-[#1E1E1E] border border-[#2C2C2C] p-6 rounded-2xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#D4AF37] bg-[rgba(212,175,55,0.08)] px-2.5 py-1 rounded border border-[rgba(212,175,55,0.15)]">WORKFORCE MANAGEMENT</span>
                      </div>
                      <h1 className="text-xl font-black text-white tracking-widest">
                        工班部署與考勤清冊系統
                      </h1>
                      <p className="text-xs text-[#A0A0A0] mt-1.5 leading-relaxed">
                        維護工班與外調師傅人事檔案、基本配工日工資基準、個人代扣明細，並可即時調閱歷史派遣考勤天數與發薪審核。
                      </p>
                    </div>

                    <WorkersPanel
                      workers={workers}
                      setWorkers={setWorkers}
                      onSaveToast={triggerToast}
                    />
                  </div>
                )}

                {/* TAB 5 Display: Materials & Suppliers Panel */}
                {activeTab === 'materials' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Unified Executive Header */}
                    <div className="bg-[#1E1E1E] border border-[#2C2C2C] p-6 rounded-2xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#D4AF37] bg-[rgba(212,175,55,0.08)] px-2.5 py-1 rounded border border-[rgba(212,175,55,0.15)]">MATERIALS & SUPPLY CHAIN</span>
                      </div>
                      <h1 className="text-xl font-black text-white tracking-widest">
                        資材物料耗用與供應商管理
                      </h1>
                      <p className="text-xs text-[#A0A0A0] mt-1.5 leading-relaxed">
                        管理工程所需常備材料與基本單位採購指導牌價，並維護特約合作五金行、石材木水電耗材供應商家檔案。
                      </p>
                    </div>

                    {/* Materials Integrated Sub-Navigation Controls */}
                    <div className="flex border border-[#2D2D2D] bg-[#1E1E1E] p-1.5 rounded-xl max-w-md select-none gap-2 shadow-sm overflow-x-auto scrollbar-none">
                      <button
                        onClick={() => setMaterialsSubTab('records')}
                        className={`flex-1 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
                          materialsSubTab === 'records'
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold'
                            : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
                        }`}
                      >
                        <ShoppingBag size={15} className="shrink-0 stroke-[2.5]" />
                        <span>常備資材儲備大庫</span>
                      </button>
                      
                      <button
                        onClick={() => setMaterialsSubTab('suppliers')}
                        className={`flex-1 py-2 px-3.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-max border ${
                          materialsSubTab === 'suppliers'
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-3xs font-extrabold'
                            : 'bg-[#252525] text-neutral-300 border-[#3A3A3A] hover:text-[#D4AF37] hover:bg-[#2C2C2C] font-semibold'
                        }`}
                      >
                        <Store size={15} className="shrink-0 stroke-[2.5]" />
                        <span>特約供應商家名冊</span>
                      </button>
                    </div>

                    {materialsSubTab === 'records' ? (
                      <div className="animate-fadeIn">
                        <MaterialsPanel
                          materials={materials}
                          setMaterials={setMaterials}
                          suppliers={suppliers}
                          onSaveToast={triggerToast}
                        />
                      </div>
                    ) : (
                      <div className="animate-fadeIn">
                        <SuppliersPanel
                          suppliers={suppliers}
                          setSuppliers={setSuppliers}
                          materials={materials}
                          onSaveToast={triggerToast}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 6 Display: Firebase 雲端備份中心 */}
                {activeTab === 'supabase-excel' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Unified Executive Header */}
                    <div className="bg-[#1E1E1E] border border-[#2C2C2C] p-6 rounded-2xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#D4AF37] bg-[rgba(212,175,55,0.08)] px-2.5 py-1 rounded border border-[rgba(212,175,55,0.15)]">CLOUD SECURITY & DATA SNAPSHOT</span>
                      </div>
                      <h1 className="text-xl font-black text-white tracking-widest">
                        雲端數據備份與安全備置維護組
                      </h1>
                      <p className="text-xs text-[#A0A0A0] mt-1.5 leading-relaxed">
                        連結雲端安全分散式儲存，實現全資料庫安全快照打包備份、一鍵按檔還原及雲端備置狀態對照，確保水電裝修工料資產歷程永不丟失。
                      </p>
                    </div>

                    <FirebaseSyncPanel
                      bypassTrackingRef={bypassTrackingRef}
                      workers={workers}
                      setWorkers={setWorkers}
                      suppliers={suppliers}
                      setSuppliers={setSuppliers}
                      materials={materials}
                      setMaterials={setMaterials}
                      customers={customers}
                      setCustomers={setCustomers}
                      projects={projects}
                      setProjects={setProjects}
                      records={records}
                      setRecords={setRecords}
                      transactions={transactions}
                      setTransactions={setTransactions}
                      workerAdvances={workerAdvances}
                      setWorkerAdvances={setWorkerAdvances}
                      pettyCashTransactions={pettyCashTransactions}
                      setPettyCashTransactions={setPettyCashTransactions}
                      onSaveToast={triggerToast}
                    />
                  </div>
                )}

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* 6. PROJECT FORM CREATION MODAL WITH COMPLETE CLIENT PROPS */}
      {showProjectModal && (
        <ProjectForm
          onSave={handleSaveProject}
          onClose={() => {
            setShowProjectModal(false);
            setPreSelCustomer(null);
            setPreSelAddress(undefined);
          }}
          existingProjects={projects}
          customers={customers}
          preSelectedCustomer={preSelCustomer}
          preSelectedAddress={preSelAddress}
        />
      )}

      {/* 7. BOOKING FORM CREATION/EDITING MODAL */}
      {showBookingModal && (
        <BookingForm
          onSave={handleSaveBooking}
          onClose={() => {
            setShowBookingModal(false);
            setBookingToEdit(undefined);
          }}
          existingProjects={projects}
          customers={customers}
          existingBooking={bookingToEdit}
        />
      )}
    </div>
  );
}
