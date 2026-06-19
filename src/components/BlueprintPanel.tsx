import React, { useState } from 'react';
import { Project, Worker, MaterialPreset, DailyRecord, Customer, Supplier, PaymentTransaction, WorkerAdvance, PettyCashTransaction } from '../types';
import { 
  Sparkles, ClipboardList, Users, HardHat, ShoppingBag, Store, 
  Coins, FolderLock, Landmark, ArrowRight, CheckCircle2, ShieldAlert, 
  Info, BarChart3, Clock, Layers, HelpCircle, ArrowUpRight
} from 'lucide-react';

interface BlueprintPanelProps {
  projects: Project[];
  records: DailyRecord[];
  customers: Customer[];
  workers: Worker[];
  materials: MaterialPreset[];
  suppliers: Supplier[];
  transactions: PaymentTransaction[];
  workerAdvances: WorkerAdvance[];
  pettyCashTransactions: PettyCashTransaction[];
  setActiveTab: (tab: 'blueprint' | 'construction' | 'billing' | 'workers' | 'materials') => void;
  setRecordsSubTab: (subTab: 'today' | 'projects' | 'history' | 'customers') => void;
  setMaterialsSubTab?: (subTab: 'records' | 'suppliers') => void;
}

export default function BlueprintPanel({
  projects,
  records,
  customers,
  workers,
  materials,
  suppliers,
  transactions,
  workerAdvances,
  pettyCashTransactions,
  setActiveTab,
  setRecordsSubTab,
  setMaterialsSubTab,
}: BlueprintPanelProps) {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // 計算動態指標
  const activeProjectsCount = projects.filter(p => !p.isCompleted).length;
  const totalContractVal = projects.reduce((sum, p) => sum + (p.estimationQuoteAmount || 0), 0);
  
  // 計算總預收款 (client_pool 代表儲存至客戶預收款，advance 代表未施作保證金訂金)
  const totalPrepaid = transactions
    .filter(t => t.allocationType === 'client_pool' || t.allocationType === 'advance')
    .reduce((sum, t) => sum + t.amount, 0);

  // 計算已提兌/已沖銷 (特定工程案場從預收池扣抵轉充銷)
  const totalDeducted = transactions
    .filter(t => t.allocationType === 'specific_project' && t.method === '從預收款溢收抵扣')
    .reduce((sum, t) => sum + t.amount, 0);

  const prepaidPoolBalance = totalPrepaid - totalDeducted;

  // 計算師傅累計借支呆帳
  const totalBorrowed = workerAdvances.filter(a => a.type === 'borrow').reduce((sum, a) => sum + a.amount, 0);
  const totalRepaidBySalary = workerAdvances.filter(a => a.type === 'repay').reduce((sum, a) => sum + a.amount, 0);
  const totalAdvancedDebt = totalBorrowed - totalRepaidBySalary;

  // 系統功能模組配置清單
  const modules = [
    {
      id: 'records-projects',
      num: '1',
      title: '案場工作流看板',
      icon: <FolderLock className="text-amber-700 stroke-[2.5]" size={24} />,
      badge: '已上線',
      stats: `${activeProjectsCount} 個在建中 / ${projects.length} 個案場總數`,
      desc: '視覺化管理工程進度（估價簽認、施工在建 WIP、會計對帳、結案歸檔）。卡片即時透視業主資訊、合約估值、累計實耗工料隱性成本、預收抵扣與現場收款狀況，根絕作帳黑洞。',
      actionText: '前往案場看板',
      action: () => {
        setActiveTab('construction');
        setRecordsSubTab('projects');
      }
    },
    {
      id: 'customers',
      num: '2',
      title: '顧客與業主登記簿',
      icon: <Users className="text-amber-700 stroke-[2.5]" size={24} />,
      badge: '已上線',
      stats: `${customers.length} 個特約建商/業主登記`,
      desc: '完整登載發包業主或工務採購單位基本資訊與旗下多個施作案場、地址（一對多位址關聯簿）。支援快速檢索歷史合約、現有在建專案與專款專用款餘額。',
      actionText: '管理特約業主',
      action: () => {
        setActiveTab('construction');
        setRecordsSubTab('customers');
      }
    },
    {
      id: 'workers',
      num: '3',
      title: '工班名冊與請款費率',
      icon: <HardHat className="text-amber-700 stroke-[2.5]" size={24} />,
      badge: '雙重費率',
      stats: `${workers.length} 位在登正規/臨時師傅`,
      desc: '登載正規班師傅與外僱臨時點工。核心支持「雙重費率」：標準每小時支付成本（工資底價）與向業主核實請款費率（報價費率），於登錄日誌時自動算出各案人次工時計價利潤。',
      actionText: '校正工班名冊',
      action: () => setActiveTab('workers')
    },
    {
      id: 'materials',
      num: '4',
      title: '材料原廠合約價格單',
      icon: <ShoppingBag className="text-amber-700 stroke-[2.5]" size={24} />,
      badge: '多單位轉換',
      stats: `${materials.length} 項標準工料原廠資料`,
      desc: '捨棄傳統工程行繁重且無實效之期末盤點，改採「標準單價調撥」管理。提供逆向多單位折算（進貨以箱/捆計，出料以支/米計倍率換算），並支持多供應商合約進價與牌價比價對照。',
      actionText: '查看材料大庫',
      action: () => {
        setActiveTab('materials');
        if (setMaterialsSubTab) {
          setMaterialsSubTab('records');
        }
      }
    },
    {
      id: 'estimations',
      num: '5',
      title: '工程估價一件轉案',
      icon: <Landmark className="text-amber-700 stroke-[2.5]" size={24} />,
      badge: '預算防守線',
      stats: `合約總估值 ~$${totalContractVal.toLocaleString()} 元`,
      desc: '支持於案場中調用材料行牌價進行外報與內控毛利試算。業主簽認後，一鍵將「估價單」直接轉立為正式「案場專案」。估價上限將自動對接為耗料警報防線，預防施工時失控超支。',
      actionText: '前往估價與開工',
      action: () => {
        setActiveTab('construction');
        setRecordsSubTab('projects');
      }
    },
    {
      id: 'records-today',
      num: '6',
      title: '施工日誌公務簿',
      icon: <ClipboardList className="text-amber-700 stroke-[2.5]" size={24} />,
      badge: '外勤快速登錄',
      stats: `累計已登記 ${records.length} 篇公務施作日誌`,
      desc: '為前線工長與師傅量身打造的快速鍵盤。每日登錄出勤點工、倉庫出料或現場臨時採購（自墊）、代墊雜支（涼水車油便當費）、現場追加變更（Add-On）以及前線現收工程款，現場數據零時差回報。',
      actionText: '今日公務日誌登錄',
      action: () => {
        setActiveTab('construction');
        setRecordsSubTab('today');
      }
    },
    {
      id: 'prepaid',
      num: '7',
      title: '業主預付款專用池',
      icon: <Coins className="text-amber-700 stroke-[2.5]" size={24} />,
      badge: '專款專用隔離',
      stats: `預付款池總餘額 $${prepaidPoolBalance.toLocaleString()} 元`,
      desc: '控管業主開立之簽約訂金、期款。支持「一般型預收池」多案場彈性調撥，以及「案場限制型預收款」專款專用鎖定。避免工程行將 A 案訂金補繳 B 案材料債務而產生斷鍊爛尾風險。',
      actionText: '檢視預收池水金流',
      action: () => setActiveTab('billing')
    },
    {
      id: 'advances',
      num: '8',
      title: '融資借支＆零用金管理',
      icon: <BarChart3 className="text-amber-700 stroke-[2.5]" size={24} />,
      badge: '師傅預支/墊付',
      stats: `師傅待扣借款 $${totalAdvancedDebt.toLocaleString()} 元`,
      desc: '系統化解水電裝修行師傅常態款項預支、周轉金借貸痛點。登錄借支流水與還款扣回計畫，並動態監管出納保險箱內的「公司小額備用金帳」，徹底釐清師傅對公司的墊款與借款透明度。',
      actionText: '管理借支與零用金',
      action: () => setActiveTab('billing')
    },
    {
      id: 'billing',
      num: '9',
      title: '會計底沖核帳',
      icon: <Landmark className="text-amber-700 stroke-[2.5]" size={24} />,
      badge: 'B法合流沖銷',
      stats: '核心主計對帳引擎',
      desc: '將當日施作的實耗工料隱成本、期初估價合約與現場追加款，與已收預收款一鍵進行「底沖合流沖款」。自動扣抵、產生應收餘額對帳單，並於對帳確認後「一鍵🔒鎖案結算」，防止二次修改。',
      actionText: '開啟主計會計對帳',
      action: () => setActiveTab('billing')
    }
  ];

  const industryFaqs = [
    {
      q: '為什麼本 ERP 採用「雙重費率設計」？這能解決什麼痛點？',
      a: '在水電與裝修工程中，我們付給技工或點工的日薪（如 3000 元/天，拆算為標準時薪成本）通常與向業主報價的工錢（如 4500 元/天，拆算為標準請款費率）不同。如果系統只有一種費率，工程行無法精準計算各案場的「人力成本真實利潤（請款費率 - 標準成本）」，容易產生作帳盲區。本系統在登錄公務日誌時，能自動加總出勤人員時長，同時跑出「實耗人工成本」與「應與業主對帳金額」，實現精準主計。'
    },
    {
      q: '什麼是「多單位逆向折算與供應商合約單價」？',
      a: '工程行買材料時，店家是以大包裝批發進貨（例如：一箱 50 盞 LED 崁燈、一捆 100 米水電白扁線）。但師傅到現場施作或做追加變更估算時，用的是散裝計量（一根、一盏、一米）。本系統允許在材料主檔設定倍率轉換（如 1 箱 = 10 盞，進價 $1000/箱，報警出料自動換算單支成本為 $100/盞），並能記錄同一個材料品項在吉林五金行和新店建材行的不同牌價，讓備料估價成本一目了然。'
    },
    {
      q: '如何做到「估價單一鍵轉案」並控制現場工料支出不超標？',
      a: '簽認成交前，你可以替業主拉出詳細的工料預估。經業主確認簽章後，系統支援「一鍵快速產立正式專案 (Project)」，此時最初核定的估價總金與工料配比，便成為該案場的「專案預算上限」。後續師傅在現場登錄的每日施工日誌、臨採材料等，都會在此專案下累計「隱成本實耗」；一旦超出最初估算範圍，系統將立即警示，確保毛利不受侵蝕。'
    },
    {
      q: '什麼是「會計底沖核帳 - B法整合沖帳」？',
      a: 'B法整合沖帳是專為工程業設計的「應收/應付預收大沖款」演算法。由於工程常有預收一筆款項（如簽約 30% 訂金），且現場不斷髮生追加、點工耗料、代墊涼水費等小碎帳。在結算期，出納會計可以一鍵調出該客戶在建案場的「實耗工料對外估值」與「現場追加款」，並直接在「預收款池」中扣抵提兌。扣抵後的餘額才發出對外請款單，避免老一輩會計用人工 Excel 對帳對到眼花累。對帳無誤一鍵「結帳鎖案」，該段時間的施工日誌將永久過期保護，避免人工補漏造成的帳務混亂。'
    }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Mega Hero Portal Header */}
      <div className="bg-neutral-950 text-white rounded-3xl p-6 md:p-8 border-2 border-neutral-800 shadow-xl relative overflow-hidden">
        {/* Subtle decorative grid lines */}
        <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-amber-500/15 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-500/20 text-amber-400 font-extrabold text-xs uppercase tracking-wider rounded-full border border-amber-500/40">
              <Sparkles size={14} className="animate-pulse text-amber-450" />
              Advanced Engineering ERP Specification
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight text-white">
              水電、裝修、營建進階工程 ERP 主計外勤管理系統
            </h1>
            <p className="text-sm md:text-base text-neutral-200 font-bold leading-relaxed font-sans">
              完美打破前線外勤與後台財務天塹。將「估價簽認 ➔ 派工登錄 ➔ 原廠料品 ➔ 現場追加 ➔ 師傅借支融資 ➔ 預收池款」
              以及「會計底沖鎖帳」融為一體，為台灣中小型工程行量身打磨之高度契合操作大廳。
            </p>
          </div>
          
          <div className="bg-neutral-850 p-6 rounded-2xl border-2 border-neutral-700 w-full md:w-auto shrink-0 space-y-4 font-mono shadow-md">
            <span className="text-xs text-amber-400 font-black block uppercase tracking-widest border-b border-neutral-700 pb-1.5">實時核心數據儲備</span>
            <div className="grid grid-cols-2 gap-5 text-sm">
              <div>
                <span className="text-neutral-400 block font-black text-xs mb-0.5">在建 / 總案場</span>
                <span className="text-base font-black text-white">{activeProjectsCount} 案 / {projects.length} 案</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-black text-xs mb-0.5">累計公務日誌</span>
                <span className="text-base font-black text-white">{records.length} 篇</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-black text-xs mb-0.5">師傅借支結餘</span>
                <span className="text-base font-black text-amber-400">${totalAdvancedDebt.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-neutral-400 block font-black text-xs mb-0.5">預付款池存蓄</span>
                <span className="text-base font-black text-emerald-400">${prepaidPoolBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 9 Core Modules Roadmap Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-neutral-300 pb-4">
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
              <Layers size={20} className="text-amber-600 stroke-[2.5]" />
              一、 系統九大核心功能模組
            </h2>
            <p className="text-sm text-neutral-600 font-bold mt-1">點選下方各功能模組即可直接跳轉至對應的操作看板與登記主檔</p>
          </div>
          <span className="text-xs text-neutral-600 font-black font-mono bg-neutral-100 px-3 py-1 rounded-lg border border-neutral-300">2026 ERP PRODUCTION ENVIRONMENT</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((m) => (
            <div 
              key={m.id} 
              className="bg-white rounded-2xl border-2 border-neutral-200 hover:border-amber-500 transition-all shadow-3xs hover:shadow-sm flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-5 space-y-4">
                {/* Module title portion */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black font-mono text-base shrink-0 border border-amber-600 flex items-center justify-center shadow-xs">
                      {m.num}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-neutral-950 group-hover:text-amber-800 transition-colors">
                        {m.title}
                      </h3>
                      <span className="text-xs text-neutral-600 font-mono font-black block mt-0.5">
                        {m.stats}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-black px-2 py-0.5 bg-neutral-150 text-neutral-800 font-mono rounded-lg border border-neutral-300">
                    {m.badge}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-neutral-850 font-bold leading-relaxed font-sans line-clamp-4">
                  {m.desc}
                </p>
              </div>

              {/* Interaction Row representing the jump button */}
              <div className="bg-neutral-50 px-5 py-3.5 border-t-2 border-neutral-200/80 flex items-center justify-between">
                <span className="text-xs text-neutral-600 font-black font-mono flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-600 stroke-[2.5]" /> 系統正常啓用中
                </span>
                <button
                  onClick={m.action}
                  className="text-xs sm:text-sm font-black text-amber-700 hover:text-amber-900 transition flex items-center gap-1 cursor-pointer"
                >
                  {m.actionText}
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Taiwan Standard Engineering Business Rules explaining */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Dynamic Q&A Panel */}
        <div className="lg:col-span-12 bg-white p-6 rounded-2xl border-2 border-neutral-200 shadow-3xs space-y-4">
          <h3 className="text-base font-black text-neutral-950 border-b-2 border-neutral-200 pb-3.5 flex items-center gap-1.5">
            <HelpCircle size={20} className="text-amber-600 stroke-[2.5]" />
            工程業 ERP 問答操作手冊
          </h3>

          <div className="space-y-3">
            {industryFaqs.map((faq, idx) => (
              <div 
                key={idx} 
                className="border-b border-neutral-200 pb-3 last:border-0 last:pb-0"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between text-left py-2.5 text-sm font-black text-neutral-950 hover:text-amber-850 transition-colors"
                >
                  <span className="pr-4">{faq.q}</span>
                  <span className="text-neutral-500 font-mono shrink-0 font-black">
                    {activeFaq === idx ? '▲' : '▼'}
                  </span>
                </button>
                {activeFaq === idx && (
                  <p className="mt-2 text-neutral-850 text-sm font-bold leading-relaxed bg-neutral-100 p-4 rounded-xl border border-neutral-300">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
