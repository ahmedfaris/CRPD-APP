import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  Ticket, 
  TicketPriority, 
  TicketStatus, 
  TicketCategory, 
  TicketDepartment, 
  TicketComment, 
  TicketAttachment, 
  ApplicationUser,
  TicketType,
  TicketStage,
  PriorityStars,
  AssignedSupportTeam,
  SupportedInformationSystem,
  UserRequestAction,
  SupportTeam,
  SystemSettings,
  DepartmentRequestDoc,
  HardwareDeviceType,
  TeamType
} from '../types';
import { INITIAL_TICKETS, INITIAL_TEAMS, DEFAULT_SYSTEM_SETTINGS } from '../data/mockData';
import { logger } from '../utils/logger';

export function getAssignedTeamForTicketType(_ticketType?: TicketType): { teamName: AssignedSupportTeam; teamId: string; teamType: TeamType } {
  // User requirement: Any ticket submitted by any user is sent to Technical Teams
  return {
    teamName: 'Technical Team',
    teamId: 'tech-team',
    teamType: 'Technical Team',
  };
}

export interface CreateTicketInput {
  title: string;
  description: string;
  ticketType: TicketType;
  priorityStars: PriorityStars;
  priority: TicketPriority;
  teamId?: string;
  hardwareDeviceType?: HardwareDeviceType;
  deptRequest: DepartmentRequestDoc;
  targetSystem?: SupportedInformationSystem | string;
  userRequestAction?: UserRequestAction;
  userRequestDetails?: {
    targetFullName?: string;
    targetUsername?: string;
    targetDepartment?: string;
    roleOrPermissions?: string;
    businessJustification?: string;
  };
  hardwareDetails?: {
    deviceId?: string | number;
    deviceCode?: string;
    assetType?: string;
    deviceType?: HardwareDeviceType;
    serialOrBarcode?: string;
    physicalLocation?: string;
    department?: string;
    brand?: string;
    model?: string;
  };
  stage?: TicketStage;
  category?: TicketCategory;
  department?: TicketDepartment;
  tags?: string[];
  attachments?: TicketAttachment[];
}

interface TicketContextType {
  tickets: Ticket[];
  teams: SupportTeam[];
  systemSettings: SystemSettings;
  isLoadingTickets: boolean;
  refreshTickets: () => Promise<void>;
  createTicket: (data: CreateTicketInput, user: ApplicationUser) => Promise<Ticket>;
  deleteTicket: (ticketId: string, actor: ApplicationUser) => Promise<void>;
  updateTicketStatus: (ticketId: string, newStatus: TicketStatus, actor: ApplicationUser) => Promise<void>;
  updateTicketStage: (ticketId: string, newStage: TicketStage, actor: ApplicationUser) => Promise<void>;
  updateTicketPriority: (ticketId: string, newPriority: TicketPriority, actor: ApplicationUser, newStars?: PriorityStars) => Promise<void>;
  assignTicket: (ticketId: string, assignee: ApplicationUser | null, actor: ApplicationUser) => Promise<void>;
  addComment: (ticketId: string, content: string, isInternalNote: boolean, actor: ApplicationUser) => Promise<void>;
  addAttachment: (ticketId: string, attachment: TicketAttachment, actor: ApplicationUser) => Promise<void>;
  updateSystemSettings: (updates: Partial<SystemSettings>, actor?: ApplicationUser) => void;
  assignUserToTeam: (teamId: string, userId: string) => void;
  removeUserFromTeam: (teamId: string, userId: string) => void;
  createTeam: (data: { name: string; nameAr: string; type?: string; description?: string; descriptionAr?: string; memberUserIds?: string[]; leadUserId?: string }) => Promise<{ success: boolean; data?: SupportTeam; error?: string }>;
  updateTeam: (teamId: string, updates: Partial<SupportTeam>) => Promise<{ success: boolean; data?: SupportTeam; error?: string }>;
  deleteTeam: (teamId: string) => Promise<{ success: boolean; error?: string }>;
  refreshTeams: () => Promise<void>;
  metrics: {
    total: number;
    open: number;
    inProgress: number;
    critical: number;
    pendingCustomer: number;
    resolved: number;
    closed: number;
    slaBreached: number;
    slaComplianceRate: number;
    avgResolutionTimeHours: number;
  };
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);

const TICKETS_STORAGE_KEY = 'pwdsnapp_tickets_v2';
const TEAMS_STORAGE_KEY = 'pwdsnapp_teams_v2';
const SETTINGS_STORAGE_KEY = 'pwdsnapp_settings_v2';

