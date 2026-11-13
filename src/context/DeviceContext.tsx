import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ElectronicDevice, DeviceMaintenanceItem, DeviceDepartmentHistoryItem, MaintenanceRecord, AssetType } from '../types';
import { useAuth } from './AuthContext';

interface DeviceFilters {
  category?: string;
  type?: string;
  search?: string;
  department?: string;
}

interface DeviceContextType {
  devices: ElectronicDevice[];
  maintenanceRecords: MaintenanceRecord[];
  loading: boolean;
  error: string | null;
  fetchDevices: (filters?: DeviceFilters) => Promise<void>;
  fetchMaintenanceRecords: (params?: { assetId?: number | string; ticketId?: number | string }) => Promise<void>;
  addDevice: (device: Partial<ElectronicDevice>) => Promise<{ success: boolean; data?: ElectronicDevice; error?: string }>;
  updateDevice: (id: string | number, device: Partial<ElectronicDevice>) => Promise<{ success: boolean; data?: ElectronicDevice; error?: string }>;
  transferDepartment: (id: string | number, newDepartment: string, reason?: string, newDepartmentAr?: string) => Promise<{ success: boolean; error?: string }>;
  addMaintenanceRecord: (id: string | number, record: Omit<DeviceMaintenanceItem, 'id'>) => Promise<{ success: boolean; error?: string }>;
  createMaintenanceTableRecord: (data: Partial<MaintenanceRecord>) => Promise<{ success: boolean; data?: any; error?: string }>;
  deleteMaintenanceTableRecord: (id: number) => Promise<{ success: boolean; error?: string }>;
  updateMaintenanceTableRecord: (id: number, data: Partial<MaintenanceRecord>) => Promise<{ success: boolean; data?: any; error?: string }>;
  assetTypes: AssetType[];
  fetchAssetTypes: () => Promise<void>;
  saveAssetType: (data: Partial<AssetType>, id?: number) => Promise<{ success: boolean; data?: AssetType; error?: string }>;
  deleteAssetType: (id: number) => Promise<{ success: boolean; error?: string }>;
  deleteDevice: (id: string | number) => Promise<{ success: boolean; error?: string }>;
  getDeviceFolder: (id: string | number) => Promise<{ success: boolean; data?: any; error?: string }>;
  uploadToDeviceFolder: (id: string | number, fileName: string, fileDataUrl: string) => Promise<{ success: boolean; files?: any[]; error?: string }>;
  getFolderHierarchy: () => Promise<{ success: boolean; tree?: any; rootFolder?: string; error?: string }>;
  syncFolders: () => Promise<{ success: boolean; count?: number; error?: string }>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

// Helper to calculate warranty expiration date and whether it's still active
export function calculateWarranty(startDateStr: string, periodStr: string): { expiryDate: string; isActive: boolean; months: number } {
  try {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) {
      return { expiryDate: startDateStr, isActive: false, months: 12 };
    }

    let months = 12;
    const lower = (periodStr || '').toLowerCase();
    const numMatch = lower.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : 12;

    if (lower.includes('year') || lower.includes('سنة') || lower.includes('سنوات')) {
      months = num * 12;
    } else if (lower.includes('month') || lower.includes('شهر') || lower.includes('شهور')) {
      months = num;
    } else {
      months = num;
    }

    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + months);

    const now = new Date();
    const isActive = expiry.getTime() > now.getTime();

    return {
      expiryDate: expiry.toISOString().split('T')[0],
      isActive,
      months
    };
  } catch {
    return { expiryDate: startDateStr, isActive: false, months: 12 };
  }
}

