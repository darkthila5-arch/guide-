const axios = require('axios');

const REGION_HOSTS = {
  IND: 'https://clientbp.ggblueshark.com',
  SG:  'https://clientbp.ggblueshark.com',
  BR:  'https://clientbp.ggblueshark.com',
  VN:  'https://clientbp.ggblueshark.com',
  TH:  'https://clientbp.ggblueshark.com',
  ID:  'https://clientbp.ggblueshark.com',
  TW:  'https://clientbp.ggblueshark.com',
  US:  'https://clientbp.ggblueshark.com',
  PK:  'https://clientbp.ggblueshark.com',
  MENA:'https://clientbp.ggblueshark.com'
};

const MATCH_GLORY_REWARD = { WIN: 120, TOP5: 60, PLAY: 30 };
const DELAY = (ms) => new Promise(r => setTimeout(r, ms));

function log(session, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  session.logs.push(line);
  if (session.logs.length > 200) session.logs.shift();
}

function buildHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Redmi Note 8) AppleWebKit/537.36',
    'X-Unity-Version': '2019.4.28f1',
    'X-Garena-Client': '1.95.6',
    'Accept-Encoding': 'gzip, deflate'
  };
}

async function joinGuild(host, token, guildId) {
  try {
    const r = await axios.post(`${host}/guild/join`, { guildId }, { headers: buildHeaders(token), timeout: 10000 });
    return r.data;
  } catch (e) {
    if (e.response?.data?.code === 10015) return { already_member: true };
    throw e;
  }
}

async function fetchGuildInfo(host, token, guildId) {
  const r = await axios.get(`${host}/guild/info`, {
    params: { guildId }, headers: buildHeaders(token), timeout: 10000
  });
  return r.data;
}

async function submitGloryMatch(host, token, guildId, result = 'WIN') {
  const payload = {
    guildId, matchType: 1, result, score: result === 'WIN' ? 1 : 0,
    kills: Math.floor(Math.random() * 8) + (result === 'WIN' ? 5 : 1),
    placement: result === 'WIN' ? 1 : (result === 'TOP5' ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 45) + 6),
    duration: Math.floor(Math.random() * 900) + 600,
    mapId: [1, 2, 3, 4, 5][Math.floor(Math.random() * 5)]
  };
  const r = await axios.post(`${host}/guild/glory/contribute`, payload, {
    headers: buildHeaders(token), timeout: 15000
  });
  return r.data;
}

async function claimGloryCheckIn(host, token, guildId) {
  try {
    const r = await axios.post(`${host}/guild/glory/checkin`, { guildId }, { headers: buildHeaders(token), timeout: 8000 });
    return r.data;
  } catch (e) { return null; }
}

async function startGuildBot({ guildId, accountToken, region }, session) {
  const host = REGION_HOSTS[region] || REGION_HOSTS['IND'];
  log(session, `Initializing bot → Guild: ${guildId} | Region: ${region}`);

  try {
    const joinResult = await joinGuild(host, accountToken, guildId);
    log(session, joinResult.already_member ? 'Already a member — skipping join' : 'Joined guild successfully');
  } catch (e) {
    log(session, `Join failed: ${e.message} — aborting`);
    session.running = false;
    return;
  }

  await DELAY(2000);

  try {
    const info = await fetchGuildInfo(host, accountToken, guildId);
    log(session, `Guild verified — Current Glory: ${info?.guild?.gloryPoint || 0}`);
  } catch (e) {
    log(session, `Could not fetch guild info: ${e.message}`);
  }

  const checkin = await claimGloryCheckIn(host, accountToken, guildId);
  if (checkin) log(session, `Daily check-in claimed: +${checkin.reward || '?'} glory`);

  let resultCycle = ['WIN','WIN','TOP5','WIN','PLAY','WIN','TOP5','WIN'];
  let cycleIdx = 0;

  while (session.running) {
    if (session.maxLoops > 0 && session.loops >= session.maxLoops) {
      log(session, `Max loops (${session.maxLoops}) reached — stopping`);
      session.running = false;
      break;
    }

    const result = resultCycle[cycleIdx % resultCycle.length];
    cycleIdx++;

    try {
      const matchData = await submitGloryMatch(host, accountToken, guildId, result);
      const gained = matchData?.gloryGained || MATCH_GLORY_REWARD[result];
      session.glory += gained;
      session.loops++;
      log(session, `Match #${session.loops} → ${result} | +${gained} glory | Session total: ${session.glory}`);

      const cooldown = 8000 + Math.floor(Math.random() * 7000);
      log(session, `Cooldown: ${(cooldown/1000).toFixed(1)}s`);
      await DELAY(cooldown);
    } catch (e) {
      log(session, `Match error: ${e.response?.data?.message || e.message}`);
      if (e.response?.status === 429) { log(session, 'Rate limited — 60s backoff'); await DELAY(60000); }
      else await DELAY(5000);
    }
  }

  log(session, `Bot stopped — Glory: ${session.glory} | Matches: ${session.loops}`);
}

module.exports = { startGuildBot };
