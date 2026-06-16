import React, { useState, useEffect } from 'react';
import { Project, Worker, MaterialPreset, DailyRecord, Customer, Supplier, PaymentTransaction, WorkerAdvance, PettyCashTransaction } from './types';
import { DEFAULT_WORKERS, DEFAULT_MATERIALS, DEFAULT_SUPPLIERS } from './data';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, TrendingUp, Plus, Landmark, Users,
  Check, Info, FileSpreadsheet, Sparkles, Building2, Calendar, HardHat,
  ShoppingBag, FolderLock, Store, Coins,
  Database, AlertTriangle, Download, Upload, Trash2, Settings, ShieldAlert,
  Cloud, CloudOff, RefreshCw, LogOut, LogIn
} from 'lucide-react';

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

import ProjectForm from './components/ProjectForm';
import RecordForm from './components/RecordForm';
import CustomerPanel from './components/CustomerPanel';
import WorkersPanel from './components/WorkersPanel';
import MaterialsPanel from './components/MaterialsPanel';
import ProjectsPanel from './components/ProjectsPanel';
import SuppliersPanel from './components/SuppliersPanel';
import BillingPanel from './components/BillingPanel';
import BlueprintPanel from './components/BlueprintPanel';
import FirebaseSyncPanel from './components/FirebaseSyncPanel';

