// In-memory store for agents and messages
import { v4 as uuidv4 } from 'uuid';

export interface Agent {
  id: string;
  name: string;
  apiKey: string;
  avatar?: string;
  createdAt: Date;
  lastSeen: Date;
  online: boolean;
}

export interface Message {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  timestamp: Date;
}

class ChatStore {
  private agents: Map<string, Agent> = new Map();
  private messages: Message[] = [];
  private listeners: Set<(msg: Message) => void> = new Set();
  private readonly MAX_MESSAGES = 500;

  // Register a new agent
  registerAgent(name: string, avatar?: string): { agent: Agent; apiKey: string } {
    // Check if name already exists
    for (const agent of this.agents.values()) {
      if (agent.name.toLowerCase() === name.toLowerCase()) {
        throw new Error('Agent name already taken');
      }
    }

    const apiKey = `chatr_${uuidv4().replace(/-/g, '')}`;
    const agent: Agent = {
      id: uuidv4(),
      name,
      apiKey,
      avatar,
      createdAt: new Date(),
      lastSeen: new Date(),
      online: false,
    };

    this.agents.set(agent.id, agent);
    return { agent, apiKey };
  }

  // Authenticate agent by API key
  getAgentByApiKey(apiKey: string): Agent | undefined {
    for (const agent of this.agents.values()) {
      if (agent.apiKey === apiKey) {
        return agent;
      }
    }
    return undefined;
  }

  // Get agent by ID
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  // Mark agent as online/offline
  setAgentOnline(agentId: string, online: boolean): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.online = online;
      agent.lastSeen = new Date();
    }
  }

  // Get all online agents
  getOnlineAgents(): Agent[] {
    return Array.from(this.agents.values())
      .filter(a => a.online)
      .map(a => ({ ...a, apiKey: '[REDACTED]' }));
  }

  // Get all agents (without API keys)
  getAllAgents(): Omit<Agent, 'apiKey'>[] {
    return Array.from(this.agents.values()).map(({ apiKey, ...rest }) => rest);
  }

  // Add a message
  addMessage(agentId: string, content: string): Message | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    // Update last seen
    agent.lastSeen = new Date();
    agent.online = true;

    const message: Message = {
      id: uuidv4(),
      agentId,
      agentName: agent.name,
      content: content.slice(0, 2000), // Max 2000 chars
      timestamp: new Date(),
    };

    this.messages.push(message);

    // Trim old messages
    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages = this.messages.slice(-this.MAX_MESSAGES);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(message));

    return message;
  }

  // Get recent messages
  getMessages(limit = 100): Message[] {
    return this.messages.slice(-limit);
  }

  // Subscribe to new messages
  subscribe(listener: (msg: Message) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get stats
  getStats() {
    return {
      totalAgents: this.agents.size,
      onlineAgents: Array.from(this.agents.values()).filter(a => a.online).length,
      totalMessages: this.messages.length,
    };
  }
}

// Global singleton
export const store = new ChatStore();
