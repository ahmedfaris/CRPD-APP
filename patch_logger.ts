import fs from 'fs';

const file = 'src/server/utils/logger.ts';

const newContent = `import fs from 'fs';
import path from 'path';

// Ensure logs directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFilePath = path.join(logDir, 'system-events.log');

export interface SerilogLogEntry {
  Timestamp: string;
  Level: 'Information' | 'Warning' | 'Error';
  MessageTemplate: string;
  RenderedMessage: string;
  Properties: Record<string, unknown>;
}

class BackendLogger {
  public log(
    level: 'Information' | 'Warning' | 'Error',
    messageTemplate: string,
    properties: Record<string, unknown> = {}
  ) {
    let renderedMessage = messageTemplate;
    for (const [key, val] of Object.entries(properties)) {
      renderedMessage = renderedMessage.replace(new RegExp('\\\\\\\\{' + key + '\\\\\\\\}', 'g'), String(val));
    }

    const entry: SerilogLogEntry = {
      Timestamp: new Date().toISOString(),
      Level: level,
      MessageTemplate: messageTemplate,
      RenderedMessage: renderedMessage,
      Properties: {
        Application: 'CRPD APP Backend',
        Environment: process.env.NODE_ENV || 'development',
        ...properties,
      },
    };

    const logLine = JSON.stringify(entry);
    
    // 1. Console Output
    if (level === 'Error') {
      console.error(logLine);
    } else if (level === 'Warning') {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }
    
    // 2. Local File Record
    try {
      fs.appendFileSync(logFilePath, logLine + '\\n', 'utf8');
    } catch (err) {
      console.error('Failed to write to local log file:', err);
    }

    // 3. Emit to Seq Server (if SEQ_URL is configured)
    const seqUrl = process.env.SEQ_URL;
    if (seqUrl) {
      const seqEndpoint = seqUrl.endsWith('/') ? \\\`\\$\\{seqUrl\\}api/events/raw\\\` : \\\`\\$\\{seqUrl\\}/api/events/raw\\\`;
      fetch(seqEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(process.env.SEQ_API_KEY ? { 'X-Seq-ApiKey': process.env.SEQ_API_KEY } : {})
        },
        body: JSON.stringify({ Events: [entry] })
      }).catch(() => {
        // Ignore network errors for logging so we don't crash requests
      });
    }
    
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
}

export const logger = new BackendLogger();
`;

fs.writeFileSync(file, newContent);