export function getSlaMinutes(priority: TicketPriority, settings?: SystemSettings): { response: number; resolution: number } {
  const criticalHours = settings?.slaCriticalHours ?? 4;
  const mediumHours = settings?.slaMediumHours ?? 24;
  const lowHours = settings?.slaLowHours ?? 48;

  switch (priority) {
    case 'Critical':
    case 'High':
      return { response: 60, resolution: criticalHours * 60 }; // 1h response / criticalHours resolution (3 Stars)
    case 'Medium':
      return { response: 240, resolution: mediumHours * 60 }; // 4h response / mediumHours resolution (2 Stars)
    case 'Low':
    default:
      return { response: 480, resolution: lowHours * 60 }; // 8h response / lowHours resolution (1 Star)
  }
}

const EXAMPLE_TICKET_NOS = new Set(['TCK-2026-1042', 'TCK-2026-1041', 'TCK-2026-1040', 'TCK-2026-1039', 'TCK-2026-1038']);
const isExampleTicket = (t: any) => {
  if (!t) return false;
  if (t.ticketNo && EXAMPLE_TICKET_NOS.has(t.ticketNo)) return true;
  if (t.id && EXAMPLE_TICKET_NOS.has(t.id)) return true;
  return false;
};

// Helper to obtain active auth headers
const getAuthHeaders = (actor?: ApplicationUser): Record<string, string> => {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (actor) {
    headers['x-user-id'] = String(actor.id || (actor as any).uid || '');
    headers['x-user-name'] = encodeURIComponent(actor.fullName || '');
    headers['x-user-email'] = actor.email || '';
    headers['x-user-role'] = actor.role || '';
    headers['x-user-type'] = actor.userType || '';
    headers['x-user-dept'] = encodeURIComponent(actor.department || '');
  }
  return headers;
};

