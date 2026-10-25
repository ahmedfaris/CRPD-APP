import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ElectronicDevice, DeviceMaintenanceItem, DeviceDepartmentHistoryItem, MaintenanceRecord } from '../types';
import { INITIAL_DEVICES } from '../data/mockDevices';

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

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<ElectronicDevice[]>(() => {
    try {
      const saved = localStorage.getItem('crpd_electronic_devices_v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return INITIAL_DEVICES;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);

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

  useEffect(() => {
    fetchDevices();
    fetchMaintenanceRecords();
  }, [fetchDevices, fetchMaintenanceRecords]);

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
    } catch (e: any) {
      console.warn('Backend addDevice failed, applying local fallback:', e.message);
    }

    // Local fallback creation
    let code = deviceData.deviceCode;
    if (!code || code.startsWith('DEV-') || code.includes('XXX')) {
      const t = (deviceData.deviceType || '').toLowerCase();
      let prefix = 'DEV';
      if (t.includes('printer') || t.includes('طابعة')) prefix = 'PR';
      else if (t.includes('computer') || t.includes('pc') || t.includes('laptop') || t.includes('desktop') || t.includes('حاسوب') || t.includes('كمبيوتر')) prefix = 'PC';
      else if (t.includes('scanner') || t.includes('ماسح')) prefix = 'SC';
      else if (t.includes('screen') || t.includes('monitor') || t.includes('شاشة')) prefix = 'MN';
      else if (t.includes('fingerprint') || t.includes('بصمة')) prefix = 'FP';
      else if (t.includes('router') || t.includes('راوتر')) prefix = 'RT';
      else if (t.includes('switch') || t.includes('سويتش')) prefix = 'SW';
      else if (t.includes('access point') || t.includes('نقطة وصول') || t.includes('wifi')) prefix = 'AP';
      else if (t.includes('server') || t.includes('خادم')) prefix = 'SR';
      else if (t.includes('phone') || t.includes('هاتف')) prefix = 'PH';
      else if (deviceData.category === 'network') prefix = 'NW';

      const deptNorm = (deviceData.department || 'Information Technology').toLowerCase();
      const deptDevs = devices.filter(d => (d.department || '').toLowerCase() === deptNorm || (d.departmentAr || '').toLowerCase() === deptNorm);
      let maxSeq = 0;
      const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
      for (const d of deptDevs) {
        const match = d.deviceCode?.trim().match(regex);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
      code = `${prefix}-${String(maxSeq + 1).padStart(3, '0')}`;
    }

    const newDev: ElectronicDevice = enrichDevice({
      id: 'local_' + Date.now(),
      deviceCode: code,
      category: deviceData.category || 'electronic',
      deviceType: deviceData.deviceType || 'Computer',
      brand: deviceData.brand || 'Standard',
      model: deviceData.model || 'Model',
      serialNumber: deviceData.serialNumber || '',
      dateOfPurchase: deviceData.dateOfPurchase || new Date().toISOString().split('T')[0],
      warrantyStartDate: deviceData.warrantyStartDate || deviceData.dateOfPurchase || new Date().toISOString().split('T')[0],
      warrantyPeriod: deviceData.warrantyPeriod || '24 Months',
      department: deviceData.department || 'Information Technology',
      departmentAr: deviceData.departmentAr || '',
      status: deviceData.status || 'Operational',
      ipAddress: deviceData.ipAddress || '',
      macAddress: deviceData.macAddress || '',
      location: deviceData.location || '',
      assignedEmployee: deviceData.assignedEmployee || '',
      departmentHistory: deviceData.departmentHistory || [],
      maintenanceHistory: deviceData.maintenanceHistory || [],
      notes: deviceData.notes || '',
      purchaseReceipt: deviceData.purchaseReceipt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    setDevices(prev => {
      const next = [newDev, ...prev];
      saveToStorage(next);
      return next;
    });

    return { success: true, data: newDev };
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
    } catch (e: any) {
      console.warn('Backend updateDevice failed, applying local fallback:', e.message);
    }

    setDevices(prev => {
      const next = prev.map(d => {
        if (d.id === String(id)) {
          return enrichDevice({ ...d, ...deviceData, updatedAt: new Date().toISOString() });
        }
        return d;
      });
      saveToStorage(next);
      return next;
    });

    return { success: true };
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
          return { success: true };
        }
      }
    } catch (e: any) {
      console.warn('Backend transfer failed, applying local fallback:', e.message);
    }

    // Local fallback
    setDevices(prev => {
      const next = prev.map(d => {
        if (d.id === String(id)) {
          const historyItem: DeviceDepartmentHistoryItem = {
            id: 'dh-' + Date.now(),
            department: d.department,
            departmentAr: d.departmentAr || d.department,
            assignedDate: d.dateOfPurchase,
            transferredDate: new Date().toISOString().split('T')[0],
            transferredBy: 'Current User',
            reason: reason || 'Departmental transfer'
          };
          return {
            ...d,
            department: newDepartment,
            departmentAr: newDepartmentAr || d.departmentAr,
            departmentHistory: [...d.departmentHistory, historyItem],
            updatedAt: new Date().toISOString()
          };
        }
        return d;
      });
      saveToStorage(next);
      return next;
    });

    return { success: true };
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
    } catch (e: any) {
      console.warn('Backend maintenance failed, applying local fallback:', e.message);
    }

    // Local fallback
    setDevices(prev => {
      const next = prev.map(d => {
        if (d.id === String(id)) {
          const newRecord: DeviceMaintenanceItem = {
            ...record,
            id: 'mh-' + Date.now()
          };
          return {
            ...d,
            maintenanceHistory: [...d.maintenanceHistory, newRecord],
            status: record.status === 'In Progress' ? 'Under Maintenance' : d.status,
            updatedAt: new Date().toISOString()
          };
        }
        return d;
      });
      saveToStorage(next);
      return next;
    });

    return { success: true };
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
    } catch (e: any) {
      console.warn('Backend delete failed, applying local fallback:', e.message);
    }

    setDevices(prev => {
      const next = prev.filter(d => d.id !== String(id));
      saveToStorage(next);
      return next;
    });

    return { success: true };
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
        await fetchMaintenanceRecords();
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
        return { success: true };
      }
      return { success: false, error: json.error || 'Failed to delete maintenance record' };
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
