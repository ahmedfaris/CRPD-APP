import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserNotification } from '../types';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: UserNotification[];
  unreadCount: number;
  isLoading: boolean;
  activeTicketModalId: string | null;
  setActiveTicketModalId: (ticketId: string | null) => void;
  markAsRead: (id: string | number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string | number) => Promise<void>;
  clearAll: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTicketModalId, setActiveTicketModalId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !currentUser) {
      setNotifications([]);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (currentUser.uid || currentUser.id) {
        params.set('userId', currentUser.uid || currentUser.id);
      }
      if (currentUser.email) {
        params.set('email', currentUser.email);
      }

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.warn('Notice loading notifications:', err);
    }
  }, [currentUser, isAuthenticated]);

  // Initial load and periodic polling
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      setIsLoading(true);
      fetchNotifications().finally(() => setIsLoading(false));

      // Poll periodically every 8 seconds for real-time responsiveness
      const interval = setInterval(() => {
        fetchNotifications();
      }, 8000);

      return () => clearInterval(interval);
    } else {
      setNotifications([]);
    }
  }, [isAuthenticated, currentUser?.uid, currentUser?.email, fetchNotifications]);

  const markAsRead = async (id: string | number) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id.toString() === id.toString() ? { ...n, isRead: true } : n))
    );

    try {
      const params = new URLSearchParams();
      if (currentUser?.uid || currentUser?.id) {
        params.set('userId', currentUser.uid || currentUser.id);
      }
      await fetch(`/api/notifications/${id}/read?${params.toString()}`, {
        method: 'PATCH'
      });
    } catch (err) {
      console.warn('Error marking notification read:', err);
    }
  };

  const markAllAsRead = async () => {
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.uid || currentUser?.id })
      });
    } catch (err) {
      console.warn('Error marking all notifications read:', err);
    }
  };

  const deleteNotification = async (id: string | number) => {
    // Optimistic UI update
    setNotifications((prev) => prev.filter((n) => n.id.toString() !== id.toString()));

    try {
      const params = new URLSearchParams();
      if (currentUser?.uid || currentUser?.id) {
        params.set('userId', currentUser.uid || currentUser.id);
      }
      await fetch(`/api/notifications/${id}?${params.toString()}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('Error deleting notification:', err);
    }
  };

  const clearAll = async () => {
    setNotifications([]);

    try {
      await fetch('/api/notifications/clear-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.uid || currentUser?.id })
      });
    } catch (err) {
      console.warn('Error clearing notifications:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        activeTicketModalId,
        setActiveTicketModalId,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        refreshNotifications: fetchNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