export function TicketProvider({ children }: { children: ReactNode }) {
  const { currentUser, isAuthenticated } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>(() => {
    try {
      const stored = localStorage.getItem(TICKETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter((t: any) => !isExampleTicket(t));
        }
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [teams, setTeams] = useState<SupportTeam[]>(() => {
    try {
      const stored = localStorage.getItem(TEAMS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return INITIAL_TEAMS;
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // fallback
    }
    return DEFAULT_SYSTEM_SETTINGS;
  });

  const [isLoadingTickets, setIsLoadingTickets] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
    } catch {
      // storage error
    }
  }, [tickets]);

  useEffect(() => {
    try {
      localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
    } catch {
      // storage error
    }
  }, [teams]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(systemSettings));
    } catch {
      // storage error
    }
  }, [systemSettings]);

  // Load live tickets, teams, and settings from database backend API
  const fetchBackendData = useCallback(async () => {
    try {
      setIsLoadingTickets(true);
      const headers = getAuthHeaders(currentUser || undefined);

      const [ticketsRes, teamsRes, settingsRes] = await Promise.allSettled([
        fetch('/api/tickets', { headers }),
        fetch('/api/tickets/teams', { headers }),
        fetch('/api/tickets/settings', { headers })
      ]);

      if (ticketsRes.status === 'fulfilled' && ticketsRes.value.ok) {
        const tJson = await ticketsRes.value.json();
        if (tJson.success && Array.isArray(tJson.data)) {
          const cleanTickets = tJson.data.filter((t: any) => !isExampleTicket(t));
          setTickets(cleanTickets);
          try {
            localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(cleanTickets));
          } catch (_) {}
        }
      }

      if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
        const tmJson = await teamsRes.value.json();
        if (tmJson.success && Array.isArray(tmJson.data) && tmJson.data.length > 0) {
          setTeams(tmJson.data);
          try {
            localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(tmJson.data));
          } catch (_) {}
        }
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
        const sJson = await settingsRes.value.json();
        if (sJson.success && sJson.data) {
          setSystemSettings(sJson.data);
          try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sJson.data));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('Backend tickets sync notice:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  }, [currentUser]);

  // Sync on mount, when auth changes, when window focuses, or periodically every 10s for real-time cross-computer sync
  useEffect(() => {
    fetchBackendData();

    const handleSync = () => {
      fetchBackendData();
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('online', handleSync);

    // Cross-computer background synchronization every 5 seconds for real-time visibility
    const pollInterval = setInterval(() => {
      fetchBackendData();
    }, 5000);

    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('online', handleSync);
      clearInterval(pollInterval);
    };
  }, [fetchBackendData, isAuthenticated, currentUser?.id]);

  const refreshTickets = useCallback(async () => {
    await fetchBackendData();
  }, [fetchBackendData]);

  // Periodic SLA check every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      setTickets((prev) =>
        prev.map((t) => {
          if (t.status === 'Resolved' || t.status === 'Closed') return t;
          const respDueMs = new Date(t.responseDueAt).getTime();
          const resolDueMs = new Date(t.resolutionDueAt).getTime();
          const respBreached = !t.respondedAt && nowMs > respDueMs;
          const resolBreached = nowMs > resolDueMs;

          if (respBreached !== t.isResponseBreached || resolBreached !== t.isResolutionBreached) {
            return {
              ...t,
              isResponseBreached: respBreached,
              isResolutionBreached: resolBreached,
            };
          }
          return t;
        })
      );
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const createTicket = async (
    data: CreateTicketInput,
    user: ApplicationUser
  ): Promise<Ticket> => {
    // User requirement: Any ticket submitted by any user is sent to Technical Teams
    const teamRes = getAssignedTeamForTicketType(data.ticketType);
    const assignedTeam = teamRes.teamName;
    const teamId = data.teamId || teamRes.teamId;
    const sla = getSlaMinutes(data.priority, systemSettings);
    const now = new Date();
    const responseDueAt = new Date(now.getTime() + sla.response * 60000).toISOString();
    const resolutionDueAt = new Date(now.getTime() + sla.resolution * 60000).toISOString();

    const category: TicketCategory = data.category || (
      data.ticketType === 'Hardware Maintenance' 
        ? 'Hardware & Devices' 
        : data.ticketType === 'User Request' 
          ? 'Access & Identity' 
          : 'Software & Applications'
    );
    
    // Each operator user generates a ticket that belongs to their department
    const userDept = (user.department && user.department !== 'Unassigned') ? user.department : null;
    const department: TicketDepartment = (userDept || data.department || (
      data.ticketType === 'Hardware Maintenance'
        ? 'Workplace Tech'
        : data.ticketType === 'User Request'
          ? 'Cybersecurity (SOC)'
          : 'IT Service Desk'
    )) as TicketDepartment;

    const initialStage: TicketStage = data.stage || 'New';

    let savedTicket: Ticket;
    try {
      const headers = getAuthHeaders(user);
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...data,
          assignedTeam,
          teamId,
          category,
          department,
          stage: initialStage,
          priorityStars: data.priorityStars,
          actor: user,
        }),
      });

      const resJson = await res.json();
      if (!resJson.success || !resJson.data) {
        throw new Error(resJson.error || 'Failed to save ticket to database');
      }
      savedTicket = resJson.data;
    } catch (networkErr: any) {
      console.error('Backend create ticket network/persistence notice:', networkErr);
      throw new Error(networkErr?.message || 'Failed to persist ticket to database');
    }

    setTickets((prev) => [savedTicket, ...prev.filter((t) => t.id !== savedTicket.id && t.ticketNo !== savedTicket.ticketNo)]);

    logger.logRequest('POST', '/api/tickets', 201, 21.3, {
      TicketId: savedTicket.ticketNo || savedTicket.id,
      TicketType: data.ticketType,
      PriorityStars: data.priorityStars,
      AssignedTeam: assignedTeam,
      TeamId: teamId,
      Requester: user.email,
    });

    return savedTicket;
  };

  const deleteTicket = async (ticketId: string, actor: ApplicationUser) => {
    // Only System Admins can delete tickets
    if (actor.userType !== 'System Admin' && actor.role !== 'Admin') {
      throw new Error('Only System Admins have permission to delete tickets.');
    }

    setTickets((prev) => prev.filter((t) => t.id !== ticketId && t.ticketNo !== ticketId));

    try {
      const headers = getAuthHeaders(actor);
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
        headers,
      });
    } catch (err) {
      console.warn('Database sync for deleteTicket notice:', err);
    }

    logger.log('Warning', 'Ticket {TicketId} was permanently deleted by System Admin {Admin}', {
      TicketId: ticketId,
      Admin: actor.email,
    });
  };

  const updateSystemSettings = (updates: Partial<SystemSettings>, actor?: ApplicationUser) => {
    setSystemSettings((prev) => {
      const next = { ...prev, ...updates };
      if (updates.maxAttachmentSizeMB !== undefined) {
        next.maxAttachmentSizeBytes = updates.maxAttachmentSizeMB * 1024 * 1024;
      }
      return next;
    });

    fetch('/api/tickets/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch((err) => console.warn('Database sync for settings notice:', err));

    if (actor) {
      logger.log('Information', 'System Settings updated by {Actor}', {
        Actor: actor.email,
        Updates: updates,
      });
    }
  };

  const assignUserToTeam = (teamId: string, userId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          if (t.memberUserIds.includes(userId)) return t;
          return { ...t, memberUserIds: [...t.memberUserIds, userId] };
        }
        return t;
      })
    );

    fetch(`/api/tickets/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch((err) => console.warn('Database sync for assignUserToTeam notice:', err));
  };

  const removeUserFromTeam = (teamId: string, userId: string) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          return { ...t, memberUserIds: t.memberUserIds.filter((id) => id !== userId) };
        }
        return t;
      })
    );

    fetch(`/api/tickets/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('Database sync for removeUserFromTeam notice:', err));
  };

  const refreshTeams = async () => {
    try {
      const res = await fetch('/api/tickets/teams');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTeams(json.data);
          try {
            localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(json.data));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('Failed to refresh teams:', err);
    }
  };

  const createTeam = async (data: {
    name: string;
    nameAr: string;
    type?: string;
    description?: string;
    descriptionAr?: string;
    memberUserIds?: string[];
    leadUserId?: string;
  }): Promise<{ success: boolean; data?: SupportTeam; error?: string }> => {
    try {
      const res = await fetch('/api/tickets/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (res.ok && result.success && result.data) {
        const newTeam = result.data;
        setTeams((prev) => {
          const updated = [...prev, newTeam];
          try {
            localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });
        return { success: true, data: newTeam };
      }
      return { success: false, error: result.error || 'Failed to create team' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const updateTeam = async (
    teamId: string,
    updates: Partial<SupportTeam>
  ): Promise<{ success: boolean; data?: SupportTeam; error?: string }> => {
    try {
      const res = await fetch(`/api/tickets/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const result = await res.json();
      if (res.ok && result.success && result.data) {
        const updatedTeam = result.data;
        setTeams((prev) => {
          const updated = prev.map((t) => (t.id === teamId ? updatedTeam : t));
          try {
            localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });
        return { success: true, data: updatedTeam };
      }
      return { success: false, error: result.error || 'Failed to update team' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const deleteTeam = async (teamId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/tickets/teams/${teamId}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setTeams((prev) => {
          const updated = prev.filter((t) => t.id !== teamId);
          try {
            localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to delete team' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const updateTicketStage = async (ticketId: string, newStage: TicketStage, actor: ApplicationUser) => {
    const now = new Date().toISOString();
    let oldStage = 'New';

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId && t.ticketNo !== ticketId) return t;
        oldStage = t.stage;
        
        let newStatus: TicketStatus = t.status;
        if (newStage === 'New') newStatus = 'New';
        else if (newStage === 'Triaged') newStatus = 'Open';
        else if (newStage === 'In Progress') newStatus = 'In Progress';
        else if (newStage === 'Pending Review') newStatus = 'Pending Customer';
        else if (newStage === 'Resolved') newStatus = 'Resolved';
        else if (newStage === 'Closed') newStatus = 'Closed';

        const resolvedAt = newStage === 'Resolved' && !t.resolvedAt ? now : t.resolvedAt;
        const closedAt = newStage === 'Closed' && !t.closedAt ? now : t.closedAt;

        return {
          ...t,
          stage: newStage,
          status: newStatus,
          resolvedAt,
          closedAt,
          updatedAt: now,
          history: [
            ...t.history,
            {
              id: 'hist_' + Date.now(),
              ticketId: t.id,
              timestamp: now,
              actorName: actor.fullName,
              actorRole: actor.role,
              actorUserType: actor.userType,
              action: `Transitioned stage from "${oldStage}" to "${newStage}"`,
            },
          ],
        };
      })
    );

    logger.log('Information', 'Ticket {TicketId} stage updated from {OldStage} to {NewStage} by {Actor}', {
      TicketId: ticketId,
      NewStage: newStage,
      Actor: actor.email,
    });

    try {
      const headers = getAuthHeaders(actor);
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ stage: newStage, actor }),
      });
    } catch (err) {
      console.warn('Database sync for updateTicketStage notice:', err);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: TicketStatus, actor: ApplicationUser) => {
    const now = new Date().toISOString();
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId && t.ticketNo !== ticketId) return t;
        const oldStatus = t.status;
        const resolvedAt = newStatus === 'Resolved' && !t.resolvedAt ? now : t.resolvedAt;
        const closedAt = newStatus === 'Closed' && !t.closedAt ? now : t.closedAt;

        return {
          ...t,
          status: newStatus,
          resolvedAt,
          closedAt,
          updatedAt: now,
          history: [
            ...t.history,
            {
              id: 'hist_' + Date.now(),
              ticketId: t.id,
              timestamp: now,
              actorName: actor.fullName,
              actorRole: actor.role,
              actorUserType: actor.userType,
              action: `Changed status from "${oldStatus}" to "${newStatus}"`,
            },
          ],
        };
      })
    );

    logger.log('Information', 'Ticket {TicketId} status changed from {OldStatus} to {NewStatus} by {Actor}', {
      TicketId: ticketId,
      NewStatus: newStatus,
      Actor: actor.email,
    });

    try {
      const headers = getAuthHeaders(actor);
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus, actor }),
      });
    } catch (err) {
      console.warn('Database sync for updateTicketStatus notice:', err);
    }
  };

  const updateTicketPriority = async (
    ticketId: string, 
    newPriority: TicketPriority, 
    actor: ApplicationUser,
    newStars?: PriorityStars
  ) => {
    const now = new Date();
    const sla = getSlaMinutes(newPriority);
    const responseDueAt = new Date(now.getTime() + sla.response * 60000).toISOString();
    const resolutionDueAt = new Date(now.getTime() + sla.resolution * 60000).toISOString();
    const starsToSet = newStars !== undefined ? newStars : (newPriority === 'Critical' || newPriority === 'High' ? 3 : newPriority === 'Medium' ? 2 : 1);

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId && t.ticketNo !== ticketId) return t;
        const oldPriority = t.priority;
        return {
          ...t,
          priority: newPriority,
          priorityStars: starsToSet,
          responseSlaMinutes: sla.response,
          resolutionSlaMinutes: sla.resolution,
          responseDueAt,
          resolutionDueAt,
          updatedAt: now.toISOString(),
          history: [
            ...t.history,
            {
              id: 'hist_' + Date.now(),
              ticketId: t.id,
              timestamp: now.toISOString(),
              actorName: actor.fullName,
              actorRole: actor.role,
              actorUserType: actor.userType,
              action: `Modified priority from "${oldPriority}" to "${newPriority}" (★${starsToSet} Stars)`,
            },
          ],
        };
      })
    );

    logger.log('Warning', 'Ticket {TicketId} priority modified to {NewPriority} by {Actor}', {
      TicketId: ticketId,
      NewPriority: newPriority,
      Actor: actor.email,
    });

    try {
      const headers = getAuthHeaders(actor);
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ priority: newPriority, priorityStars: starsToSet, actor }),
      });
    } catch (err) {
      console.warn('Database sync for updateTicketPriority notice:', err);
    }
  };

  const assignTicket = async (ticketId: string, assignee: ApplicationUser | null, actor: ApplicationUser) => {
    const now = new Date().toISOString();
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId && t.ticketNo !== ticketId) return t;
        const newStatus = t.status === 'New' && assignee ? 'In Progress' : t.status;
        return {
          ...t,
          assigneeId: assignee ? assignee.id : null,
          assigneeName: assignee ? assignee.fullName : null,
          assigneeRole: assignee ? assignee.role : undefined,
          status: newStatus,
          updatedAt: now,
          history: [
            ...t.history,
            {
              id: 'hist_' + Date.now(),
              ticketId: t.id,
              timestamp: now,
              actorName: actor.fullName,
              actorRole: actor.role,
              actorUserType: actor.userType,
              action: assignee
                ? `Assigned ticket to ${assignee.fullName} (${assignee.role})`
                : 'Unassigned ticket',
            },
          ],
        };
      })
    );

    logger.log('Information', 'Ticket {TicketId} assignment updated to {Assignee}', {
      TicketId: ticketId,
      Assignee: assignee ? assignee.email : 'Unassigned',
      Actor: actor.email,
    });

    try {
      const headers = getAuthHeaders(actor);
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          assigneeId: assignee ? assignee.id : null,
          assigneeName: assignee ? assignee.fullName : null,
          assigneeRole: assignee ? assignee.role : null,
          actor,
        }),
      });
    } catch (err) {
      console.warn('Database sync for assignTicket notice:', err);
    }
  };

  const addComment = async (ticketId: string, content: string, isInternalNote: boolean, actor: ApplicationUser) => {
    const now = new Date().toISOString();
    const comment: TicketComment = {
      id: 'comm_' + Date.now(),
      ticketId,
      authorId: actor.id,
      authorName: actor.fullName,
      authorRole: actor.role,
      authorUserType: actor.userType || (actor.role === 'Admin' ? 'System Admin' : 'Operational User'),
      authorEmail: actor.email,
      content,
      isInternalNote,
      createdAt: now,
    };

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId && t.ticketNo !== ticketId) return t;
        const respondedAt =
          !t.respondedAt && !isInternalNote && (actor.role === 'Agent' || actor.role === 'Admin')
            ? now
            : t.respondedAt;

        return {
          ...t,
          respondedAt,
          updatedAt: now,
          comments: [...t.comments, comment],
          history: [
            ...t.history,
            {
              id: 'hist_' + Date.now(),
              ticketId: t.id,
              timestamp: now,
              actorName: actor.fullName,
              actorRole: actor.role,
              actorUserType: actor.userType,
              action: isInternalNote ? 'Added private internal note' : 'Added comment to ticket',
            },
          ],
        };
      })
    );

    logger.log('Information', 'Comment added to ticket {TicketId} (Internal: {IsInternal}) by {Author}', {
      TicketId: ticketId,
      IsInternal: isInternalNote,
      Author: actor.email,
    });

    try {
      const headers = getAuthHeaders(actor);
      await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, isInternalNote, actor }),
      });
    } catch (err) {
      console.warn('Database sync for addComment notice:', err);
    }
  };

  const addAttachment = async (ticketId: string, attachment: TicketAttachment, actor: ApplicationUser) => {
    const now = new Date().toISOString();
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId && t.ticketNo !== ticketId) return t;
        return {
          ...t,
          attachments: [...t.attachments, attachment],
          updatedAt: now,
          history: [
            ...t.history,
            {
              id: 'hist_' + Date.now(),
              ticketId: t.id,
              timestamp: now,
              actorName: actor.fullName,
              actorRole: actor.role,
              action: `Uploaded attachment "${attachment.fileName}" (${attachment.fileSize})`,
            },
          ],
        };
      })
    );

    try {
      const headers = getAuthHeaders(actor);
      await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...attachment, actor }),
      });
    } catch (err) {
      console.warn('Database sync for addAttachment notice:', err);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = tickets.length;
    let open = 0;
    let inProgress = 0;
    let critical = 0;
    let pendingCustomer = 0;
    let resolved = 0;
    let closed = 0;
    let slaBreached = 0;

    let totalResolutionHours = 0;
    let resolvedCount = 0;

    tickets.forEach((t) => {
      if (t.status === 'Open' || t.status === 'New') open++;
      if (t.status === 'In Progress') inProgress++;
      if (t.status === 'Pending Customer') pendingCustomer++;
      if (t.status === 'Resolved') resolved++;
      if (t.status === 'Closed') closed++;
      if (t.priority === 'Critical') critical++;
      if (t.isResponseBreached || t.isResolutionBreached) slaBreached++;

      if (t.resolvedAt) {
        const diffMs = new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
        totalResolutionHours += Math.max(0.1, diffMs / 3600000);
        resolvedCount++;
      }
    });

    const slaComplianceRate = total > 0 ? Math.round(((total - slaBreached) / total) * 100) : 100;
    const avgResolutionTimeHours = resolvedCount > 0 ? +(totalResolutionHours / resolvedCount).toFixed(1) : 4.2;

    return {
      total,
      open,
      inProgress,
      critical,
      pendingCustomer,
      resolved,
      closed,
      slaBreached,
      slaComplianceRate,
      avgResolutionTimeHours,
    };
  }, [tickets]);

  return (
    <TicketContext.Provider
      value={{
        tickets,
        teams,
        systemSettings,
        isLoadingTickets,
        refreshTickets,
        createTicket,
        deleteTicket,
        updateTicketStatus,
        updateTicketStage,
        updateTicketPriority,
        assignTicket,
        addComment,
        addAttachment,
        updateSystemSettings,
        assignUserToTeam,
        removeUserFromTeam,
        createTeam,
        updateTeam,
        deleteTeam,
        refreshTeams,
        metrics,
      }}
    >
      {children}
    </TicketContext.Provider>
  );
}

export function useTickets() {
  const context = useContext(TicketContext);
  if (!context) {
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
}
