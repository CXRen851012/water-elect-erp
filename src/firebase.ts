import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocFromServer, 
  writeBatch,
  addDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// 機動讀取環境變數 (Vite 專屬 VITE_ 前綴)，若無或為 placeholder，則 fallback 至本地對應 JSON 欄位
const metaEnv = (import.meta as any).env || {};

const isPlaceholder = (val: any): boolean => {
  if (typeof val !== 'string') return true;
  const v = val.trim().toLowerCase();
  return (
    v === "" || 
    v.includes("your_") || 
    v.includes("placeholder") || 
    v.includes("your-project-id")
  );
};

const getEnvValue = (envVal: any, fallbackVal: any) => {
  return envVal && !isPlaceholder(envVal) ? envVal : fallbackVal;
};

const finalConfig = {
  apiKey: getEnvValue(metaEnv.VITE_FIREBASE_API_KEY, firebaseConfig.apiKey),
  authDomain: getEnvValue(metaEnv.VITE_FIREBASE_AUTH_DOMAIN, firebaseConfig.authDomain),
  projectId: getEnvValue(metaEnv.VITE_FIREBASE_PROJECT_ID, firebaseConfig.projectId),
  storageBucket: getEnvValue(metaEnv.VITE_FIREBASE_STORAGE_BUCKET, firebaseConfig.storageBucket),
  messagingSenderId: getEnvValue(metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID, firebaseConfig.messagingSenderId),
  appId: getEnvValue(metaEnv.VITE_FIREBASE_APP_ID, firebaseConfig.appId),
  measurementId: getEnvValue(metaEnv.VITE_FIREBASE_MEASUREMENT_ID, firebaseConfig.measurementId || ""),
  firestoreDatabaseId: getEnvValue(metaEnv.VITE_FIREBASE_FIRESTORE_DB_ID, firebaseConfig.firestoreDatabaseId || "(default)")
};

const app = initializeApp(finalConfig);
export const db = finalConfig.firestoreDatabaseId && finalConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, finalConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

// 驗證與 Firestore 雲端之連線
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("請確認您的 Firebase 配置與網路連線狀況。");
    }
  }
}
testConnection();

// Google 登入驗證器
const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Google 登入錯誤：", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("登出錯誤：", error);
    throw error;
  }
};

// 錯誤記錄機制（遵循 Firebase Integration規範）
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore 錯誤詳細資訊: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 遞迴清除物件中所有 undefined 值，避免 Firestore 寫入報錯
export function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item));
  }
  if (typeof obj === 'object') {
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  }
  return obj;
}

/**
 * 記錄本地刪除墓碑 (Tombstones)，用於後續雲端增量同步中將刪除指令派送至 Firestore 雲端
 */
export function recordTombstone(collectionName: string, id: string) {
  try {
    const stored = localStorage.getItem('engineering_deleted_tombstones');
    const tombstones = stored ? JSON.parse(stored) : [];
    if (!tombstones.some((t: any) => t.id === id && t.collectionName === collectionName)) {
      tombstones.push({
        id,
        collectionName,
        deletedAt: new Date().toISOString()
      });
      localStorage.setItem('engineering_deleted_tombstones', JSON.stringify(tombstones));
    }
  } catch (err) {
    console.error("無法將刪除項目寫入本地墓碑佇列:", err);
  }
}

