import React, { useState, useEffect } from 'react';
import { 
  Cloud, RefreshCw, Upload, Download, ShieldAlert, LogIn, LogOut, AlertCircle,
  Eye, EyeOff, Search, ArrowUpDown, SlidersHorizontal
} from 'lucide-react';
import { 
  auth, loginWithGoogle, logoutUser, uploadAllToFirebase, downloadAllFromFirebase, getBackupSnapshotsList
} from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Worker, Supplier, MaterialPreset, Customer, Project, DailyRecord, PaymentTransaction, WorkerAdvance, PettyCashTransaction } from '../types';

interface FirebaseSyncPanelProps {
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
  
  // ---- 同步診斷與防爆狀態 ----
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(() => localStorage.getItem('firebase_last_sync'));
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccessInfo, setSyncSuccessInfo] = useState<string | null>(null);

  // 滾動循環歷史快照狀態
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);

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

    const cleanForCompare = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      const copy = { ...obj };
      delete copy.updatedAt;
      delete copy.createdAt;
      delete copy.lastSyncTime;
      return copy;
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
          const cleanSnapStr = JSON.stringify(cleanForCompare(snapItem));
          const cleanCurrStr = JSON.stringify(cleanForCompare(item));
          if (cleanSnapStr !== cleanCurrStr) {
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        fetchBackups(user.uid);
      } else {
        setBackups([]);
      }
    });
    return () => unsubscribe();
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
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      
      {/* 頂部 Firebase 連線與雲端金鑰診斷面板 */}
      <div className="bg-neutral-900 text-white rounded-2xl p-6 shadow-xl border border-neutral-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-amber-500/20 text-amber-500 font-bold font-mono rounded-lg text-[10px] uppercase tracking-wider">
              Google Firebase Connected
            </span>
          </div>

          <div className="bg-[#1E1E1E] border border-neutral-700/50 p-4 rounded-xl flex items-center gap-4 shrink-0 w-full lg:w-auto">
            {authLoading ? (
              <div className="flex items-center gap-2 text-xs text-neutral-400 py-1 font-mono">
                <RefreshCw size={14} className="animate-spin text-amber-500" />
                <span>正在辨識安全憑證信號...</span>
              </div>
            ) : currentUser ? (
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-start xl:items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-bold text-white text-sm select-none shadow-md">
                    {currentUser.displayName ? currentUser.displayName[0] : '工'}
                  </div>
                  <div>
                    <span className="text-xs font-black block text-amber-400">{currentUser.displayName || '工務管理員'}</span>
                    <span className="text-[9px] text-neutral-400 font-mono block">{currentUser.email || 'offline-admin'}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-red-650/40 hover:bg-red-650 text-red-100 hover:text-white rounded-lg text-[11px] font-black tracking-wider transition-colors border border-red-900/50 flex items-center gap-1 select-none cursor-pointer"
                >
                  <LogOut size={11} />
                  <span>登出通道</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 w-full">
                <p className="text-[10px] text-neutral-400 leading-none font-bold">⚠️ 當前處於「離線暫存模式」，為防資料丟失，建議連結雲端：</p>
                <button
                  onClick={handleLogin}
                  className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 rounded-lg text-xs font-black tracking-wider transition-all shadow-md transform hover:scale-[1.01] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn size={13} />
                  <span>一鍵啟用 Google 伺服器對齊連線</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 雲端備份操作按鈕組 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-neutral-800">
          <button 
            type="button"
            disabled={isSyncing || !currentUser}
            onClick={handleUploadToFirebase}
            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${
              currentUser 
                ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15 text-amber-300 cursor-pointer shadow-3xs scale-100 hover:scale-[1.01]' 
                : 'bg-neutral-800/40 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Upload size={18} className="animate-bounce" />
              <span className="font-extrabold text-sm">一鍵同步：打包備份至雲端</span>
            </div>
            <p className="text-[10px] text-neutral-400 font-semibold max-w-md">
              {currentUser ? '將本地 9 大核心表格（點工、材料、案場公金等）全數打包上傳覆蓋雲端同名紀錄。' : '🔒 請先完成 Google 登入以解鎖雲端備份功能'}
            </p>
          </button>

          <button 
            type="button"
            disabled={isSyncing || !currentUser}
            onClick={handleDownloadFromFirebase}
            className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${
              currentUser 
                ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15 text-emerald-300 cursor-pointer shadow-3xs scale-100 hover:scale-[1.01]' 
                : 'bg-neutral-800/40 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Download size={18} />
              <span className="font-extrabold text-sm">一鍵還原：拉取雲端數據覆蓋本地</span>
            </div>
            <p className="text-[10px] text-neutral-400 font-semibold max-w-md">
              {currentUser ? '從 Firebase 安全下載您在上一個裝置備份完畢的資料，並完整覆蓋此瀏覽器中的暫存。' : '🔒 請先完成 Google 登入以解鎖雲端拉取功能'}
            </p>
          </button>
        </div>

        {/* 狀態診斷日誌輸出報告 */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="font-bold">雲端診斷與備份報告：</span>
            {lastSync && (
              <span className="font-mono text-neutral-500">上次同步完成時間：{lastSync}</span>
            )}
          </div>
          
          <div className="bg-neutral-950 p-4 rounded-xl text-xs font-mono border border-neutral-800 space-y-2">
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
          {backups.length > 0 && (
            <span className="text-[11px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
              共計雲端保存: {backups.length} 份快照
            </span>
          )}
        </div>

        {backupsLoading ? (
          <div className="py-8 text-center text-neutral-400 text-xs flex items-center justify-center gap-2 font-black">
            <RefreshCw size={14} className="animate-spin text-amber-500" />
            <span>正在取得 Google 備份快照備份列表...</span>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-6 bg-neutral-50 rounded-xl text-center border border-dashed border-neutral-200 text-xs text-neutral-400">
            📭 雲端目前尚無任何歷史快照備份。當您點擊「一鍵同步」時，此處將自動觸發備份建立！
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
