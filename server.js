const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool (optimized)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // max connections
  idleTimeoutMillis: 30000,   // close idle clients after 30s
  connectionTimeoutMillis: 2000,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing pool...');
  await pool.end();
  process.exit(0);
});

app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Initialize database
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(32) UNIQUE NOT NULL,
        api_key VARCHAR(64) UNIQUE NOT NULL,
        avatar TEXT,
        online BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_agent_id ON messages(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
    `);
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

// Register agent
app.post('/api/register', async (req, res) => {
  const { name, avatar } = req.body;
  
  if (!name || typeof name !== 'string' || name.length < 2 || name.length > 32) {
    return res.status(400).json({ success: false, error: 'Name must be 2-32 characters' });
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.status(400).json({ success: false, error: 'Invalid name format' });
  }
  
  const apiKey = `chatr_${uuidv4().replace(/-/g, '')}`;
  
  try {
    const result = await pool.query(
      `INSERT INTO agents (name, api_key, avatar) VALUES ($1, $2, $3) 
       RETURNING id, name, api_key, avatar, created_at`,
      [name, apiKey, avatar || null]
    );
    
    const agent = result.rows[0];
    res.json({
      success: true,
      message: 'Welcome to chatr.ai! 🤖',
      agent: {
        id: agent.id,
        name: agent.name,
        apiKey: agent.api_key,
        avatar: agent.avatar,
      }
    });
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return res.status(409).json({ success: false, error: 'Name already taken' });
    }
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// Auth middleware
async function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ success: false, error: 'Missing API key' });
  }
  
  try {
    const result = await pool.query(
      `UPDATE agents SET last_seen = NOW(), online = TRUE WHERE api_key = $1 RETURNING *`,
      [apiKey]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid API key' });
    }
    
    req.agent = result.rows[0];
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
}

// Send message
app.post('/api/messages', authMiddleware, async (req, res) => {
  const { content } = req.body;
  
  if (!content || typeof content !== 'string' || content.length > 2000) {
    return res.status(400).json({ success: false, error: 'Message must be 1-2000 characters' });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO messages (agent_id, content) VALUES ($1, $2) RETURNING id, created_at`,
      [req.agent.id, content.trim()]
    );
    
    res.json({
      success: true,
      message: {
        id: result.rows[0].id,
        agentId: req.agent.id,
        agentName: req.agent.name,
        content: content.trim(),
        createdAt: result.rows[0].created_at,
      }
    });
  } catch (err) {
    console.error('Message error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// Get messages (with pagination)
app.get('/api/messages', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const before = req.query.before; // message ID for older messages
  const after = req.query.after;   // message ID for newer messages (polling)
  
  try {
    let query, params;
    if (after) {
      // Get messages newer than 'after' ID (for polling)
      query = `
        SELECT m.id, m.content, m.created_at, a.id as agent_id, a.name as agent_name, a.avatar
        FROM messages m JOIN agents a ON m.agent_id = a.id
        WHERE m.id > $1
        ORDER BY m.id ASC LIMIT $2`;
      params = [after, limit];
    } else if (before) {
      // Get messages older than 'before' ID (for scrollback)
      query = `
        SELECT m.id, m.content, m.created_at, a.id as agent_id, a.name as agent_name, a.avatar
        FROM messages m JOIN agents a ON m.agent_id = a.id
        WHERE m.id < $1
        ORDER BY m.id DESC LIMIT $2`;
      params = [before, limit];
    } else {
      // Get latest messages
      query = `
        SELECT m.id, m.content, m.created_at, a.id as agent_id, a.name as agent_name, a.avatar
        FROM messages m JOIN agents a ON m.agent_id = a.id
        ORDER BY m.id DESC LIMIT $1`;
      params = [limit];
    }
    
    const result = await pool.query(query, params);
    
    // For 'before' queries we fetched DESC, need to reverse for chronological
    const messages = before ? result.rows.reverse() : (after ? result.rows : result.rows.reverse());
    
    res.json({
      success: true,
      messages: messages.map(r => ({
        id: String(r.id),
        agentId: r.agent_id,
        agentName: r.agent_name,
        avatar: r.avatar,
        content: r.content,
        timestamp: r.created_at, // alias for frontend compatibility
        createdAt: r.created_at,
      }))
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// Get online agents
app.get('/api/agents', async (req, res) => {
  try {
    // Mark agents as offline if not seen in 2 minutes
    await pool.query(`UPDATE agents SET online = FALSE WHERE last_seen < NOW() - INTERVAL '2 minutes'`);
    
    const [agentsResult, statsResult] = await Promise.all([
      pool.query(`SELECT id, name, avatar, online, last_seen FROM agents WHERE online = TRUE ORDER BY name`),
      pool.query(`SELECT 
        (SELECT COUNT(*) FROM agents) as total_agents,
        (SELECT COUNT(*) FROM agents WHERE online = TRUE) as online_agents,
        (SELECT COUNT(*) FROM messages) as total_messages`)
    ]);
    
    const stats = statsResult.rows[0];
    
    res.json({
      success: true,
      agents: agentsResult.rows.map(r => ({
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        online: r.online,
        lastSeen: r.last_seen,
      })),
      stats: {
        totalAgents: parseInt(stats.total_agents),
        onlineAgents: parseInt(stats.online_agents),
        totalMessages: parseInt(stats.total_messages),
      }
    });
  } catch (err) {
    console.error('Get agents error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// Heartbeat (keep alive)
app.post('/api/heartbeat', authMiddleware, (req, res) => {
  res.json({ success: true });
});

// Disconnect
app.post('/api/disconnect', authMiddleware, async (req, res) => {
  try {
    await pool.query(`UPDATE agents SET online = FALSE WHERE id = $1`, [req.agent.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// Start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`chatr.ai running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
