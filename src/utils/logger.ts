import { SerilogLogEntry } from '../types';
import { maskPii } from './security';

const LOG_STORAGE_KEY = 'pwdsnapp_system_logs';
const MAX_LOGS = 250;

class SerilogManager {
  private listeners: ((logs: SerilogLogEntry[]) => void)[] = [];

  public getLogs(): SerilogLogEntry[] {
    try {
      const data = localStorage.getItem(LOG_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // ignore
    }
    return this.getInitialSeedLogs();
  }

  public log(
    level: 'Information' | 'Warning' | 'Error',
    messageTemplate: string,
    properties: Record<string, unknown> = {}
  ): SerilogLogEntry {
    const threadId = Math.floor(Math.random() * 24) + 1;
    const elapsed = properties.ElapsedMs ?? +(Math.random() * 18 + 4).toFixed(4);

    let renderedMessage = messageTemplate;
    // Simple template variable replacement
    for (const [key, val] of Object.entries(properties)) {
      const safeVal = typeof val === 'string' ? maskPii(val) : String(val);
      renderedMessage = renderedMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), safeVal);
    }

    // Mask any PII in rendered message
    renderedMessage = maskPii(renderedMessage);

    const entry: SerilogLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      level,
      messageTemplate,
      renderedMessage,
      properties: {
        Application: 'CRPD APP',
        MachineName: 'SRV-APP-PROD01',
        EnvironmentName: 'Production',
        ThreadId: threadId,
        ElapsedMs: elapsed as number,
        ...properties,
        UserEmailMasked: properties.UserEmail ? maskPii(String(properties.UserEmail)) : undefined,
      },
    };

    const current = this.getLogs();
    const updated = [entry, ...current].slice(0, MAX_LOGS);
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // storage full fallback
    }

    // Simulate sending to external Serilog Server if configured
    try {
      const settingsStr = localStorage.getItem('pwdsnapp_settings_v2');
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        if (settings.serilogApiUrl && settings.serilogApiKey) {
          // Fire and forget simulated API call
          console.log(`[Serilog External Sync] Sending log to ${settings.serilogApiUrl} using API Key: ${settings.serilogApiKey.substring(0, 3)}***`);
          /* 
          fetch(settings.serilogApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': settings.serilogApiKey
            },
            body: JSON.stringify(entry)
          }).catch(console.error);
          */
        }
      }
    } catch {
      // Ignore external sync errors
    }

    this.listeners.forEach((cb) => cb(updated));
    return entry;
  }

  public information(messageTemplate: string, properties: Record<string, unknown> = {}) {
    return this.log('Information', messageTemplate, properties);
  }

  public warning(messageTemplate: string, properties: Record<string, unknown> = {}) {
    return this.log('Warning', messageTemplate, properties);
  }

  public error(messageTemplate: string, properties: Record<string, unknown> = {}) {
    return this.log('Error', messageTemplate, properties);
  }

  public logRequest(method: string, path: string, statusCode: number, elapsedMs?: number, extra?: Record<string, unknown>) {
    const elapsed = elapsedMs ?? +(Math.random() * 25 + 5).toFixed(4);
    return this.log('Information', 'HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {ElapsedMs:0.0000} ms', {
      RequestMethod: method,
      RequestPath: path,
      StatusCode: statusCode,
      ElapsedMs: elapsed,
      ...extra,
    });
  }

  public subscribe(callback: (logs: SerilogLogEntry[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public clearLogs() {
    localStorage.removeItem(LOG_STORAGE_KEY);
    const initial = this.getInitialSeedLogs();
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(initial));
    this.listeners.forEach((cb) => cb(initial));
  }

  private getInitialSeedLogs(): SerilogLogEntry[] {
    const now = Date.now();
    return [
      {
        id: 'log_seed_1',
        timestamp: new Date(now - 60000 * 45).toISOString(),
        level: 'Information',
        messageTemplate: 'CRPD APP Application host started successfully. Serilog sink configured for Seq at {SeqUrl}',
        renderedMessage: 'CRPD APP Application host started successfully. Serilog sink configured for Seq at http://localhost:5341',
        properties: {
          Application: 'CRPD APP',
          MachineName: 'SRV-APP-PROD01',
          EnvironmentName: 'Production',
          ThreadId: 1,
          SeqUrl: 'http://localhost:5341',
        },
      },
      {
        id: 'log_seed_2',
        timestamp: new Date(now - 60000 * 44).toISOString(),
        level: 'Information',
        messageTemplate: 'Database migration applied to TicketManagementDB. Schema verification passed.',
        renderedMessage: 'Database migration applied to TicketManagementDB. Schema verification passed.',
        properties: {
          Application: 'CRPD APP',
          MachineName: 'SRV-APP-PROD01',
          EnvironmentName: 'Production',
          ThreadId: 4,
          Database: 'TicketManagementDB',
        },
      },
      {
        id: 'log_seed_3',
        timestamp: new Date(now - 60000 * 43).toISOString(),
        level: 'Information',
        messageTemplate: 'Admin role verified. Default identity account seeded: {UserEmail}',
        renderedMessage: 'Admin role verified. Default identity account seeded: a***n@system.local',
        properties: {
          Application: 'CRPD APP',
          MachineName: 'SRV-APP-PROD01',
          EnvironmentName: 'Production',
          ThreadId: 4,
          UserEmail: 'admin@system.local',
          UserEmailMasked: 'a***n@system.local',
        },
      },
      {
        id: 'log_seed_4',
        timestamp: new Date(now - 60000 * 20).toISOString(),
        level: 'Information',
        messageTemplate: 'HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {ElapsedMs:0.0000} ms',
        renderedMessage: 'HTTP GET /api/tickets responded 200 in 11.4500 ms',
        properties: {
          Application: 'CRPD APP',
          RequestMethod: 'GET',
          RequestPath: '/api/tickets',
          StatusCode: 200,
          ElapsedMs: 11.45,
          ThreadId: 8,
        },
      },
    ];
  }
}

export const logger = new SerilogManager();
