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
  records?: any[];
  setRecords?: any;
}

export default function CustomerPanel({
  customers,
  setCustomers,
  onSaveToast,
  projects,
  setProjects,
  onAddProjectForCustomer,
  records,
  setRecords
}: CustomerPanelProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  
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
      const updatedCustName = customerName.trim();
      const updatedContactPerson = contactPerson.trim() || undefined;
      const updatedContactPhone = phone.trim() || undefined;

      setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? {
        ...c,
        name: updatedCustName,
        contactPerson: updatedContactPerson,
        phone: updatedContactPhone,
        notes: notes.trim() || undefined,
        addresses: filteredAddresses
      } : c));

      // Link and update associated projects and daily records
      if (setProjects && projects) {
        const updatedProjectNamesMap: { [projectId: string]: string } = {};

        setProjects((prevProjects: any[]) => prevProjects.map(p => {
          if (p.clientId === editingCustomer.id) {
            let dateFormatted = '';
            if (p.createdAt) {
              dateFormatted = p.createdAt.substring(0, 10).replace(/-/g, '');
            } else {
              dateFormatted = new Date().toISOString().substring(0, 10).replace(/-/g, '');
            }

            let newFullAddress = p.fullAddress;
            let newAddressAbbreviated = p.addressAbbreviated;

            // Look up if this project's address was edited in the customer panel
            let matchedOldAddr = editingCustomer.addresses.find(
              oldAddr => oldAddr.fullAddress.trim().toLowerCase() === p.fullAddress.trim().toLowerCase()
            );
            // Fallback: if there is only 1 address in editingCustomer, assume it corresponds to this project
            if (!matchedOldAddr && editingCustomer.addresses.length === 1) {
              matchedOldAddr = editingCustomer.addresses[0];
            }

            if (matchedOldAddr) {
              const matchedNewAddr = filteredAddresses.find(newAddr => newAddr.id === matchedOldAddr.id);
              if (matchedNewAddr) {
                newFullAddress = matchedNewAddr.fullAddress;
                newAddressAbbreviated = matchedNewAddr.addressAbbreviated;
              }
            }

            let clientPart = updatedCustName;
            const person = (updatedContactPerson || '').trim();
            const phoneNum = (updatedContactPhone || '').trim();

            if (person && person !== '本人' && person !== updatedCustName) {
              if (phoneNum) {
                clientPart += `(${person}:${phoneNum})`;
              } else {
                clientPart += `(${person})`;
              }
            } else {
              if (phoneNum) {
                clientPart += `(${phoneNum})`;
              }
            }

            const abbrev = (newAddressAbbreviated || '').trim();
            const addressPart = abbrev ? `(${abbrev})${newFullAddress.trim()}` : newFullAddress.trim();

            let serial = p.serialNumber || '001';
            if (serial.includes('-')) {
              const parts = serial.split('-');
              serial = parts[parts.length - 1];
            }
            if (/^\d+$/.test(serial)) {
              serial = serial.padStart(3, '0');
            }

            const baseName = `${dateFormatted}-${clientPart}-${addressPart}-${serial}`;
            const newGeneratedName = (p.isEstimation || p.generatedName?.startsWith('[估]')) ? `[估]${baseName}` : baseName;

            updatedProjectNamesMap[p.id] = newGeneratedName;

            return {
              ...p,
              companyOrOwner: updatedCustName,
              contactPerson: updatedContactPerson,
              contactPhone: updatedContactPhone,
              fullAddress: newFullAddress,
              addressAbbreviated: newAddressAbbreviated,
              generatedName: newGeneratedName
            };
          }
          return p;
        }));

        // Keep daily records' backup projectName in sync with the new standard project identifier
        if (setRecords && records) {
          setRecords((prevRecords: any[]) => prevRecords.map(r => {
            const updatedName = updatedProjectNamesMap[r.projectId];
            if (updatedName) {
              return {
                ...r,
                projectName: updatedName
              };
            }
            return r;
          }));
        }
      }

      onSaveToast(`💾 客戶【${customerName}】資料與相關案場專案名稱已成功連動轉變！`);
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
    <div id="customer-panel-container" className="space-y-6 text-neutral-300">
      <div className="space-y-6 animate-fadeIn pb-2">
        {/* Search Header Bar */}
        <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#2C2C2C] shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-5 text-white">

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Real-time search */}
            <div className="relative w-full sm:w-[280px]">
              <input
                id="search-customer-input"
                type="text"
                placeholder="搜尋客戶名、聯絡人、地址..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-[#3A3A3A] rounded-lg text-xs text-white bg-[#252525] placeholder-neutral-500 font-bold focus:outline-none focus:border-[#D4AF37]"
              />
              <Search className="absolute left-3 top-2.5 text-neutral-500" size={14} />
            </div>

            <button
              id="btn-add-customer-panel"
              onClick={handleOpenAdd}
              className="w-full sm:w-auto px-4 py-2 bg-[#D4AF37] text-black hover:bg-[#bfa032] font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-3xs whitespace-nowrap cursor-pointer"
            >
              <Plus size={14} className="stroke-[2.5]" />
              登記新客戶
            </button>
          </div>
        </div>

        {/* Grid listing */}
        {filteredCustomers.length === 0 ? (
          <div id="no-customers-placeholder" className="text-center py-16 bg-[#1E1E1E] rounded-2xl border border-[#2C2C2C] border-dashed">
            <Users size={48} className="mx-auto text-neutral-600 stroke-[1.5] mb-3" />
            <h4 className="text-base font-black text-white">目前尚無任何合作客戶或業主紀錄！</h4>
            <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto font-semibold">
              您可以點擊右上方「登記新客戶」按鈕，快速建立主檔案。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCustomers.map(customer => {
              return (
                <div 
                  key={customer.id} 
                  className="bg-[#1E1E1E] p-5 rounded-2xl border border-[#2C2C2C] shadow-3xs hover:border-[#D4AF37] transition-all flex flex-col justify-between group text-neutral-300"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] tracking-widest uppercase font-mono text-[#D4AF37] font-bold block">合作客戶成員</span>
                        <h4 className="text-sm font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                          {customer.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] bg-[#252525] font-bold text-neutral-400 font-mono px-2 py-0.5 rounded-md border border-[#2C2C2C]">
                          {customer.addresses.length} 個常用地址
                        </span>
                      </div>
                    </div>

                    {/* Contacts info details block */}
                    <div className="bg-[#252525] p-3 rounded-xl border border-[#2C2C2C] text-xs text-neutral-400 space-y-1.5">
                      {customer.contactPerson ? (
                        <p className="flex items-center gap-1.5 font-bold text-neutral-300">
                          👤 聯絡人：<span className="text-white font-black">{customer.contactPerson}</span>
                        </p>
                      ) : (
                        <p className="text-neutral-500 italic">無特定負責聯絡窗口</p>
                      )}
                      {customer.phone && (
                        <p className="flex items-center gap-1.5 font-mono text-neutral-300 font-bold">
                          📞 連絡電話：<span className="text-white font-black">{customer.phone}</span>
                        </p>
                      )}
                      {customer.notes && (
                        <p className="text-[10px] text-neutral-500 font-medium leading-relaxed border-t border-[#2C2C2C] pt-1 mt-1">
                          📝 系統備忘：{customer.notes}
                        </p>
                      )}
                    </div>

                    {/* Collapsible list of associated addresses */}
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      <span className="text-[11px] uppercase font-bold text-neutral-400 block tracking-wider mb-2 font-mono">📍 常用工地派工地址名冊 ({customer.addresses.length})</span>
                      {customer.addresses.map((addr) => (
                        <div key={addr.id} className="p-2.5 bg-[#252525] border border-[#2C2C2C] rounded-xl hover:bg-[#2C2C2C] transition-colors">
                          <p className="text-xs font-bold text-white flex items-start gap-1.5 leading-normal">
                            {addr.addressAbbreviated && addr.addressAbbreviated.trim() !== '' && (
                              <span className="text-[10px] bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/45 font-black px-1.5 py-0.5 rounded-md whitespace-nowrap mt-0.5 inline-flex items-center">
                                {addr.addressAbbreviated.trim()}
                              </span>
                            )}
                            <span className="mt-0.5">{addr.fullAddress}</span>
                          </p>
                          {(addr.contactPerson || addr.contactPhone) && (
                            <p className="text-[10px] text-neutral-400 font-bold font-mono mt-0.5 pl-4">
                              窗口: {addr.contactPerson || '同客戶'} | {addr.contactPhone || '-'}
                            </p>
                          )}
                          {addr.addressNotes && (
                            <p className="text-[10px] text-[#D4AF37] font-bold pl-4">
                              📌 案場備註: {addr.addressNotes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Associated projects display (collapsible) */}
                    {(() => {
                      const custProjects = projects ? projects.filter((p: any) => p.clientId === customer.id) : [];
                      const isProjExpanded = !!expandedProjects[customer.id];
                      return (
                        <div className="space-y-1.5 border-t border-[#2C2C2C] pt-3.5 mt-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setExpandedProjects(prev => ({ ...prev, [customer.id]: !prev[customer.id] }))}
                            className="w-full flex items-center justify-between text-[11px] font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer text-left"
                          >
                            <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider">
                              💼 歷史施作案場數量 ({custProjects.length})
                            </span>
                            <span className="text-[10px] text-[#D4AF37] font-extrabold bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/20 hover:bg-[#D4AF37]/25 transition-all">
                              {isProjExpanded ? '收合' : '點開查看'}
                            </span>
                          </button>
                          {isProjExpanded && (
                            <div className="space-y-1.5 mt-2 max-h-[140px] overflow-y-auto pr-1 animate-fadeIn">
                              {custProjects.length === 0 ? (
                                <p className="text-[10px] text-neutral-500 italic pl-1 py-1">目前尚無旗下施工中或已完工之案場專案</p>
                              ) : (
                                custProjects.map((proj: any) => (
                                  <div key={proj.id} className="p-2.5 bg-[#252525] border border-[#2C2C2C] rounded-xl hover:border-[#D4AF37]/30 transition-all">
                                    <p className="text-[11px] font-mono font-bold text-neutral-300 leading-normal select-all break-all">
                                      {proj.generatedName}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      {proj.isCompleted ? (
                                        <span className="text-[9px] bg-emerald-950/25 text-emerald-400 border border-emerald-900/40 px-1.5 py-0.5 rounded-md font-bold">
                                          ✓ 已完工
                                        </span>
                                      ) : (
                                        <span className="text-[9px] bg-amber-950/25 text-amber-400 border border-amber-900/40 px-1.5 py-0.5 rounded-md font-bold">
                                          ⚙ 施作中
                                        </span>
                                      )}
                                      {proj.isEstimation && (
                                        <span className="text-[9px] bg-sky-950/25 text-sky-400 border border-sky-900/40 px-1.5 py-0.5 rounded-md font-bold">
                                          估價單
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Actions footer options */}
                  <div className="pt-3.5 mt-4 border-t border-[#2C2C2C] flex items-center justify-between gap-1 select-none">
                    {deleteConfirmId === customer.id ? (
                      <div className="flex items-center gap-1.5 bg-red-950/20 p-1.5 rounded-lg border border-red-900 w-full animate-fadeIn flex-wrap">
                        <span className="text-[10px] text-red-200 font-black">確定刪除此業主與常用地址？</span>
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
                            className="bg-[#252525] text-neutral-400 font-extrabold text-[10px] px-2 py-0.5 rounded cursor-pointer border border-[#3A3A3A]"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <button
                          onClick={() => handleOpenEdit(customer)}
                          className="p-1 px-2.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold rounded-lg border border-[#D4AF37]/20 cursor-pointer flex items-center gap-1 transition"
                        >
                          <Edit size={12} />
                          編輯
                        </button>
                        
                        <button
                          onClick={() => setDeleteConfirmId(customer.id)}
                          className="p-1 px-2 hover:bg-red-950/20 text-neutral-500 hover:text-red-450 rounded transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
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
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] rounded-2xl border border-[#2C2C2C] shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] text-white">
            {/* Header */}
            <div className="p-5 border-b border-[#2C2C2C] flex items-center justify-between bg-[#212121]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#252525] rounded-xl text-[#D4AF37] border border-[#3A3A3A]">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {editingCustomer ? '修改客戶 / 業主資料' : '登記長期合作夥伴主檔案'}
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-[#2C2C2C] text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    公司名稱 / 業主姓名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="如：豪雅室內設計、林業主"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#3A3A3A] rounded-lg text-white bg-[#252525] placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {/* Double fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      現場聯絡人 <span className="text-neutral-500 text-[10px] font-normal">(選填)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="如：陳主任、張先生"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-3 py-2 border border-[#3A3A3A] rounded-lg text-white bg-[#252525] placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      聯絡方式 / 電話 <span className="text-neutral-500 text-[10px] font-normal">(選填)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="如：0912-345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-[#3A3A3A] rounded-lg text-white bg-[#252525] placeholder-neutral-500 font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    客戶特別備註與安全事項 <span className="text-neutral-500 text-[10px] font-normal">(選填)</span>
                  </label>
                  <textarea
                    placeholder="例如：付款週期為雙月結、常態備料習慣等..."
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-[#3A3A3A] rounded-lg text-white bg-[#252525] placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {/* Addresses lists sections */}
                <div className="space-y-3.5 pt-4 border-t border-[#2C2C2C]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-300">📍 施作工地與常備派工地址名簿</span>
                    <button
                      type="button"
                      onClick={handleAddAddressRow}
                      className="text-[10px] font-bold text-[#D4AF37] bg-[#252525] hover:bg-[#2C2C2C] border border-[#3A3A3A] px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    >
                      ➕ 增加一條新工地地址
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                    {addresses.map((addr, idx) => (
                      <div key={addr.id} className="p-4 bg-[#252525] rounded-xl border border-[#3A3A3A] space-y-3 relative group/addr">
                        <div className="absolute right-3.5 top-3.5">
                          <button
                            type="button"
                            onClick={() => handleRemoveAddressRow(idx)}
                            className="text-neutral-500 hover:text-red-400 p-1 rounded-full hover:bg-[#2C2C2C] transition cursor-pointer"
                            title="刪除此常用工址"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-400 font-mono">#{idx+1} 地址</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-1">
                            <label className="block text-[9px] font-bold text-neutral-400 mb-0.5">工址完整地址 <span className="text-rose-500">*</span></label>
                            <input
                              type="text"
                              required
                              placeholder="完整路名與門牌，例如：台北市信義路五段7號"
                              value={addr.fullAddress}
                              onChange={(e) => handleUpdateAddressField(idx, 'fullAddress', e.target.value)}
                              className="w-full px-2 py-1 border border-[#3A3A3A] rounded-lg text-white bg-[#1e1e1e] text-xs focus:border-[#D4AF37] focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-1">
                            <label className="block text-[9px] font-bold text-neutral-400 mb-0.5">常用名稱簡稱 (例如: 信義店)</label>
                            <input
                              type="text"
                              placeholder="例如：信義A館、二樓辦公室"
                              value={addr.addressAbbreviated || ''}
                              onChange={(e) => handleUpdateAddressField(idx, 'addressAbbreviated', e.target.value)}
                              className="w-full px-2 py-1 border border-[#3A3A3A] rounded-lg text-white bg-[#1e1e1e] text-xs focus:border-[#D4AF37] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-bold text-neutral-400 mb-0.5">現場調度聯絡人 (工地視窗)</label>
                            <input
                              type="text"
                              placeholder="專屬此工地窗口，如：李工頭"
                              value={addr.contactPerson || ''}
                              onChange={(e) => handleUpdateAddressField(idx, 'contactPerson', e.target.value)}
                              className="w-full px-2 py-1 border border-[#3A3A3A] rounded-lg text-white bg-[#1e1e1e] text-xs focus:border-[#D4AF37] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-bold text-neutral-400 mb-0.5">現場聯絡電話</label>
                            <input
                              type="text"
                              placeholder="專屬負責人電話"
                              value={addr.contactPhone || ''}
                              onChange={(e) => handleUpdateAddressField(idx, 'contactPhone', e.target.value)}
                              className="w-full px-2 py-1 border border-[#3A3A3A] rounded-lg text-white bg-[#1e1e1e] text-xs font-mono focus:border-[#D4AF37] focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Local notes */}
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 mb-0.5">個別地址特別備註 / 注意事項</label>
                          <input
                            type="text"
                            placeholder="例如：需在非工作時間施工,高空管路等..."
                            value={addr.addressNotes || ''}
                            onChange={(e) => handleUpdateAddressField(idx, 'addressNotes', e.target.value)}
                            className="w-full px-2 py-1 border border-[#3A3A3A] rounded-lg text-white bg-[#1e1e1e] text-xs focus:border-[#D4AF37] focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 mt-6 border-t border-[#2C2C2C] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white hover:bg-[#252525] rounded-lg transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-[#D4AF37] hover:bg-[#bfa032] text-black rounded-lg shadow-sm transition"
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
