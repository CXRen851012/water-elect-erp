import React, { useState } from 'react';
import { Supplier, MaterialPreset } from '../types';
import { Plus, Trash2, Edit, Store, Phone, MapPin, User, FileText, Info, Layers, Camera, Image, Eye, EyeOff, Check, X } from 'lucide-react';

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
      showInMaterialsDatabase: newShowInMaterialsDatabase
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
          showInMaterialsDatabase: editShowInMaterialsDatabase
        };
      }
      return s;
    }));

    setEditingId(null);
    setEditTaxId('');
    setEditPhotoUrl('');
    onSaveToast('✅ 材料行資訊更新成功！');
  };

  const handleConfirmDelete = (id: string, name: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setDeleteConfirmId(null);
    onSaveToast(`🗑️ 材料行【${name}】已成功從名冊中撤除！`);
  };

  return (
    <div id="suppliers-panel" className="bg-white p-6 rounded-2xl border-2 border-neutral-300 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-neutral-200">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider font-extrabold text-amber-700 block font-mono">Supplier Directory</span>
          <h2 className="text-lg font-black text-neutral-950 flex items-center gap-2">
            <Store className="text-amber-700 animate-pulse stroke-[2.5]" size={24} />
            特約材料行名冊管理
          </h2>
        </div>
      </div>

      {/* Add Supplier Form */}
      <div className="bg-neutral-50 p-5 border-2 border-neutral-250 rounded-xl">
        <h3 className="text-sm font-black text-neutral-950 mb-3 block">➕ 新增特約材料行 及 五金商家</h3>
        <form onSubmit={handleCreateSupplier} className="grid grid-cols-12 gap-3">
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] text-neutral-500 font-bold mb-1">商家名稱 (例如：大山電料行) <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="請輸入材料行名稱"
              className="w-full px-2.5 py-2 border border-neutral-200 bg-white rounded-lg text-xs text-neutral-800 font-bold font-sans"
              required
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] text-neutral-500 font-bold mb-1">主要聯絡人/老闆 (非必填)</label>
            <input
              type="text"
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
              placeholder="例如：張老闆 / 洪特助"
              className="w-full px-2.5 py-2 border border-neutral-200 bg-white rounded-lg text-xs text-neutral-800 font-sans"
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] text-neutral-500 font-bold mb-1">聯絡電話 (非必填)</label>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="例如：02-2234-5678"
              className="w-full px-2.5 py-2 border border-neutral-200 bg-white rounded-lg text-xs text-neutral-800 font-mono"
            />
          </div>
          <div className="col-span-12 sm:col-span-3">
            <label className="block text-[10px] text-neutral-500 font-bold mb-1">統一編號 / 統編 (非必填)</label>
            <input
              type="text"
              maxLength={8}
              value={newTaxId}
              onChange={(e) => setNewTaxId(e.target.value.replace(/\D/g, ''))}
              placeholder="請輸入 8 位統編數字"
              className="w-full px-2.5 py-2 border border-neutral-200 bg-white rounded-lg text-xs text-neutral-800 font-mono"
            />
          </div>
          <div className="col-span-12">
            <label className="block text-[10px] text-neutral-500 font-bold mb-1">店家地址 (非必填)</label>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="請輸入實體店鋪或發貨中心完整地址"
              className="w-full px-2.5 py-2 border border-neutral-200 bg-white rounded-lg text-xs text-neutral-800"
            />
          </div>
          <div className="col-span-12">
            <label className="block text-[10px] text-neutral-500 font-bold mb-1">合作備忘錄與退成備註 (例如：太平洋退2成、月結出帳等)</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="請輸入此配合材料行的特定折數、結算、強大產品分類或其他合約細節..."
              rows={2}
              className="w-full px-2.5 py-2 border border-neutral-200 bg-white rounded-lg text-xs text-neutral-800"
            />
          </div>

          {/* Photo & Material Library Config Box */}
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-3.5 border border-neutral-150 rounded-xl">
            {/* Show in Materials list */}
            <div className="flex flex-col justify-center space-y-1">
              <label className="block text-[11px] font-black text-neutral-700">⚙️ 大庫材料配合設定</label>
              <p className="text-[10px] text-neutral-400">若不勾選，該商家僅保留於通訊名冊以供查詢，不會干擾或顯示在大庫新增規格或工務日誌登錄之選單中。</p>
              <label className="inline-flex items-center gap-2 pt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newShowInMaterialsDatabase}
                  onChange={(e) => setNewShowInMaterialsDatabase(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-neutral-800">
                  {newShowInMaterialsDatabase ? '🟢 預設於「材料大庫、日誌材料行」選單中顯示此特約商' : '⚪ 僅保留在名冊中，不於材料大庫選項內顯示'}
                </span>
              </label>
            </div>

            {/* Photo Card Upload */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-black text-neutral-700">📇 商家相片或名片 (非必填)</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg text-xs font-bold text-neutral-700 cursor-pointer transition">
                  <Camera size={14} className="text-neutral-500" />
                  <span>選擇/拍攝名片</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, false)}
                    className="hidden"
                  />
                </label>
                {newPhotoUrl && (
                  <div className="relative group w-12 h-12 rounded border border-neutral-200 overflow-hidden shadow-2xs">
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
              className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
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
          <div className="text-center py-12 border border-dashed border-neutral-200 text-neutral-400 text-xs italic rounded-2xl bg-neutral-50/20">
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
                  className="p-4 bg-white hover:bg-neutral-50/20 border border-neutral-200 rounded-xl space-y-3 transition flex flex-col justify-between"
                >
                  {isEditing ? (
                    <div className="space-y-3 bg-white p-3 border border-neutral-200 rounded-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">商家名稱</label>
                          <input
                            type="text"
                            value={editStoreName}
                            onChange={(e) => setEditStoreName(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">主要聯絡人</label>
                          <input
                            type="text"
                            value={editContact}
                            onChange={(e) => setEditContact(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-neutral-400 mb-0.5">聯絡電話</label>
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-mono"
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
                            className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-800 font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-0.5">店家實體地址</label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-0.5">備註/合約詳情</label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1 border border-neutral-200 rounded text-xs bg-white text-neutral-800"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50 p-2.5 rounded-lg border border-neutral-150">
                        {/* Edit Show in materials library */}
                        <div className="flex flex-col justify-center">
                          <label className="block text-[9px] font-bold text-neutral-500 mb-1">大庫與日誌配合</label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editShowInMaterialsDatabase}
                              onChange={(e) => setEditShowInMaterialsDatabase(e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-neutral-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-neutral-700">
                              {editShowInMaterialsDatabase ? '在大庫/施工日誌選單中顯示' : '僅列在名錄，不在大庫顯示'}
                            </span>
                          </label>
                        </div>
                        {/* Edit Photo Card / upload */}
                        <div>
                          <label className="block text-[9px] font-bold text-neutral-500 mb-1">名片或商家相片</label>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-200 rounded text-[10px] font-bold text-neutral-700 cursor-pointer transition">
                              <Camera size={12} className="text-neutral-500" />
                              <span>更換/拍攝</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePhotoUpload(e, true)}
                                className="hidden"
                              />
                            </label>
                            {editPhotoUrl && (
                              <div className="relative group w-8 h-8 rounded border border-neutral-200 overflow-hidden shadow-3xs">
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
                          className="px-2.5 py-1 bg-amber-600 text-white rounded text-xs font-bold hover:bg-amber-700 cursor-pointer"
                        >
                          儲存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 bg-neutral-200 text-neutral-600 rounded text-xs hover:bg-neutral-300 cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : deleteConfirmId === s.id ? (
                    <div className="bg-red-50/50 p-4 border border-red-200/80 rounded-xl space-y-3 animate-fadeIn">
                      <div className="flex items-start gap-2 text-red-900">
                        <span className="text-base select-none mt-0.5">⚠️</span>
                        <div className="space-y-1">
                          <span className="font-extrabold text-xs block text-red-950">
                            確定要刪除材料商【{s.name}】嗎？
                          </span>
                          <span className="text-[10px] text-red-800 leading-relaxed block">
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
                          className="px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-lg text-[11px] font-bold cursor-pointer shadow-3xs transition"
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
                          <div className="space-y-1 bg-white">
                            <span className="font-bold text-neutral-800 text-sm sm:text-base block flex items-center gap-1.5">
                              <Store className="text-neutral-500" size={16} />
                              {s.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-md font-bold">
                                🏬 本統特約配合材料行
                              </span>
                              {s.showInMaterialsDatabase !== false ? (
                                <span className="inline-flex items-center gap-1 text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-250/20 px-2 py-0.5 rounded-md font-bold">
                                  🟢 大庫特約連動中
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] text-neutral-500 bg-neutral-100 border border-neutral-200/50 px-2 py-0.5 rounded-md font-bold" title="已剔除在大庫匹配名單，僅保留名片與基本資訊">
                                  🔒 僅在通訊錄備用
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 bg-white">
                            <button
                              onClick={() => handleStartEdit(s)}
                              className="p-1 px-1.5 text-neutral-400 hover:text-amber-600 hover:bg-neutral-100 rounded transition cursor-pointer"
                              title="編輯聯絡卡片"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(s.id)}
                              className="p-1 px-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                              title="從名冊中移出"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-600 pt-1 border-t border-neutral-100">
                          {s.contactPerson && (
                            <div className="flex items-center gap-1.5">
                              <User size={13} className="text-neutral-400 shrink-0" />
                              <span>聯絡負責人：<strong className="text-neutral-800">{s.contactPerson}</strong></span>
                            </div>
                          )}
                          {s.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={13} className="text-neutral-400 shrink-0" />
                              <span>電話：<strong className="text-neutral-800 font-mono">{s.phone}</strong></span>
                            </div>
                          )}
                          {s.taxId && (
                            <div className="col-span-1 sm:col-span-2 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-250/20 px-2 py-0.5 rounded font-mono font-bold">
                                📋 統一編號(統編)：{s.taxId}
                              </span>
                            </div>
                          )}
                          {s.address && (
                            <div className="col-span-1 sm:col-span-2 flex items-start gap-1.5 mt-0.5">
                              <MapPin size={13} className="text-neutral-400 shrink-0 mt-0.5" />
                              <span className="leading-tight">地址：<span className="text-neutral-700 font-sans">{s.address}</span></span>
                            </div>
                          )}
                        </div>

                        {/* Co-op Memo notes */}
                        {s.notes && (
                          <div className="bg-neutral-50 px-3 py-2 border border-neutral-200 rounded-lg text-xs leading-relaxed text-neutral-600">
                            <span className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider mb-0.5">📌 合作折扣及結算備註</span>
                            <p className="italic">{s.notes}</p>
                          </div>
                        )}

                        {/* Co-op Photo card */}
                        {s.photoUrl && (
                          <div className="flex items-center gap-2 mt-2 bg-neutral-50 px-3 py-2 border border-neutral-150 rounded-lg">
                            <div className="relative w-10 h-10 rounded border border-neutral-200 bg-white overflow-hidden shrink-0 shadow-3xs cursor-zoom-in group" onClick={() => setSelectedPhotoForViewer(s.photoUrl || '')}>
                              <img referrerPolicy="no-referrer" src={s.photoUrl} alt="Store Card Thumbnail" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-left">
                              <span className="block text-[10px] uppercase font-black text-neutral-400 tracking-wider">📇 商家名片 / 特約店照</span>
                              <button
                                type="button"
                                onClick={() => setSelectedPhotoForViewer(s.photoUrl || '')}
                                className="text-[10px] text-amber-700 hover:text-amber-900 font-extrabold flex items-center gap-0.5 transition cursor-pointer"
                              >
                                <Camera size={11} />
                                點擊放行大名片 🔍
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Linked Materials section */}
                      <div className="pt-2 border-t border-neutral-100 mt-2 flex justify-between items-center bg-white">
                        <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                          <Layers size={13} className="text-neutral-400" />
                          <span>已綁定大庫特約耗料：<strong className="text-amber-805 text-xs">{referencedMaterials.length}</strong> 項</span>
                        </span>

                        {referencedMaterials.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedStoreId(isExpanded ? null : s.id)}
                            className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200/50 transition cursor-pointer"
                          >
                            {isExpanded ? '▲ 隱藏精細清單' : '▼ 查看綁定品項價格'}
                          </button>
                        )}
                      </div>

                      {isExpanded && referencedMaterials.length > 0 && (
                        <div className="bg-amber-50/15 border border-amber-200 p-2.5 rounded-lg text-xs space-y-1.5 mt-2 animate-fadeIn max-h-[160px] overflow-y-auto">
                          <span className="text-[10px] font-bold block text-neutral-500">🏬 在本材料行有特報價的材料：</span>
                          <div className="divide-y divide-neutral-150">
                            {referencedMaterials.map(m => {
                              const storeConf = m.suppliers?.find(sup => sup.storeName === s.name);
                              return (
                                <div key={m.id} className="py-1 flex justify-between items-center text-[11px]">
                                  <span className="font-semibold text-neutral-800">{m.name} ({m.unit})</span>
                                  <span className="font-mono text-neutral-500 scale-95">
                                    牌: <strong className="text-neutral-900">${storeConf?.listPrice}</strong> / 進: <strong className="text-amber-800 font-bold">${storeConf?.costPrice}</strong>
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
            className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl animate-scaleUp p-1"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header/Control bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-neutral-50">
              <span className="text-xs font-black text-neutral-700 flex items-center gap-1.5">
                <Camera size={14} className="text-amber-600 animate-bounce" />
                特約商家名片 / 照片詳細瀏覽
              </span>
              <button
                type="button"
                onClick={() => setSelectedPhotoForViewer(null)}
                className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-full transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Photo core */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden p-2 flex items-center justify-center max-h-[70vh]">
              <img 
                referrerPolicy="no-referrer" 
                src={selectedPhotoForViewer} 
                alt="Selected business card full size" 
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
              />
            </div>
            
            <div className="px-5 py-3 text-center bg-neutral-50 border-t border-neutral-100">
              <p className="text-[10px] text-neutral-500 font-extrabold">💡 點擊外部黑色背景或右上角【X】即可關閉視窗</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
