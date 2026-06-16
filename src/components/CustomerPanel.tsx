import React, { useState, useMemo } from 'react';
import { Customer, CustomerAddress } from '../types';
import { 
  Users, Plus, Trash2, Edit, MapPin, Phone, 
  Search, Check, Building2, X 
} from 'lucide-react';

interface CustomerPanelProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  onSaveToast: (msg: string) => void;
  // 以下為相容性 prop 接口，宣告為 optional 避免其它地方報錯
  projects?: any[];
  setProjects?: any;
  onAddProjectForCustomer?: any;
}

export default function CustomerPanel({
  customers,
  setCustomers,
  onSaveToast
}: CustomerPanelProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal controllers
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  // Add individual address row in modal
  const handleAddAddressRow = () => {
    setAddresses([
      ...addresses,
      {
        id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        fullAddress: '',
        addressAbbreviated: '',
        contactPerson: '',
        contactPhone: '',
        addressNotes: ''
      }
    ]);
  };

  const handleRemoveAddressRow = (index: number) => {
    if (addresses.length <= 1) {
      onSaveToast('⚠️ 客戶必須至少保留一個主地址！');
      return;
    }
    setAddresses(addresses.filter((_, idx) => idx !== index));
  };

  const handleUpdateAddressField = (index: number, field: keyof CustomerAddress, value: string) => {
    setAddresses(prev => prev.map((addr, idx) => {
      if (idx === index) {
        return { ...addr, [field]: value };
      }
      return addr;
    }));
  };

  // Open add modal
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setCustomerName('');
    setContactPerson('');
    setPhone('');
    setNotes('');
    setAddresses([
      {
        id: `addr-${Date.now()}`,
        fullAddress: '',
        addressAbbreviated: '',
        contactPerson: '',
        contactPhone: '',
        addressNotes: ''
      }
    ]);
    setShowAddModal(true);
  };

  // Open edit modal
  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerName(customer.name);
    setContactPerson(customer.contactPerson || '');
    setPhone(customer.phone || '');
    setNotes(customer.notes || '');
    setAddresses(customer.addresses.length > 0 ? customer.addresses : [
      {
        id: `addr-${Date.now()}`,
        fullAddress: '',
        addressAbbreviated: '',
        contactPerson: '',
        contactPhone: '',
        addressNotes: ''
      }
    ]);
    setShowAddModal(true);
  };

  // Submit Add / Edit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('請填寫客戶/業主名稱');
      return;
    }

    const filteredAddresses = addresses.map(a => ({
      id: a.id || `addr-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fullAddress: a.fullAddress.trim(),
      addressAbbreviated: a.addressAbbreviated?.trim() || undefined,
      contactPerson: a.contactPerson?.trim() || undefined,
      contactPhone: a.contactPhone?.trim() || undefined,
      addressNotes: a.addressNotes?.trim() || undefined
    })).filter(a => a.fullAddress !== '');

    if (filteredAddresses.length === 0) {
      alert('請至少填寫一個施作地址');
      return;
    }

    if (editingCustomer) {
      // Editing
      setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? {
        ...c,
        name: customerName.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        addresses: filteredAddresses
      } : c));
      onSaveToast(`💾 客戶【${customerName}】資料已成功保存！`);
    } else {
      // New Customer
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        name: customerName.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        addresses: filteredAddresses
      };
      setCustomers(prev => [newCustomer, ...prev]);
      onSaveToast(`🎉 成功登記全新客戶：${customerName}`);
    }

    setShowAddModal(false);
  };

  // Search filter
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase().trim();
    return customers.filter(c => 
      c.name.toLowerCase().includes(query) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(query)) ||
      (c.phone && c.phone.includes(query)) ||
      (c.addresses && c.addresses.some(addr => 
        addr.fullAddress.toLowerCase().includes(query) || 
        (addr.addressAbbreviated && addr.addressAbbreviated.toLowerCase().includes(query))
      ))
    );
  }, [customers, searchQuery]);

  return (
    <div id="customer-panel-container" className="space-y-6">
      <div className="space-y-6 animate-fadeIn pb-2">
        {/* Search Header Bar */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-neutral-850 flex items-center gap-2">
              <Users size={18} className="text-amber-600" />
              客戶紀錄及常用工地地址維護
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Real-time search */}
            <div className="relative w-full sm:w-[260px]">
              <input
                id="search-customer-input"
                type="text"
                placeholder="搜尋客戶名、聯絡人、地址..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-neutral-200 rounded-xl text-xs text-neutral-808 bg-white placeholder-neutral-400"
              />
              <Search className="absolute left-2.5 top-2.5 text-neutral-400" size={13} />
            </div>

            <button
              id="btn-add-customer-panel"
              onClick={handleOpenAdd}
              className="w-full sm:w-auto px-4.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-600/10 whitespace-nowrap cursor-pointer"
            >
              <Plus size={14} className="stroke-[2.5]" />
              登記新客戶/業主
            </button>
          </div>
        </div>

        {/* Grid listing */}
        {filteredCustomers.length === 0 ? (
          <div id="no-customers-placeholder" className="text-center py-16 bg-white rounded-2xl border border-neutral-200 border-dashed">
            <Users size={40} className="mx-auto text-neutral-300 stroke-[1.2] mb-3" />
            <h4 className="text-sm font-bold text-neutral-600">目前尚無任何合作客戶或業主紀錄！</h4>
            <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
              您可以點擊右上方「登記新客戶/業主」按鈕，快速建立主檔案。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCustomers.map(customer => {
              return (
                <div 
                  key={customer.id} 
                  className="bg-white p-5 rounded-2xl border border-neutral-200 hover:border-amber-300/60 transition-all hover:shadow-md flex flex-col justify-between group"
                >
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] tracking-widest uppercase font-mono text-amber-600 font-extrabold block">COOPERATIVE CLIENT</span>
                        <h4 className="text-sm font-extrabold text-neutral-850 group-hover:text-amber-800 transition-colors">
                          {customer.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] bg-neutral-100/80 font-bold text-neutral-500 font-mono px-1.5 py-0.5 rounded-md">
                          {customer.addresses.length} 地
                        </span>
                      </div>
                    </div>

                    {/* Contacts info details block */}
                    <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 text-xs text-neutral-600 space-y-1">
                      {customer.contactPerson ? (
                        <p className="flex items-center gap-1.5 font-bold">
                          👤 聯絡：<span className="text-neutral-800">{customer.contactPerson}</span>
                        </p>
                      ) : (
                        <p className="text-neutral-350 italic">無特定負責聯絡窗口</p>
                      )}
                      {customer.phone && (
                        <p className="flex items-center gap-1.5 font-mono">
                          📞 電話：<span className="text-neutral-800 font-bold">{customer.phone}</span>
                        </p>
                      )}
                      {customer.notes && (
                        <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1">
                          📝 備忘：{customer.notes}
                        </p>
                      )}
                    </div>

                    {/* Collapsible list of associated addresses */}
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider mb-2">📍 常用工地派工地址名冊 ({customer.addresses.length})</span>
                      {customer.addresses.map((addr) => (
                        <div key={addr.id} className="p-2 bg-white/40 border border-neutral-150 rounded-lg hover:bg-amber-50/10 transition-colors">
                          <p className="text-xs font-semibold text-neutral-850 flex items-start gap-1">
                            <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1 rounded scale-90 whitespace-nowrap mt-0.5">
                              {addr.addressAbbreviated || '派'}
                            </span>
                            {addr.fullAddress}
                          </p>
                          {(addr.contactPerson || addr.contactPhone) && (
                            <p className="text-[10px] text-neutral-500 font-medium font-mono mt-0.5 pl-4">
                              窗口: {addr.contactPerson || '同客戶'} | {addr.contactPhone || '-'}
                            </p>
                          )}
                          {addr.addressNotes && (
                            <p className="text-[10px] text-amber-600 font-medium pl-4">
                              📌 備註: {addr.addressNotes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions footer options */}
                  <div className="pt-3.5 mt-4 border-t border-neutral-100 flex items-center justify-between gap-1 select-none">
                    {deleteConfirmId === customer.id ? (
                      <div className="flex items-center gap-1.5 bg-red-50 p-1.5 rounded-lg border border-red-100 w-full animate-fadeIn flex-wrap">
                        <span className="text-[10px] text-red-700 font-black">確定刪除此業主與常用地址？</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setCustomers(prev => prev.filter(c => c.id !== customer.id));
                              setDeleteConfirmId(null);
                              onSaveToast(`🗑️ 已成功自通訊錄中移除客戶代碼：【${customer.name}】！`);
                            }}
                            className="bg-red-650 hover:bg-red-750 text-white font-extrabold text-[10px] px-2 py-0.5 rounded cursor-pointer"
                          >
                            確認
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="bg-neutral-200 text-neutral-600 font-extrabold text-[10px] px-2 py-0.5 rounded cursor-pointer"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <button
                          onClick={() => handleOpenEdit(customer)}
                          className="p-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200 cursor-pointer flex items-center gap-1 transition"
                        >
                          <Edit size={12} />
                          編輯
                        </button>
                        
                        <button
                          onClick={() => setDeleteConfirmId(customer.id)}
                          className="p-1 px-2 hover:bg-neutral-50 text-neutral-400 hover:text-red-600 rounded transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} />
                          刪除業主
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. MODAL ADD / EDIT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-800">
                    {editingCustomer ? '修改客戶 / 業主資料' : '登記長期合作夥伴名冊'}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-neutral-200 text-neutral-500 hover:text-neutral-850 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1.5">
                    公司名稱 / 業主姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="如：豪雅室內設計、林業主"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                {/* Double fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1.5">
                      現場聯絡人 <span className="text-neutral-400 text-[10px] font-normal">(選填)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="如：陳主任、張先生"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-neutral-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-600 mb-1.5">
                      聯絡方式 / 電話 <span className="text-neutral-400 text-[10px] font-normal">(選填)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="如：0912-345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-neutral-800 font-mono"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-1.5">
                    客戶特別備註與安全事項 <span className="text-neutral-400 text-[10px] font-normal">(選填)</span>
                  </label>
                  <textarea
                    placeholder="例如：付款週期為雙月結、常態備料習慣等..."
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-neutral-800 focus:outline-none"
                  />
                </div>

                {/* Addresses lists sections */}
                <div className="space-y-3.5 pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700">📍 施作工地與常備派工地址名簿</span>
                    <button
                      type="button"
                      onClick={handleAddAddressRow}
                      className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    >
                      ➕ 增加一條新工地地址
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                    {addresses.map((addr, idx) => (
                      <div key={addr.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-3 relative group/addr">
                        <div className="absolute right-3.5 top-3.5">
                          <button
                            type="button"
                            onClick={() => handleRemoveAddressRow(idx)}
                            className="text-neutral-400 hover:text-red-700 p-1 rounded-full hover:bg-neutral-200/50 transition cursor-pointer"
                            title="刪除此常用工址"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-600 font-mono">#{idx+1} 地址</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-1">
                            <label className="block text-[9px] font-bold text-neutral-550 mb-0.5">工址完整地址 <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              required
                              placeholder="完整路名與門牌，例如：台北市信義路五段7號"
                              value={addr.fullAddress}
                              onChange={(e) => handleUpdateAddressField(idx, 'fullAddress', e.target.value)}
                              className="w-full px-2 py-1 border border-neutral-200 rounded-lg text-neutral-800 text-xs bg-white focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div className="sm:col-span-1">
                            <label className="block text-[9px] font-bold text-neutral-500 mb-0.5">常用名稱簡稱 (例如: 信義店)</label>
                            <input
                              type="text"
                              placeholder="例如：信義A館、二樓辦公室"
                              value={addr.addressAbbreviated || ''}
                              onChange={(e) => handleUpdateAddressField(idx, 'addressAbbreviated', e.target.value)}
                              className="w-full px-2 py-1 border border-neutral-200 rounded-lg text-neutral-800 text-xs bg-white focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-bold text-neutral-500 mb-0.5">現場調度聯絡人 (工地視窗)</label>
                            <input
                              type="text"
                              placeholder="專屬此工地窗口，如：李工頭"
                              value={addr.contactPerson || ''}
                              onChange={(e) => handleUpdateAddressField(idx, 'contactPerson', e.target.value)}
                              className="w-full px-2 py-1 border border-neutral-200 rounded-lg text-neutral-800 text-xs bg-white focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-bold text-neutral-500 mb-0.5">現場聯絡電話</label>
                            <input
                              type="text"
                              placeholder="專屬負責人電話"
                              value={addr.contactPhone || ''}
                              onChange={(e) => handleUpdateAddressField(idx, 'contactPhone', e.target.value)}
                              className="w-full px-2 py-1 border border-neutral-200 rounded-lg text-neutral-800 text-xs bg-white font-mono focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        {/* Local notes */}
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-500 mb-0.5">個別地址特別備註 / 注意事項</label>
                          <input
                            type="text"
                            placeholder="例如：需在非工作時間施工,高空管路等..."
                            value={addr.addressNotes || ''}
                            onChange={(e) => handleUpdateAddressField(idx, 'addressNotes', e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded-lg text-neutral-800 text-xs bg-white focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 mt-6 border-t border-neutral-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition"
                >
                  確認儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