/** Extract a readable error message from a failed API response. */
async function readApiError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json?.error || json?.message || `Request failed (HTTP ${res.status})`;
  } catch {
    return `Request failed (HTTP ${res.status})`;
  }
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [devices, setDevices] = useState<ElectronicDevice[]>(() => {
    try {
      // Cache of the last list loaded from the server (never sample data).
      const saved = localStorage.getItem('crpd_electronic_devices_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((d: any) => !String(d?.id ?? '').startsWith('local_'));
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);

  const authHeaders = (json = false): Record<string, string> => {
    const token = localStorage.getItem('auth_token');
    return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const fetchAssetTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/asset-types', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) setAssetTypes(json.data);
      }
    } catch (e: any) {
      console.warn('Failed to fetch asset types:', e?.message || e);
    }
  }, []);

  const fetchMaintenanceRecords = useCallback(async (params?: { assetId?: number | string; ticketId?: number | string }) => {
    try {
      const token = localStorage.getItem('auth_token');
      const q = new URLSearchParams();
      if (params?.assetId) q.append('assetId', String(params.assetId));
      if (params?.ticketId) q.append('ticketId', String(params.ticketId));

      const url = `/api/maintenance${q.toString() ? `?${q.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setMaintenanceRecords(json.data);
        }
      }
    } catch (e: any) {
      console.warn('Failed to fetch maintenance records:', e?.message || e);
    }
  }, []);

  const saveToStorage = (updated: ElectronicDevice[]) => {
    try {
      localStorage.setItem('crpd_electronic_devices_v1', JSON.stringify(updated));
    } catch {}
  };

  const enrichDevice = (dev: any): ElectronicDevice => {
    const warrantyInfo = calculateWarranty(dev.warrantyStartDate || dev.dateOfPurchase, dev.warrantyPeriod || '24 Months');
    return {
      ...dev,
      id: String(dev.id),
      warrantyExpiryDate: warrantyInfo.expiryDate,
      isWarrantyActive: warrantyInfo.isActive,
      warrantyPeriodMonths: warrantyInfo.months,
      departmentHistory: Array.isArray(dev.departmentHistory) 
        ? dev.departmentHistory 
        : (typeof dev.departmentHistory === 'string' ? JSON.parse(dev.departmentHistory) : []),
      maintenanceHistory: Array.isArray(dev.maintenanceHistory) 
        ? dev.maintenanceHistory 
        : (typeof dev.maintenanceHistory === 'string' ? JSON.parse(dev.maintenanceHistory) : []),
    };
  };

  const fetchDevices = useCallback(async (filters?: DeviceFilters) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      if (filters?.category && filters.category !== 'ALL') params.append('category', filters.category);
      if (filters?.type && filters.type !== 'ALL') params.append('type', filters.type);
      if (filters?.department && filters.department !== 'ALL') params.append('department', filters.department);
      if (filters?.search) params.append('search', filters.search);

      const url = `/api/devices${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const enriched = json.data.map(enrichDevice);
          setDevices(enriched);
          saveToStorage(enriched);
          setLoading(false);
          return;
        }
      }
    } catch (e: any) {
      console.warn('API fetchDevices offline, fallback to local state:', e.message);
    }

    // Local fallback filter if backend failed
    setDevices(prev => {
      let filtered = [...prev];
      if (filters?.category && filters.category !== 'ALL') {
        filtered = filtered.filter(d => d.category.toLowerCase() === filters.category?.toLowerCase());
      }
      if (filters?.type && filters.type !== 'ALL') {
        filtered = filtered.filter(d => d.deviceType.toLowerCase() === filters.type?.toLowerCase());
      }
      if (filters?.department && filters.department !== 'ALL') {
        filtered = filtered.filter(d => d.department.toLowerCase() === filters.department?.toLowerCase());
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        filtered = filtered.filter(d => 
          d.deviceCode.toLowerCase().includes(q) ||
          d.brand.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q) ||
          (d.serialNumber && d.serialNumber.toLowerCase().includes(q)) ||
          d.department.toLowerCase().includes(q)
        );
      }
      return filtered;
    });
    setLoading(false);
  }, []);

  // Load from the server whenever a user signs in (the first load happens before login and is
  // rejected with 401); clear the list on sign-out so nothing stale is shown.
  useEffect(() => {
    if (!currentUser) {
      setDevices([]);
      setMaintenanceRecords([]);
      setAssetTypes([]);
      try { localStorage.removeItem('crpd_electronic_devices_v1'); } catch {}
      return;
    }
    fetchDevices();
    fetchMaintenanceRecords();
    fetchAssetTypes();
  }, [currentUser?.uid, fetchDevices, fetchMaintenanceRecords, fetchAssetTypes]);

  const addDevice = async (deviceData: Partial<ElectronicDevice>): Promise<{ success: boolean; data?: ElectronicDevice; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(deviceData)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const enriched = enrichDevice(json.data);
          setDevices(prev => {
            const next = [enriched, ...prev.filter(d => d.id !== enriched.id)];
            saveToStorage(next);
            return next;
          });
          return { success: true, data: enriched };
        }
      }
      return { success: false, error: await readApiError(res) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error: could not reach the server.' };
    }
  };

  const updateDevice = async (id: string | number, deviceData: Partial<ElectronicDevice>): Promise<{ success: boolean; data?: ElectronicDevice; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/devices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(deviceData)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const enriched = enrichDevice(json.data);
          setDevices(prev => {
            const next = prev.map(d => d.id === String(id) ? enriched : d);
            saveToStorage(next);
            return next;
          });
          return { success: true, data: enriched };
        }
      }
      return { success: false, error: await readApiError(res) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error: could not reach the server.' };
    }
  };

  const transferDepartment = async (id: string | number, newDepartment: string, reason?: string, newDepartmentAr?: string): Promise<{ success: boolean; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/devices/${id}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ newDepartment, newDepartmentAr, reason })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const enriched = enrichDevice(json.data);
          setDevices(prev => {
            const next = prev.map(d => d.id === String(id) ? enriched : d);
            saveToStorage(next);
            return next;
          });
          await fetchMaintenanceRecords();
          return { success: true };
        }
      }
      return { success: false, error: await readApiError(res) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error: could not reach the server.' };
    }
  };

  const addMaintenanceRecord = async (id: string | number, record: Omit<DeviceMaintenanceItem, 'id'>): Promise<{ success: boolean; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/devices/${id}/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(record)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const enriched = enrichDevice(json.data);
          setDevices(prev => {
            const next = prev.map(d => d.id === String(id) ? enriched : d);
            saveToStorage(next);
            return next;
          });
          return { success: true };
        }
      }
      return { success: false, error: await readApiError(res) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error: could not reach the server.' };
    }
  };

  const deleteDevice = async (id: string | number): Promise<{ success: boolean; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/devices/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (res.ok) {
        setDevices(prev => {
          const next = prev.filter(d => d.id !== String(id));
          saveToStorage(next);
          return next;
        });
        return { success: true };
      }
      return { success: false, error: await readApiError(res) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error: could not reach the server.' };
    }
  };

  const createMaintenanceTableRecord = async (data: Partial<MaintenanceRecord>): Promise<{ success: boolean; data?: any; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        // The device status follows its maintenance (e.g. "Under Maintenance"), so reload both.
        await Promise.all([fetchMaintenanceRecords(), fetchDevices()]);
        return { success: true, data: json.data };
      }
      return { success: false, error: json.error || 'Failed to create maintenance record' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteMaintenanceTableRecord = async (id: number): Promise<{ success: boolean; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/maintenance/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMaintenanceRecords(prev => prev.filter(m => m.id !== id));
        await fetchDevices();
        return { success: true };
      }
      return { success: false, error: json.error || 'Failed to delete maintenance record' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateMaintenanceTableRecord = async (id: number, data: Partial<MaintenanceRecord>): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const res = await fetch(`/api/maintenance/${id}`, { method: 'PUT', headers: authHeaders(true), body: JSON.stringify(data) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        await Promise.all([fetchMaintenanceRecords(), fetchDevices()]);
        return { success: true, data: json.data };
      }
      return { success: false, error: json.error || 'Failed to update maintenance record' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const saveAssetType = async (data: Partial<AssetType>, id?: number): Promise<{ success: boolean; data?: AssetType; error?: string }> => {
    try {
      const res = await fetch(id ? `/api/asset-types/${id}` : '/api/asset-types', {
        method: id ? 'PUT' : 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(data)
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        await fetchAssetTypes();
        return { success: true, data: json.data };
      }
      return { success: false, error: json.error || 'Failed to save asset type' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const deleteAssetType = async (id: number): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/asset-types/${id}`, { method: 'DELETE', headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        await fetchAssetTypes();
        return { success: true };
      }
      return { success: false, error: json.error || 'Failed to delete asset type' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const getDeviceFolder = async (id: string | number): Promise<{ success: boolean; data?: any; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/devices/${id}/folder`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, data: json };
      }
      return { success: false, error: json.error || 'Failed to load device folder' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const uploadToDeviceFolder = async (
    id: string | number,
    fileName: string,
    fileDataUrl: string
  ): Promise<{ success: boolean; files?: any[]; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/devices/${id}/folder/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ fileName, fileDataUrl })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, files: json.files };
      }
      return { success: false, error: json.error || 'Failed to upload file to folder' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const getFolderHierarchy = async (): Promise<{ success: boolean; tree?: any; rootFolder?: string; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/devices/folders/hierarchy', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, tree: json.tree, rootFolder: json.rootFolder };
      }
      return { success: false, error: json.error || 'Failed to fetch folder hierarchy' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const syncFolders = async (): Promise<{ success: boolean; count?: number; error?: string }> => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/devices/sync-folders', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await fetchDevices();
        return { success: true, count: json.count };
      }
      return { success: false, error: json.error || 'Failed to sync device folders' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  return (
    <DeviceContext.Provider value={{
      devices,
      maintenanceRecords,
      loading,
      error,
      fetchDevices,
      fetchMaintenanceRecords,
      addDevice,
      updateDevice,
      transferDepartment,
      addMaintenanceRecord,
      createMaintenanceTableRecord,
      deleteMaintenanceTableRecord,
      updateMaintenanceTableRecord,
      assetTypes,
      fetchAssetTypes,
      saveAssetType,
      deleteAssetType,
      deleteDevice,
      getDeviceFolder,
      uploadToDeviceFolder,
      getFolderHierarchy,
      syncFolders
    }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevices() {
  const context = useContext(DeviceContext);
  if (context === undefined) {
    throw new Error('useDevices must be used within a DeviceProvider');
  }
  return context;
}
