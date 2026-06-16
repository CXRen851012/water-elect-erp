import React, { useState, useEffect } from 'react';
import { 
  Cloud, RefreshCw, Upload, Download, ShieldAlert, Check, LogIn, LogOut, AlertCircle
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

  // ---- 🛠️ 自定義 Firebase 金鑰配置導引狀態 ----
  const [showConfigGuide, setShowConfigGuide] = useState(false);

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

  useEffect(() => {
    if (syncError && (
      syncError.toLowerCase().includes('api-key-not-valid') || 
      syncError.toLowerCase().includes('api key') ||
      syncError.toLowerCase().includes('unauthorized-domain') ||
      syncError.toLowerCase().includes('unauthorized domain')
    )) {
      setShowConfigGuide(true);
    }
  }, [syncError]);

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

  // ---- 雲端一鍵備份 (上傳所有 9 大模組至 Firestore) ----
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
        onSaveToast('☁️ 雲端全庫備份與循環快照已建立！');
        fetchBackups(currentUser.uid); // 刷新備份快照列表
      } else {
        setSyncError(result.message);
        onSaveToast('⚠️ 雲端備份有部分失敗，請查看控制診斷報告。');
      }
    } catch (err: any) {
      setSyncError(err?.message || '不明連線或安全性權限拒絕錯誤。');
      onSaveToast('❌ 同步上傳遭遇安全性攔截。');
    } finally {
      setIsSyncing(false);
    }
  };

  // ---- 雲端一鍵還原 (從 Firestore 下載 9 大模組覆蓋本地) ----
  const handleDownloadFromFirebase = () => {
    if (!currentUser) {
      onSaveToast('⚠️ 請先登入 Google 帳號，才能從雲端還原您的多載資料！');
      return;
    }

    triggerConfirm(
      '🚨 警告：還原將覆蓋本地數據！',
      '您目前瀏覽器中的本地暫存數據將會被雲端資料完全覆蓋！確定要執行還原嗎？',
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

            onSaveToast('☁️ 雲端還原全庫覆蓋已成功！請核對當前數據。');
          } else {
            setSyncError(result.message);
            onSaveToast('⚠️ 雲端還原未完成，查無備份或連線不穩。');
          }
        } catch (err: any) {
          setSyncError(err?.message || '還原同步出錯。');
          onSaveToast('❌ 同步還原遭遇攔截。');
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
            
            // 同時更新上次同步到 localStorage 保持對齊
            setLastSync(dateStr);
            localStorage.setItem('firebase_last_sync', dateStr);
            
            onSaveToast(`✨ 倒帶還原成功！已回復至歷史時間快照：[ ${dateStr} ]！`);
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 bg-amber-500/20 text-amber-500 font-bold font-mono rounded-lg text-[10px] uppercase tracking-wider">
                Google Firebase Powered
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                雲端主機通道已就緒 (免寫SQL)
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight leading-none flex items-center gap-2">
              <Cloud className="text-amber-500" size={24} />
              <span>水電工務通 雲端備份中心</span>
            </h2>
            <p className="text-xs text-neutral-400 max-w-2xl font-medium leading-relaxed">
              全面轉用零 SQL 維護的 <strong>Google Cloud Firestore</strong> 企業級雲端資料庫。
              Google 專利的安全連線與防護，讓您的工班點工日誌與材料帳目能在多台裝置間一鍵備份與還原。
            </p>
          </div>

          <div className="bg-neutral-800/60 border border-neutral-700/50 p-4 rounded-xl flex items-center gap-4 shrink-0 w-full lg:w-auto">
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
                  💡 建議解決方案：1) 確認在 AWS / Cloud Run 或 Vercel 環境中的 IP 能對外網建立 HTTP 連接。2) 確認專案已成功執行過 Firebase set_up 生效。3) 重新按 Google 登入對齊認證身分。
                </p>
              </div>
            )}

            {!isSyncing && !syncSuccessInfo && !syncError && (
              <div className="text-neutral-500 text-[11px] leading-relaxed">
                [診斷器] 機房信號正常。等待操作指引。
                {!currentUser && '（提示：當前處於「離線暫存模式」，為防資料丟失，建議隨時點擊登入以便儲存至 Google 雲端資料庫中。）'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 💾 雲端備份歷史快照還原中心 (滾動自動備份) */}
      {currentUser && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-3xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-amber-500 rounded-full inline-block animate-pulse"></span>
                <span className="text-[10px] font-black text-amber-800 tracking-wider uppercase block">Rolling Backups</span>
              </div>
              <h3 className="text-sm font-black text-neutral-900 flex items-center gap-1.5">
                <span>💾 雲端歷史快照備份中心 (最多保留 5 份快照)</span>
              </h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                系統會在您每次點擊<strong>「一鍵同步」</strong>時，自動在雲端為您存下一份完整的「資料庫時間戳快照」。
                若發生誤刪或誤覆蓋，您隨時可以點擊下方對應的時間點「還原此快照」！
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchBackups(currentUser.uid)}
              className="px-3 py-1.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg flex items-center gap-1 border border-neutral-200 self-start md:self-center cursor-pointer select-none"
            >
              <RefreshCw size={12} className={backupsLoading ? 'animate-spin' : ''} />
              <span>重整列表</span>
            </button>
          </div>

          {backupsLoading ? (
            <div className="py-6 flex justify-center items-center text-xs text-neutral-500 gap-2 font-mono">
              <RefreshCw size={14} className="animate-spin text-amber-500" />
              <span>正在向 Google Cloud 請求歷史快照清單...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="p-6 bg-neutral-50 rounded-xl text-center border border-dashed border-neutral-200 text-xs text-neutral-400">
              📭 雲端目前尚無任何歷史快照備份。當您點擊「一鍵同步」時，此處將自動觸發備份建立！
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((bk, idx) => {
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
                  <div key={bk.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-250/60 rounded-xl transition-all gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 bg-neutral-800 text-white rounded-md text-[10px] font-mono font-bold select-none">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-black font-mono text-neutral-800">
                          {showDate}
                        </span>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-800 font-extrabold text-[9px] rounded-md border border-amber-200/40 font-sans">
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

                    <button
                      type="button"
                      onClick={() => handleRestoreFromSnapshot(bk)}
                      className="px-3.5 py-2 border border-neutral-300 hover:border-amber-600 hover:bg-amber-100 bg-white text-neutral-800 font-black text-xs rounded-lg transition-all self-end sm:self-center flex items-center gap-1.5 hover:text-amber-850 shadow-3xs cursor-pointer select-none"
                    >
                      <RefreshCw size={12} className="text-amber-600" />
                      <span>還原此快照</span>
                    </button>
                  </div>
                );
              })}
              <p className="text-[9px] text-neutral-400 font-mono text-right italic">
                * 本滾動歷史備份包含點工、材料廠商、案場、派工日誌、借支預支及零用公金流水等全部 9 大模組。最多保留 5 份，超額自動洗牌清除最舊紀錄，請安心存取！
              </p>
            </div>
          )}
        </div>
      )}

      {/* 🛠️ 自定義 Firebase 雲端備份庫金鑰配置指南 */}
      <div className="bg-white rounded-2xl border border-neutral-205 p-6 shadow-3xs space-y-4">
        <button
          type="button"
          onClick={() => setShowConfigGuide(!showConfigGuide)}
          className="w-full flex items-center justify-between text-left select-none cursor-pointer focus:outline-none"
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-amber-700 transition-colors ${showConfigGuide ? 'bg-amber-100' : 'bg-neutral-100'}`}>
              <ShieldAlert size={16} />
            </div>
            <div>
              <span className="text-xs font-black text-amber-800 tracking-wider uppercase block">Self-Service Configuration</span>
              <h3 className="text-sm font-black text-neutral-900">🛠️ 點我展開：專屬自定義 Firebase 備份金鑰配置修復手冊</h3>
            </div>
          </div>
          <span className="text-xs text-neutral-400 font-extrabold font-mono select-none">
            {showConfigGuide ? '▲ 點擊收合' : '▼ 點擊展開修復'}
          </span>
        </button>

        {showConfigGuide && (
          <div className="text-xs text-neutral-700 font-sans leading-relaxed pt-3 border-t border-dotted border-neutral-200 animate-fadeIn space-y-4">
            
            {/* Warning block */}
            {syncError && (syncError.toLowerCase().includes('unauthorized') || syncError.toLowerCase().includes('authority') || syncError.toLowerCase().includes('domain')) ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2.5">
                <span className="text-xs font-black text-amber-800 flex items-center gap-1.5">
                  <ShieldAlert size={16} /> 偵測到 Firebase 安全阻擋：`auth/unauthorized-domain` (未授權網域)
                </span>
                <p className="text-[11px] text-amber-940 font-medium leading-relaxed">
                  為保護您的 Google Sign-In 帳務安全，您的自建 Firebase 專案必須授權當前運行 ERP 系統之網頁網域進行登入驗證。
                  請跟隨以下 3 步操作，在 Firebase 控制台解鎖當前網域：
                </p>
                <div className="space-y-1.5 pl-1.5 text-[11px] text-neutral-700">
                  <div className="flex gap-1.5">
                    <strong>1.</strong> 
                    <span>前往 <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-amber-850 font-extrabold underline hover:text-amber-900">Firebase 控制台 (console.firebase.google.com)</a> 並點擊進入您的專案中。</span>
                  </div>
                  <div className="flex gap-1.5">
                    <strong>2.</strong> 
                    <span>點擊左側選單的 <strong>「Authentication (身分驗證)」</strong>，進入上方的 <strong>「設定 (Settings)」</strong> 標籤頁 → 點擊 <strong>「授權網域 (Authorized domains)」</strong>。</span>
                  </div>
                  <div className="flex gap-1.5">
                    <strong>3.</strong> 
                    <span>點選 <strong>「新增網域」</strong>，將以下您 ERP 系統當前使用的兩個專用網際網路網域（不含 https:// 與尾巴斜線路徑）拷貝新增進去：</span>
                  </div>
                  <div className="mt-1 pb-1 font-mono text-[10px] bg-white text-neutral-800 p-2.5 rounded-lg border border-amber-200 space-y-1 block">
                    <div className="flex items-center select-all cursor-pointer">
                      <code>ais-dev-ithpyf7klw4jrc27hgbubh-9881502283.asia-northeast1.run.app</code>
                    </div>
                    <div className="flex items-center select-all cursor-pointer">
                      <code>ais-pre-ithpyf7klw4jrc27hgbubh-9881502283.asia-northeast1.run.app</code>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-700 font-extrabold mt-1">
                    💡 貼心提示：新增完畢並點擊儲存後，請【重新整理網頁 (F5)】，再次點擊 Google 登入就完成了！
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-50/70 border border-red-200/50 rounded-xl space-y-1.5">
                <span className="text-xs font-black text-red-650 flex items-center gap-1">
                  <AlertCircle size={14} /> 為什麼會出現 `auth/api-key-not-valid` 錯誤？
                </span>
                <p className="text-[11px] text-red-950 font-medium">
                  本系統原本預設綁定的 Firebase 基礎建設屬於原作者開發環境。當您在 AI Studio 分叉/複製 (Remix)
                  此專案時，您目前的 Google 測試帳號沒有寫入或託管該預置專案的系統層權限。所以會引發安全攔截與憑證失效。
                </p>
                <p className="text-[11px] text-neutral-650 font-bold block">
                  💡 別擔心！您可以按照下方指引，在一分鐘內完成您專屬的「完全免費」雲端備份機房配置，讓數據即刻開始對齊雲端！
                </p>
              </div>
            )}

            {/* List steps */}
            <div className="space-y-3.5 pl-1">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-neutral-900 flex items-center justify-center font-black font-mono text-[10px] shrink-0 mt-0.5">1</span>
                <div>
                  <h4 className="font-extrabold text-neutral-900 text-xs">創建免費 Firebase 雲端專案</h4>
                  <p className="text-neutral-500 text-[11px]">
                    請點選前往 <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-amber-600 font-bold underline hover:text-amber-700">Firebase 控制台 (console.firebase.google.com)</a> 並使用您的 Google 帳號登入。
                    點擊 <strong>「新增專案」</strong>，為專案隨意命名（如 <code>watelect-erp</code>），並一路下一步直到完成創建。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-neutral-900 flex items-center justify-center font-black font-mono text-[10px] shrink-0 mt-0.5">2</span>
                <div>
                  <h4 className="font-extrabold text-neutral-900 text-xs">啟用 Firestore Database 雲端存儲</h4>
                  <p className="text-neutral-500 text-[11px]">
                    進入 Firebase 專案大廳後，在側邊欄進入 <strong>「Firestore Database」</strong>，點擊「建立資料庫」。
                    在安全規則選擇 <strong>「測試模式」</strong> (以方便您免配置複雜權限即刻存取)，機房位置選擇東亞或台灣 <strong>(如 asia-east1 或 asia-northeast1)</strong> 後點擊完成啟用。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-neutral-900 flex items-center justify-center font-black font-mono text-[10px] shrink-0 mt-0.5">3</span>
                <div>
                  <h4 className="font-extrabold text-neutral-900 text-xs">生成 Web 應用程式憑證 (Web SDK Config)</h4>
                  <p className="text-neutral-500 text-[11px]">
                    回到專案首頁大廳，點擊齒輪下的首頁大標題，在正中間點擊 <strong>「Web {"(</>)"}」圖示</strong> 來註冊一個網頁 App (例如命名為 <code>web-client</code>)。
                    完成後，畫面將會顯示您的 <strong>firebaseConfig JSON 程式碼</strong>。裡面將包含 <code>apiKey</code>、<code>authDomain</code>、<code>projectId</code>、<code>appId</code> 等專屬金鑰。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-neutral-900 flex items-center justify-center font-black font-mono text-[10px] shrink-0 mt-0.5">4</span>
                <div>
                  <h4 className="font-extrabold text-neutral-900 text-xs">在 AI Studio 核心面板綁定環境變數</h4>
                  <p className="text-neutral-500 text-[11px] leading-relaxed">
                    現在回到您正在閱讀的 AI Studio 視窗，點擊右上角控制列的 <strong>「Settings ⚙️ (設定)」</strong> → 
                    進入 <strong>「Environment Variables (環境變數)」</strong> 選項，並逐一<strong>新增</strong>貼上您剛剛複製的參數（大小寫與底線必須完全符合）：
                  </p>
                  <div className="mt-2 text-[10px] font-mono bg-neutral-900 text-neutral-300 p-2.5 rounded-xl border border-neutral-800 space-y-1 block leading-relaxed">
                    <div><span className="text-sky-400">VITE_FIREBASE_API_KEY</span> = (對應畫面中的 apiKey)</div>
                    <div><span className="text-sky-400">VITE_FIREBASE_AUTH_DOMAIN</span> = (對應畫面中的 authDomain)</div>
                    <div><span className="text-sky-400">VITE_FIREBASE_PROJECT_ID</span> = (對應畫面中的 projectId)</div>
                    <div><span className="text-sky-400">VITE_FIREBASE_APP_ID</span> = (對應畫面中的 appId)</div>
                    <div><span className="text-sky-400">VITE_FIREBASE_STORAGE_BUCKET</span> = (對應畫面中的 storageBucket)</div>
                    <div><span className="text-sky-400">VITE_FIREBASE_MESSAGING_SENDER_ID</span> = (對應畫面中的 messagingSenderId)</div>
                    <div><span className="text-sky-400">VITE_FIREBASE_FIRESTORE_DB_ID</span> = <span className="text-amber-500">"(default)"</span> (保持預設即可)</div>
                  </div>
                  <p className="text-[10px] text-amber-600 font-extrabold mt-1.5 leading-none">
                    ⚠️ 提示：填寫完畢後，點選儲存成功後，請直接【重新整理瀏覽器 (F5)】，系統即能無縫對齊您自定義的安全雲端通道！
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-150 text-[11px] text-neutral-500 space-y-1">
              <span className="font-black text-neutral-800 block">💡 專業級備審建議與優化 (ERP 帳務安全層面)</span>
              <div>• <strong>安全规则强化：</strong>當完成功能串接後，請儘快將 Firestore rules 由測試模式改為屬性防衛 (ABAC)，保障個人與企業之工務帳務隱私。</div>
              <div>• <strong>完全免費：</strong>Firebase 提供免費每月萬次資料讀寫額度 (Firestore Spark Free Plan)，非常適合全日工務紀錄與小團隊備份，不收取任何一毛錢。</div>
            </div>

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
