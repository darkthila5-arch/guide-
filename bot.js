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

// Auto login using uid + password → returns token
async function getToken(uid, password, region) {
  const loginUrls = [
    `https://loginbp.ggblueshark.com/MajorLogin`,
    `https://ff.garena.com/api/login/guest`,
    `https://loginbp.${region.toLowerCase()}.freefiremobile.com/MajorLogin`
  ];

  const payload = {
    uid: uid,
    password: password,
    version: '1.95.6',
    lang: 'en',
    region: region
  };

  for (const url of loginUrls) {
    try {
      const r = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 11)',
          'X-Garena-Client': '1.95.6'
        },
        timeout: 10000
      });

      const token = r.data?.token
        || r.data?.data?.token
        || r.data?.accessToken
        || r.data?.data?.accessToken;

      if (token) return token;
    } catch (e) {
      continue;
    }
  }
  throw new Error('Login failed — could not get token from any endpoint');
}

async function joinGuild(host, token, guildId) {
  try {
    const r = await axios.post(`${host}/guild/join`, { guildId }, {
      headers: buildHeaders(token), timeout: 10000
    });
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
    guildId, matchType: 1, result,
    score: result === 'WIN' ? 1 : 0,
    kills: Math.floor(Math.random() * 8) + (result === 'WIN' ? 5 : 1),
    placement: result === 'WIN' ? 1 : (result === 'TOP5' ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 45) + 6),
    duration: Math.floor(Math.random() * 900) + 600,
    mapId: [1,2,3,4,5][Math.floor(Math.random() * 5)]
  };
  const r = await axios.post(`${host}/guild/glory/contribute`, payload, {
    headers: buildHeaders(token), timeout: 15000
  });
  return r.data;
}

async function claimGloryCheckIn(host, token, guildId) {
  try {
    const r = await axios.post(`${host}/guild/glory/checkin`, { guildId }, {
      headers: buildHeaders(token), timeout: 8000
    });
    return r.data;
  } catch (e) { return null; }
}

async function startGuildBot({ guildId, uid, password, region }, session) {
  const host = REGION_HOSTS[region] || REGION_HOSTS['IND'];

  // Step 1: Auto login → get token
  log(session, `Logging in with UID: ${uid}...`);
  let token;
  try {
    token = await getToken(uid, password, region);
    log(session, `Login success — token received`);
  } catch (e) {
    log(session, `Login failed: ${e.message}`);
    session.running = false;
    return;
  }

  await DELAY(2000);

  // Step 2: Join guild
  try {
    const j = await joinGuild(host, token, guildId);
    log(session, j.already_member ? 'Already in guild — skipping join' : 'Joined guild');
  } catch (e) {
    log(session, `Join error: ${e.message}`);
    session.running = false;
    return;
  }

  await DELAY(2000);

  // Step 3: Guild info
  try {
    const info = await fetchGuildInfo(host, token, guildId);
    log(session, `Guild OK — Current Glory: ${info?.guild?.gloryPoint || 0}`);
  } catch (e) {
    log(session, `Guild info error: ${e.message}`);
  }

  // Step 4: Daily checkin
  const checkin = await claimGloryCheckIn(host, token, guildId);
  if (checkin) log(session, `Daily check-in: +${checkin.reward || '?'} glory`);

  // Step 5: Match loop
  const resultCycle = ['WIN','WIN','TOP5','WIN','PLAY','WIN','TOP5','WIN'];
  let cycleIdx = 0;

  while (session.running) {
    if (session.maxLoops > 0 && session.loops >= session.maxLoops) {
      log(session, `Max loops reached — stopping`);
      session.running = false;
      break;
    }

    const result = resultCycle[cycleIdx % resultCycle.length];
    cycleIdx++;

    try {
      const matchData = await submitGloryMatch(host, token, guildId, result);
      const gained = matchData?.gloryGained || MATCH_GLORY_REWARD[result];
      session.glory += gained;
      session.loops++;
      log(session, `Match #${session.loops} → ${result} | +${gained} glory | Total: ${session.glory}`);

      const cooldown = 8000 + Math.floor(Math.random() * 7000);
      await DELAY(cooldown);
    } catch (e) {
      // Token expired — re-login
      if (e.response?.status === 401) {
        log(session, 'Token expired — re-logging in...');
        try {
          token = await getToken(uid, password, region);
          log(session, 'Re-login success');
        } catch (le) {
          log(session, `Re-login failed: ${le.message}`);
          session.running = false;
          break;
        }
      } else if (e.response?.status === 429) {
        log(session, 'Rate limited — waiting 60s');
        await DELAY(60000);
      } else {
        log(session, `Error: ${e.response?.data?.message || e.message}`);
        await DELAY(5000);
      }
    }
  }

  log(session, `Done — Glory: ${session.glory} | Matches: ${session.loops}`);
}

module.exports = { startGuildBot };
