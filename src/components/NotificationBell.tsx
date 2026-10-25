import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Bell, 
  BellRing, 
  CheckCheck, 
  Ticket, 
  MessageSquare, 
  Trash2, 
  Clock, 
  Check, 
  Filter,
  ExternalLink,
  Sparkles,
  Inbox
} from 'lucide-react';
import { UserNotification, NotificationType } from '../types';

interface NotificationBellProps {
  onSelectTicket?: (ticketId: string) => void;
  className?: string;
  variant?: 'dark' | 'light' | 'metro';
}

export function NotificationBell({ onSelectTicket, className = '', variant = 'dark' }: NotificationBellProps) {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAll,
    setActiveTicketModalId
  } = useNotifications();
  const { language, dir } = useLanguage();
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD' | 'NEW_TICKET' | 'NEW_COMMENT'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Format relative time in Arabic and English
  const formatTimeAgo = (dateStr: string) => {
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSecs < 60) {
        return language === 'ar' ? 'الآن' : 'Just now';
      }
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) {
        return language === 'ar' ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
      }
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) {
        return language === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
      }
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) {
        return language === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
      }
      return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch (_) {
      return dateStr;
    }
  };

  // Filter items
  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'UNREAD') return !item.isRead;
    if (activeFilter === 'NEW_TICKET') return item.type === 'NEW_TICKET';
    if (activeFilter === 'NEW_COMMENT') return item.type === 'NEW_COMMENT';
    return true;
  });

  const handleNotificationClick = (item: UserNotification) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }
    setIsOpen(false);
    
    if (item.ticketId) {
      if (onSelectTicket) {
        onSelectTicket(item.ticketId);
      } else {
        setActiveTicketModalId(item.ticketId);
      }
    }
  };

  const getButtonStyles = () => {
    if (variant === 'metro') {
      return 'bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200';
    }
    return 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200';
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef} dir={dir}>
      {/* Notifications Icon Button */}
      <button
        id="btn-notifications-bell"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center justify-center p-2.5 rounded-xl border text-sm font-bold transition shadow-xs hover:scale-105 active:scale-95 cursor-pointer ${getButtonStyles()}`}
        title={language === 'ar' ? 'التنبيهات والإشعارات' : 'Notifications'}
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-4.5 h-4.5 text-amber-400 animate-wiggle" />
        ) : (
          <Bell className="w-4.5 h-4.5 text-slate-400 hover:text-slate-200 transition" />
        )}

        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-black leading-none text-white bg-gradient-to-r from-rose-500 to-red-600 rounded-full shadow-md shadow-red-500/30 animate-pulse border-2 border-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute ${dir === 'rtl' ? 'left-0 sm:left-auto sm:-right-4' : 'right-0 sm:right-auto sm:-left-4'} mt-2 w-[90vw] sm:w-[420px] max-w-md rounded-2xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                <Bell className="w-4 h-4" />
              </div>
              <div className="mx-2">
                <h3 className="font-extrabold text-sm sm:text-base flex items-center space-x-2">
                  <span>{language === 'ar' ? 'التنبيهات' : 'Notifications'}</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 mx-1">
                      {unreadCount} {language === 'ar' ? 'جديد' : 'new'}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {language === 'ar' ? 'بلاغات جديدة وتعليقات مخصصة لك' : 'New tickets & comments for your user'}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center space-x-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer hover:text-white"
                  title={language === 'ar' ? 'تحديد كل التنبيهات كمقروءة' : 'Mark all as read'}
                >
                  <CheckCheck className="w-3.5 h-3.5 text-blue-400 mx-0.5" />
                  <span className="hidden sm:inline">{language === 'ar' ? 'قراءة الكل' : 'Mark all read'}</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  title={language === 'ar' ? 'مسح كل التنبيهات' : 'Clear all'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-1.5 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750'
              }`}
            >
              {language === 'ar' ? 'الكل' : 'All'} ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter('UNREAD')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                activeFilter === 'UNREAD'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750'
              }`}
            >
              {language === 'ar' ? 'غير مقروءة' : 'Unread'} ({unreadCount})
            </button>
            <button
              onClick={() => setActiveFilter('NEW_TICKET')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap flex items-center space-x-1 cursor-pointer ${
                activeFilter === 'NEW_TICKET'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750'
              }`}
            >
              <Ticket className="w-3 h-3 text-cyan-500 mx-0.5" />
              <span>{language === 'ar' ? 'بلاغات جديدة' : 'New Tickets'}</span>
            </button>
            <button
              onClick={() => setActiveFilter('NEW_COMMENT')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap flex items-center space-x-1 cursor-pointer ${
                activeFilter === 'NEW_COMMENT'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750'
              }`}
            >
              <MessageSquare className="w-3 h-3 text-purple-500 mx-0.5" />
              <span>{language === 'ar' ? 'تعليقات' : 'Comments'}</span>
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-[55vh]">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center text-slate-400 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <Inbox className="w-7 h-7" />
                </div>
                <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                  {language === 'ar' ? 'لا توجد تنبيهات حالياً' : 'No notifications right now'}
                </p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {language === 'ar' 
                    ? 'ستظهر هنا التنبيهات فور تنزيل بلاغ جديد أو إضافة تعليق على بلاغاتك.'
                    : 'Notifications for new tickets and comments on your tickets will appear here.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isNewTicket = item.type === 'NEW_TICKET';
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 transition group cursor-pointer flex items-start space-x-3 ${
                      !item.isRead
                        ? 'bg-blue-50/70 dark:bg-blue-950/25 hover:bg-blue-100/60 dark:hover:bg-blue-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Type Icon Badge */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isNewTicket
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                      }`}
                    >
                      {isNewTicket ? (
                        <Ticket className="w-4.5 h-4.5" />
                      ) : (
                        <MessageSquare className="w-4.5 h-4.5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 mx-2">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span
                            className={`text-xs font-bold leading-tight ${
                              !item.isRead
                                ? 'text-slate-900 dark:text-white font-extrabold'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {language === 'ar' ? item.titleAr : item.titleEn}
                          </span>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse inline-block mx-1" />
                          )}
                        </div>

                        {/* Relative Time */}
                        <span className="text-[11px] text-slate-400 shrink-0 flex items-center space-x-1 font-mono">
                          <Clock className="w-3 h-3 inline mx-0.5" />
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      {/* Message Body */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {language === 'ar' ? item.messageAr : item.messageEn}
                      </p>

                      {/* Footer Metadata */}
                      {item.ticketId && (
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-mono font-bold border border-slate-300 dark:border-slate-700 group-hover:border-blue-400 transition">
                            {item.ticketId}
                            <ExternalLink className="w-2.5 h-2.5 mx-1" />
                          </span>

                          <span className="text-[10px] text-slate-400 font-medium opacity-0 group-hover:opacity-100 transition">
                            {language === 'ar' ? 'انقر للعرض والتفاصيل' : 'Click to view'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick Row Actions */}
                    <div className="flex flex-col items-center space-y-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      {!item.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(item.id);
                          }}
                          className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-emerald-500 transition cursor-pointer"
                          title={language === 'ar' ? 'تحديد كمقروء' : 'Mark read'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                        title={language === 'ar' ? 'حذف التنبيه' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-center text-[11px] text-slate-500 flex items-center justify-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 mx-1" />
            <span>
              {language === 'ar' 
                ? 'تنبيهات فورية لجميع البلاغات والتعليقات الخاصة بكل مستخدم' 
                : 'Instant alerts for all user tickets & comments'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