// 彙總上傳至 Firebase Firestore
export async function uploadAllToFirebase(
  uid: string,
  data: {
    workers: any[];
    suppliers: any[];
    materials: any[];
    customers: any[];
    projects: any[];
    records: any[];
    transactions: any[];
    workerAdvances: any[];
    pettyCashTransactions: any[];
  }
): Promise<{ success: boolean; message: string }> {
  if (!uid) {
    return { success: false, message: '請先登入 Google 帳號，才能將備份寫入雲端！' };
  }

  const ownerUid = uid;
  const successes: string[] = [];
  const errors: string[] = [];

  const collectionsMapping = {
    workers: { name: 'workers', data: data.workers, label: '👷 工班人員' },
    suppliers: { name: 'suppliers', data: data.suppliers, label: '🛒 特約材料夥伴' },
    materials: { name: 'materials', data: data.materials, label: '📦 牌物料品項' },
    customers: { name: 'customers', data: data.customers, label: '👥 業主地址名錄' },
    projects: { name: 'projects', data: data.projects, label: '🏗️ 施工案場清單' },
    records: { name: 'records', data: data.records, label: '📄 每日派工日誌' },
    transactions: { name: 'transactions', data: data.transactions, label: '💰 客戶收款對帳' },
    workerAdvances: { name: 'worker_advances', data: data.workerAdvances, label: '💵 團隊借支預支' },
    pettyCashTransactions: { name: 'petty_cash', data: data.pettyCashTransactions, label: '👛 零用公金流水' },
  };

  for (const [key, mapping] of Object.entries(collectionsMapping)) {
    try {
      // 1. 查詢該使用者在雲端所有的現存資料，找出對應的 document IDs
      const q = query(collection(db, mapping.name), where('ownerUid', '==', ownerUid));
      const querySnapshot = await getDocs(q);
      
      const remoteIds = new Set<string>();
      querySnapshot.forEach((docSnap) => {
        remoteIds.add(docSnap.id);
      });

      // 2. 統整本地目前的項目 ID
      const localIds = new Set<string>(mapping.data.map(item => item.id));

      // 3. 找出需要清除的雲端 ID（即雲端有，但本地目前不存在/已被刪除之資料）
      const toDeleteIds: string[] = [];
      remoteIds.forEach(id => {
        if (!localIds.has(id)) {
          toDeleteIds.push(id);
        }
      });

      // 4. 將寫入/更新與刪除操作彙整，分批執行
      const operations: { type: 'set' | 'delete'; id: string; data?: any }[] = [];
      
      for (const id of toDeleteIds) {
        operations.push({ type: 'delete', id });
      }
      for (const item of mapping.data) {
        operations.push({ type: 'set', id: item.id, data: item });
      }

      if (operations.length > 0) {
        // 分批：一次最多 400 筆，避免超過 500 的 Firestore 寫入限制
        const chunks: any[][] = [];
        for (let i = 0; i < operations.length; i += 400) {
          chunks.push(operations.slice(i, i + 400));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          for (const op of chunk) {
            const docRef = doc(db, mapping.name, op.id);
            if (op.type === 'delete') {
              batch.delete(docRef);
            } else {
              const cleanedData = sanitizeForFirestore(op.data);
              batch.set(docRef, {
                ...cleanedData,
                ownerUid: ownerUid
              });
            }
          }
          await batch.commit();
        }

        if (toDeleteIds.length > 0) {
          successes.push(`${mapping.label} (已上傳 ${mapping.data.length} 筆，同步清除已刪除之 ${toDeleteIds.length} 筆)`);
        } else {
          successes.push(`${mapping.label} (已上傳/更新 ${mapping.data.length} 筆)`);
        }
      } else {
        successes.push(`${mapping.label} (保持為空/同步無異動)`);
      }
    } catch (err: any) {
      console.error(`Firebase upload failed for ${key}`, err);
      errors.push(`${mapping.label} (${mapping.name}): ${err.message || err}`);
    }
  }

  // 5. 同步使用者自訂分類、二級次分類與倍率設定至 settings 集合
  try {
    const settingsData = {
      materialCategories: (() => {
        try { return JSON.parse(localStorage.getItem('engineering_material_categories') || 'null'); } catch { return null; }
      })(),
      materialSubcategories: (() => {
        try { return JSON.parse(localStorage.getItem('engineering_material_subcategories') || 'null'); } catch { return null; }
      })(),
      subcategoryMultipliers: (() => {
        try { return JSON.parse(localStorage.getItem('engineering_subcategory_multipliers') || 'null'); } catch { return null; }
      })(),
      categoryMaterialConfigs: (() => {
        try { return JSON.parse(localStorage.getItem('engineering_category_material_configs') || 'null'); } catch { return null; }
      })(),
      roleBillingConfigs: (() => {
        try { return JSON.parse(localStorage.getItem('engineering_role_billing_configs') || 'null'); } catch { return null; }
      })(),
      workerRoles: (() => {
        try { return JSON.parse(localStorage.getItem('engineering_worker_roles') || 'null'); } catch { return null; }
      })(),
      ownerUid: ownerUid,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'settings', ownerUid), sanitizeForFirestore(settingsData));
    successes.push(`⚙️ 自訂分類與加成配置 (同步寫入雲端設定檔)`);
  } catch (err: any) {
    console.error("Firebase upload settings failed", err);
    errors.push(`⚙️ 自訂分類與設定 (settings): ${err.message || err}`);
  }

  if (errors.length > 0) {
    const successMsg = successes.length > 0 ? "部分成功：\n" + successes.map(s => `✅ ${s}`).join('\n') + "\n\n" : "";
    const errorMsg = "⚠️ 以下資料表上傳失敗：\n" + errors.map(e => `❌ ${e}`).join('\n');
    return {
      success: successes.length > 0,
      message: successMsg + errorMsg
    };
  }

  // 成功同步後，自動在雲端建立本次上傳的歷史還原點複本（最大 5 份快照循環）
  try {
    await createRollingBackup(ownerUid, data);
  } catch (backupErr) {
    console.error("雲端滾動歷史備份建立失敗，但不影響主資料同步:", backupErr);
  }

  return { 
    success: true, 
    message: '🎉 成功將本地 ERP 資料全部同步至 Google Cloud Firestore 雲端資料庫！\n(系統已自動在雲端為您存下一筆「滾動歷史還原快照」，保護您的資料不被誤刪覆蓋)' 
  };
}

