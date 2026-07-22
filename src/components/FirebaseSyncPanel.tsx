import React, { useState, useEffect } from 'react';
import { 
  Cloud, RefreshCw, Upload, Download, ShieldAlert, LogIn, LogOut, AlertCircle,
  Eye, EyeOff, Search, ArrowUpDown, SlidersHorizontal, Zap, Shield, HelpCircle,
  Activity, Database, CheckCircle2, XCircle, Terminal
} from 'lucide-react';
import { 
  auth, loginWithGoogle, logoutUser, uploadAllToFirebase, downloadAllFromFirebase, 
  getBackupSnapshotsList, syncIncrementalWithFirebase, createRollingBackup,
  checkFirebaseConnection, getFirebaseConfigInfo, getNetworkLogs, subscribeNetworkLogs, NetworkLogEntry
} from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Worker, Supplier, MaterialPreset, Customer, Project, DailyRecord, PaymentTransaction, WorkerAdvance, PettyCashTransaction } from '../types';

interface FirebaseSyncPanelProps {
  bypassTrackingRef?: React.RefObject<boolean>;
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  materials: MaterialPreset[];
  setMaterials: React.Dispatch<React.SetStateAction<MaterialPreset[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  records: DailyRecord[];
  setRecords: React.Dispatch<React.SetStateAction<DailyRecord[]>>;
  transactions: PaymentTransaction[];
  setTransactions: React.Dispatch<React.SetStateAction<PaymentTransaction[]>>;
  workerAdvances: WorkerAdvance[];
  setWorkerAdvances: React.Dispatch<React.SetStateAction<WorkerAdvance[]>>;
  pettyCashTransactions: PettyCashTransaction[];
  setPettyCashTransactions: React.Dispatch<React.SetStateAction<PettyCashTransaction[]>>;
  onSaveToast: (msg: string) => void;
}

export default function FirebaseSyncPanel({
  bypassTrackingRef,
  workers, setWorkers,
  suppliers, setSuppliers,
  materials, setMaterials,
  customers, setCustomers,
  projects, setProjects,
  records, setRecords,
  transactions, setTransactions,
  workerAdvances, setWorkerAdvances,
  pettyCashTransactions, setPettyCashTransactions,
  onSaveToast
}: FirebaseSyncPanelProps) {
  
  // ---- Firebase Auth 狀態監控 ----
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [authLoading, setAuthLoading] = useState(true);
  
  // ---- 實時網路連線診斷狀態 ----
  const [connStatus, setConnStatus] = useState<{
    isChecking: boolean;
    isConnected: boolean | null;
    pingMs: number | null;
    dbId: string;
    message: string;
  }>({
    isChecking: false,
    isConnected: null,
    pingMs: null,
    dbId: getFirebaseConfigInfo().databaseId,
    message: '初始化連線檢測中...'
  });

  // ---- 即時 Request Logging 佇列與診斷 console 顯示 ----
  const [networkLogs, setNetworkLogs] = useState<NetworkLogEntry[]>([]);
  const [showLogConsole, setShowLogConsole] = useState(false);

  // ---- 同步診斷與防爆狀態 ----
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem('firebase_last_sync'));
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccessInfo, setSyncSuccessInfo] = useState<string | null>(null);

  // 滾動循環歷史快照狀態
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

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

  // 展開備份細節紀錄狀態
  const [expandedBackupId, setExpandedBackupId] = useState<string | null>(null);

  // 比較當前系統資料與備份快照的差異
  const getSnapshotDiff = (bk: any) => {
    if (!bk || !bk.data) return [];
    
    const categories = [
      { key: 'workers', label: '工班人員', current: workers, getName: (item: any) => item.name || item.id },
      { key: 'suppliers', label: '耗材材料大庫合作商', current: suppliers, getName: (item: any) => item.name || item.id },
      { key: 'materials', label: '材料大庫規格牌價', current: materials, getName: (item: any) => item.name || item.id },
      { key: 'customers', label: '客戶專案檔案', current: customers, getName: (item: any) => item.name || item.id },
      { key: 'projects', label: '工程案場資料', current: projects, getName: (item: any) => item.companyOrOwner || item.id },
      { key: 'records', label: '每日工務日誌記錄', current: records, getName: (item: any) => `${item.date} - ${item.projectName || '未命名'}` },
      { key: 'transactions', label: '收付款與預支流水帳', current: transactions, getName: (item: any) => `${item.date} (${item.type === 'income' ? '收款' : '支出'}: $${item.amount})` },
      { key: 'workerAdvances', label: '同仁借支預支紀錄表', current: workerAdvances, getName: (item: any) => `${item.date} (${item.workerName}: $${item.amount})` },
      { key: 'pettyCashTransactions', label: '工地零用公金流動記帳', current: pettyCashTransactions, getName: (item: any) => `${item.date} ($${item.amount} - ${item.desc || '無備註'})` },
    ];

    const diffResult: { 
      category: string; 
      added: string[]; 
      deleted: string[]; 
      modified: string[] 
    }[] = [];

    const isDeepEqual = (a: any, b: any): boolean => {
      if (a === b) return true;
      if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        return false;
      }

      const keysA = Object.keys(a).filter(k => k !== 'updatedAt' && k !== 'createdAt' && k !== 'lastSyncTime' && a[k] !== undefined && a[k] !== null);
      const keysB = Object.keys(b).filter(k => k !== 'updatedAt' && k !== 'createdAt' && k !== 'lastSyncTime' && b[k] !== undefined && b[k] !== null);

      if (keysA.length !== keysB.length) return false;

      for (const k of keysA) {
        if (!(k in b)) return false;
        
        const valA = a[k];
        const valB = b[k];

        if (typeof valA === 'object' && typeof valB === 'object') {
          if (!isDeepEqual(valA, valB)) return false;
        } else if (valA !== valB) {
          return false;
        }
      }

      return true;
    };

    categories.forEach(cat => {
      const snapList = bk.data[cat.key] || [];
      const currList = cat.current || [];

      const snapMap = new Map<string, any>(snapList.map((item: any) => [item.id, item] as [string, any]));
      const currMap = new Map<string, any>(currList.map((item: any) => [item.id, item] as [string, any]));

      const added: string[] = [];
      const deleted: string[] = [];
      const modified: string[] = [];

      // Detect added & modified
      currMap.forEach((item, id) => {
        if (!snapMap.has(id)) {
          added.push(cat.getName(item));
        } else {
          const snapItem = snapMap.get(id);
          if (!isDeepEqual(snapItem, item)) {
            modified.push(cat.getName(item));
          }
        }
      });

      // Detect deleted
      snapMap.forEach((item, id) => {
        if (!currMap.has(id)) {
          deleted.push(cat.getName(item));
        }
      });

      if (added.length > 0 || deleted.length > 0 || modified.length > 0) {
        diffResult.push({
          category: cat.label,
          added,
          deleted,
          modified
        });
      }
    });

    return diffResult;
  };

  const fetchBackups = async (uid: string) => {
    try {
      setBackupsLoading(true);
      const list = await getBackupSnapshotsList(uid);
      setBackups(list);
    } catch (e) {
      console.error('取得備份快照失敗:', e);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleCreateManualBackup = async () => {
    if (!currentUser) {
      onSaveToast('⚠️ 請先完成 Google 帳號登入，才能建立雲端歷史快照！');
      return;
    }
    setIsCreatingBackup(true);
    try {
      await createRollingBackup(currentUser.uid, {
        workers, suppliers, materials, customers, projects,
        records, transactions, workerAdvances, pettyCashTransactions
      });
      onSaveToast('🎉 已成功為當前 ERP 資料建立最新雲端歷史快照！');
      await fetchBackups(currentUser.uid);
    } catch (err: any) {
      onSaveToast(`❌ 建立快照失敗：${err?.message || err}`);
    } finally {
      setIsCreatingBackup(false);
    }
  };

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

  const runConnectionTest = async () => {
    setConnStatus(prev => ({ ...prev, isChecking: true }));
    try {
      const res = await checkFirebaseConnection();
      setConnStatus({
        isChecking: false,
        isConnected: res.success,
        pingMs: res.durationMs,
        dbId: res.dbId,
        message: res.message
      });
    } catch (err: any) {
      setConnStatus({
        isChecking: false,
        isConnected: false,
        pingMs: null,
        dbId: getFirebaseConfigInfo().databaseId,
        message: err?.message || '連線測試異常'
      });
    }
  };

  useEffect(() => {
    // 1. 初始化 Request Logs 佇列與訂閱
    setNetworkLogs(getNetworkLogs());
    const unsubLogs = subscribeNetworkLogs(() => {
      setNetworkLogs(getNetworkLogs());
    });

    // 2. 測試雲端連線狀態
    runConnectionTest();

    // 3. 監聽 Firebase Auth
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        fetchBackups(user.uid);
      } else {
        setBackups([]);
      }
    });

    return () => {
      unsubLogs();
      unsubscribeAuth();
    };
  }, []);

  // 登入程序
  const handleLogin = async () => {
    try {
      setAuthLoading(true);
      setSyncError(null);
      setSyncSuccessInfo(null);
      const user = await loginWithGoogle();
      onSaveToast(`👋 歡迎回來，${user.displayName || '工務夥伴'}！已成功透過 Google Sign-In 安全通道對齊認證！`);
    } catch (err: any) {
      const errMsg = err.message || String(err);
      setSyncError(errMsg);
      onSaveToast(`❌ 登入失敗：${errMsg}`);
    } finally {
      setAuthLoading(false);
    }
  };

  // 登出程序
  const handleLogout = () => {
    triggerConfirm('確認登出並下線', '確定要切換帳號或中斷雲端連線嗎？（本地資料不會消失）', async () => {
      try {
        await logoutUser();
        onSaveToast('🔓 已卸載雲端認證，當前切換為本地離線儲存模式。');
      } catch (err: any) {
        onSaveToast(`❌ 登出失敗：${err.message || err}`);
      }
    });
  };

  // ---- 雲端一鍵備份 ----
  const handleUploadToFirebase = async () => {
    if (!currentUser) {
      onSaveToast('⚠️ 請先登入 Google 帳號，才能將備份安全寫入 Firebase 雲端機房！');
      return;
    }
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccessInfo(null);

    try {
      const result = await uploadAllToFirebase(currentUser.uid, {
        workers,
        suppliers,
        materials,
        customers,
        projects,
        records,
        transactions,
        workerAdvances,
        pettyCashTransactions
      });

      if (result.success) {
        const nowStr = new Date().toLocaleString('zh-TW');
        setLastSync(nowStr);
        localStorage.setItem('firebase_last_sync', nowStr);
        setSyncSuccessInfo(result.message);
        onSaveToast('雲端全庫備份與循環快照已成功建立！');
        fetchBackups(currentUser.uid);
      } else {
        setSyncError(result.message);
        onSaveToast('雲端備份部分遭遇錯誤，請檢視控制台診斷報告。');
      }
    } catch (err: any) {
      setSyncError(err?.message || '不明連線或安全性權限拒絕錯誤。');
      onSaveToast('同步上傳因安全驗證未通過。');
    } finally {
      setIsSyncing(false);
    }
  };

  // ---- ⚡ 增量智慧雙向同步 (結合墓碑機制) ----
  const handleIncrementalSync = async () => {
    if (!currentUser) {
      onSaveToast('⚠️ 請先登入 Google 帳號，才能進行增量雙向同步！');
      return;
    }
    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccessInfo(null);

    try {
      if (bypassTrackingRef) {
        bypassTrackingRef.current = true;
      }

      const result = await syncIncrementalWithFirebase(currentUser.uid, {
        workers,
        suppliers,
        materials,
        customers,
        projects,
        records,
        transactions,
        workerAdvances,
        pettyCashTransactions
      });

      if (result.success && result.updatedData) {
        const d = result.updatedData;
        if (d.workers) setWorkers(d.workers);
        if (d.suppliers) setSuppliers(d.suppliers);
        if (d.materials) setMaterials(d.materials);
        if (d.customers) setCustomers(d.customers);
        if (d.projects) setProjects(d.projects);
        if (d.records) setRecords(d.records);
        if (d.transactions) setTransactions(d.transactions);
        if (d.workerAdvances) setWorkerAdvances(d.workerAdvances);
        if (d.pettyCashTransactions) setPettyCashTransactions(d.pettyCashTransactions);

        const localTime = new Date().toLocaleString('zh-TW');
        setLastSync(localTime);
        setSyncSuccessInfo(result.message);
        onSaveToast('🎉 雙向智慧增量同步（墓碑清除與異動融合）順利完成！');
        fetchBackups(currentUser.uid);
      } else {
        setSyncError(result.message);
        onSaveToast('⚠️ 智慧增量同步已完成，但可能存有部分未對齊表格。');
      }
    } catch (err: any) {
      setSyncError(err?.message || '增量同步錯誤。');
      onSaveToast('❌ 雙向增量同步中斷：網路安全阻斷。');
    } finally {
      if (bypassTrackingRef) {
        bypassTrackingRef.current = false;
      }
      setIsSyncing(false);
    }
  };

  // ---- 雲端一鍵還原 ----
  const handleDownloadFromFirebase = () => {
    if (!currentUser) {
      onSaveToast('請先登入系統帳戶，以讀取雲端備置數據。');
      return;
    }

    triggerConfirm(
      '確認：還原操作將覆蓋本機數據',
      '您目前瀏覽器中的本機快取數據將會被雲端資料完整覆蓋！確定要執行還原下載嗎？',
      async () => {
        setIsSyncing(true);
        setSyncError(null);
        setSyncSuccessInfo(null);

        try {
          if (bypassTrackingRef) bypassTrackingRef.current = true;
          const result = await downloadAllFromFirebase(currentUser.uid);

          if (result.success && result.data) {
            const d = result.data;
            if (d.workers) setWorkers(d.workers);
            if (d.suppliers) setSuppliers(d.suppliers);
            if (d.materials) setMaterials(d.materials);
            if (d.customers) setCustomers(d.customers);
            if (d.projects) setProjects(d.projects);
            if (d.records) setRecords(d.records);
            if (d.transactions) setTransactions(d.transactions);
            if (d.workerAdvances) setWorkerAdvances(d.workerAdvances);
            if (d.pettyCashTransactions) setPettyCashTransactions(d.pettyCashTransactions);

            onSaveToast('🎉 雲端還原全庫與自訂設定載入成功！系統即將重新啟動對齊數據...');
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            setSyncError(result.message);
            onSaveToast('雲端還原未完成，請確認安全連線是否穩定。');
          }
        } catch (err: any) {
          setSyncError(err?.message || '還原同步出錯。');
          onSaveToast('同步還原遭遇系統安全驗證攔截。');
        } finally {
          if (bypassTrackingRef) bypassTrackingRef.current = false;
          setIsSyncing(false);
        }
      }
    );
  };

  // ---- 雲端歷史快照滾動還原 ----
  const handleRestoreFromSnapshot = (snapshot: any) => {
    if (!currentUser) return;
    const dateStr = new Date(snapshot.timestamp).toLocaleString('zh-TW');
    triggerConfirm(
      `確定還原至歷史備份快照？`,
      `⚠️ 警告！此操作將徹底覆蓋您目前瀏覽器中的所有 ERP 數據，倒帶並還原至歷史時間點：[ ${dateStr} ]。該快照共包含 ${snapshot.totalCount} 筆資料項目。此動作執行後無法復原，是否確定？`,
      () => {
        try {
          if (bypassTrackingRef) bypassTrackingRef.current = true;
          const d = snapshot.data;
          if (d) {
            if (d.workers) setWorkers(d.workers);
            if (d.suppliers) setSuppliers(d.suppliers);
            if (d.materials) setMaterials(d.materials);
            if (d.customers) setCustomers(d.customers);
            if (d.projects) setProjects(d.projects);
            if (d.records) setRecords(d.records);
            if (d.transactions) setTransactions(d.transactions);
            if (d.workerAdvances) setWorkerAdvances(d.workerAdvances);
            if (d.pettyCashTransactions) setPettyCashTransactions(d.pettyCashTransactions);
            
            // 還原自訂分類與倍率配置
            if (d.settings) {
              const s = d.settings;
              if (s.materialCategories) localStorage.setItem('engineering_material_categories', JSON.stringify(s.materialCategories));
              if (s.materialSubcategories) localStorage.setItem('engineering_material_subcategories', JSON.stringify(s.materialSubcategories));
              if (s.subcategoryMultipliers) localStorage.setItem('engineering_subcategory_multipliers', JSON.stringify(s.subcategoryMultipliers));
              if (s.categoryMaterialConfigs) localStorage.setItem('engineering_category_material_configs', JSON.stringify(s.categoryMaterialConfigs));
              if (s.roleBillingConfigs) localStorage.setItem('engineering_role_billing_configs', JSON.stringify(s.roleBillingConfigs));
              if (s.workerRoles) localStorage.setItem('engineering_worker_roles', JSON.stringify(s.workerRoles));
            }

            setLastSync(dateStr);
            localStorage.setItem('firebase_last_sync', dateStr);
            
            onSaveToast(`✨ 倒帶還原成功！已回復至歷史時間快照：[ ${dateStr} ]！系統即將重新載入...`);
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            onSaveToast('❌ 還原失敗：該歷史快照資料格式有缺損。');
          }
        } catch (err: any) {
          onSaveToast(`❌ 快照還原倒帶失敗：${err.message || err}`);
        } finally {
          if (bypassTrackingRef) bypassTrackingRef.current = false;
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部 Firebase 連線與雲端金鑰診斷面板 */}
      <div className="bg-neutral-900 text-white rounded-2xl p-6 shadow-xl border border-neutral-800 space-y-6">
        
        {/* 第一排：連線狀態、Database ID、即時 Ping 與同步時間戳記 */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-neutral-800">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 連線狀態 Badge */}
            {connStatus.isChecking ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 font-bold font-mono rounded-lg text-xs border border-amber-500/30">
                <RefreshCw size={12} className="animate-spin" />
                <span>連線診斷中...</span>
              </span>
            ) : connStatus.isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 font-black font-mono rounded-lg text-xs border border-emerald-500/30 shadow-xs">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>雲端連線正常</span>
                {connStatus.pingMs !== null && (
                  <span className="text-[10px] text-emerald-300/80 font-normal">({connStatus.pingMs}ms)</span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/20 text-red-400 font-black font-mono rounded-lg text-xs border border-red-500/30 shadow-xs">
                <XCircle size={13} className="text-red-400" />
                <span>連線受阻 / 離線</span>
              </span>
            )}

            {/* Firestore Database ID 指示器 */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-800 text-neutral-300 font-mono text-xs rounded-lg border border-neutral-700/60" title={`已載入之 Firestore Database ID: ${connStatus.dbId}`}>
              <Database size={12} className="text-amber-500" />
              <span className="text-neutral-400">DB:</span>
              <span className="font-bold text-amber-400">{connStatus.dbId}</span>
            </span>

            {/* 手動重測連線按鈕 */}
            <button
              type="button"
              disabled={connStatus.isChecking}
              onClick={runConnectionTest}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs rounded-lg border border-neutral-700 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="測試與 Firebase Firestore 雲端資料庫的連接品質"
            >
              <RefreshCw size={11} className={connStatus.isChecking ? "animate-spin text-amber-400" : ""} />
              <span>測試連線 Ping</span>
            </button>
          </div>

          {/* 右側：最近一次成功同步時間戳 & Auth 按鈕 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-950/80 px-3 py-1.5 rounded-lg border border-neutral-800">
              <Activity size={12} className="text-amber-400" />
              <span className="text-neutral-500 font-semibold">最近成功同步時間：</span>
              <span className="font-mono font-bold text-amber-300">{lastSync || '尚未執行過同步'}</span>
            </div>

            <div className="bg-[#1E1E1E] border border-neutral-700/50 p-2 px-3 rounded-xl flex items-center gap-3 shrink-0">
              {authLoading ? (
                <div className="flex items-center gap-2 text-xs text-neutral-400 py-0.5 font-mono">
                  <RefreshCw size={12} className="animate-spin text-amber-500" />
                  <span>憑證驗證中...</span>
                </div>
              ) : currentUser ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-bold text-white text-xs select-none shadow-sm">
                      {currentUser.displayName ? currentUser.displayName[0] : '工'}
                    </div>
                    <div>
                      <span className="text-xs font-black block text-amber-400 leading-none">{currentUser.displayName || '工務夥伴'}</span>
                      <span className="text-[9px] text-neutral-400 font-mono block leading-tight">{currentUser.email || 'online'}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-2.5 py-1 bg-red-650/40 hover:bg-red-650 text-red-100 hover:text-white rounded-md text-[10px] font-black tracking-wider transition-colors border border-red-900/50 flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut size={10} />
                    <span>登出</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-lg text-xs font-black tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn size={12} />
                  <span>一鍵 Google 登入連線</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 雙向智慧增量同步區塊 - 優先推薦 */}
        <div className="mt-6 p-5 rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span className="text-[10px] font-black text-amber-400 tracking-widest uppercase">⚡ 推薦：雙向智慧增量同步系統</span>
              </div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                智慧增量同步 + 墓碑物理刪除對齊機制
              </h3>
              <p className="text-[11px] text-neutral-350 leading-relaxed max-w-3xl">
                自動比對本地與雲端 9 大核心表格的時間戳記 (<code className="text-amber-400 font-mono text-[10px]">updatedAt</code>)，僅傳輸有異動或新增的數據（<strong>大幅降低 90% 以上雲端讀寫用量，維持萬筆大數據的秒讀載速度</strong>）；同時，本機若有刪除耗材物料或工務日誌，系統會自動在雲端實施物理銷毀，並發布<strong>「刪除墓碑 (Tombstone)」</strong>至其他裝置，確保跨機對齊一致、數據永不混亂。
              </p>
            </div>
            
            <button
              type="button"
              disabled={isSyncing || !currentUser}
              onClick={handleIncrementalSync}
              className={`px-6 py-4 rounded-xl font-black text-xs tracking-widest flex items-center justify-center gap-2 select-none transition-all duration-300 shrink-0 ${
                currentUser
                  ? 'bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black shadow-lg shadow-amber-500/20 active:scale-[0.98] cursor-pointer hover:shadow-amber-500/30'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
              }`}
            >
              <Zap size={14} className={isSyncing ? "animate-spin text-neutral-950" : "text-neutral-950 animate-pulse"} />
              <span>進行雙向增量同步</span>
            </button>
          </div>
        </div>

        {/* 雲端備份操作按鈕組 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-neutral-800/80">
          <div className="col-span-1 md:col-span-2 flex items-center gap-1.5 text-neutral-450 text-[10px] font-black uppercase tracking-wider mb-1">
            <Shield size={12} className="text-neutral-600" />
            <span>⚠️ 進階全庫強行覆蓋選項 (適用於首次安裝或欲徹底重置為單端數據時)</span>
          </div>
          <button 
            type="button"
            disabled={isSyncing || !currentUser}
            onClick={handleUploadToFirebase}
            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${
              currentUser 
                ? 'bg-[#1E1E1E]/50 border-neutral-700/60 hover:bg-neutral-800/80 text-neutral-300 cursor-pointer shadow-3xs scale-100 hover:scale-[1.01]' 
                : 'bg-neutral-800/40 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-neutral-400" />
              <span className="font-extrabold text-xs">強制一鍵打包：覆蓋覆寫雲端</span>
            </div>
            <p className="text-[10px] text-neutral-500 font-semibold max-w-md">
              {currentUser ? '將本地 9 大核心表格與設定全量打包，直接「強行蓋掉」雲端數據（一般不需使用）。' : '🔒 請先完成 Google 登入以解鎖本功能'}
            </p>
          </button>
 
          <button 
            type="button"
            disabled={isSyncing || !currentUser}
            onClick={handleDownloadFromFirebase}
            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${
              currentUser 
                ? 'bg-[#1E1E1E]/50 border-neutral-700/60 hover:bg-neutral-800/80 text-neutral-350 cursor-pointer shadow-3xs scale-100 hover:scale-[1.01]' 
                : 'bg-neutral-800/40 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Download size={16} className="text-neutral-400" />
              <span className="font-extrabold text-xs">強制一鍵還原：拉取雲端覆蓋本地</span>
            </div>
            <p className="text-[10px] text-neutral-500 font-semibold max-w-md">
              {currentUser ? '直接拉取雲端完整快照，將當前瀏覽器的所有 ERP 點工物料紀錄徹底「沖洗覆蓋」。' : '🔒 請先完成 Google 登入以解鎖本功能'}
            </p>
          </button>
        </div>

        {/* 狀態診斷日誌與網路層 Request Logging 輸出報告 */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="font-bold flex items-center gap-1.5">
              <span>雲端診斷與備份報告：</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLogConsole(!showLogConsole)}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-mono text-[10px] font-bold rounded-md border border-neutral-700/80 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Terminal size={12} />
                <span>{showLogConsole ? '隱藏網路請求日誌' : `檢視即時網路層日誌 (${networkLogs.length})`}</span>
              </button>
              {lastSync && (
                <span className="font-mono text-neutral-500 hidden sm:inline-block">上次同步時間：{lastSync}</span>
              )}
            </div>
          </div>
          
          <div className="bg-neutral-950 p-4 rounded-xl text-xs font-mono border border-neutral-800 space-y-3">
            {isSyncing && (
              <div className="text-amber-400 flex items-center gap-2 animate-pulse">
                <span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce"></span>
                <span>[正在交涉 Google Cloud Firestore] 實施備份存取中，請勿關閉視窗...</span>
              </div>
            )}
            
            {syncSuccessInfo && (
              <div className="text-emerald-400 space-y-1">
                <p className="font-extrabold flex items-center gap-1">
                  <span className="text-emerald-500">● [同盟成功]</span> {syncSuccessInfo}
                </p>
                <p className="text-neutral-500 text-[10px] leading-relaxed">
                  系統運作良好，本機 Web-SQL 無縫轉移 Google Firestore 成功，所有關聯之成員資料、日誌詳情與支出已被永久持久化儲存！
                </p>
              </div>
            )}

            {syncError && (
              <div className="text-red-400 p-2 bg-red-950/40 border border-red-900/50 rounded-lg space-y-1">
                <div className="font-black flex items-center gap-1.5 text-[11px]">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span>[同步中止 - 防爆診斷反饋] Firestore 安全防衛機制或連線遭到阻礙：</span>
                </div>
                <div className="text-[10px] bg-neutral-900 p-1.5 rounded text-neutral-300 break-all leading-relaxed whitespace-pre-wrap">
                  {syncError}
                </div>
                <p className="text-[10px] text-neutral-500">
                  💡 建議解決方案：請確認您已正確配置專案環境變數，並在 Firebase 設定中新增目前運行系統的網域為授權登入網址。
                </p>
              </div>
            )}

            {/* 即時 Request Logging Console 展開檢視 */}
            {showLogConsole && (
              <div className="pt-3 border-t border-neutral-800 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-neutral-400 font-bold">
                  <span className="text-amber-400 flex items-center gap-1">
                    <Terminal size={11} />
                    <span>即時網路層請求日誌佇列 (Firestore Network Request Logs)</span>
                  </span>
                  <span className="text-neutral-500 font-mono">DB: {connStatus.dbId}</span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
                  {networkLogs.length === 0 ? (
                    <div className="text-neutral-600 italic text-[10px] py-2 text-center">
                      尚無網路請求紀錄，點擊「測試連線 Ping」或「進行雙向增量同步」以觸發網路請求...
                    </div>
                  ) : (
                    networkLogs.map(log => (
                      <div
                        key={log.id}
                        className={`p-2 rounded border text-[10px] leading-snug flex flex-col gap-1 ${
                          log.status === 'ERROR'
                            ? 'bg-red-950/30 border-red-900/50 text-red-300'
                            : log.status === 'PENDING'
                            ? 'bg-amber-950/20 border-amber-900/40 text-amber-300 animate-pulse'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-mono">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                              log.status === 'ERROR' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              log.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}>
                              [{log.status}]
                            </span>
                            <span className="font-bold text-white">{log.operation}</span>
                            <span className="text-neutral-500 text-[9px]">DB: {log.databaseId}</span>
                          </div>
                          <span className="text-neutral-500 text-[9px]">{new Date(log.timestamp).toLocaleTimeString('zh-TW')}</span>
                        </div>

                        <div className="flex items-center justify-between text-neutral-400 text-[9px] font-mono">
                          <span>UID: {log.ownerUid}</span>
                          {log.durationMs !== undefined && (
                            <span className="text-amber-400 font-bold">耗時: {log.durationMs}ms</span>
                          )}
                        </div>

                        {log.details && (
                          <div className="text-neutral-400 text-[10px] font-sans break-words bg-neutral-950/60 p-1 rounded border border-neutral-800/60">
                            {log.details}
                          </div>
                        )}

                        {log.error && (
                          <div className="text-red-400 font-mono text-[10px] break-all bg-red-950/50 p-1.5 rounded border border-red-900/60">
                            ❌ Error: {log.error}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 💾 雲端歷史快照備份中心 (滾動自動備份) */}
      <div className="bg-white rounded-2xl border border-neutral-205 p-6 shadow-3xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-3">
          <div className="flex items-center gap-2 text-neutral-800">
            <Cloud size={18} className="text-amber-500 animate-pulse" />
            <span className="font-black text-sm text-neutral-900">💾 雲端歷史快照備份中心 (最多保留 5 份快照)</span>
          </div>

          <div className="flex items-center gap-2">
            {backups.length > 0 && (
              <span className="text-[11px] font-bold text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md border border-neutral-200 hidden sm:inline-block">
                共計雲端保存: {backups.length} 份快照
              </span>
            )}

            <button
              type="button"
              disabled={backupsLoading || !currentUser}
              onClick={() => currentUser && fetchBackups(currentUser.uid)}
              className="px-2.5 py-1.5 border border-neutral-250 hover:bg-neutral-100 text-neutral-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none disabled:opacity-50"
              title="重新載入雲端備份列表"
            >
              <RefreshCw size={12} className={backupsLoading ? "animate-spin text-amber-500" : ""} />
              <span>重新整理</span>
            </button>

            <button
              type="button"
              disabled={isCreatingBackup || !currentUser}
              onClick={handleCreateManualBackup}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer select-none disabled:opacity-50"
            >
              <Zap size={12} className={isCreatingBackup ? "animate-spin" : ""} />
              <span>{isCreatingBackup ? '建立快照中...' : '立即建立新快照'}</span>
            </button>
          </div>
        </div>

        {backupsLoading ? (
          <div className="py-8 text-center text-neutral-400 text-xs flex items-center justify-center gap-2 font-black">
            <RefreshCw size={14} className="animate-spin text-amber-500" />
            <span>正在取得 Google 備份快照備份列表...</span>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-8 bg-neutral-50 rounded-xl text-center border border-dashed border-neutral-200 space-y-3">
            <div className="text-xs text-neutral-500 font-bold">
              📭 雲端目前尚無歷史快照備份檔案。
            </div>
            <p className="text-[11px] text-neutral-400 max-w-md mx-auto">
              當您執行「雙向增量同步」或點擊右上方「立即建立新快照」時，系統將自動將 9 大工務表格完整凍結並於雲端存下一份還原備份！
            </p>
            {currentUser && (
              <button
                type="button"
                disabled={isCreatingBackup}
                onClick={handleCreateManualBackup}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Cloud size={13} />
                <span>立即建立第一份雲端快照</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((bk, idx) => {
              const originalIndex = idx;
              const bkDate = new Date(bk.timestamp);
              const showDate = bkDate.toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
              return (
                <div key={bk.id} className="p-3.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-250/60 rounded-xl transition-all space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-neutral-800 text-white rounded-md text-[10px] font-mono font-bold select-none font-black">
                          #{originalIndex + 1}
                        </span>
                        <span className="text-xs font-black font-mono text-neutral-800">
                          {showDate}
                        </span>
                        {originalIndex === 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-850 font-extrabold text-[9px] rounded-md border border-amber-200/40 font-sans">
                            最新一期快照
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono flex flex-wrap gap-x-2 gap-y-0.5">
                        <span>📊 總量: <strong className="text-neutral-700">{bk.totalCount} 筆</strong></span>
                        <span>•</span>
                        <span>工班: {bk.data?.workers?.length || 0} 👤</span>
                        <span>•</span>
                        <span>案場: {bk.data?.projects?.length || 0} 🏗️</span>
                        <span>•</span>
                        <span>派工: {bk.data?.records?.length || 0} 📄</span>
                        <span>•</span>
                        <span>合作商: {bk.data?.suppliers?.length || 0} 🛒</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setExpandedBackupId(expandedBackupId === bk.id ? null : bk.id)}
                        className={`px-3 py-1.5 border text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                          expandedBackupId === bk.id 
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                            : 'border-neutral-300 hover:border-neutral-500 hover:bg-neutral-100 bg-white text-neutral-700'
                        }`}
                      >
                        {expandedBackupId === bk.id ? <EyeOff size={11} /> : <Eye size={11} />}
                        <span>{expandedBackupId === bk.id ? '收合詳情差異' : '對比實時異動 (增/刪/改)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRestoreFromSnapshot(bk)}
                        className="px-3.5 py-2 border border-neutral-300 hover:border-amber-600 hover:bg-amber-100 bg-white text-neutral-800 font-black text-xs rounded-lg transition-all flex items-center gap-1.5 hover:text-amber-850 shadow-3xs cursor-pointer select-none"
                      >
                        <RefreshCw size={11} className="text-amber-600" />
                        <span>還原此快照</span>
                      </button>
                    </div>
                  </div>

                  {/* Detailed expandable differences section */}
                  {expandedBackupId === bk.id && (
                    <div className="mt-3 pt-3 border-t border-dashed border-neutral-300/80 animate-fadeIn space-y-3">
                      <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/50">
                        <span className="text-[11px] font-extrabold text-amber-850 flex items-center gap-1">
                          🔍 實時核對報告：此歷史備份至今「已存在的流失或增減更改」分析
                        </span>
                        <span className="text-[9.5px] text-neutral-500 block leading-normal mt-1">
                          系統偵測自該備份（#{originalIndex+1}）存檔後，您目前瀏覽器相比這份雲端備份發生的 新增 (+), 刪除 (-), 或 修改 (✎) 資料細目。
                        </span>
                      </div>

                      {(() => {
                        const diff = getSnapshotDiff(bk);
                        if (diff.length === 0) {
                          return (
                            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-900 border border-emerald-200/50 text-xs font-bold text-center">
                              🎉 所有資料比對成功！此快照與您目前的本期大資料完全一致，沒有任何未同步異動。
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3.5">
                            {diff.map((catDiff, cidx) => (
                              <div key={cidx} className="bg-white p-3 rounded-lg border border-neutral-200/75 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-neutral-800 bg-neutral-100 px-2.5 py-0.5 rounded border border-neutral-200">
                                    📁 {catDiff.category}
                                  </span>
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    異動: {catDiff.added.length + catDiff.deleted.length + catDiff.modified.length} 筆
                                  </span>
                                </div>

                                <div className="space-y-1.5 pl-1.5 font-sans">
                                  {/* ADDED */}
                                  {catDiff.added.length > 0 && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-[10.5px] font-black text-emerald-700">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        <span>新增項目 (您在快照建立後另外「新增」的資料):</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pl-3">
                                        {catDiff.added.map((name, nIdx) => (
                                          <span key={nIdx} className="text-[10.5px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-black">
                                            + {name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* DELETED */}
                                  {catDiff.deleted.length > 0 && (
                                    <div className="space-y-1 mt-1">
                                      <div className="flex items-center gap-1.5 text-[10.5px] font-black text-rose-700">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                        <span>已刪除項目 (存在於此快照，但我目前本地「已移除」的資料):</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pl-3">
                                        {catDiff.deleted.map((name, nIdx) => (
                                          <span key={nIdx} className="text-[10.5px] bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded font-black line-through decoration-rose-400">
                                            - {name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* MODIFIED */}
                                  {catDiff.modified.length > 0 && (
                                    <div className="space-y-1 mt-1">
                                      <div className="flex items-center gap-1.5 text-[10.5px] font-black text-amber-700">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                        <span>已修改項目 (兩邊皆有，但有「更改過」內容的資料):</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pl-3">
                                        {catDiff.modified.map((name, nIdx) => (
                                          <span key={nIdx} className="text-[10.5px] bg-amber-50 text-amber-805 border border-amber-300 px-1.5 py-0.5 rounded font-black">
                                            ✎ {name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-[9px] text-neutral-400 font-mono text-right italic">
              * 本滾動歷史備份包含點工、材料廠商、案場、派工日誌、借支預支及零用公金流水等全部 9 大模組。最多保留 5 份，超額自動洗牌清除最舊紀錄，請安心存取！
            </p>
          </div>
        )}
      </div>

      {/* Custom Elegant Confirm Dialog */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-neutral-100 p-6 transform scale-100 transition-all font-sans">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-full mt-0.5">
                <AlertCircle size={22} className="stroke-[2]" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-neutral-950">{confirmModal.title}</h3>
                <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed font-semibold">{confirmModal.message}</p>
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
