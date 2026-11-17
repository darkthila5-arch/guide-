require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { startGuildBot } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessions = {};

app.post('/api/start', async (req, res) => {
  const { guildId, uid, password, region, loopCount } = req.body;

  if (!guildId || !uid || !password) {
    return res.status(400).json({ error: 'guildId, uid and password required' });
  }
  if (sessions[guildId]?.running) {
    return res.status(409).json({ error: 'Bot already running' });
  }

  sessions[guildId] = {
    running: true, glory: 0, loops: 0,
    maxLoops: parseInt(loopCount) || 0,
    startTime: Date.now(), logs: []
  };

  startGuildBot({ guildId, uid, password, region: region || 'IND' }, sessions[guildId]);
  res.json({ success: true });
});

app.post('/api/stop', (req, res) => {
  const { guildId } = req.body;
  if (!sessions[guildId]) return res.status(404).json({ error: 'No session' });
  sessions[guildId].running = false;
  res.json({ success: true });
});

app.get('/api/status/:guildId', (req, res) => {
  const s = sessions[req.params.guildId];
  if (!s) return res.status(404).json({ error: 'No session' });
  res.json({
    running: s.running, glory: s.glory, loops: s.loops,
    uptime: Math.floor((Date.now() - s.startTime) / 1000),
    logs: s.logs.slice(-20)
  });
});

app.listen(PORT, () => console.log(`[SERVER] Port ${PORT}`));
