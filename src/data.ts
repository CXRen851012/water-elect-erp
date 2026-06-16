import { Worker, MaterialPreset, Supplier } from './types';

export const DEFAULT_WORKERS: Worker[] = [
  { id: 'w-1', name: '陳建志', role: '專業師傅(水電)', defaultHourlyRate: 400 },
  { id: 'w-2', name: '林冠宇', role: '熟練半技工', defaultHourlyRate: 280 },
  { id: 'w-3', name: '張家豪', role: '粗工/助手', defaultHourlyRate: 180 },
  { id: 'w-4', name: '黃明輝', role: '水電工頭', defaultHourlyRate: 450 },
  { id: 'w-5', name: '李威廷', role: '配線技術工', defaultHourlyRate: 320 }
];

export const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-init-1',
    name: '信義水電五金行',
    contactPerson: '張老闆 (阿信)',
    phone: '02-2733-1122',
    address: '台北市大安區信義路四段250號',
    notes: '核心常配店。PVC管彎頭水路配件最齊全，滿兩千可免費派車配送工地，特約月結、退佣1.2成，配合良好。'
  },
  {
    id: 'sup-init-2',
    name: '大山電料照明量販',
    contactPerson: '林經理',
    phone: '02-2391-4567',
    address: '新北市板橋區萬板路105號',
    notes: '電料大庫。太平洋電線、白扁線、松下/星光全系列面板報價全區最低，一律隔月月結付款。'
  },
  {
    id: 'sup-init-3',
    name: '德昌管材建材通路',
    contactPerson: '陳小姐',
    phone: '02-2255-8899',
    address: '新北市西園路二段12號',
    notes: '厚薄鑄鐵管、防爆軟管、特規大口徑污水排水排水管首選，現款現付享額外5%扣折。'
  },
  {
    id: 'sup-init-4',
    name: '宏泰廚衛精品配管',
    contactPerson: '洪副總',
    phone: '02-2598-7711',
    address: '台北市中山區民權東路一段300號',
    notes: '雙聯龍頭、不鏽鋼精緻防臭防濺混合龍頭、進口衛浴專用五金特約商，直接對保固，極度有利推廣。'
  }
];