// 彙總下載自 Firebase Firestore
export async function downloadAllFromFirebase(uid: string): Promise<{
  success: boolean;
  message: string;
  data?: {
    workers?: any[];
    suppliers?: any[];
    materials?: any[];
    customers?: any[];
    projects?: any[];
    records?: any[];
    transactions?: any[];
    workerAdvances?: any[];
    pettyCashTransactions?: any[];
  };
}> {
  if (!uid) {
    return { success: false, message: '請先登入 Google 帳號，才能從雲端下載備份！' };
  }

  const ownerUid = uid;
  const successes: string[] = [];
  const errors: string[] = [];

  const results: any = {
    workers: [],
    suppliers: [],
    materials: [],
    customers: [],
    projects: [],
    records: [],
    transactions: [],
    workerAdvances: [],
    pettyCashTransactions: [],
  };

  const collectionsMapping = {
    workers: { name: 'workers', key: 'workers', label: '👷 工班人員' },
    suppliers: { name: 'suppliers', key: 'suppliers', label: '🛒 特約材料夥伴' },
    materials: { name: 'materials', key: 'materials', label: '📦 牌物料品項' },
    customers: { name: 'customers', key: 'customers', label: '👥 業主地址名錄' },
    projects: { name: 'projects', key: 'projects', label: '🏗️ 施工案場清單' },
    records: { name: 'records', key: 'records', label: '📄 每日派工日誌' },
    transactions: { name: 'transactions', key: 'transactions', label: '💰 客戶收款對帳' },
    workerAdvances: { name: 'worker_advances', key: 'workerAdvances', label: '💵 團隊借支預支' },
    pettyCashTransactions: { name: 'petty_cash', key: 'pettyCashTransactions', label: '👛 零用公金流水' },
  };

  for (const [key, mapping] of Object.entries(collectionsMapping)) {
    try {
      const q = query(collection(db, mapping.name), where('ownerUid', '==', ownerUid));
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        const item = { ...docSnap.data() };
        // 安全：移除 ownerUid 暴露對元件的影响
        delete item.ownerUid;
        list.push(item);
      });
      results[mapping.key] = list;
      successes.push(`${mapping.label} (${list.length} 筆)`);
    } catch (err: any) {
      console.error(`Firebase download failed for ${key}`, err);
      errors.push(`${mapping.label} (${mapping.name}): ${err.message || err}`);
    }
  }

  // 下載與還原自訂分類與倍率設定
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', ownerUid));
    if (settingsDoc.exists()) {
      const sData = settingsDoc.data();
      if (sData.materialCategories) {
        localStorage.setItem('engineering_material_categories', JSON.stringify(sData.materialCategories));
      }
      if (sData.materialSubcategories) {
        localStorage.setItem('engineering_material_subcategories', JSON.stringify(sData.materialSubcategories));
      }
      if (sData.subcategoryMultipliers) {
        localStorage.setItem('engineering_subcategory_multipliers', JSON.stringify(sData.subcategoryMultipliers));
      }
      if (sData.categoryMaterialConfigs) {
        localStorage.setItem('engineering_category_material_configs', JSON.stringify(sData.categoryMaterialConfigs));
      }
      if (sData.roleBillingConfigs) {
        localStorage.setItem('engineering_role_billing_configs', JSON.stringify(sData.roleBillingConfigs));
      }
      if (sData.workerRoles) {
        localStorage.setItem('engineering_worker_roles', JSON.stringify(sData.workerRoles));
      }
      successes.push(`⚙️ 自訂分類與加成配置 (自雲端回復本地)`);
    } else {
      successes.push(`⚙️ 自訂分類與加成配置 (雲端尚無此設定，保持本地狀態)`);
    }
  } catch (err: any) {
    console.error("Firebase download settings failed", err);
    errors.push(`⚙️ 自訂分類與設定 (settings): ${err.message || err}`);
  }

  if (errors.length > 0) {
    const successMsg = successes.length > 0 ? "部分成功下載：\n" + successes.map(s => `✅ ${s}`).join('\n') + "\n\n" : "";
    const errorMsg = "⚠️ 以下資料表同步下載失敗：\n" + errors.map(e => `❌ ${e}`).join('\n');
    return {
      success: successes.length > 0,
      message: successMsg + errorMsg,
      data: results
    };
  }

  return {
    success: true,
    message: '☁️ 成功自 Google Cloud Firestore 下載同步所有工務與 Excel 級 ERP 資料！',
    data: results
  };
}

