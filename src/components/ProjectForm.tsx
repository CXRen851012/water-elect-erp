import React, { useState, useEffect, useMemo } from 'react';
import { Project, Customer } from '../types';
import { Plus, X, Building2, CheckCircle2, Search, UserCheck, MapPin, Phone, AlertTriangle } from 'lucide-react';

interface ProjectFormProps {
  onSave: (project: Omit<Project, 'id' | 'createdAt'>, updatedCustomer?: Customer) => void;
  onClose: () => void;
  existingProjects: Project[];
  customers: Customer[];
  // If we open modal with pre-targeted customer & address
  preSelectedCustomer?: Customer | null;
  preSelectedAddress?: string;
}

export default function ProjectForm({ 
  onSave, 
  onClose, 
  existingProjects, 
  customers,
  preSelectedCustomer,
  preSelectedAddress
}: ProjectFormProps) {
  // Date configuration
  const [projectDate, setProjectDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  // Selector mode: 'existing' | 'new'
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  
  // Searching through client state
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  
  // Selected client address choice
  const [addressChoice, setAddressChoice] = useState<string>('custom'); // selected address or 'custom'

  // Input Fields
  const [companyOrOwner, setCompanyOrOwner] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressAbbreviated, setAddressAbbreviated] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [isEstimation, setIsEstimation] = useState(false);
  
  const [serialNumber, setSerialNumber] = useState('');

  // Handle client pre-selection triggers safely
  useEffect(() => {
    if (preSelectedCustomer) {
      setCustomerMode('existing');
      setSelectedClient(preSelectedCustomer);
      setCompanyOrOwner(preSelectedCustomer.name);
      setContactPerson(preSelectedCustomer.contactPerson || '');
      setContactPhone(preSelectedCustomer.phone || '');
      setProjectNotes(preSelectedCustomer.notes || '');
      
      if (preSelectedAddress) {
        setAddressChoice(preSelectedAddress);
        setFullAddress(preSelectedAddress);
        // Find if this is an existing address with customized contact info
        const foundAddr = preSelectedCustomer.addresses.find(a => a.fullAddress === preSelectedAddress);
        if (foundAddr) {
          setAddressAbbreviated(foundAddr.addressAbbreviated || '');
          setContactPerson(foundAddr.contactPerson || preSelectedCustomer.contactPerson || '');
          setContactPhone(foundAddr.contactPhone || preSelectedCustomer.phone || '');
          setProjectNotes(foundAddr.addressNotes || preSelectedCustomer.notes || '');
        }
      } else if (preSelectedCustomer.addresses.length > 0) {
        const firstAddr = preSelectedCustomer.addresses[0];
        setAddressChoice(firstAddr.fullAddress);
        setFullAddress(firstAddr.fullAddress);
        setAddressAbbreviated(firstAddr.addressAbbreviated || '');
        setContactPerson(firstAddr.contactPerson || preSelectedCustomer.contactPerson || '');
        setContactPhone(firstAddr.contactPhone || preSelectedCustomer.phone || '');
        setProjectNotes(firstAddr.addressNotes || preSelectedCustomer.notes || '');
      } else {
        setAddressChoice('custom');
      }
    }
  }, [preSelectedCustomer, preSelectedAddress, customers]);

  // Adjust Mode switches
  const handleModeSwitch = (mode: 'existing' | 'new') => {
    setCustomerMode(mode);
    if (mode === 'new') {
      setSelectedClient(null);
      setCompanyOrOwner('');
      setContactPerson('');
      setContactPhone('');
      setAddressAbbreviated('');
      setAddressChoice('custom');
      setFullAddress('');
      setProjectNotes('');
    } else {
      setCompanyOrOwner('');
      setContactPerson('');
      setContactPhone('');
      setAddressAbbreviated('');
      setFullAddress('');
      setProjectNotes('');
    }
  };

  // Select an existing client suggestion
  const handleSelectClientSuggestion = (item: { customer: Customer; address: any | null }) => {
    const { customer, address } = item;
    setSelectedClient(customer);
    setCompanyOrOwner(customer.name);
    setClientSearchQuery(''); // clear query index

    if (address) {
      setContactPerson(address.contactPerson || customer.contactPerson || '');
      setContactPhone(address.contactPhone || customer.phone || '');
      setAddressAbbreviated(address.addressAbbreviated || '');
      setProjectNotes(address.addressNotes || customer.notes || '');
      setAddressChoice(address.fullAddress);
      setFullAddress(address.fullAddress);
    } else {
      setContactPerson(customer.contactPerson || '');
      setContactPhone(customer.phone || '');
      setAddressAbbreviated('');
      setProjectNotes(customer.notes || '');
      setAddressChoice('custom');
      setFullAddress('');
    }
  };

  // Filter client suggestions with detailed address flattening
  const clientSuggestions = useMemo(() => {
    const query = clientSearchQuery.trim().toLowerCase();
    
    const filteredCustomers = query
      ? customers.filter(c => 
          c.name.toLowerCase().includes(query) ||
          (c.contactPerson && c.contactPerson.toLowerCase().includes(query)) ||
          c.addresses.some(addr => 
            addr.fullAddress.toLowerCase().includes(query) || 
            (addr.addressAbbreviated && addr.addressAbbreviated.toLowerCase().includes(query))
          )
        )
      : customers;

    const suggestions: { customer: Customer; address: any | null }[] = [];

    filteredCustomers.forEach(c => {
      if (c.addresses && c.addresses.length > 0) {
        c.addresses.forEach(addr => {
          suggestions.push({
            customer: c,
            address: addr
          });
        });
      } else {
        suggestions.push({
          customer: c,
          address: null
        });
      }
    });

    return suggestions;
  }, [customers, clientSearchQuery]);

  // Handle address selector dropdown update
  const handleAddressChoiceChange = (choice: string) => {
    setAddressChoice(choice);
    if (choice === 'custom') {
      setFullAddress('');
      if (selectedClient) {
        setContactPerson(selectedClient.contactPerson || '');
        setContactPhone(selectedClient.phone || '');
        setAddressAbbreviated('');
        setProjectNotes(selectedClient.notes || '');
      }
    } else {
      setFullAddress(choice);
      if (selectedClient) {
        const matchedAddr = selectedClient.addresses.find(a => a.fullAddress === choice);
        if (matchedAddr) {
          setContactPerson(matchedAddr.contactPerson || selectedClient.contactPerson || '');
          setContactPhone(matchedAddr.contactPhone || selectedClient.phone || '');
          setAddressAbbreviated(matchedAddr.addressAbbreviated || '');
          setProjectNotes(matchedAddr.addressNotes || selectedClient.notes || '');
        } else {
          setContactPerson(selectedClient.contactPerson || '');
          setContactPhone(selectedClient.phone || '');
          setAddressAbbreviated('');
          setProjectNotes(selectedClient.notes || '');
        }
      }
    }
  };

  // Auto-calculate flowing serial number for distinguishing duplicate date/site projects
  useEffect(() => {
    if (!companyOrOwner.trim() || !fullAddress.trim() || !projectDate) {
      setSerialNumber('001');
      return;
    }

    const targetDateStr = projectDate.replace(/-/g, ''); // e.g. "20260526"
    const currentComp = companyOrOwner.trim().toLowerCase();
    const currentAddr = fullAddress.trim().toLowerCase();

    // Scan existing projects that have the SAME date and customer (to ensure unique non-overlapping serials on the same day for a customer)
    const matchingProjects = existingProjects.filter(p => {
      let cleanGenName = p.generatedName;
      if (cleanGenName.startsWith('[估]')) {
        cleanGenName = cleanGenName.substring(3);
      }
      const parts = cleanGenName.split('-');
      const pDateStr = parts[0]; // e.g. "20260526"
      return (
        pDateStr === targetDateStr &&
        p.companyOrOwner.trim().toLowerCase() === currentComp
      );
    });

    let nextNum = 1;
    if (matchingProjects.length > 0) {
      const nums = matchingProjects.map(p => {
        let cleanGenName = p.generatedName;
        if (cleanGenName.startsWith('[估]')) {
          cleanGenName = cleanGenName.substring(3);
        }
        const parts = cleanGenName.split('-');
        const lastPart = parts[parts.length - 1]; // ending index
        const num = parseInt(lastPart, 10);
        return isNaN(num) ? 0 : num;
      });
      nextNum = Math.max(...nums) + 1;
    }

    // Format serial code as '001', '002', '003' etc.
    setSerialNumber(String(nextNum).padStart(3, '0'));
  }, [projectDate, companyOrOwner, fullAddress, existingProjects]);

  // Unified helper to produce standardized project name
  const getGeneratedName = (
    dateStr: string,
    owner: string,
    person: string,
    phone: string,
    abbrev: string,
    fullAddr: string,
    serial: string,
    isEst?: boolean
  ): string => {
    const dateFormatted = dateStr.replace(/-/g, '');
    
    let clientPart = owner.trim();
    const p = person.trim();
    const ph = phone.trim();
    
    // Determine parenthesis content for contact info
    if (p && p !== '本人' && p !== owner.trim()) {
      if (ph) {
        clientPart += `(${p}:${ph})`;
      } else {
        clientPart += `(${p})`;
      }
    } else {
      if (ph) {
        clientPart += `(${ph})`;
      }
    }

    const addrAbbrev = abbrev.trim();
    let addressPart = '';
    if (addrAbbrev) {
      addressPart = `(${addrAbbrev})${fullAddr.trim()}`;
    } else {
      addressPart = fullAddr.trim();
    }

    const baseName = `${dateFormatted}-${clientPart}-${addressPart}-${serial}`;
    return isEst ? `[估]${baseName}` : baseName;
  };

  // Compute live visual preview matching standard format
  const generatePreview = () => {
    if (!companyOrOwner || !fullAddress) {
      return '(請填打「公司名/業主名」與「完整施作地址」以預覽標準按場名稱)';
    }

    return getGeneratedName(
      projectDate,
      companyOrOwner,
      contactPerson,
      contactPhone,
      addressAbbreviated,
      fullAddress,
      serialNumber,
      isEstimation
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyOrOwner.trim() || !fullAddress.trim()) {
      alert('請填打必填欄位！');
      return;
    }

    const finalGeneratedName = getGeneratedName(
      projectDate,
      companyOrOwner,
      contactPerson,
      contactPhone,
      addressAbbreviated,
      fullAddress,
      serialNumber,
      isEstimation
    );

    // Create a client info helper structure to backup
    let updatedCustomer: Customer | undefined = undefined;

    if (customerMode === 'new') {
      // Auto register a brand new customer
      const newAddrObj = {
        id: `addr-${Date.now()}`,
        fullAddress: fullAddress.trim(),
        addressAbbreviated: addressAbbreviated.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        addressNotes: projectNotes.trim() || undefined
      };
      
      updatedCustomer = {
         id: `cust-${Date.now()}`,
         name: companyOrOwner.trim(),
         contactPerson: contactPerson.trim() || undefined,
         phone: contactPhone.trim() || undefined,
         notes: undefined, // 客戶特別備註，保留給客戶面板建立主筆記用
         addresses: [newAddrObj]
      };
    } else if (selectedClient) {
      // Check if address selected is brand new or existing to synchronize
      const existingAddrIndex = selectedClient.addresses.findIndex(
        addr => addr.fullAddress.trim().toLowerCase() === fullAddress.trim().toLowerCase()
      );
      
      const newAddrObj = {
        id: existingAddrIndex >= 0 ? selectedClient.addresses[existingAddrIndex].id : `addr-${Date.now()}`,
        fullAddress: fullAddress.trim(),
        addressAbbreviated: addressAbbreviated.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        addressNotes: projectNotes.trim() || undefined
      };

      const updatedAddresses = [...selectedClient.addresses];
      if (existingAddrIndex >= 0) {
        // Sync & update existing address specifications
        updatedAddresses[existingAddrIndex] = newAddrObj;
      } else {
        // Append new site addresses
        updatedAddresses.push(newAddrObj);
      }

      updatedCustomer = {
        ...selectedClient,
        addresses: updatedAddresses
      };
    }

    onSave({
      clientId: selectedClient ? selectedClient.id : (updatedCustomer ? updatedCustomer.id : undefined),
      serialNumber,
      companyOrOwner: companyOrOwner.trim(),
      contactPerson: contactPerson.trim() || undefined,
      addressAbbreviated: addressAbbreviated.trim() || undefined,
      fullAddress: fullAddress.trim(),
      contactPhone: contactPhone.trim() || undefined,
      projectNotes: projectNotes.trim() || undefined,
      generatedName: finalGeneratedName,
      isCompleted: false,
      isEstimation: isEstimation
    }, updatedCustomer);
  };

  return (
    <div id="project-form-modal" className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="!bg-[#1A1A1A] rounded-2xl border border-[#D4AF37]/35 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-xl w-full overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#D4AF37]/25 flex items-center justify-between !bg-[#1A1A1A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 !bg-[#D4AF37]/10 rounded-xl text-amber-500 font-bold border border-[#D4AF37]/20">
              <Building2 size={20} className="text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold !text-[#F3E5AB]">新開施工案場 / 專案登記</h2>
              <p className="text-xs !text-[#E0E0E0]">輸入常用客戶或手動填打，系統自動拼裝現場流水認證名</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:!bg-[#D4AF37]/15 !text-[#8C8C8C] hover:!text-[#F3E5AB] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4 text-xs sm:text-sm !bg-[#161616]">

          {/* Core Configuration Date */}
          <div>
            <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">案場立案/開工日期 <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={projectDate}
              onChange={(e) => setProjectDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#D4AF37]/20 rounded-lg !bg-[#121212] !text-[#E0E0E0] font-mono focus:border-[#D4AF37] outline-none"
              required
            />
          </div>

          {/* Estimation Mode Switch */}
          <div className="p-3 !bg-[#121212] rounded-xl border border-[#D4AF37]/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="block text-xs font-bold !text-[#F3E5AB]">📋 啟用「預算估價案場」模式</span>
              <span className="block text-[10px] !text-[#E0E0E0] leading-normal font-sans">此模式為估價或方案模擬使用。名稱前方將自動冠上 <strong className="!text-[#D4AF37]/90 text-[11px]"> [估] </strong> 識別，並依照每日施工回報標準格式提供填報。</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4 select-none">
              <input
                type="checkbox"
                checked={isEstimation}
                onChange={(e) => setIsEstimation(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#D4AF37]" />
            </label>
          </div>

          {/* Customer Sourcing Tab selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold !text-[#E0E0E0]">業主/客戶來源設定</label>
            <div className="grid grid-cols-2 p-1 !bg-[#121212] border border-[#D4AF37]/15 rounded-xl">
              <button
                type="button"
                onClick={() => handleModeSwitch('existing')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${customerMode === 'existing' ? '!bg-[#D4AF37]/25 !text-[#F3E5AB] border border-[#D4AF37]/35 shadow-sm' : '!text-[#8C8C8C] hover:!text-[#F3E5AB]'}`}
              >
                🔍 選擇已有客戶 (從名冊載入)
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('new')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${customerMode === 'new' ? '!bg-[#D4AF37]/25 !text-[#F3E5AB] border border-[#D4AF37]/35 shadow-sm' : '!text-[#8C8C8C] hover:!text-[#F3E5AB]'}`}
              >
                ➕ 手補全新客戶 (同步儲存)
              </button>
            </div>
          </div>

          {/* Sourcing Area */}
          {customerMode === 'existing' ? (
            <div className="p-3 !bg-[#121212] border border-[#D4AF37]/20 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">搜尋業主 / 長期配合設計公司</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="輸入關鍵字搜尋，或留空直接點選/查看所有合約客戶與設計公司..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-[#D4AF37]/20 rounded-lg text-xs !bg-[#1A1A1A] !text-[#E0E0E0] placeholder-[#8C8C8C] outline-none focus:border-[#D4AF37]"
                  />
                  <Search className="absolute left-2.5 top-2.5 text-neutral-400" size={12} />
                </div>
                
                {/* Search suggestion popover list */}
                {clientSuggestions.length > 0 && (
                  <div className="mt-1 border border-[#D4AF37]/30 rounded-lg !bg-[#0D0D0D] shadow-2xl max-h-[180px] overflow-y-auto divide-y divide-[#D4AF37]/15 z-50 relative">
                    {clientSuggestions.map((s, idx) => (
                      <div
                        key={`${s.customer.id}-${idx}`}
                        onClick={() => handleSelectClientSuggestion(s)}
                        className="p-3 py-2.5 !text-[#E0E0E0] hover:!bg-[#D4AF37]/10 cursor-pointer text-xs transition space-y-1"
                      >
                        {/* 搜尋結果顯示：公司名/業主名 - 現場負責人/聯絡人(電話)(聯絡方式) - 地址簡稱(可能無) - 完整地址 */}
                        <div className="flex flex-col !text-[#E0E0E0] font-sans">
                          <div className="flex flex-wrap items-center gap-1 font-bold !text-[#F3E5AB]">
                            <span className="!text-[#F3E5AB]">🏢 {s.customer.name}</span>
                            <span className="text-neutral-600">-</span>
                            <span className="!text-[#E0E0E0]">👤 {s.customer.contactPerson || '無負責人'}</span>
                            {s.customer.phone && (
                              <span className="!text-[#F3E5AB] font-mono text-[10px] !bg-[#D4AF37]/10 px-1 py-0.2 rounded font-semibold ml-1">
                                ({s.customer.phone})(聯絡方式)
                              </span>
                            )}
                          </div>
                          
                          <div className="text-[11px] !text-[#8C8C8C] font-mono flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span>🏷️ 地址簡稱: {s.address?.addressAbbreviated || '無'}</span>
                            <span className="text-neutral-700">|</span>
                            <span className="truncate max-w-[320px]">📍 完整地址: {s.address?.fullAddress || '全新工地地址待配'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Client Profile Display */}
              {selectedClient ? (
                <div className="p-2.5 !bg-[#D4AF37]/5 rounded-lg border border-[#D4AF37]/20 text-xs">
                  <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-[#D4AF37]/15">
                    <span className="font-bold !text-[#F3E5AB]">👤 當前綁定客戶: {selectedClient.name}</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedClient(null); setCompanyOrOwner(''); }}
                      className="text-[10px] text-red-400 font-bold hover:underline"
                    >
                      取消重選
                    </button>
                  </div>
                  
                  {/* Address drop select */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold !text-[#8C8C8C] uppercase">施作工地地址快速引用</label>
                    <select
                      value={addressChoice}
                      onChange={(e) => handleAddressChoiceChange(e.target.value)}
                      className="w-full p-1.5 border border-[#D4AF37]/20 rounded text-xs !bg-[#1A1A1A] !text-[#E0E0E0] outline-none"
                    >
                      {selectedClient.addresses.map((addr, idx) => (
                        <option className="!bg-[#1A1A1A] !text-[#E0E0E0]" key={addr.id || idx} value={addr.fullAddress}>
                          📍 {addr.addressAbbreviated ? `[${addr.addressAbbreviated}] ` : ''}{addr.fullAddress}
                        </option>
                      ))}
                      <option className="!bg-[#1A1A1A] !text-[#E0E0E0]" value="custom">-- ➕ 為此既有客戶手填新施作地址 --</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2.5 !text-[#8C8C8C] border border-dashed border-[#D4AF37]/20 rounded-lg !bg-[#121212]">
                  <span className="text-[11px]">請使用上方輸入框搜尋並點選您先前建立的客戶/業主</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 !bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl !text-[#E0E0E0]">
              <span className="block font-bold text-[11px] !text-[#F3E5AB] pb-1 flex items-center gap-1">
                <Plus size={13} className="text-[#D4AF37]" />
                正在手添全新業主 Profile
              </span>
              <p className="text-[10px] !text-[#8C8C8C]">
                本案場建立後，系統會在客戶資料名簿中，完美新同步存儲此人的手機和名字，省得以後重複打字！
              </p>
            </div>
          )}

          {/* Form fields for Case Setup details */}
          <div className="space-y-3 pt-1">
            {/* Owner Company */}
            <div>
              <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">
                公司名 / 業主名稱 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="例如：安捷設計、張先生"
                value={companyOrOwner}
                onChange={(e) => setCompanyOrOwner(e.target.value)}
                disabled={customerMode === 'existing' && selectedClient !== null}
                className="w-full px-3 py-1.5 border border-[#D4AF37]/25 rounded-lg !text-[#E0E0E0] !bg-[#121212] font-medium placeholder-[#8C8C8C]/80 disabled:opacity-60 disabled:!bg-[#1D1D1D] disabled:!text-[#8C8C8C] disabled:border-[#D4AF37]/10 outline-none focus:border-[#D4AF37]"
                required
              />
            </div>

            {/* In Charge & Mobile (Parallel Row) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">現場負責人/聯絡人 <span className="!text-[#8C8C8C] font-normal">(選填)</span></label>
                <input
                  type="text"
                  placeholder="例如：林主任、林先生"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#D4AF37]/25 rounded-lg !text-[#E0E0E0] !bg-[#121212] font-medium placeholder-[#8C8C8C]/80 outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">聯絡人號碼 / 電話 <span className="!text-[#8C8C8C] font-normal">(選填)</span></label>
                <input
                  type="text"
                  placeholder="例如：0912-345678"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#D4AF37]/25 rounded-lg !text-[#E0E0E0] !bg-[#121212] font-mono placeholder-[#8C8C8C]/80 outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            {/* Address Nickname & Full address */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-4">
                <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">區域/地址簡稱 <span className="!text-[#8C8C8C] font-normal">(選填)</span></label>
                <input
                  type="text"
                  placeholder="例如：新店案, 信義店"
                  value={addressAbbreviated}
                  onChange={(e) => setAddressAbbreviated(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#D4AF37]/25 rounded-lg !text-[#E0E0E0] !bg-[#121212] placeholder-[#8C8C8C]/80 outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="sm:col-span-8">
                <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">
                  施作完整地址 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例如：新北市新店區北新路一段100號3樓"
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  disabled={customerMode === 'existing' && addressChoice !== 'custom'}
                  className="w-full px-3 py-1.5 border border-[#D4AF37]/25 rounded-lg !text-[#E0E0E0] !bg-[#121212] placeholder-[#8C8C8C]/80 disabled:opacity-60 disabled:!bg-[#1D1D1D] disabled:!text-[#8C8C8C] disabled:border-[#D4AF37]/10 outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>
            </div>

            {/* Special notices / warnings */}
            <div>
              <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">案場常規注意及警告事項 <span className="!text-[#8C8C8C] font-normal">(選填)</span></label>
              <textarea
                rows={2}
                placeholder="例如：高粉塵、限中午十一點前無噪音施工、需要特定防火梯等安全事項..."
                value={projectNotes}
                onChange={(e) => setProjectNotes(e.target.value)}
                className="w-full p-2 border border-[#D4AF37]/25 rounded-lg !text-[#E0E0E0] !bg-[#121212] text-xs placeholder-[#8C8C8C]/80 outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* Interactive Preview Container */}
            <div className="p-3.5 !bg-[#0D0D0D] border border-[#D4AF37]/25 rounded-xl space-y-1.5 !text-[#E0E0E0]">
              <span className="block text-[10px] font-bold !text-[#D4AF37] tracking-wider">自動轉換標準案場識別名 (預覽):</span>
              <p id="generated-name-preview" className="text-xs sm:text-sm font-black tracking-tight break-all font-mono !text-[#F3E5AB]">
                {generatePreview()}
              </p>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-[#D4AF37]/20 flex items-center justify-end gap-3.5">
            <button
              id="btn-cancel-project"
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#D4AF37]/25 bg-[#121212] !text-[#D4AF37] hover:!bg-[#D4AF37]/15 rounded-lg transition text-xs font-bold"
            >
              取消
            </button>
            <button
              id="btn-confirm-project"
              type="submit"
              disabled={!companyOrOwner.trim() || !fullAddress.trim()}
              className="px-5 py-2 text-xs font-black !text-[#0D0D0D] bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] hover:brightness-110 disabled:!from-[#333333] disabled:!to-[#222222] disabled:!text-[#8C8C8C] disabled:opacity-30 disabled:cursor-not-allowed rounded-lg shadow-md transition flex items-center gap-1"
            >
              <CheckCircle2 size={13} />
              建立新案場
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
