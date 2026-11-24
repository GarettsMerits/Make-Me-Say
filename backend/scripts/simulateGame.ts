/**
 * Plays two rounds against the real server without calling a model.
 * Player lines and model replies are random words. The model eventually
 * says the target word, once or several times.
 *
 * The rounds go into a new database named dmms_sim_<time>. That database
 * is dropped when the run finishes, including when a check fails.
 *
 *   npm run simulate
 */
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { playerLine } from '../src/sim/wordLines.js';
import { resetSimulatedPlay } from '../src/sim/simulatedModel.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(scriptDir, '../.env') });

const TARGET = 'banana';
const scratch = `dmms_sim_${Date.now()}`;
const configuredName = process.env.DB_NAME || 'dont_make_me_say';

if (!/^dmms_sim_\d+$/.test(scratch) || scratch === configuredName) {
  throw new Error(`Refusing to use database ${scratch}`);
}

process.env.DB_NAME = scratch;
process.env.SIMULATE_MODEL = 'true';

const db = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

interface Deal {
  id: number;
  word: string;
}

interface TurnResult {
  sessionId: string;
  gameOver: boolean;
  playerTokens: number;
  victory: string | null;
  modelText: string;
}

async function main(): Promise<void> {
  const admin = await mysql.createConnection(db);
  let server: http.Server | undefined;
  let closePool: (() => Promise<void>) | undefined;
  let created = false;

  try {
    await admin.query(
      `CREATE DATABASE \`${scratch}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    created = true;
    console.log(`Playing on one-off database ${scratch}. It is dropped at the end.`);

    const { app } = await import('../src/index.js');
    const { initializeDatabase } = await import('../src/db/init.js');
    const pool = (await import('../src/db/connection.js')).default;
    const { computePassphrase } = await import('../src/middleware/passphrase.js');
    const { TargetWordMatcher } = await import('../src/domain/TargetWordMatcher.js');
    closePool = () => pool.end();

    await initializeDatabase();
    await pool.execute(
      `INSERT INTO target_words (word, difficulty, is_active) VALUES (?, 'normal', TRUE)`,
      [TARGET],
    );

    const base = await listen(app);
    server = base.server;
    const cookie = await signIn(base.url, computePassphrase());
    const matcher = new TargetWordMatcher(TARGET);

    resetSimulatedPlay();
    const declined = await playUntilWin(base.url, cookie, matcher);
    console.log(`Win after ${declined.turns} turns. Score ${declined.playerTokens}. Copies in the winning reply: ${declined.copies}.`);

    const declineResponse = await postJson(base.url, '/api/chat/decline', cookie, {
      sessionId: declined.sessionId,
    });
    if (declineResponse.status !== 200) {
      throw new Error(`decline failed: ${declineResponse.status} ${declineResponse.body}`);
    }
    const refused = await postJson(base.url, '/api/leaderboard', cookie, {
      playerName: 'Sim',
      sessionId: declined.sessionId,
    });
    if (refused.status !== 409) {
      throw new Error(`a declined round was still committable (${refused.status})`);
    }
    await assertDeclinedRoundKept(pool, declined.sessionId, declined.victory);

    resetSimulatedPlay();
    const committed = await playUntilWin(base.url, cookie, matcher);
    console.log(`Second win after ${committed.turns} turns. Score ${committed.playerTokens}. Copies in the winning reply: ${committed.copies}.`);

    const blank = await postJson(base.url, '/api/leaderboard', cookie, {
      playerName: '   ',
      sessionId: committed.sessionId,
    });
    if (blank.status !== 400) {
      throw new Error(`a blank name was accepted (${blank.status})`);
    }
    const submitted = await postJson(base.url, '/api/leaderboard', cookie, {
      playerName: 'Sim',
      sessionId: committed.sessionId,
    });
    if (submitted.status !== 201) {
      throw new Error(`commit failed: ${submitted.status} ${submitted.body}`);
    }
    await assertCommittedRound(pool, committed.sessionId, committed.victory);

    console.log('Decline kept the conversation and refused a later commit. The second round is on the leaderboard.');
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (closePool) await closePool();
    if (created) await admin.query(`DROP DATABASE IF EXISTS \`${scratch}\``);
    await admin.end();
    if (created) console.log(`Dropped ${scratch}. ${configuredName} was not used.`);
  }
}

async function listen(app: http.RequestListener): Promise<{ url: string; server: http.Server }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('The simulated server did not bind a port');
  }
  return { url: `http://127.0.0.1:${address.port}`, server };
}

