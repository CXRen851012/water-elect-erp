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
  writeBatch
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
              batch.set(docRef, {
                ...op.data,
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

  if (errors.length > 0) {
    const successMsg = successes.length > 0 ? "部分成功：\n" + successes.map(s => `✅ ${s}`).join('\n') + "\n\n" : "";
    const errorMsg = "⚠️ 以下資料表上傳失敗：\n" + errors.map(e => `❌ ${e}`).join('\n');
    return {
      success: successes.length > 0,
      message: successMsg + errorMsg
    };
  }

  return { success: true, message: '🎉 成功將本地 ERP 資料全部同步至 Google Cloud Firestore 雲端資料庫！' };
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

