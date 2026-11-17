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
  const { guildId, accountToken, region, loopCount } = req.body;
  if (!guildId || !accountToken) return res.status(400).json({ error: 'guildId and accountToken required' });
  if (sessions[guildId]?.running) return res.status(409).json({ error: 'Bot already running for this guild' });

  sessions[guildId] = {
    running: true, glory: 0, loops: 0,
    maxLoops: parseInt(loopCount) || 0,
    startTime: Date.now(), logs: []
  };

  startGuildBot({ guildId, accountToken, region: region || 'IND' }, sessions[guildId]);
  res.json({ success: true, message: `Bot started for guild ${guildId}` });
});

app.post('/api/stop', (req, res) => {
  const { guildId } = req.body;
  if (!sessions[guildId]) return res.status(404).json({ error: 'No session found' });
  sessions[guildId].running = false;
  res.json({ success: true, message: `Bot stopped for guild ${guildId}` });
});

app.get('/api/status/:guildId', (req, res) => {
  const session = sessions[req.params.guildId];
  if (!session) return res.status(404).json({ error: 'No session' });
  res.json({
    running: session.running, glory: session.glory,
    loops: session.loops,
    uptime: Math.floor((Date.now() - session.startTime) / 1000),
    logs: session.logs.slice(-20)
  });
});

app.get('/api/sessions', (req, res) => {
  const summary = Object.entries(sessions).map(([guildId, s]) => ({
    guildId, running: s.running, glory: s.glory, loops: s.loops
  }));
  res.json(summary);
});

app.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