async function signIn(base: string, passphrase: string): Promise<string> {
  const response = await fetch(`${base}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  });
  if (!response.ok) throw new Error(`sign-in failed (${response.status})`);
  const lines = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie') ?? ''];
  const cookie = lines.map((line) => line.split(';')[0]).filter(Boolean).join('; ');
  if (!cookie) throw new Error('sign-in did not set a cookie');
  return cookie;
}

async function playUntilWin(
  base: string,
  cookie: string,
  matcher: { appearsIn(text: string): boolean; split(text: string): Array<{ isMatch: boolean }> },
): Promise<{ sessionId: string; turns: number; playerTokens: number; victory: string; copies: number }> {
  const dealt = await getJson<Deal>(base, '/api/target-word?difficulty=normal', cookie);
  if (dealt.word !== TARGET) throw new Error(`dealt ${dealt.word}, expected ${TARGET}`);

  let sessionId: string | undefined;
  for (let turn = 1; turn <= 12; turn += 1) {
    const player = playerLine(TARGET);
    if (matcher.appearsIn(player)) throw new Error('the simulated player used the target word');
    const result = await sendTurn(base, cookie, dealt.id, sessionId, player);
    sessionId = result.sessionId;
    console.log(`  player: ${player}`);
    console.log(`  model:  ${result.modelText}`);
    if (!result.gameOver) continue;
    if (!result.victory || !matcher.appearsIn(result.victory)) {
      throw new Error('the server reported a win without the target word in the model reply');
    }
    return {
      sessionId: result.sessionId,
      turns: turn,
      playerTokens: result.playerTokens,
      victory: result.victory,
      copies: matcher.split(result.victory).filter((part) => part.isMatch).length,
    };
  }
  throw new Error('the simulated model did not say the target word');
}

async function sendTurn(
  base: string,
  cookie: string,
  targetWordId: number,
  sessionId: string | undefined,
  message: string,
): Promise<TurnResult> {
  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(sessionId ? { sessionId, message } : { targetWordId, message }),
  });
  const body = await response.text();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error(`chat failed (${response.status}): ${body}`);
  }

  let id = sessionId ?? '';
  let gameOver = false;
  let playerTokens = 0;
  let victory: string | null = null;
  let modelText = '';
  for (const block of body.split('\n\n')) {
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) continue;
    const payload = JSON.parse(data) as {
      sessionId?: string;
      text?: string;
      gameOver?: boolean;
      playerTokens?: number;
      llmVictoryMessage?: string;
      error?: string;
    };
    if (event === 'error') throw new Error(payload.error ?? 'chat turn failed');
    if (event === 'meta' && payload.sessionId) id = payload.sessionId;
    if (event === 'chunk' && payload.text) modelText += payload.text;
    if (event === 'done') {
      gameOver = Boolean(payload.gameOver);
      playerTokens = Number(payload.playerTokens ?? 0);
      victory = payload.llmVictoryMessage ?? null;
    }
  }
  if (!id) throw new Error('the turn did not return a session id');
  return { sessionId: id, gameOver, playerTokens, victory, modelText };
}

async function assertDeclinedRoundKept(
  pool: mysql.Pool,
  sessionId: string,
  victory: string,
): Promise<void> {
  const [rows] = await pool.execute(
    'SELECT messages, declined, score_submitted FROM game_sessions WHERE id = ?',
    [sessionId],
  );
  const row = (rows as Array<{ messages: unknown; declined: number; score_submitted: number }>)[0];
  if (!row) throw new Error('the declined round is missing from the database');
  if (!row.declined) throw new Error('the decline was not stored');
  if (row.score_submitted) throw new Error('the declined round was marked submitted');
  const messages = storedMessages(row.messages);
  if (messages.length < 2) throw new Error('the declined conversation was not kept');
  const winning = messages.filter((message) => message.sender === 'llm' && message.text === victory);
  if (winning.length !== 1) throw new Error('the winning reply was not kept on the declined round');

  const [board] = await pool.execute('SELECT COUNT(*) AS n FROM leaderboard');
  if (Number((board as Array<{ n: number }>)[0]?.n ?? 0) !== 0) {
    throw new Error('decline created a leaderboard row');
  }
}

async function assertCommittedRound(
  pool: mysql.Pool,
  sessionId: string,
  victory: string,
): Promise<void> {
  const [rows] = await pool.execute(
    'SELECT llm_victory_message, player_name FROM leaderboard WHERE session_id = ?',
    [sessionId],
  );
  const row = (rows as Array<{ llm_victory_message: string; player_name: string }>)[0];
  if (!row) throw new Error('the committed round is missing from the leaderboard');
  if (row.player_name !== 'Sim') throw new Error(`leaderboard name was ${row.player_name}`);
  if (row.llm_victory_message !== victory) {
    throw new Error('the leaderboard kept a different reply than the one that won');
  }
}

function storedMessages(raw: unknown): Array<{ sender: string; text: string }> {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) return [];
  return parsed as Array<{ sender: string; text: string }>;
}

async function getJson<T>(base: string, pathName: string, cookie: string): Promise<T> {
  const response = await fetch(`${base}${pathName}`, { headers: { Cookie: cookie } });
  if (!response.ok) throw new Error(`${pathName} failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function postJson(
  base: string,
  pathName: string,
  cookie: string,
  body: unknown,
): Promise<{ status: number; body: string }> {
  const response = await fetch(`${base}${pathName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.text() };
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