export const DEFAULT_MATERIALS: MaterialPreset[] = [
  { 
    id: 'm-1', 
    name: '1英吋 PVC 南亞管', 
    unit: '支', 
    defaultUnitPrice: 180, 
    category: '水路管材類', 
    defaultCostPrice: 130,
    unitOptions: [
      { 
        id: 'uo-m1-1', 
        unit: '支', 
        defaultUnitPrice: 180, 
        defaultCostPrice: 130, 
        suppliers: [
          { id: 'uoms-1-1', storeName: '信義水電五金行', listPrice: 180, costPrice: 130 },
          { id: 'uoms-1-2', storeName: '德昌管材建材通路', listPrice: 175, costPrice: 125 }
        ] 
      },
      { 
        id: 'uo-m1-2', 
        unit: '米', 
        defaultUnitPrice: 60, 
        defaultCostPrice: 45, 
        suppliers: [
          { id: 'uoms-1-3', storeName: '信義水電五金行', listPrice: 60, costPrice: 45 },
          { id: 'uoms-1-4', storeName: '德昌管材建材通路', listPrice: 55, costPrice: 40 }
        ] 
      }
    ]
  },
  { 
    id: 'm-2', 
    name: '4英吋 PVC 排水管', 
    unit: '支', 
    defaultUnitPrice: 420, 
    category: '水路管材類', 
    defaultCostPrice: 320,
    unitOptions: [
      { 
        id: 'uo-m2-1', 
        unit: '支', 
        defaultUnitPrice: 420, 
        defaultCostPrice: 320, 
        suppliers: [
          { id: 'uoms-2-1', storeName: '信義水電五金行', listPrice: 390, costPrice: 290 },
          { id: 'uoms-2-2', storeName: '德昌管材建材通路', listPrice: 420, costPrice: 320 } // 這裡是特約最高價，因此預設調整到此高值
        ] 
      },
      { 
        id: 'uo-m2-2', 
        unit: '米', 
        defaultUnitPrice: 110, 
        defaultCostPrice: 85, 
        suppliers: [
          { id: 'uoms-2-3', storeName: '德昌管材建材通路', listPrice: 110, costPrice: 85 }
        ] 
      }
    ]
  },
  { 
    id: 'm-3', 
    name: 'PVC 彎頭 1英吋', 
    unit: '個', 
    defaultUnitPrice: 25, 
    category: '水路管材類', 
    defaultCostPrice: 18,
    unitOptions: [
      { 
        id: 'uo-m3-1', 
        unit: '個', 
        defaultUnitPrice: 25, 
        defaultCostPrice: 18, 
        suppliers: [
          { id: 'uoms-3-1', storeName: '信義水電五金行', listPrice: 25, costPrice: 18 }
        ] 
      },
      {
        id: 'uo-m3-2',
        unit: '包(10入)',
        defaultUnitPrice: 220,
        defaultCostPrice: 150,
        suppliers: [
          { id: 'uoms-3-2', storeName: '信義水電五金行', listPrice: 220, costPrice: 150 }
        ]
      }
    ]
  },
  { 
    id: 'm-4', 
    name: '松下單開關面板(星光系列)', 
    unit: '個', 
    defaultUnitPrice: 155, 
    category: '電路電材類', 
    defaultCostPrice: 110,
    unitOptions: [
      { 
        id: 'uo-m4-1', 
        unit: '個', 
        defaultUnitPrice: 155, 
        defaultCostPrice: 110, 
        suppliers: [
          { id: 'uoms-4-1', storeName: '大山電料照明量販', listPrice: 155, costPrice: 110 }
        ] 
      }
    ]
  },
  { 
    id: 'm-5', 
    name: '雙聯三插座安全插座', 
    unit: '個', 
    defaultUnitPrice: 210, 
    category: '電路電材類', 
    defaultCostPrice: 150,
    unitOptions: [
      { 
        id: 'uo-m5-1', 
        unit: '個', 
        defaultUnitPrice: 210, 
        defaultCostPrice: 150, 
        suppliers: [
          { id: 'uoms-5-1', storeName: '大山電料照明量販', listPrice: 210, costPrice: 150 }
        ] 
      }
    ]
  },
  { 
    id: 'm-6', 
    name: '無熔線斷路器 20A 單極', 
    unit: '個', 
    defaultUnitPrice: 240, 
    category: '電路電材類', 
    defaultCostPrice: 180,
    unitOptions: [
      { 
        id: 'uo-m6-1', 
        unit: '個', 
        defaultUnitPrice: 240, 
        defaultCostPrice: 180, 
        suppliers: [
          { id: 'uoms-6-1', storeName: '大山電料照明量販', listPrice: 240, costPrice: 180 }
        ] 
      }
    ]
  },
  { 
    id: 'm-7', 
    name: '廚衛不鏽鋼冷熱混水龍頭', 
    unit: '組', 
    defaultUnitPrice: 1650, 
    category: '廚衛設備類', 
    defaultCostPrice: 1200,
    unitOptions: [
      { 
        id: 'uo-m7-1', 
        unit: '組', 
        defaultUnitPrice: 1650, 
        defaultCostPrice: 1200, 
        suppliers: [
          { id: 'uoms-7-1', storeName: '宏泰廚衛精品配管', listPrice: 1650, costPrice: 1200 }
        ] 
      }
    ]
  },
  { 
    id: 'm-8', 
    name: '2.0mm 白扁線雙芯(太平洋)', 
    unit: '捲', 
    defaultUnitPrice: 1850, 
    category: '電路電材類', 
    defaultCostPrice: 1550,
    unitOptions: [
      { 
        id: 'uo-m8-1', 
        unit: '捲', 
        defaultUnitPrice: 1850, 
        defaultCostPrice: 1550, 
        suppliers: [
          { id: 'uoms-8-1', storeName: '大山電料照明量販', listPrice: 1850, costPrice: 1550 }
        ] 
      },
      { 
        id: 'uo-m8-2', 
        unit: '米', 
        defaultUnitPrice: 22, 
        defaultCostPrice: 18, 
        suppliers: [
          { id: 'uoms-8-2', storeName: '大山電料照明量販', listPrice: 22, costPrice: 18 }
        ] 
      }
    ]
  },
  { 
    id: 'm-9', 
    name: '止洩帶 (貼布西魯)', 
    unit: '個', 
    defaultUnitPrice: 15, 
    category: '工具與雜耗', 
    defaultCostPrice: 8,
    unitOptions: [
      { 
        id: 'uo-m9-1', 
        unit: '個', 
        defaultUnitPrice: 15, 
        defaultCostPrice: 8, 
        suppliers: [] 
      }
    ]
  },
  { 
    id: 'm-10', 
    name: '不鏽鋼壁虎螺絲組(M6)', 
    unit: '包', 
    defaultUnitPrice: 120, 
    category: '五金緊固類', 
    defaultCostPrice: 85,
    unitOptions: [
      { 
        id: 'uo-m10-1', 
        unit: '包', 
        defaultUnitPrice: 120, 
        defaultCostPrice: 85, 
        suppliers: [] 
      }
    ]
  },
  { 
    id: 'm-11', 
    name: '塑膠軟管 4分', 
    unit: '米', 
    defaultUnitPrice: 45, 
    category: '水路管材類', 
    defaultCostPrice: 30,
    unitOptions: [
      { 
        id: 'uo-m11-1', 
        unit: '米', 
        defaultUnitPrice: 45, 
        defaultCostPrice: 30, 
        suppliers: [] 
      }
    ]
  },
  { 
    id: 'm-12', 
    name: '防潮接線盒', 
    unit: '個', 
    defaultUnitPrice: 85, 
    category: '電路電材類', 
    defaultCostPrice: 60,
    unitOptions: [
      { 
        id: 'uo-m12-1', 
        unit: '個', 
        defaultUnitPrice: 85, 
        defaultCostPrice: 60, 
        suppliers: [] 
      }
    ]
  }
];