export default function App() {
  // ---- 1. Initialize State with Local Storage fallback ----
  
  // Existing Workers List
  const [workers, setWorkers] = useState<Worker[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_workers');
      return stored ? JSON.parse(stored) : DEFAULT_WORKERS;
    } catch {
      return DEFAULT_WORKERS;
    }
  });

  // Material Suppliers Directory
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_suppliers');
      return stored ? JSON.parse(stored) : DEFAULT_SUPPLIERS;
    } catch {
      return DEFAULT_SUPPLIERS;
    }
  });

  // Material Templates
  const [materials, setMaterials] = useState<MaterialPreset[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_materials');
      return stored ? JSON.parse(stored) : DEFAULT_MATERIALS;
    } catch {
      return DEFAULT_MATERIALS;
    }
  });

  // New persistent Customers address list
  const [customers, setCustomers] = useState<Customer[]>(() => {
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

  // Projects / Sites Management
  const [projects, setProjects] = useState<Project[]>(() => {
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

  // Daily Engineering Records
  const [records, setRecords] = useState<DailyRecord[]>(() => {
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

        // 若正值估價案場，且已經開始登錄施工紀錄（工務日誌），系統自動將其結轉為正式施工專案，擺脫手動結轉
        if (p.isEstimation && hasRecords) {
          changed = true;
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
          const finalEstName = `[估]${baseName}`;

          return {
            ...p,
            isEstimation: false,
            estimationStatus: undefined,
            generatedName: finalEstName,
            isCompleted: projectRecords.some(r => r.markAsCompleted)
          };
        }

        if (!p.isEstimation) return p;

        const anyRecordCompleted = projectRecords.some(r => r.markAsCompleted);

        let nextEstimationStatus = p.estimationStatus || '估價中';
        let nextIsCompleted = p.isCompleted;

        if (!hasRecords) {
          // 若沒有施工紀錄：
          // - 如果當前是 '進行中施工'，自動跳回 '估價中'
          // - 報價未成則維持報價未成，已完工則還原
          if (nextEstimationStatus === '進行中施工') {
            nextEstimationStatus = '估價中';
            nextIsCompleted = false;
          } else if (nextEstimationStatus === '估價中') {
            nextIsCompleted = false;
          }
        } else {
          // 若有施工紀錄：
          // - 自動轉為 '進行中施工'
          if (nextEstimationStatus === '估價中' || nextEstimationStatus === '報價未成') {
            nextEstimationStatus = '進行中施工';
          }
          // - 若施工紀錄勾選今日已完工，則標記為已完工
          if (anyRecordCompleted) {
            nextIsCompleted = true;
          }
        }

        if (p.estimationStatus !== nextEstimationStatus || p.isCompleted !== nextIsCompleted) {
          changed = true;
          return {
            ...p,
            estimationStatus: nextEstimationStatus,
            isCompleted: nextIsCompleted
          };
        }
        return p;
      });

      return changed ? nextProjects : prevProjects;
    });
  }, [records]);

  // Persistent Client Transactions List (Billing Receipts Ledger)
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(() => {
    try {
      const stored = localStorage.getItem('engineering_transactions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('engineering_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Worker Cash Advances (預支借支管理)
  const [workerAdvances, setWorkerAdvances] = useState<WorkerAdvance[]>(() => {
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

  useEffect(() => {
    localStorage.setItem('engineering_worker_advances', JSON.stringify(workerAdvances));
  }, [workerAdvances]);

  // Petty Cash / Public fund Ledger (零用金與公基金收支記帳)
  const [pettyCashTransactions, setPettyCashTransactions] = useState<PettyCashTransaction[]>(() => {
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

  useEffect(() => {
    localStorage.setItem('engineering_petty_cash', JSON.stringify(pettyCashTransactions));
  }, [pettyCashTransactions]);

  // ---- 3. Navigation Controls & Modal states ----
  const [activeTab, setActiveTab] = useState<'blueprint' | 'construction' | 'billing' | 'workers' | 'materials' | 'supabase-excel'>('blueprint');
  const [recordsSubTab, setRecordsSubTab] = useState<'today' | 'projects' | 'history' | 'customers'>('today');

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
  const [showRecordForm, setShowRecordForm] = useState<boolean>(false);
  const [recordToEdit, setRecordToEdit] = useState<DailyRecord | undefined>(undefined);
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);


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
    if (recordToEdit) {
      // Edit existing
      setRecords(prev => prev.map(r => r.id === recordToEdit.id ? {
        ...r,
        ...recordData,
        createdAt: r.createdAt // preserve initial creation stamp
      } : r));

      triggerToast('💾 工務日誌修改成功，修改紀錄已成功存檔！');
    } else {
      // New record
      const newRec: DailyRecord = {
        ...recordData,
        id: `rec-${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      setRecords(prev => [newRec, ...prev]);

      triggerToast('✅ 工務日誌已順利成功送出登錄！');
    }

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
          nextGenName = `[估]${baseName}`;

          setTimeout(() => {
            triggerToast('⚡ 偵測到登錄日誌：已自動結轉為「正式施作工程」！原預估工料預算已保留作爲比對基準（[估] 字頭名稱已依您要求予以保留）。');
          }, 800);
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
    projectData: Omit<Project, 'id' | 'createdAt'>, 
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
      createdAt: new Date().toISOString(),
      estimationStatus: projectData.isEstimation ? (projectData.estimationStatus || '估價中') : undefined
    };

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
    triggerToast('🗑️ 本日施作紀錄日誌已永久清除抹消');
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-[#fcfbfa] text-neutral-800 font-sans selection:bg-amber-100 antialiased pb-12">
      {/* Upper Navigation Header bar */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo area */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-600/15 animate-fadeIn">
                <Landmark size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-amber-600 font-mono leading-none block">
                  水電工程專業管理系統
                </span>
                <h1 className="text-base font-black text-neutral-900 tracking-tight mt-0.5">
                  水電工務通
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
                    ? 'text-amber-700 bg-amber-50 border-amber-200/70 hover:bg-emerald-100' 
                    : 'text-neutral-700 bg-neutral-100 border-neutral-300/70 hover:bg-neutral-200'
                }`}
                title={firebaseConnected ? "Firebase 雲端已登入連線，點擊開啟備份與對控管理" : "目前為離線或未登入模式，點擊至管理分頁對齊 Google 雲端庫"}
              >
                {firebaseConnected ? (
                  <>
                    <Cloud size={14} className="text-amber-650 shrink-0 select-none animate-pulse" />
                    <span className="hidden sm:inline">Firebase 雲端已接通</span>
                    <span className="inline sm:hidden">已接通</span>
                  </>
                ) : (
                  <>
                    <CloudOff size={14} className="text-neutral-500 shrink-0" />
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
                className="hidden sm:flex text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3.5 py-2 rounded-lg border border-amber-200/70 items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={14} />
                新開案場專案
              </button>
              
              <div className="hidden md:flex flex-col text-right pl-3 border-l border-neutral-200 text-xs">
                <span className="text-neutral-400 font-semibold block uppercase text-[8px] tracking-wider font-mono">SERVER REAL DATE</span>
                <span className="font-mono text-neutral-700 font-bold">{new Date().toISOString().substring(0, 10)}</span>
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
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white font-medium text-xs py-2.5 px-5 rounded-full shadow-xl flex items-center gap-2 border border-neutral-800"
          >
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Tab Selection Navigation */}
        <nav className="flex space-x-2 border-b border-neutral-200 mb-6 pb-px overflow-x-auto select-none">
          {/* TAB -1: ERP blueprint & guide */}
          <button
            id="tab-blueprint"
            onClick={() => { setActiveTab('blueprint'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'blueprint'
                ? 'border-amber-600 text-amber-700 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Sparkles size={16} className="text-amber-500 animate-pulse animate-duration-[2000ms]" />
            ERP 導覽 & 藍圖
          </button>

          {/* TAB 0: Combined Construction Management */}
          <button
            id="tab-construction"
            onClick={() => { setActiveTab('construction'); setRecordsSubTab('today'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'construction'
                ? 'border-amber-600 text-amber-700 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <ClipboardList size={16} />
            🏗️ 施工與案場管理
          </button>

          {/* TAB 3: billing */}
          <button
            id="tab-billing"
            onClick={() => { setActiveTab('billing'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'billing'
                ? 'border-amber-600 text-amber-700 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Coins size={16} className="text-amber-500 font-black" />
            💰 請款應收與收付
          </button>

          {/* TAB 4: workers */}
          <button
            id="tab-workers"
            onClick={() => { setActiveTab('workers'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'workers'
                ? 'border-amber-600 text-amber-700 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <HardHat size={16} />
            👷 工班團隊名冊
          </button>

          {/* TAB 5: materials & suppliers */}
          <button
            id="tab-materials"
            onClick={() => { setActiveTab('materials'); setMaterialsSubTab('records'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'materials'
                ? 'border-amber-600 text-amber-700 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <ShoppingBag size={16} />
            📦 資材材料與商家
          </button>

          {/* TAB 6: supabase-excel */}
          <button
            id="tab-supabase-excel"
            onClick={() => { setActiveTab('supabase-excel'); setShowRecordForm(false); setRecordToEdit(undefined); }}
            className={`flex items-center gap-2 py-3 px-4 font-bold text-xs border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'supabase-excel'
                ? 'border-amber-500 text-amber-700 font-black'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 font-semibold'
            }`}
          >
            <Cloud size={16} className="text-amber-500 animate-pulse" />
            ☁️ Firebase 雲端備份中心
          </button>
        </nav>

        {/* Dynamic Display area */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {/* RECORD FORM SCREEN */}
            {showRecordForm ? (
              <motion.div
                key="record-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
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
                  onCancel={() => { setShowRecordForm(false); setRecordToEdit(undefined); }}
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
                    {/* Integrated Sub-Navigation Controls */}
                    <div className="flex border-b border-neutral-200 bg-neutral-50 p-1.2 sm:p-1.5 rounded-xl max-w-4xl select-none gap-1 shadow-3xs overflow-x-auto scrollbar-none">
                      <button
                        onClick={() => { setRecordsSubTab('today'); setShowRecordForm(false); }}
                        className={`flex-1 py-2 px-2 sm:px-3 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-max ${
                          recordsSubTab === 'today'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                        }`}
                      >
                        <Calendar size={13} className="shrink-0" />
                        <span>
                          <span className="hidden sm:inline">📌 當日施工 (今日派工)</span>
                          <span className="inline sm:hidden">📌 今日派工</span>
                        </span>
                      </button>
                      
                      <button
                        onClick={() => { setRecordsSubTab('projects'); setShowRecordForm(false); }}
                        className={`flex-1 py-2 px-2 sm:px-3 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-max ${
                          recordsSubTab === 'projects'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                        }`}
                      >
                        <FolderLock size={13} className="shrink-0" />
                        <span>
                          <span className="hidden sm:inline">🏗️ 工程案場 (案場進度)</span>
                          <span className="inline sm:hidden">🏗️ 案場進度</span>
                        </span>
                      </button>

                      <button
                        onClick={() => { setRecordsSubTab('history'); setShowRecordForm(false); }}
                        className={`flex-1 py-2 px-2 sm:px-3 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-max ${
                          recordsSubTab === 'history'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                        }`}
                      >
                        <ClipboardList size={13} className="shrink-0" />
                        <span>
                          <span className="hidden sm:inline">📜 歷史日誌彙整 (調閱歷史)</span>
                          <span className="inline sm:hidden">📜 歷史日誌</span>
                        </span>
                      </button>

                      <button
                        onClick={() => { setRecordsSubTab('customers'); setShowRecordForm(false); }}
                        className={`flex-1 py-2 px-2 sm:px-3 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-max ${
                          recordsSubTab === 'customers'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                        }`}
                      >
                        <Users size={13} className="shrink-0" />
                        <span>
                          <span className="hidden sm:inline">👥 特約業主 (業主登記)</span>
                          <span className="inline sm:hidden">👥 特約業主</span>
                        </span>
                      </button>
                    </div>

                    {/* SUB-TAB: TODAY'S CONSTRUCTION */}
                    {recordsSubTab === 'today' && (
                      <div className="space-y-6">
                        {/* Upper Action block */}
                        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-5">
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-600 block">DAILY SHIFT SYSTEM</span>
                            <h2 className="text-base font-bold text-neutral-800">
                              快速派遣施工紀錄與回報大廳
                            </h2>
                            <p className="text-xs text-neutral-400 font-medium">記錄今日出勤同仁、耗用工料材料與現況進度回報。</p>
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                              id="quick-start-record-btn"
                              onClick={() => { setRecordToEdit(undefined); setShowRecordForm(true); }}
                              className="flex-1 sm:flex-none px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-amber-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Plus size={16} />
                              登錄當日工務日誌
                            </button>
                          </div>
                        </div>

                        {/* Today Stats Summary */}
                        {(() => {
                          const todayStr = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                          const utcTodayStr = new Date().toISOString().substring(0, 10);
                          const todayRecords = records.filter(r => r.date === todayStr || r.date === utcTodayStr);
                          
                          const todayWorkersCount = todayRecords.reduce((sum, r) => sum + (r.workers?.length || 0), 0);
                          const todayEstimatedCost = todayRecords.reduce((sum, r) => {
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
                                  <span className="text-xs text-neutral-400 block font-bold">今日施工進場</span>
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
                                  <span className="text-xs text-neutral-400 block font-bold">今日調派工班</span>
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
                                  <span className="text-xs text-neutral-400 block font-bold">今日預估工料成本</span>
                                  <span className="text-lg font-black text-neutral-800 font-mono">
                                    ${todayEstimatedCost.toLocaleString()} <span className="text-xs font-bold text-neutral-500">元</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Today Records List */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
                            📋 今日施工動態
                          </h3>

                          {(() => {
                            const todayStr = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                            const utcTodayStr = new Date().toISOString().substring(0, 10);
                            const todayRecords = records.filter(r => r.date === todayStr || r.date === utcTodayStr);

                            const activeProjects = projects.filter(p => {
                              if (p.isCompleted) return false;
                              if (p.isEstimation) {
                                return p.estimationStatus === '進行中施工';
                              }
                              return true;
                            });

                            if (todayRecords.length === 0) {
                              return (
                                <div className="text-center py-10 bg-white rounded-2xl border border-neutral-200 border-dashed">
                                  <p className="text-sm text-neutral-500 font-medium">今天尚未登錄任何施工日誌！</p>
                                  <button
                                    onClick={() => setShowRecordForm(true)}
                                    className="mt-3 px-5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                                  >
                                    立即登錄今日工程
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-4">
                                <div className="space-y-4">
                                  {todayRecords.map(record => {
                                    const matSum = record.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
                                    const laborSum = record.workers.reduce((sum, w) => sum + ((w.billingHourlyRate ?? w.hourlyRate) * w.hoursWork), 0);
                                    const expSum = record.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
                                    const recordTotalCost = matSum + laborSum + expSum;

                                    const matchedProj = projects.find(p => p.id === record.projectId);
                                    const formattedProjName = matchedProj ? getProjectDisplayName(matchedProj) : record.projectName;

                                    return (
                                      <div key={record.id} className="p-4.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50/50 border-amber-300 shadow-xs">
                                        <div className="space-y-1.5">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded">
                                              {record.date} 🔥 本日施工
                                            </span>
                                            {record.markAsCompleted ? (
                                              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full">已宣告結案</span>
                                            ) : (
                                              <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full">持續施作中</span>
                                            )}
                                          </div>
                                          <h4 className="text-xs sm:text-sm font-extrabold text-neutral-800">
                                            {formattedProjName}
                                          </h4>
                                          <p className="text-xs text-neutral-400 font-medium font-mono">
                                            {record.notes ? `施工說明/進度備份：${record.notes}` : '工作正常，無特殊狀況。'}
                                          </p>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                                          <div className="text-left sm:text-right">
                                            <span className="text-[10px] text-neutral-400 font-bold block leading-relaxed">日誌工料估算費用</span>
                                            <span className="text-xs sm:text-sm font-black text-neutral-800 font-mono">
                                              ${recordTotalCost.toLocaleString()} 元
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => handleEditRecordTrigger(record)}
                                              className="px-3.5 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-3xs"
                                            >
                                              詳細與修改
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Active projects suggestion anyway for quick add */}
                                <div className="mt-6 bg-neutral-50 p-5 rounded-2xl border border-neutral-200/80">
                                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-1.5">
                                    <span>🏗️ 其他施作中案場 (快速登錄)</span>
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {activeProjects.map(p => (
                                      <button
                                        key={p.id}
                                        onClick={() => {
                                          setRecordToEdit({
                                            id: '',
                                            projectId: p.id,
                                            date: todayStr,
                                            projectName: getProjectDisplayName(p),
                                            materials: [],
                                            expenses: [],
                                            workers: [],
                                            notes: '',
                                            markAsCompleted: false,
                                            createdAt: new Date().toISOString()
                                              });
                                              setShowRecordForm(true);
                                            }}
                                        className="text-left p-3 bg-white hover:bg-amber-50 hover:border-amber-300 transition-all border border-neutral-200 rounded-xl cursor-pointer group"
                                      >
                                        <div className="text-[10px] font-mono font-bold text-amber-600 mb-1 flex items-center justify-between">
                                          <span>{p.serialNumber}</span>
                                          <span className="text-neutral-400 group-hover:text-amber-600 transition-colors">快速登錄 →</span>
                                        </div>
                                        <div className="text-xs font-bold text-neutral-800 line-clamp-1">
                                          {getProjectDisplayName(p)}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
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

                    {/* SUB-TAB: HISTORY LOGS LIST */}
                    {recordsSubTab === 'history' && (
                      <div className="space-y-4">
                        {/* Search and Filters bar */}
                        <div className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="relative w-full sm:max-w-md">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                              <Calendar size={14} />
                            </span>
                            <input
                              type="text"
                              placeholder="搜尋日期、案場名稱或施工說明關鍵字..."
                              value={historySearch}
                              onChange={(e) => setHistorySearch(e.target.value)}
                              className="w-full pl-9 pr-4 py-2 bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white text-xs text-neutral-800 font-medium rounded-lg border border-neutral-200 outline-hidden focus:border-amber-500 transition-all"
                            />
                          </div>

                          <div className="text-xs text-neutral-400 font-bold">
                            共計 {records.length} 筆施工紀錄
                          </div>
                        </div>

                        {/* List rendering */}
                        {(() => {
                          const filteredHistoryRecords = records.filter(r => {
                            if (!historySearch) return true;
                            const matchSearch = historySearch.toLowerCase();
                            const matchedProj = projects.find(p => p.id === r.projectId);
                            const projName = matchedProj ? getProjectDisplayName(matchedProj).toLowerCase() : (r.projectName || '').toLowerCase();
                            return (
                              r.date.includes(matchSearch) ||
                              projName.includes(matchSearch) ||
                              (r.notes || '').toLowerCase().includes(matchSearch)
                            );
                          });

                          if (filteredHistoryRecords.length === 0) {
                            return (
                              <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200 border-dashed">
                                <p className="text-sm text-neutral-500 font-medium">找不到符合條件的歷史施作紀錄！</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {filteredHistoryRecords.map(record => {
                                const matSum = record.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity), 0);
                                const laborSum = record.workers.reduce((sum, w) => sum + ((w.billingHourlyRate ?? w.hourlyRate) * w.hoursWork), 0);
                                const expSum = record.expenses.filter(e => e.isProjectExpense !== false).reduce((sum, e) => sum + e.amount, 0);
                                const recordTotalCost = matSum + laborSum + expSum;

                                const matchedProj = projects.find(p => p.id === record.projectId);
                                const formattedProjName = matchedProj ? getProjectDisplayName(matchedProj) : record.projectName;

                                return (
                                  <div key={record.id} className="p-4 bg-white hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-xs font-semibold bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded">
                                          {record.date}
                                        </span>
                                        {record.markAsCompleted ? (
                                          <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full">已宣告結案</span>
                                        ) : (
                                          <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-850 font-bold rounded-full">持續施作中</span>
                                        )}
                                      </div>
                                      <h4 className="text-xs sm:text-sm font-extrabold text-neutral-800">
                                        {formattedProjName}
                                      </h4>
                                      <p className="text-xs text-neutral-400 font-medium">
                                        {record.notes ? `施工說明：${record.notes}` : '工作正常，無特殊狀況。'}
                                      </p>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                                      <div className="text-left sm:text-right">
                                        <span className="text-[10px] text-neutral-400 font-bold block leading-relaxed">日誌估算費用</span>
                                        <span className="text-xs sm:text-sm font-black text-neutral-800 font-mono">
                                          ${recordTotalCost.toLocaleString()} 元
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleEditRecordTrigger(record)}
                                          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-3xs"
                                        >
                                          詳細與修改
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
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
                          onAddProjectForCustomer={handleAddProjectForCustomer}
                          onSaveToast={triggerToast}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* TAB -1 Display: BlueprintPanel */}
                {activeTab === 'blueprint' && (
                  <BlueprintPanel
                    projects={projects}
                    records={records}
                    customers={customers}
                    workers={workers}
                    materials={materials}
                    suppliers={suppliers}
                    transactions={transactions}
                    workerAdvances={workerAdvances}
                    pettyCashTransactions={pettyCashTransactions}
                    setActiveTab={setActiveTab}
                    setRecordsSubTab={setRecordsSubTab}
                  />
                )}

                {/* TAB 2.5 Display: BillingPanel */}
                {activeTab === 'billing' && (
                  <BillingPanel
                    customers={customers}
                    projects={projects}
                    records={records}
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
                  />
                )}

                {/* TAB 4 Display: WorkersPanel */}
                {activeTab === 'workers' && (
                  <WorkersPanel
                    workers={workers}
                    setWorkers={setWorkers}
                    onSaveToast={triggerToast}
                  />
                )}

                {/* TAB 5 Display: Materials & Suppliers Panel */}
                {activeTab === 'materials' && (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Materials Integrated Sub-Navigation Controls */}
                    <div className="flex border-b border-neutral-200 bg-neutral-50 p-1.2 sm:p-1.5 rounded-xl max-w-md select-none gap-1 shadow-3xs overflow-x-auto scrollbar-none">
                      <button
                        onClick={() => setMaterialsSubTab('records')}
                        className={`flex-1 py-1.5 px-3 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-max ${
                          materialsSubTab === 'records'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                        }`}
                      >
                        <ShoppingBag size={13} className="shrink-0" />
                        <span>箱米折算材料大庫</span>
                      </button>
                      
                      <button
                        onClick={() => setMaterialsSubTab('suppliers')}
                        className={`flex-1 py-1.5 px-3 text-[10px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap min-w-max ${
                          materialsSubTab === 'suppliers'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                        }`}
                      >
                        <Store size={13} className="shrink-0" />
                        <span>特約合作材料商家</span>
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
                  <div className="animate-fadeIn">
                    <FirebaseSyncPanel
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
    </div>
  );
}