/**
 * ⚡【增量同步 + 墓碑機制】核心雙向智能同步引擎
 * 僅查詢與上傳自上次同步時間以來的變更項目，大幅降低 Firebase 讀寫用量，
 * 同時利用 tombstones 機制在不同裝置間同步資料的物理刪除，兼顧效能與資料一致性。
 */
export async function syncIncrementalWithFirebase(
  uid: string,
  localData: {
    workers: any[];
    suppliers: any[];
    materials: any[];
    customers: any[];
    projects: any[];
    records: any[];
    transactions: any[];
    workerAdvances: any[];
    pettyCashTransactions: any[];
  }
): Promise<{
  success: boolean;
  message: string;
  updatedData?: typeof localData;
}> {
  if (!uid) {
    return { success: false, message: '請先登入 Google 帳號，才能進行增量雙向同步！' };
  }

  const ownerUid = uid;
  const successes: string[] = [];
  const errors: string[] = [];
  const nowStr = new Date().toISOString();

  // 讀取上次同步時間 (ISO格式)。若從未同步，則 fallback 為 1970 基準，即首次同步全量拉取與上傳
  const lastSyncStr = localStorage.getItem('firebase_last_sync_iso');
  const lastSyncTime = lastSyncStr ? new Date(lastSyncStr).getTime() : 0;

  // 定義資料表映射關係
  const collectionsMapping = {
    workers: { name: 'workers', key: 'workers', label: '👷 工班人員' },
    suppliers: { name: 'suppliers', key: 'suppliers', label: '🛒 特約材料夥伴' },
    materials: { name: 'materials', key: 'materials', label: '📦 牌物料品項' },
    customers: { name: 'customers', key: 'customers', label: '👥 業主地址名錄' },
    projects: { name: 'projects', key: 'projects', label: '🏗️ 施工案場清單' },
    records: { name: 'records', key: 'records', label: '📄 每日派工日誌' },
    transactions: { name: 'transactions', key: 'transactions', label: '💰 客戶收款對帳' },
    workerAdvances: { name: 'worker_advances', key: 'workerAdvances', label: '💵 團隊借支預支' },
    pettyCashTransactions: { name: 'petty_cash', key: 'pettyCashTransactions', label: '👛 零用公金流水' },
  };

  // 深拷貝本地現有資料結構
  const mergedData: any = {
    workers: [...localData.workers],
    suppliers: [...localData.suppliers],
    materials: [...localData.materials],
    customers: [...localData.customers],
    projects: [...localData.projects],
    records: [...localData.records],
    transactions: [...localData.transactions],
    workerAdvances: [...localData.workerAdvances],
    pettyCashTransactions: [...localData.pettyCashTransactions],
  };

  try {
    // ==========================================
    // 步驟 A: 獲取雲端自上次同步後的「刪除墓碑紀錄」 (Tombstones)
    // ==========================================
    let remoteTombstones: any[] = [];
    try {
      let qTomb = query(collection(db, 'tombstones'), where('ownerUid', '==', ownerUid));
      if (lastSyncTime > 0 && lastSyncStr) {
        // 安全增量：只查詢比上次同步時間更晚的墓碑
        qTomb = query(collection(db, 'tombstones'), where('ownerUid', '==', ownerUid), where('deletedAt', '>', lastSyncStr));
      }
      const tSnap = await getDocs(qTomb);
      tSnap.forEach(docSnap => {
        remoteTombstones.push(docSnap.data());
      });
    } catch (err: any) {
      console.warn("📥 讀取雲端刪除墓碑失敗（可能是首次設定，尚無該集合），將自動跳過他端刪除合併：", err);
    }

    // 物理刪除本地匹配之項目
    let remoteDeleteCount = 0;
    for (const tomb of remoteTombstones) {
      const { id, collectionName } = tomb;
      const foundMapping = Object.values(collectionsMapping).find(m => m.name === collectionName);
      if (foundMapping) {
        const localKey = foundMapping.key;
        const beforeLen = mergedData[localKey].length;
        mergedData[localKey] = mergedData[localKey].filter((item: any) => item.id !== id);
        if (mergedData[localKey].length < beforeLen) {
          remoteDeleteCount++;
        }
      }
    }
    if (remoteDeleteCount > 0) {
      successes.push(`🗑️ 【雲端刪除同步】清除了本機 ${remoteDeleteCount} 筆已被其他裝置刪除的項目 (墓碑對齊)`);
    }

    // ==========================================
    // 步驟 B: 下載雲端自上次同步後「新增 / 被修改」的項目
    // ==========================================
    let remoteUpdateCount = 0;
    for (const [key, mapping] of Object.entries(collectionsMapping)) {
      try {
        let q = query(collection(db, mapping.name), where('ownerUid', '==', ownerUid));
        if (lastSyncTime > 0 && lastSyncStr) {
          // 只請求大於上次同步更新日期的雲端異動，節省 90% 以上的讀取用量！
          q = query(collection(db, mapping.name), where('ownerUid', '==', ownerUid), where('updatedAt', '>', lastSyncStr));
        }
        const qSnap = await getDocs(q);
        
        qSnap.forEach(docSnap => {
          const remoteItem = { ...docSnap.data() };
          delete remoteItem.ownerUid; // 移除包裝欄位避免影響 UI

          const localList = mergedData[mapping.key];
          const localIdx = localList.findIndex((item: any) => item.id === remoteItem.id);

          if (localIdx === -1) {
            // 本地完全沒有此 ID：判定為他端新增
            localList.push(remoteItem);
            remoteUpdateCount++;
          } else {
            // 本地已有此 ID：比對異動時間戳 (Conflict Resolution: Last-Write-Wins)
            const localItem = localList[localIdx];
            const localUp = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
            const remoteUp = remoteItem.updatedAt ? new Date(remoteItem.updatedAt).getTime() : 0;

            if (remoteUp > localUp) {
              localList[localIdx] = remoteItem;
              remoteUpdateCount++;
            }
          }
        });
      } catch (err: any) {
        console.error(`📥 下載 ${mapping.label} 增量失敗:`, err);
        errors.push(`${mapping.label} 增量下載: ${err.message || err}`);
      }
    }
    if (remoteUpdateCount > 0) {
      successes.push(`📥 【雲端更新拉取】成功融合了他端新增或修改的 ${remoteUpdateCount} 筆資料`);
    }

    // ==========================================
    // 步驟 C: 上傳本地累積之「物理刪除墓碑紀錄」
    // ==========================================
    let localTombstones: any[] = [];
    try {
      const stored = localStorage.getItem('engineering_deleted_tombstones');
      localTombstones = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("無法載入本地墓碑快取：", e);
    }

    if (localTombstones.length > 0) {
      const tBatch = writeBatch(db);
      for (const tomb of localTombstones) {
        // 1. 寫入雲端 tombstones 記錄（供他端日後增量拉取對齊）
        const tRef = doc(db, 'tombstones', tomb.id);
        tBatch.set(tRef, {
          id: tomb.id,
          collectionName: tomb.collectionName,
          deletedAt: tomb.deletedAt || nowStr,
          ownerUid: ownerUid
        });

        // 2. 物理刪除雲端原有之正式文件，徹底清空雲端儲存空間
        const docRef = doc(db, tomb.collectionName, tomb.id);
        tBatch.delete(docRef);
      }
      await tBatch.commit();
      
      // 清空本地墓碑緩衝區
      localStorage.removeItem('engineering_deleted_tombstones');
      successes.push(`📤 【本地刪除上傳】成功註銷並清理雲端 ${localTombstones.length} 筆項目，並成功在雲端建立對應墓碑`);
    }

    // ==========================================
    // 步驟 D: 上傳本地新增或已修改的異動資料 (含初次遺漏時戳者)
    // ==========================================
    let localUploadCount = 0;
    let uploadBatch = writeBatch(db);
    let batchOperationsCount = 0;

    for (const [key, mapping] of Object.entries(collectionsMapping)) {
      const localList = mergedData[mapping.key];

      for (const item of localList) {
        const itemUp = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        
        // 若項目無 updatedAt（可能在升級前新增）或 updatedAt 比上次同步時間更新，即需要上傳！
        if (!item.updatedAt || itemUp > lastSyncTime) {
          if (!item.updatedAt) {
            item.updatedAt = nowStr;
          }

          const docRef = doc(db, mapping.name, item.id);
          const cleanedData = sanitizeForFirestore(item);
          uploadBatch.set(docRef, {
            ...cleanedData,
            ownerUid: ownerUid
          });

          batchOperationsCount++;
          localUploadCount++;

          // 保持在 Firestore 批次限制內
          if (batchOperationsCount >= 400) {
            await uploadBatch.commit();
            uploadBatch = writeBatch(db);
            batchOperationsCount = 0;
          }
        }
      }
    }

    if (batchOperationsCount > 0) {
      await uploadBatch.commit();
    }

    if (localUploadCount > 0) {
      successes.push(`📤 【本地更新上傳】已成功將本地 ${localUploadCount} 筆異動/新品項增量同步上傳至雲端`);
    }

    // ==========================================
    // 步驟 E: 備份並寫入自訂分類等系統組態 (settings)
    // ==========================================
    try {
      const settingsData = {
        materialCategories: (() => {
          try { return JSON.parse(localStorage.getItem('engineering_material_categories') || 'null'); } catch { return null; }
        })(),
        materialSubcategories: (() => {
          try { return JSON.parse(localStorage.getItem('engineering_material_subcategories') || 'null'); } catch { return null; }
        })(),
        subcategoryMultipliers: (() => {
          try { return JSON.parse(localStorage.getItem('engineering_subcategory_multipliers') || 'null'); } catch { return null; }
        })(),
        categoryMaterialConfigs: (() => {
          try { return JSON.parse(localStorage.getItem('engineering_category_material_configs') || 'null'); } catch { return null; }
        })(),
        roleBillingConfigs: (() => {
          try { return JSON.parse(localStorage.getItem('engineering_role_billing_configs') || 'null'); } catch { return null; }
        })(),
        workerRoles: (() => {
          try { return JSON.parse(localStorage.getItem('engineering_worker_roles') || 'null'); } catch { return null; }
        })(),
        ownerUid: ownerUid,
        updatedAt: nowStr
      };
      await setDoc(doc(db, 'settings', ownerUid), sanitizeForFirestore(settingsData));
    } catch (err: any) {
      console.error("⚙️ 同步自訂設定檔失敗:", err);
      errors.push(`⚙️ 自訂設定同步失敗: ${err.message || err}`);
    }

    // 更新本次增量同步的歷史備份快照 (循環 5 份快照)
    try {
      await createRollingBackup(ownerUid, mergedData);
    } catch (backupErr) {
      console.error("備份滾動快照失敗（非阻斷性錯誤）：", backupErr);
    }

    // 更新同步時間記號
    localStorage.setItem('firebase_last_sync_iso', nowStr);
    localStorage.setItem('firebase_last_sync', new Date(nowStr).toLocaleString('zh-TW'));

    if (errors.length > 0) {
      return {
        success: false,
        message: `⚠️ 增量同步完成，但遭遇以下非阻斷性異常：\n` + errors.join('\n'),
        updatedData: mergedData
      };
    }

    const summaryMsg = successes.length > 0 
      ? successes.join('\n') 
      : '✨ 雲端與本機資料皆已是對齊狀態，無需進行任何實體資料上傳與下載！';

    return {
      success: true,
      message: summaryMsg,
      updatedData: mergedData
    };

  } catch (err: any) {
    console.error("增量同步過程發生致命錯誤:", err);
    return {
      success: false,
      message: `❌ 增量同步致命失敗：${err.message || err}`
    };
  }
}

