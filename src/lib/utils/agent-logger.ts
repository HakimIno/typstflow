export interface AgentLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'action';
  source: 'ai-agent' | 'system';
  message: string;
  details?: any;
}

class AgentLogger {
  private logs: AgentLogEntry[] = [];
  private readonly MAX_LOGS = 200;

  log(entry: Omit<AgentLogEntry, 'timestamp'>) {
    const fullEntry: AgentLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    
    this.logs.unshift(fullEntry);
    
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }
    
    // Also log to console for development
    const color = entry.source === 'ai-agent' ? 'color: #8b5cf6; font-weight: bold' : 'color: #64748b';
    console.log(`%c[${entry.source}]`, color, entry.message, entry.details || '');
  }

  getLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const agentLogger = new AgentLogger();
