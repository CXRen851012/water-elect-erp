import React, { useState, useEffect, useMemo } from 'react';
import { Project, Customer } from '../types';
import { X, Building2, Search, UserCheck, MapPin, Phone, AlertTriangle, Calendar, Clock } from 'lucide-react';

interface BookingFormProps {
  onSave: (bookingData: Omit<Project, 'id' | 'createdAt'> & { 
    id?: string;
    createdAt?: string;
    isBooking: boolean;
    bookingDate?: string;
    bookingTime?: string;
    bookingWorkContent?: string;
    bookingStatus: 'pending' | 'converted' | 'lost';
  }, updatedCustomer?: Customer) => void;
  onClose: () => void;
  existingProjects: Project[];
  customers: Customer[];
  existingBooking?: Project; // If editing
}

export default function BookingForm({ 
  onSave, 
  onClose, 
  existingProjects, 
  customers,
  existingBooking
}: BookingFormProps) {
  // Creation Date (Default to today or existing)
  const [creationDate, setCreationDate] = useState<string>(() => {
    if (existingBooking?.createdAt) {
      return existingBooking.createdAt.substring(0, 10);
    }
    return new Date().toISOString().substring(0, 10);
  });

  // Appointment scheduling
  const [bookingDate, setBookingDate] = useState<string>(existingBooking?.bookingDate || '');
  const [bookingTime, setBookingTime] = useState<string>(existingBooking?.bookingTime || '');
  const [bookingWorkContent, setBookingWorkContent] = useState<string>(existingBooking?.bookingWorkContent || '');

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
  const [serialNumber, setSerialNumber] = useState('');

  // Handle client pre-selection and editing initial values
  useEffect(() => {
    if (existingBooking) {
      setCompanyOrOwner(existingBooking.companyOrOwner);
      setContactPerson(existingBooking.contactPerson || '');
      setContactPhone(existingBooking.contactPhone || '');
      setAddressAbbreviated(existingBooking.addressAbbreviated || '');
      setFullAddress(existingBooking.fullAddress);
      setProjectNotes(existingBooking.projectNotes || '');
      setSerialNumber(existingBooking.serialNumber);

      if (existingBooking.clientId) {
        const foundCust = customers.find(c => c.id === existingBooking.clientId);
        if (foundCust) {
          setCustomerMode('existing');
          setSelectedClient(foundCust);
          // Check if address is custom or matches one of the client's addresses
          const addrMatch = foundCust.addresses.find(
            a => a.fullAddress.trim().toLowerCase() === existingBooking.fullAddress.trim().toLowerCase()
          );
          if (addrMatch) {
            setAddressChoice(addrMatch.fullAddress);
          } else {
            setAddressChoice('custom');
          }
        } else {
          setCustomerMode('new');
        }
      } else {
        setCustomerMode('new');
      }
    }
  }, [existingBooking, customers]);

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
      setAddressChoice('custom');
      setFullAddress('');
      setProjectNotes('');
    }
  };

  // Select an existing client suggestion
  const handleSelectClientSuggestion = (item: { customer: Customer; address: any | null }) => {
    const { customer, address } = item;
    setSelectedClient(customer);
    setCompanyOrOwner(customer.name);
    setClientSearchQuery(''); // clear query

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

  // Auto-calculate flowing serial number for unique standard identifier
  useEffect(() => {
    if (existingBooking) return; // Don't recalculate if editing

    if (!companyOrOwner.trim() || !fullAddress.trim() || !creationDate) {
      setSerialNumber('001');
      return;
    }

    const targetDateStr = creationDate.replace(/-/g, ''); // e.g. "20260526"
    const currentComp = companyOrOwner.trim().toLowerCase();

    // Scan existing projects that have the SAME date and customer
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
  }, [creationDate, companyOrOwner, fullAddress, existingProjects, existingBooking]);

  // Unified helper to produce standardized project name
  const getGeneratedName = (
    dateStr: string,
    owner: string,
    person: string,
    phone: string,
    abbrev: string,
    fullAddr: string,
    serial: string
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

    return `${dateFormatted}-${clientPart}-${addressPart}-${serial}`;
  };

  // Compute live visual preview matching standard format
  const generatePreview = () => {
    if (!companyOrOwner || !fullAddress) {
      return '(請填打「公司名/業主名」與「完整施作地址」以預覽標準案場識別名)';
    }

    return getGeneratedName(
      creationDate,
      companyOrOwner,
      contactPerson,
      contactPhone,
      addressAbbreviated,
      fullAddress,
      serialNumber
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (customerMode === 'existing' && !selectedClient) {
      alert('請先在搜尋結果中點選欲載入的已有客戶！若要手動輸入，請切換至「手填全新客戶」設定。');
      return;
    }

    if (!companyOrOwner.trim() || !fullAddress.trim()) {
      alert('請填打必填欄位！');
      return;
    }

    const finalGeneratedName = getGeneratedName(
      creationDate,
      companyOrOwner,
      contactPerson,
      contactPhone,
      addressAbbreviated,
      fullAddress,
      serialNumber
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
         notes: undefined,
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
      id: existingBooking?.id,
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
      isBooking: true,
      bookingDate: bookingDate || undefined,
      bookingTime: bookingTime || undefined,
      bookingWorkContent: bookingWorkContent.trim() || undefined,
      bookingStatus: existingBooking?.bookingStatus as any || 'pending',
      createdAt: creationDate + 'T00:00:00.000Z'
    }, updatedCustomer);
  };

  return (
    <div id="booking-form-modal" className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="!bg-[#1A1A1A] rounded-2xl border border-[#D4AF37]/35 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-xl w-full overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#D4AF37]/25 flex items-center justify-between !bg-[#1A1A1A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 !bg-[#D4AF37]/10 rounded-xl text-amber-500 border border-[#D4AF37]/20">
              <Calendar size={20} className="text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold !text-[#F3E5AB]">
                {existingBooking ? '修改預約與待辦排程' : '新增預約與工作待辦'}
              </h2>
              <p className="text-xs !text-[#E0E0E0]">登記待排程之預約，可填寫預約日期時間與具體工作</p>
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

          {/* Creation Date */}
          <div>
            <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">
              立案建立日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={creationDate}
              onChange={(e) => setCreationDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-[#D4AF37]/20 rounded-lg !bg-[#121212] !text-[#E0E0E0] font-mono focus:border-[#D4AF37] outline-none"
              required
            />
          </div>

          {/* Booking Date & Time Scheduling */}
          <div className="p-4 !bg-[#1A1A1A] rounded-xl border border-[#D4AF37]/15 space-y-3">
            <span className="block text-xs font-bold !text-[#F3E5AB]">⏰ 預約時程排定 (選填)</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] !text-[#B3B3B3] mb-1">預約施作日期</label>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#D4AF37]/15 rounded-lg !bg-[#121212] !text-[#E0E0E0] font-mono focus:border-[#D4AF37] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] !text-[#B3B3B3] mb-1">預約施作時間</label>
                <input
                  type="text"
                  placeholder="例：上午、下午、10點前、17:00後"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#D4AF37]/15 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setBookingTime('上午')}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded text-[10px] text-neutral-300 font-bold transition-all"
                  >
                    ☀️ 上午
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingTime('下午')}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded text-[10px] text-neutral-300 font-bold transition-all"
                  >
                    🌙 下午
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingTime('10點前')}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded text-[10px] text-neutral-300 font-bold transition-all"
                  >
                    ⏰ 10點前
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingTime('12點前')}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded text-[10px] text-neutral-300 font-bold transition-all"
                  >
                    ⏰ 12點前
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingTime('13點後')}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded text-[10px] text-neutral-300 font-bold transition-all"
                  >
                    ⏰ 13點後
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingTime('17點後')}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded text-[10px] text-neutral-300 font-bold transition-all"
                  >
                    ⏰ 17點後
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 font-sans leading-normal">
              💡 若尚未確定特定日期或時間，請保持空白。系統支持「僅有預約日期、無特定時間」之項目。
            </p>
          </div>

          {/* Booking Specific Work Content */}
          <div>
            <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">
              🛠️ 預約施作工作內容 <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={bookingWorkContent}
              onChange={(e) => setBookingWorkContent(e.target.value)}
              placeholder="請具體描述此客戶預約之施工或查勘項目 (例如：客廳水管堵塞疏通、浴室天花板漏水檢測)"
              className="w-full px-3 py-2 border border-[#D4AF37]/20 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none placeholder:text-neutral-600 resize-none"
              required
            />
          </div>

          {/* Customer Sourcing Tab selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold !text-[#E0E0E0]">業主/客戶來源設定</label>
            <div className="grid grid-cols-2 p-1 !bg-[#121212] border border-[#D4AF37]/15 rounded-xl">
              <button
                type="button"
                onClick={() => handleModeSwitch('existing')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${customerMode === 'existing' ? 'bg-[#D4AF37] text-black font-extrabold' : 'text-neutral-400 hover:text-white'}`}
              >
                🔍 載入名錄已有客戶
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('new')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all ${customerMode === 'new' ? 'bg-[#D4AF37] text-black font-extrabold' : 'text-neutral-400 hover:text-white'}`}
              >
                ✍️ 手填全新客戶
              </button>
            </div>
          </div>

          {customerMode === 'existing' ? (
            <div className="space-y-3">
              {/* Existing Customer Search Input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="輸入關鍵字搜尋，或直接在下方清單點選已建立的業主..."
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-[#D4AF37]/20 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none placeholder:text-neutral-600"
                />
              </div>

              {/* Suggestions dropdown list */}
              {customers.length > 0 && (
                <div className="max-h-[160px] overflow-y-auto border border-[#3A3A3A] bg-[#1E1E1E] rounded-xl p-1 divide-y divide-neutral-800 scrollbar-thin">
                  {clientSuggestions.length === 0 ? (
                    <div className="p-3 text-center text-xs text-neutral-500 font-sans">
                      ⚠️ 找不到匹配的客戶！您可以直接切換「手填全新客戶」進行新客登記。
                    </div>
                  ) : (
                    clientSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectClientSuggestion(item)}
                        className="w-full text-left p-3 py-2.5 !text-[#E0E0E0] hover:!bg-[#D4AF37]/10 cursor-pointer text-xs transition border-b border-neutral-800 last:border-b-0"
                      >
                        <div className="flex flex-col !text-[#E0E0E0] font-sans">
                          <div className="flex flex-wrap items-center gap-1 font-bold !text-[#F3E5AB]">
                            <span className="!text-[#F3E5AB]">🏢 {item.customer.name}</span>
                            <span className="text-neutral-600">-</span>
                            <span className="!text-[#E0E0E0]">👤 {item.customer.contactPerson || '無負責人'}</span>
                            {item.customer.phone && (
                              <span className="!text-[#F3E5AB] font-mono text-[10px] !bg-[#D4AF37]/10 px-1 py-0.2 rounded font-semibold ml-1">
                                ({item.customer.phone})(聯絡方式)
                              </span>
                            )}
                          </div>
                          
                          <div className="text-[11px] !text-[#8C8C8C] font-mono flex flex-wrap items-center gap-1.5 mt-1">
                            <span>🏷️ 地址簡稱: {item.address?.addressAbbreviated || '無'}</span>
                            <span className="text-neutral-700">|</span>
                            <span className="truncate max-w-[420px]">📍 完整地址: {item.address?.fullAddress || '全新工地地址待配'}</span>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Selected Customer indicator */}
              {selectedClient ? (
                <div className="p-3 bg-[#D4AF37]/5 border border-[#D4AF37]/35 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-amber-400" />
                    <div>
                      <span className="text-xs font-extrabold text-[#F3E5AB]">已選定合作客戶</span>
                      <p className="text-xs text-neutral-200 font-bold">{selectedClient.name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedClient(null); setCompanyOrOwner(''); }}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 transition underline"
                  >
                    清除重選
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-center text-xs text-neutral-500 font-sans">
                  💡 請在上方搜尋並「點選」指定一位已有客戶，系統將自動載入其聯絡人與可用施作地址。
                </div>
              )}

              {/* Selected client's address dropdown */}
              {selectedClient && (
                <div>
                  <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">選擇施作地址</label>
                  <select
                    value={addressChoice}
                    onChange={(e) => handleAddressChoiceChange(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#D4AF37]/20 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none"
                  >
                    {selectedClient.addresses.map((a, i) => (
                      <option key={i} value={a.fullAddress}>
                        {a.addressAbbreviated ? `【${a.addressAbbreviated}】` : ''} {a.fullAddress}
                      </option>
                    ))}
                    <option value="custom">➕ 使用全新自訂施作地址 (並自動同步更新至該客戶名單中)</option>
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl space-y-1">
              <span className="text-xs font-bold text-[#F3E5AB]">🆕 填打全新客戶提示</span>
              <p className="text-[10px] text-neutral-400 leading-relaxed font-sans">
                填寫完成並儲存時，系統會自動在「合作業主名錄」中建立本客戶的全新主資料，免去重複手動操作的繁瑣程序。
              </p>
            </div>
          )}

          {/* Form fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">
                公司名 / 業主名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyOrOwner}
                onChange={(e) => setCompanyOrOwner(e.target.value)}
                placeholder="例如：合悅室內設計、張先生"
                className="w-full px-3 py-1.5 border border-[#D4AF37]/20 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none"
                disabled={customerMode === 'existing'}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">現場負責人 / 聯絡人</label>
                <div className="relative">
                  <UserCheck size={14} className="absolute left-3 top-2.5 text-neutral-500" />
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="例如：陳主任、本人"
                    className="w-full pl-9 pr-3 py-1.5 border border-[#D4AF37]/15 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">聯絡人電話</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-2.5 text-neutral-500" />
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="例如：0912-345678"
                    className="w-full pl-9 pr-3 py-1.5 border border-[#D4AF37]/15 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">
                  地址簡稱
                </label>
                <input
                  type="text"
                  value={addressAbbreviated}
                  onChange={(e) => setAddressAbbreviated(e.target.value)}
                  placeholder="例如：新店官邸、大安工坊"
                  className="w-full px-3 py-1.5 border border-[#D4AF37]/15 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">
                  完整施作地址 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-2.5 text-neutral-500" />
                  <input
                    type="text"
                    value={fullAddress}
                    onChange={(e) => setFullAddress(e.target.value)}
                    placeholder="例如：新北市新店區北新路三段88號"
                    className="w-full pl-9 pr-3 py-1.5 border border-[#D4AF37]/20 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none"
                    disabled={customerMode === 'existing' && addressChoice !== 'custom'}
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold !text-[#E0E0E0] mb-1">
                此案場/地址之常規注意事項 & 特別備註 (選填)
              </label>
              <textarea
                rows={2}
                value={projectNotes}
                onChange={(e) => setProjectNotes(e.target.value)}
                placeholder="例如：此案場無電梯需走樓梯、管理室鑰匙在2樓等"
                className="w-full px-3 py-2 border border-[#D4AF37]/15 rounded-lg !bg-[#121212] !text-[#E0E0E0] focus:border-[#D4AF37] outline-none placeholder:text-neutral-700 resize-none"
              />
            </div>
          </div>

          {/* Real-time Standardized Identifier Preview Section */}
          <div className="p-4 !bg-[#1A1A1A] rounded-xl border border-dashed border-[#D4AF37]/35 space-y-1 bg-gradient-to-r from-amber-500/5 to-transparent">
            <span className="block text-xs font-extrabold !text-[#F3E5AB]">🏢 標準案場識別名 (預覽產生)</span>
            <span className="block text-[11px] font-mono !text-neutral-300 break-all select-all font-bold">
              {generatePreview()}
            </span>
            <span className="block text-[10px] !text-neutral-500 font-sans">
              * 流水號系統已在當天為您安排至第 <strong className="!text-[#D4AF37]">{serialNumber}</strong> 組。
            </span>
          </div>
        </form>

        {/* Footer actions */}
        <div className="p-4 border-t border-[#D4AF37]/20 flex items-center justify-end gap-3 bg-[#131313]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg !bg-[#262626] border border-neutral-800 !text-neutral-300 hover:!bg-[#2E2E2E] transition cursor-pointer"
          >
            取消返回
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-xs font-bold rounded-lg !bg-[#D4AF37] hover:!bg-[#bfa032] !text-black shadow-md flex items-center gap-1 cursor-pointer"
          >
            <span>💾 儲存並加入預約待辦</span>
          </button>
        </div>
      </div>
    </div>
  );
}
