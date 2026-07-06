import React, { useState } from 'react';
import { Project, Customer } from '../types';
import { 
  Calendar, Clock, Plus, Search, Trash2, Edit, CheckCircle2, 
  MapPin, Phone, Building2, User, AlertTriangle, ArrowUpDown, ChevronRight, Ban
} from 'lucide-react';

interface BookingsPanelProps {
  projects: Project[];
  setProjects: any;
  customers: Customer[];
  onSaveToast: (msg: string) => void;
  onConvertBookingToRecord: (booking: Project) => void;
  onEditBooking: (booking: Project) => void;
  onAddBooking: () => void;
}

export default function BookingsPanel({
  projects,
  setProjects,
  customers,
  onSaveToast,
  onConvertBookingToRecord,
  onEditBooking,
  onAddBooking
}: BookingsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'bookingDate'>('bookingDate');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter active bookings
  const activeBookings = projects.filter(p => 
    p.isBooking && 
    p.bookingStatus !== 'converted' && 
    p.bookingStatus !== 'lost'
  );

  // Apply search query
  const searchedBookings = activeBookings.filter(b => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    return (
      (b.companyOrOwner && b.companyOrOwner.toLowerCase().includes(q)) ||
      (b.contactPerson && b.contactPerson.toLowerCase().includes(q)) ||
      (b.contactPhone && b.contactPhone.toLowerCase().includes(q)) ||
      (b.fullAddress && b.fullAddress.toLowerCase().includes(q)) ||
      (b.addressAbbreviated && b.addressAbbreviated.toLowerCase().includes(q)) ||
      (b.bookingWorkContent && b.bookingWorkContent.toLowerCase().includes(q)) ||
      (b.generatedName && b.generatedName.toLowerCase().includes(q))
    );
  });

  // Sort bookings
  const sortedBookings = [...searchedBookings].sort((a, b) => {
    if (sortBy === 'bookingDate') {
      // Items with a booking date go first, ordered by date ascending. Items without date go last.
      if (a.bookingDate && !b.bookingDate) return -1;
      if (!a.bookingDate && b.bookingDate) return 1;
      if (a.bookingDate && b.bookingDate) {
        const dateCompare = a.bookingDate.localeCompare(b.bookingDate);
        if (dateCompare !== 0) return dateCompare;
        // Same date, compare time
        const timeA = a.bookingTime || '23:59';
        const timeB = b.bookingTime || '23:59';
        return timeA.localeCompare(timeB);
      }
    }
    // Default or fallback: Creation Date descending (newest first)
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  // Group into scheduled vs unscheduled
  const scheduledBookings = sortedBookings.filter(b => b.bookingDate);
  const unscheduledBookings = sortedBookings.filter(b => !b.bookingDate);

  // Handle conversion to unaccomplished project (未成案)
  const handleConvertToLost = (bookingId: string, company: string) => {
    const confirmMove = window.confirm(
      `❓ 您確定要將預約客戶【${company}】轉換為工程案場總覽中的「未成案場」嗎？\n此操作會將該預約移出預約排程，並在「案場總覽 > 未成案場」中供日後追蹤存檔。`
    );
    if (!confirmMove) return;

    setProjects((prev: Project[]) => prev.map(p => {
      if (p.id === bookingId) {
        return {
          ...p,
          isBooking: false,
          bookingStatus: 'lost' as const,
          isEstimation: true,
          estimationStatus: '報價未成' as const
        };
      }
      return p;
    }));

    onSaveToast(`🚫 已將【${company}】之預約項目取消，並移轉至「未成案場」存檔。`);
  };

  // Handle deletion
  const handleDeleteBooking = (bookingId: string, company: string) => {
    setProjects((prev: Project[]) => prev.filter(p => p.id !== bookingId));
    setDeleteConfirmId(null);
    onSaveToast(`🗑️ 已永久刪除【${company}】之預約排程。`);
  };

  // Format date helper
  const formatDateChinese = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[0]}年${parts[1]}月${parts[2]}日`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-6">
      {/* Top action block */}
      <div className="bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-[#F3E5AB] flex items-center gap-2">
            <Calendar className="text-[#D4AF37] stroke-[2.5]" size={20} />
            預約工作排程 & 待辦池
          </h2>
          <p className="text-xs text-neutral-400 font-sans leading-relaxed">
            在此登記「預定派工」或「待敲定時間」的客戶。登錄工務日誌（開始施工）時系統將自動轉成施工案場，等候太久亦可轉為未成案。
          </p>
        </div>
        <button
          onClick={onAddBooking}
          className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#bfa032] text-black font-extrabold text-xs rounded-xl transition-all border border-[#D4AF37] shadow-md flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus size={14} className="stroke-[3]" />
          新增預約與工作待辦
        </button>
      </div>

      {/* Searching & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#161616] border border-[#2D2D2D] p-3.5 rounded-xl">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-3 text-neutral-400" />
          <input
            type="text"
            placeholder="搜尋預約之公司、業主、聯絡電話、施作工作內容、識別名稱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-800 rounded-lg !bg-[#121212] !text-[#E0E0E0] text-xs sm:text-sm focus:border-[#D4AF37] outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-neutral-400 font-sans flex items-center gap-1">
            <ArrowUpDown size={12} /> 排序依據:
          </span>
          <div className="flex p-0.5 !bg-[#121212] border border-neutral-800 rounded-lg">
            <button
              onClick={() => setSortBy('bookingDate')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${sortBy === 'bookingDate' ? 'bg-[#D4AF37] text-black font-extrabold' : 'text-neutral-400 hover:text-white'}`}
            >
              📅 預約日期
            </button>
            <button
              onClick={() => setSortBy('createdAt')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${sortBy === 'createdAt' ? 'bg-[#D4AF37] text-black font-extrabold' : 'text-neutral-400 hover:text-white'}`}
            >
              🆕 建立時間
            </button>
          </div>
        </div>
      </div>

      {/* Bookings Counter Indicator Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl border border-neutral-800 bg-[#161616] flex items-center justify-between">
          <div className="space-y-1">
            <span className="block text-[10px] uppercase font-bold text-neutral-400 font-mono">預約池總計</span>
            <span className="block text-xl font-extrabold text-[#F3E5AB] font-sans">{activeBookings.length} 組</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Calendar size={18} />
          </div>
        </div>
        <div className="p-4 rounded-xl border border-neutral-800 bg-[#161616] flex items-center justify-between">
          <div className="space-y-1">
            <span className="block text-[10px] uppercase font-bold text-emerald-400 font-mono">已預排時程</span>
            <span className="block text-xl font-extrabold text-emerald-400 font-sans">{scheduledBookings.length} 組</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Clock size={18} />
          </div>
        </div>
        <div className="p-4 rounded-xl border border-neutral-800 bg-[#161616] flex items-center justify-between">
          <div className="space-y-1">
            <span className="block text-[10px] uppercase font-bold text-neutral-400 font-mono">待排定時間</span>
            <span className="block text-xl font-extrabold text-amber-400 font-sans">{unscheduledBookings.length} 組</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <AlertTriangle size={18} />
          </div>
        </div>
      </div>

      {activeBookings.length === 0 ? (
        <div className="p-12 text-center border border-neutral-800/80 rounded-2xl !bg-[#161616] space-y-2">
          <Calendar size={40} className="mx-auto text-neutral-600 stroke-[1.5]" />
          <h3 className="text-sm font-bold text-[#F3E5AB]">目前暫無任何預約工作</h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto font-sans leading-relaxed">
            您可以點選右上方「新增預約與工作待辦」按鈕，為可能成交或有口頭預約之客戶登記工作，便於統籌調遣，等開始施作時直接登入工務日誌，一鍵將其轉為正規施工專案！
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION 1: SCHEDULED BOOKINGS */}
          {scheduledBookings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 font-mono">
                  📅 已排定預約施作時程 ({scheduledBookings.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduledBookings.map(b => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onConvert={onConvertBookingToRecord}
                    onEdit={onEditBooking}
                    onLost={handleConvertToLost}
                    onDeleteReq={(id) => setDeleteConfirmId(id)}
                    formatDateChinese={formatDateChinese}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: UNSCHEDULED BOOKINGS */}
          {unscheduledBookings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 font-mono">
                  ❓ 待排定時間項目 / 工作待辦池 ({unscheduledBookings.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unscheduledBookings.map(b => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onConvert={onConvertBookingToRecord}
                    onEdit={onEditBooking}
                    onLost={handleConvertToLost}
                    onDeleteReq={(id) => setDeleteConfirmId(id)}
                    formatDateChinese={formatDateChinese}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal Popover */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-red-500/30 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="mx-auto h-12 w-12 bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center rounded-full">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-neutral-100">確定要永久刪除此預約？</h3>
              <p className="text-xs text-neutral-400 font-sans mt-1.5 leading-relaxed">
                此操作將會從系統中永久移除本筆預約排程，無法撤銷或恢復。若客戶僅是取消或等太久未施作，建議點選「移入未成案場」存檔。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="py-2 text-xs font-semibold rounded-lg bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 transition cursor-pointer"
              >
                取消返回
              </button>
              <button
                onClick={() => {
                  const target = activeBookings.find(b => b.id === deleteConfirmId);
                  if (target) handleDeleteBooking(deleteConfirmId, target.companyOrOwner);
                }}
                className="py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white transition cursor-pointer"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SUB-COMPONENT: BOOKING CARD
interface BookingCardProps {
  key?: React.Key | string;
  booking: Project;
  onConvert: (b: Project) => void;
  onEdit: (b: Project) => void;
  onLost: (id: string, name: string) => void;
  onDeleteReq: (id: string) => void;
  formatDateChinese: (d?: string) => string;
}

function BookingCard({
  booking,
  onConvert,
  onEdit,
  onLost,
  onDeleteReq,
  formatDateChinese
}: BookingCardProps) {
  return (
    <div className="bg-[#161616] border border-neutral-800/80 rounded-xl p-4 flex flex-col justify-between hover:border-[#D4AF37]/30 transition duration-200 group relative shadow-xs">
      
      {/* Top section: booking time pill & badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {booking.bookingDate ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
            <Calendar size={12} />
            <span>{formatDateChinese(booking.bookingDate)}</span>
            {booking.bookingTime && (
              <>
                <span className="text-emerald-700">|</span>
                <Clock size={11} className="mt-0.5" />
                <span>{booking.bookingTime}</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-sans text-xs font-bold">
            <Clock size={12} />
            <span>待排定時間</span>
          </div>
        )}

        <span className="text-[10px] text-neutral-500 font-sans">
          建立: {booking.createdAt ? booking.createdAt.substring(0, 10) : ''}
        </span>
      </div>

      {/* Main info */}
      <div className="space-y-2.5">
        <div>
          <h4 className="text-xs sm:text-sm font-extrabold text-[#F3E5AB] leading-snug line-clamp-1 flex items-center gap-1" title={booking.companyOrOwner}>
            <Building2 size={13} className="text-[#D4AF37] shrink-0" />
            {booking.companyOrOwner}
          </h4>
          
          {/* Identifier Name */}
          <p className="text-[10px] font-mono text-neutral-500 break-all select-all mt-1 bg-neutral-950/40 p-1 rounded border border-neutral-900 leading-normal" title="標準案場識別名">
            🏢 {booking.generatedName}
          </p>
        </div>

        {/* Contact list */}
        <div className="grid grid-cols-2 gap-2 text-[11px] font-sans text-neutral-300">
          <div className="flex items-center gap-1 min-w-0" title={booking.contactPerson || '尚無聯絡人'}>
            <User size={11} className="text-neutral-500 shrink-0" />
            <span className="truncate">聯絡: {booking.contactPerson || '本人'}</span>
          </div>
          <div className="flex items-center gap-1 min-w-0" title={booking.contactPhone || '尚無聯絡電話'}>
            <Phone size={11} className="text-neutral-500 shrink-0" />
            <span className="truncate font-mono">{booking.contactPhone || '無電話'}</span>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-1 text-[11px] font-sans text-neutral-300 pl-0.5">
          <MapPin size={12} className="text-neutral-500 shrink-0 mt-0.5" />
          <span className="line-clamp-1 leading-normal" title={booking.fullAddress}>
            {booking.addressAbbreviated ? `[${booking.addressAbbreviated}] ` : ''}
            {booking.fullAddress}
          </span>
        </div>

        {/* Work content specific to this appointment */}
        <div className="mt-2.5 p-2.5 rounded-lg border border-[#D4AF37]/15 bg-[#1B1A15] text-[#E0E0E0] text-[11px] leading-relaxed">
          <div className="font-bold text-[#D4AF37] mb-1 flex items-center gap-1">
            <span>🛠️ 預約工作內容:</span>
          </div>
          <p className="whitespace-pre-wrap line-clamp-3" title={booking.bookingWorkContent}>
            {booking.bookingWorkContent || '尚未輸入預約施作內容'}
          </p>
        </div>

        {/* Address Notes (if any) */}
        {booking.projectNotes && (
          <p className="text-[10px] text-neutral-500 italic pl-1 flex items-start gap-1">
            <span className="text-[#D4AF37] shrink-0 font-bold font-sans">⚠️ 備註:</span>
            <span className="truncate" title={booking.projectNotes}>{booking.projectNotes}</span>
          </p>
        )}
      </div>

      {/* Button controls */}
      <div className="mt-4 pt-3 border-t border-neutral-900 flex items-center justify-between gap-1">
        <button
          onClick={() => onConvert(booking)}
          className="flex-1 py-1.5 px-2 bg-[#D4AF37] hover:bg-[#bfa032] text-black font-extrabold text-[10px] sm:text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
          title="登錄此預約之工務日誌，將直接轉化本項目為常規施工專案"
        >
          <CheckCircle2 size={12} />
          <span>登錄工務日誌</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(booking)}
            className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-[#D4AF37] rounded-lg border border-neutral-800 transition cursor-pointer"
            title="修改預約內容"
          >
            <Edit size={12} />
          </button>
          
          <button
            onClick={() => onLost(booking.id, booking.companyOrOwner)}
            className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-amber-500 rounded-lg border border-neutral-800 transition cursor-pointer"
            title="移入未成案場 (取消預約)"
          >
            <Ban size={12} />
          </button>

          <button
            onClick={() => onDeleteReq(booking.id)}
            className="p-1.5 bg-neutral-900 hover:bg-red-950/40 text-neutral-500 hover:text-red-400 rounded-lg border border-neutral-800 hover:border-red-900/30 transition cursor-pointer"
            title="永久刪除預約"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

    </div>
  );
}