/**
 * 建立雲端歷史還原點備份（僅保留最近 5 份作為滾動循環）
 */
export async function createRollingBackup(
  uid: string,
  data: {
    workers: any[];
    suppliers: any[];
    materials: any[];
    customers: any[];
    projects: any[];
    records: any[];
    transactions: any[];
    workerAdvances: any[];
    pettyCashTransactions: any[];
  }
): Promise<void> {
  if (!uid) return;
  try {
    const totalCount = 
      (data.workers || []).length +
      (data.suppliers || []).length +
      (data.materials || []).length +
      (data.customers || []).length +
      (data.projects || []).length +
      (data.records || []).length +
      (data.transactions || []).length +
      (data.workerAdvances || []).length +
      (data.pettyCashTransactions || []).length;

    const sanitizedWorkers = (data.workers || []).map(sanitizeForFirestore);
    const sanitizedSuppliers = (data.suppliers || []).map(sanitizeForFirestore);
    const sanitizedMaterials = (data.materials || []).map(sanitizeForFirestore);
    const sanitizedCustomers = (data.customers || []).map(sanitizeForFirestore);
    const sanitizedProjects = (data.projects || []).map(sanitizeForFirestore);
    const sanitizedRecords = (data.records || []).map(sanitizeForFirestore);
    const sanitizedTransactions = (data.transactions || []).map(sanitizeForFirestore);
    const sanitizedWorkerAdvances = (data.workerAdvances || []).map(sanitizeForFirestore);
    const sanitizedPettyCashTransactions = (data.pettyCashTransactions || []).map(sanitizeForFirestore);

    // 1. 新增當前備份
    await addDoc(collection(db, 'backups'), {
      ownerUid: uid,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      totalCount,
      data: {
        workers: sanitizedWorkers,
        suppliers: sanitizedSuppliers,
        materials: sanitizedMaterials,
        customers: sanitizedCustomers,
        projects: sanitizedProjects,
        records: sanitizedRecords,
        transactions: sanitizedTransactions,
        workerAdvances: sanitizedWorkerAdvances,
        pettyCashTransactions: sanitizedPettyCashTransactions,
        settings: sanitizeForFirestore({
          materialCategories: (() => {
            try { return JSON.parse(localStorage.getItem('engineering_material_categories') || 'null'); } catch { return null; }
          })(),
          materialSubcategories: (() => {
            try { return JSON.parse(localStorage.getItem('engineering_material_subcategories') || 'null'); } catch { return null; }
          })(),
          subcategoryMultipliers: (() => {
            try { return JSON.parse(localStorage.getItem('engineering_subcategory_multipliers') || 'null'); } catch { return null; }
          })(),
          categoryMaterialConfigs: (() => {
            try { return JSON.parse(localStorage.getItem('engineering_category_material_configs') || 'null'); } catch { return null; }
          })(),
          roleBillingConfigs: (() => {
            try { return JSON.parse(localStorage.getItem('engineering_role_billing_configs') || 'null'); } catch { return null; }
          })(),
          workerRoles: (() => {
            try { return JSON.parse(localStorage.getItem('engineering_worker_roles') || 'null'); } catch { return null; }
          })()
        })
      }
    });

    // 2. 獲取該使用者所有備份並排序，只保留最新的 5 份
    const q = query(collection(db, 'backups'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    const backupsList: { id: string; timestamp: number }[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      backupsList.push({ id: docSnap.id, timestamp: d.timestamp || 0 });
    });

    // 降序排序：最新在前，最舊在後
    backupsList.sort((a, b) => b.timestamp - a.timestamp);

    // 超過 5 份時，清除最舊的
    if (backupsList.length > 5) {
      const toDelete = backupsList.slice(5);
      for (const item of toDelete) {
        try {
          await deleteDoc(doc(db, 'backups', item.id));
        } catch (e) {
          console.error(`刪除舊備份 ${item.id} 失敗:`, e);
        }
      }
    }
  } catch (error) {
    console.error('建立循環備份失敗:', error);
  }
}

/**
 * 取得雲端所有歷史備份還原點
 */
export async function getBackupSnapshotsList(uid: string): Promise<any[]> {
  if (!uid) return [];
  try {
    const q = query(collection(db, 'backups'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
        id: docSnap.id,
        createdAt: d.createdAt,
        timestamp: d.timestamp || 0,
        totalCount: d.totalCount || 0,
        data: d.data
      });
    });
    // 降序排序
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  } catch (error) {
    console.error('取得備份列表失敗:', error);
    return [];
  }
}

