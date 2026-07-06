import React, { useState } from 'react';
import { Supplier, MaterialPreset } from '../types';
import { Plus, Trash2, Edit, Store, Phone, MapPin, User, FileText, Info, Layers, Camera, Image, Eye, EyeOff, Check, X } from 'lucide-react';
import { getSubcategories } from '../utils/billingUtils';

interface SuppliersPanelProps {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  materials: MaterialPreset[];
  onSaveToast: (msg: string) => void;
}

export default function SuppliersPanel({
  suppliers,
  setSuppliers,
  materials,
  onSaveToast
}: SuppliersPanelProps) {
  const [newStoreName, setNewStoreName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newTaxId, setNewTaxId] = useState(''); // 統一編號
  const [newPhotoUrl, setNewPhotoUrl] = useState(''); // 相片/名片 (Base64)
  const [newShowInMaterialsDatabase, setNewShowInMaterialsDatabase] = useState(true); // 是否在大庫中顯示為特約行

  const categoriesList = (() => {
    try {
      const stored = localStorage.getItem('engineering_material_categories');
      return stored ? JSON.parse(stored) : ['電路電材類', '水路管材類', '廚衛設備類', '五金緊固類', '工具與雜耗'];
    } catch {
      return ['電路電材類', '水路管材類', '廚衛設備類', '五金緊固類', '工具與雜耗'];
    }
  })();
  const subcategoriesMap = getSubcategories();

  const [newAllowedCategories, setNewAllowedCategories] = useState<string[]>([]);
  const [newAllowedSubcategories, setNewAllowedSubcategories] = useState<string[]>([]);

  const [editAllowedCategories, setEditAllowedCategories] = useState<string[]>([]);
  const [editAllowedSubcategories, setEditAllowedSubcategories] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTaxId, setEditTaxId] = useState(''); // 統一編號
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editShowInMaterialsDatabase, setEditShowInMaterialsDatabase] = useState(true);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null); // 安全刪除確認ID
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const [selectedPhotoForViewer, setSelectedPhotoForViewer] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (isEdit) {
            setEditPhotoUrl(reader.result);
          } else {
            setNewPhotoUrl(reader.result);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    // Check duplicate
    if (suppliers.some(s => s.name.trim() === newStoreName.trim())) {
      alert(`⚠️ 材料行【${newStoreName.trim()}】已存在於名冊中！`);
      return;
    }

    const item: Supplier = {
      id: `sup-${Date.now()}`,
      name: newStoreName.trim(),
      contactPerson: newContact.trim() || undefined,
      phone: newPhone.trim() || undefined,
      address: newAddress.trim() || undefined,
      notes: newNotes.trim() || undefined,
      taxId: newTaxId.trim() || undefined,
      photoUrl: newPhotoUrl || undefined,
      showInMaterialsDatabase: newShowInMaterialsDatabase,
      allowedCategories: newAllowedCategories,
      allowedSubcategories: newAllowedSubcategories
    };

    setSuppliers([...suppliers, item]);
    setNewStoreName('');
    setNewContact('');
    setNewPhone('');
    setNewAddress('');
    setNewNotes('');
    setNewTaxId('');
    setNewPhotoUrl('');
    setNewShowInMaterialsDatabase(true);
    setNewAllowedCategories([]);
    setNewAllowedSubcategories([]);
    onSaveToast(`🏬 已成功將【${item.name}】登錄至特約材料行名冊！`);
  };

  const handleStartEdit = (s: Supplier) => {
    setEditingId(s.id);
    setEditStoreName(s.name);
    setEditContact(s.contactPerson || '');
    setEditPhone(s.phone || '');
    setEditAddress(s.address || '');
    setEditNotes(s.notes || '');
    setEditTaxId(s.taxId || '');
    setEditPhotoUrl(s.photoUrl || '');
    setEditShowInMaterialsDatabase(s.showInMaterialsDatabase !== false);
    setEditAllowedCategories(s.allowedCategories || []);
    setEditAllowedSubcategories(s.allowedSubcategories || []);
  };

  const handleSaveEdit = () => {
    if (!editStoreName.trim()) return;

    setSuppliers(prev => prev.map(s => {
      if (s.id === editingId) {
        return {
          ...s,
          name: editStoreName.trim(),
          contactPerson: editContact.trim() || undefined,
          phone: editPhone.trim() || undefined,
          address: editAddress.trim() || undefined,
          notes: editNotes.trim() || undefined,
          taxId: editTaxId.trim() || undefined,
          photoUrl: editPhotoUrl || undefined,
          showInMaterialsDatabase: editShowInMaterialsDatabase,
          allowedCategories: editAllowedCategories,
          allowedSubcategories: editAllowedSubcategories
        };
      }
      return s;
    }));

    setEditingId(null);
    setEditTaxId('');
    setEditPhotoUrl('');
    setEditAllowedCategories([]);
    setEditAllowedSubcategories([]);
    onSaveToast('✅ 材料行資訊更新成功！');
  };

  const handleConfirmDelete = (id: string, name: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setDeleteConfirmId(null);
    onSaveToast(`🗑️ 材料行【${name}】已成功從名冊中撤除！`);
  };

  return (
    <div id="suppliers-panel" className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#2C2C2C] shadow-sm space-y-6 text-neutral-300">

      {/* Add Supplier Form */}
      <div className="bg-[#252525] p-5 border border-[#2C2C2C] rounded-xl">
        <h3 className="text-sm font-black text-white mb-3 block">➕ 新增特約材料行 及 五金商家</h3>
        <form onSubmit={handleCreateSupplier} className="grid grid-cols-12 gap-3">
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] text-neutral-400 font-bold mb-1">商家名稱 (例如：大山電料行) <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="請輸入材料行名稱"
              className="w-full px-2.5 py-2 border border-[#3A3A3A] bg-[#1E1E1E] rounded-lg text-xs text-white font-bold font-sans focus:outline-none focus:border-[#D4AF37]"
              required
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] text-neutral-400 font-bold mb-1">主要聯絡人/老闆 (非必填)</label>
            <input
              type="text"
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
              placeholder="例如：張老闆 / 洪特助"
              className="w-full px-2.5 py-2 border border-[#3A3A3A] bg-[#1E1E1E] rounded-lg text-xs text-white font-sans focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] text-neutral-400 font-bold mb-1">聯絡電話 (非必填)</label>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="例如：02-2234-5678"
              className="w-full px-2.5 py-2 border border-[#3A3A3A] bg-[#1E1E1E] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] text-neutral-400 font-bold mb-1">統一編號 / 統編 (非必填)</label>
            <input
              type="text"
              maxLength={8}
              value={newTaxId}
              onChange={(e) => setNewTaxId(e.target.value.replace(/\D/g, ''))}
              placeholder="請輸入 8 位統編數字"
              className="w-full px-2.5 py-2 border border-[#3A3A3A] bg-[#1E1E1E] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="col-span-12">
            <label className="block text-[10px] text-neutral-400 font-bold mb-1">店家地址 (非必填)</label>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="請輸入實體店鋪或發貨中心完整地址"
              className="w-full px-2.5 py-2 border border-[#3A3A3A] bg-[#1E1E1E] rounded-lg text-xs text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="col-span-12">
            <label className="block text-[10px] text-neutral-400 font-bold mb-1">合作備忘錄與退成備註 (例如：太平洋退2成、月結出帳等)</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="請輸入此配合材料行的特定折數、結算、強大產品分類或其他合約細節..."
              rows={2}
              className="w-full px-2.5 py-2 border border-[#3A3A3A] bg-[#1E1E1E] rounded-lg text-xs text-white focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {/* Photo & Material Library Config Box */}
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#1E1E1E] p-3.5 border border-[#2C2C2C] rounded-xl">
            {/* Show in Materials list */}
            <div className="flex flex-col space-y-3.5 bg-[#252525] p-3 rounded-xl border border-[#3A3A3A] text-left">
              <div className="space-y-1">
                <label className="block text-[11px] font-black text-[#D4AF37]">⚙️ 大庫材料配合設定</label>
                <p className="text-[10px] text-neutral-400">設定此店家僅在特定的材料大分類或次分類選單中顯示。若不勾選，則該商家不顯示在任何大庫選單中。</p>
                <label className="inline-flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newShowInMaterialsDatabase}
                    onChange={(e) => setNewShowInMaterialsDatabase(e.target.checked)}
                    className="w-4 h-4 rounded border-[#3A3A3A] bg-[#252525] text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-white">
                    {newShowInMaterialsDatabase ? '🟢 啟用大庫與日誌材料選單顯示' : '⚪ 僅保留在名冊中，不於材料選單內顯示'}
                  </span>
                </label>
              </div>

              {newShowInMaterialsDatabase && (
                <div className="border-t border-[#3A3A3A] pt-3 space-y-3 animate-fadeIn text-left">
                  <div>
                    <span className="block text-[10px] font-black text-neutral-400 mb-1.5">📂 限定材料大分類 (未勾選則預設全選)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {categoriesList.map(cat => {
                        const isChecked = newAllowedCategories.includes(cat);
                        return (
                          <button
                            type="button"
                            key={cat}
                            onClick={() => {
                              if (isChecked) {
                                setNewAllowedCategories(prev => prev.filter(c => c !== cat));
                                const subsOfCat = subcategoriesMap[cat] || [];
                                setNewAllowedSubcategories(prev => prev.filter(s => !subsOfCat.includes(s)));
                              } else {
                                setNewAllowedCategories(prev => [...prev, cat]);
                              }
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                              isChecked 
                                ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/45' 
                                : 'bg-[#1E1E1E] text-neutral-400 border-[#2C2C2C] hover:text-neutral-200'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {newAllowedCategories.length > 0 && (
                    <div className="border-t border-[#2C2C2C] pt-2.5 animate-fadeIn">
                      <span className="block text-[10px] font-black text-neutral-400 mb-1.5">📂 限定材料二級次分類 (未勾選則預設全選)</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {newAllowedCategories.map(cat => {
                          const subs = subcategoriesMap[cat] || [];
                          return subs.map(sub => {
                            const isChecked = newAllowedSubcategories.includes(sub);
                            return (
                              <button
                                type="button"
                                key={`${cat}-${sub}`}
                                onClick={() => {
                                  if (isChecked) {
                                    setNewAllowedSubcategories(prev => prev.filter(s => s !== sub));
                                  } else {
                                    setNewAllowedSubcategories(prev => [...prev, sub]);
                                  }
                                }}
                                className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer border ${
                                  isChecked 
                                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' 
                                    : 'bg-[#1E1E1E] text-neutral-400 border-[#2C2C2C] hover:text-neutral-200'
                                }`}
                              >
                                {sub}
                              </button>
                            );
                          });
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Photo Card Upload */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-white">📇 商家相片或名片 (非必填)</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252525] hover:bg-[#2C2C2C] border border-[#3A3A3A] rounded-lg text-xs font-bold text-neutral-300 cursor-pointer transition">
                  <Camera size={14} className="text-neutral-400" />
                  <span>選擇/拍攝名片</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, false)}
                    className="hidden"
                  />
                </label>
                {newPhotoUrl && (
                  <div className="relative group w-12 h-12 rounded border border-[#3A3A3A] overflow-hidden shadow-2xs">
                    <img referrerPolicy="no-referrer" src={newPhotoUrl} alt="Store card preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewPhotoUrl('')}
                      className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150"
                      title="清除相片"
                    >
                      <X size={12} className="text-white font-bold" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-neutral-400">支援手機拍照直接上傳或拖放商家店面、名片圖檔，採本地離線安全存儲。</p>
            </div>
          </div>

          <div className="col-span-12 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-[#D4AF37] text-black hover:bg-[#B3922E] rounded-lg text-xs font-black flex items-center gap-1 transition-all shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              建立材料商
            </button>
          </div>
        </form>
      </div>

      {/* List Suppliers */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider font-mono">特約商家目錄 ({suppliers.length} 家)</h3>
        
        {suppliers.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#2C2C2C] text-neutral-500 text-xs italic rounded-2xl bg-[#252525]/30">
            💡 目前尚無特約材料行，請在上方登錄。
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {suppliers.map(s => {
              const isEditing = editingId === s.id;
              const isExpanded = expandedStoreId === s.id;

              // Find materials that reference this supplier name
              const referencedMaterials = materials.filter(m => 
                m.suppliers?.some(sup => sup.storeName === s.name)
              );

              return (
                <div 
                  key={s.id} 
                  className="p-4 bg-[#252525] hover:bg-[#2C2C2C] border border-[#2C2C2C] rounded-xl space-y-3 transition flex flex-col justify-between"
                >
                  {isEditing ? (
                    <div className="space-y-3 bg-[#1E1E1E] p-3 border border-[#2C2C2C] rounded-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">商家名稱</label>
                          <input
                            type="text"
                            value={editStoreName}
                            onChange={(e) => setEditStoreName(e.target.value)}
                            className="w-full px-2 py-1 border border-[#3A3A3A] rounded text-xs bg-[#252525] text-white font-bold focus:outline-none focus:border-[#D4AF37]"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">主要聯絡人</label>
                          <input
                            type="text"
                            value={editContact}
                            onChange={(e) => setEditContact(e.target.value)}
                            className="w-full px-2 py-1 border border-[#3A3A3A] rounded text-xs bg-[#252525] text-white focus:outline-none focus:border-[#D4AF37]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">聯絡電話</label>
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full px-2 py-1 border border-[#3A3A3A] rounded text-xs bg-[#252525] text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">統一編號 (統編)</label>
                          <input
                            type="text"
                            maxLength={8}
                            value={editTaxId}
                            onChange={(e) => setEditTaxId(e.target.value.replace(/\D/g, ''))}
                            placeholder="8 位統編數字"
                            className="w-full px-2 py-1 border border-[#3A3A3A] rounded text-xs bg-[#252525] text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-0.5">店家實體地址</label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="w-full px-2 py-1 border border-[#3A3A3A] rounded text-xs bg-[#252525] text-white focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-0.5">備註/合約詳情</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1 border border-[#3A3A3A] rounded text-xs bg-[#252525] text-white focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#252525] p-2.5 rounded-lg border border-[#2C2C2C]">
                        {/* Edit Show in materials library */}
                        <div className="flex flex-col space-y-2 text-left">
                          <label className="block text-[9px] font-bold text-neutral-400">大庫與日誌配合設定</label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editShowInMaterialsDatabase}
                              onChange={(e) => setEditShowInMaterialsDatabase(e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-[#3A3A3A] bg-[#1E1E1E] text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-white">
                              {editShowInMaterialsDatabase ? '🟢 在選定分類中顯示此特約商' : '⚪ 不在任何大庫選單顯示'}
                            </span>
                          </label>

                          {editShowInMaterialsDatabase && (
                            <div className="border-t border-[#3A3A3A] pt-2 space-y-2 animate-fadeIn text-left">
                              <div>
                                <span className="block text-[9px] font-bold text-neutral-400 mb-1">📂 限定大分類 (未選則預設全選)</span>
                                <div className="flex flex-wrap gap-1">
                                  {categoriesList.map(cat => {
                                    const isChecked = editAllowedCategories.includes(cat);
                                    return (
                                      <button
                                        type="button"
                                        key={cat}
                                        onClick={() => {
                                          if (isChecked) {
                                            setEditAllowedCategories(prev => prev.filter(c => c !== cat));
                                            const subsOfCat = subcategoriesMap[cat] || [];
                                            setEditAllowedSubcategories(prev => prev.filter(s => !subsOfCat.includes(s)));
                                          } else {
                                            setEditAllowedCategories(prev => [...prev, cat]);
                                          }
                                        }}
                                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer border ${
                                          isChecked 
                                            ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/45' 
                                            : 'bg-[#252525] text-neutral-400 border-[#2C2C2C] hover:text-neutral-200'
                                        }`}
                                      >
                                        {cat}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {editAllowedCategories.length > 0 && (
                                <div className="border-t border-[#2C2C2C] pt-2 animate-fadeIn">
                                  <span className="block text-[9px] font-bold text-neutral-400 mb-1">📂 限定次分類 (未選則預設全選)</span>
                                  <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto pr-1">
                                    {editAllowedCategories.map(cat => {
                                      const subs = subcategoriesMap[cat] || [];
                                      return subs.map(sub => {
                                        const isChecked = editAllowedSubcategories.includes(sub);
                                        return (
                                          <button
                                            type="button"
                                            key={`${cat}-${sub}`}
                                            onClick={() => {
                                              if (isChecked) {
                                                setEditAllowedSubcategories(prev => prev.filter(s => s !== sub));
                                              } else {
                                                setEditAllowedSubcategories(prev => [...prev, sub]);
                                              }
                                            }}
                                            className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-all cursor-pointer border ${
                                              isChecked 
                                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' 
                                                : 'bg-[#252525] text-neutral-400 border-[#2C2C2C] hover:text-neutral-200'
                                            }`}
                                          >
                                            {sub}
                                          </button>
                                        );
                                      });
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {/* Edit Photo Card / upload */}
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-400 mb-1">名片或商家相片</label>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 px-2 py-1 bg-[#252525] hover:bg-[#2C2C2C] border border-[#3A3A3A] rounded text-[10px] font-bold text-neutral-300 cursor-pointer transition">
                              <Camera size={12} className="text-neutral-400" />
                              <span>更換/拍攝</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePhotoUpload(e, true)}
                                className="hidden"
                              />
                            </label>
                            {editPhotoUrl && (
                              <div className="relative group w-8 h-8 rounded border border-[#3A3A3A] overflow-hidden shadow-3xs">
                                <img referrerPolicy="no-referrer" src={editPhotoUrl} alt="Card edit preview" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setEditPhotoUrl('')}
                                  className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150"
                                  title="清除相片"
                                >
                                  <X size={10} className="text-white font-bold" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="px-2.5 py-1 bg-[#D4AF37] text-black rounded text-xs font-black hover:bg-[#B3922E] cursor-pointer"
                        >
                          儲存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 bg-[#252525] text-neutral-400 rounded text-xs hover:bg-[#2C2C2C] cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : deleteConfirmId === s.id ? (
                    <div className="bg-red-950/20 p-4 border border-red-900 rounded-xl space-y-3 animate-fadeIn">
                      <div className="flex items-start gap-2 text-red-200">
                        <span className="text-base select-none mt-0.5">⚠️</span>
                        <div className="space-y-1">
                          <span className="font-extrabold text-xs block text-white">
                            確定要刪除材料商【{s.name}】嗎？
                          </span>
                          <span className="text-[10px] text-red-300 leading-relaxed block">
                            此操作不可逆。此材料行目前與大庫中存有特約價格。移除後，名冊將不再顯示此商家，但過往大庫歷史特定合約進貨價格仍會予以保留。
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(s.id, s.name)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-black cursor-pointer shadow-xs transition"
                        >
                          確定刪除
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 bg-[#252525] hover:bg-[#2C2C2C] text-neutral-300 border border-[#3A3A3A] rounded-lg text-[11px] font-bold cursor-pointer transition shadow-3xs"
                        >
                          我再想想 (取消)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2.5">
                        {/* Title bar */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <span className="font-bold text-white text-sm sm:text-base block flex items-center gap-1.5">
                              <Store className="text-[#D4AF37]" size={16} />
                              {s.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[9px] text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-2 py-0.5 rounded-md font-bold">
                                🏬 本統特約配合材料行
                              </span>
                              {s.showInMaterialsDatabase !== false ? (
                                <>
                                  <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">
                                    🟢 大庫特約連動中
                                  </span>
                                  {s.allowedCategories && s.allowedCategories.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[9px] text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-2 py-0.5 rounded-md font-mono font-bold" title={s.allowedCategories.join(', ')}>
                                      📁 限定大類: {s.allowedCategories.join(', ')}
                                    </span>
                                  )}
                                  {s.allowedSubcategories && s.allowedSubcategories.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-mono font-bold" title={s.allowedSubcategories.join(', ')}>
                                      📁 限定次類: {s.allowedSubcategories.length}個
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] text-neutral-400 bg-[#1E1E1E] border border-[#2C2C2C] px-2 py-0.5 rounded-md font-bold" title="已剔除在大庫匹配名單，僅保留名片與基本資訊">
                                  🔒 僅在通訊錄備用
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEdit(s)}
                              className="p-1 px-1.5 text-neutral-400 hover:text-[#D4AF37] hover:bg-[#2C2C2C] rounded transition cursor-pointer"
                              title="編輯聯絡卡片"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(s.id)}
                              className="p-1 px-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-950/30 rounded transition cursor-pointer"
                              title="從名冊中移出"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-400 pt-1 border-t border-[#2C2C2C]">
                          {s.contactPerson && (
                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-neutral-500 shrink-0" />
                              <span>聯絡負責人：<strong className="text-white">{s.contactPerson}</strong></span>
                            </div>
                          )}
                          {s.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={13} className="text-neutral-500 shrink-0" />
                              <span>電話：<strong className="text-white font-mono">{s.phone}</strong></span>
                            </div>
                          )}
                          {s.taxId && (
                            <div className="col-span-1 sm:col-span-2 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                                📋 統一編號(統編)：{s.taxId}
                              </span>
                            </div>
                          )}
                          {s.address && (
                            <div className="col-span-1 sm:col-span-2 flex items-start gap-1.5 mt-0.5 text-neutral-400">
                              <MapPin size={13} className="text-neutral-500 shrink-0 mt-0.5" />
                              <span className="leading-tight">地址：<span className="text-neutral-300 font-sans">{s.address}</span></span>
                            </div>
                          )}
                        </div>

                        {/* Co-op Memo notes */}
                        {s.notes && (
                          <div className="bg-[#1E1E1E] px-3 py-2 border border-[#2C2C2C] rounded-lg text-xs leading-relaxed text-neutral-400">
                            <span className="block text-[10px] uppercase font-bold text-neutral-500 tracking-wider mb-0.5 font-mono">📌 合作折扣及結算備註</span>
                            <p className="italic text-neutral-300">{s.notes}</p>
                          </div>
                        )}

                        {/* Co-op Photo card */}
                        {s.photoUrl && (
                          <div className="flex items-center gap-2 mt-2 bg-[#1E1E1E] px-3 py-2 border border-[#2C2C2C] rounded-lg">
                            <div className="relative w-10 h-10 rounded border border-[#3A3A3A] bg-[#252525] overflow-hidden shrink-0 shadow-3xs cursor-zoom-in group" onClick={() => setSelectedPhotoForViewer(s.photoUrl || '')}>
                              <img referrerPolicy="no-referrer" src={s.photoUrl} alt="Store Card Thumbnail" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-left">
                              <span className="block text-[10px] uppercase font-black text-neutral-500 tracking-wider font-mono">📇 商家名片 / 特約店照</span>
                              <button
                                type="button"
                                onClick={() => setSelectedPhotoForViewer(s.photoUrl || '')}
                                className="text-[10px] text-[#D4AF37] hover:text-[#B3922E] font-extrabold flex items-center gap-0.5 transition cursor-pointer"
                              >
                                <Camera size={11} />
                                點擊放行大名片 🔍
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Linked Materials section */}
                      <div className="pt-2 border-t border-[#2C2C2C] mt-2 flex justify-between items-center">
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Layers size={13} className="text-neutral-500" />
                          <span>已綁定大庫特約耗料：<strong className="text-[#D4AF37] text-xs">{referencedMaterials.length}</strong> 項</span>
                        </span>

                        {referencedMaterials.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedStoreId(isExpanded ? null : s.id)}
                            className="text-[10px] font-bold text-[#D4AF37] bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 px-2 py-1 rounded border border-[#D4AF37]/20 transition cursor-pointer"
                          >
                            {isExpanded ? '▲ 隱藏精細清單' : '▼ 查看綁定品項價格'}
                          </button>
                        )}
                      </div>

                      {isExpanded && referencedMaterials.length > 0 && (
                        <div className="bg-[#1E1E1E] border border-[#2C2C2C] p-2.5 rounded-lg text-xs space-y-1.5 mt-2 animate-fadeIn max-h-[160px] overflow-y-auto">
                          <span className="text-[10px] font-bold block text-neutral-400 font-mono">🏬 在本材料行有特報價的材料：</span>
                          <div className="divide-y divide-[#2C2C2C]">
                            {referencedMaterials.map(m => {
                              const storeConf = m.suppliers?.find(sup => sup.storeName === s.name);
                              return (
                                <div key={m.id} className="py-1 flex justify-between items-center text-[11px]">
                                  <span className="font-semibold text-white">{m.name} ({m.unit})</span>
                                  <span className="font-mono text-neutral-400 scale-95">
                                    牌: <strong className="text-neutral-300">${storeConf?.listPrice}</strong> / 進: <strong className="text-[#D4AF37] font-bold">${storeConf?.costPrice}</strong>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photo Viewer Modal */}
      {selectedPhotoForViewer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
          onClick={() => setSelectedPhotoForViewer(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-[#1E1E1E] border border-[#2C2C2C] rounded-2xl overflow-hidden shadow-2xl animate-scaleUp p-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header/Control bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2C2C2C] bg-[#252525]">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <Camera size={14} className="text-[#D4AF37] animate-bounce" />
                特約商家名片 / 照片詳細瀏覽
              </span>
              <button
                type="button"
                onClick={() => setSelectedPhotoForViewer(null)}
                className="p-1 text-neutral-400 hover:text-white hover:bg-[#2C2C2C] rounded-full transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Photo core */}
            <div className="bg-black/40 border border-[#2C2C2C] rounded-xl overflow-hidden p-2 flex items-center justify-center max-h-[70vh]">
              <img 
                referrerPolicy="no-referrer" 
                src={selectedPhotoForViewer} 
                alt="Selected business card full size" 
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
              />
            </div>
            
            <div className="px-5 py-3 text-center bg-[#252525] border-t border-[#2C2C2C]">
              <p className="text-[10px] text-neutral-400 font-extrabold font-mono">💡 點擊外部黑色背景或右上角【X】即可關閉視窗</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
