import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const owner = { userId: 17, profile: 'testing' }
const fixture = fileURLToPath(new URL('./mcode.mjs', import.meta.url))
export const nativeDefault = 'native-default'
export const message = text => ({ type: 'text', text })
export const request = value => ({ input: [message(value)], history: [], instructions: [], options: {} })

export async function setup(t, { cli = fixture, ...options } = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'studio-mcode-')))
  const data = join(root, 'data')
  const paths = { runtimeDir: join(root, 'runtime'), workspaceDir: join(root, 'work space') }
  await Promise.all([data, ...Object.values(paths)].map(dir => mkdir(dir)))
  await writeFile(join(data, 'fixture.json'), JSON.stringify(options))
  const vars = {
    EKKO_MINIMAX_CODE_EXECUTABLE: cli, MINIMAX_DATA_DIR: data,
    HOME: root, USERPROFILE: root, APPDATA: root, LOCALAPPDATA: root,
    MCODE_DISABLE_TELEMETRY: '1', STUDIO_ADMIN_TOKEN: 'must-not-be-inherited',
  }
  const original = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]))
  Object.assign(process.env, vars)
  t.after(async () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(root, { recursive: true, force: true, maxRetries: 3 })
  })
  const identity = { ...owner, agentId: 'plugin:minimax-code/minimax-code', sessionId: 'chat-a' }
  const session = { identity, mode: 'global', paths, signal: new AbortController().signal }
  const events = []
  const approvals = []
  const lifecycle = { add() {} }
  const run = {
    ...session, identity: { ...identity, runId: 'run-a' }, lifecycle, mcpServers: {},
    model: { model: nativeDefault }, deadlineAt: Date.now() + 35_000,
    output: { emit: async event => { events.push(event) } },
    interactions: { approve: async item => { approvals.push(item); return { outcome: 'denied' } } },
  }
  const trace = async () => {
    try {
      return (await readFile(join(data, 'trace.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      return []
    }
  }
  async function waitForPrompt() {
    const until = Date.now() + 5000
    while (Date.now() < until) {
      if ((await trace()).some(frame => frame.method === 'session/prompt')) return
      await delay(20)
    }
    throw new Error('fixture did not receive a prompt')
  }
  return { root, data, paths, identity, lifecycle, session, run, trace, waitForPrompt, events, approvals }
}

export function definitionOf(apply, identity = owner) {
  let definition
  let disposed = false
  const rpc = new Map()
  const state = new Map()
  const release = apply({ identity, paths: { dataDir: join(process.env.MINIMAX_DATA_DIR, 'studio-plugin') },
    state: { plugin: { get: key => state.get(key), set: (key, value) => state.set(key, value) } }, extensions: {
    rpc: { register(name, handler) { rpc.set(name, handler); return () => rpc.delete(name) } },
    agents: { register(agent) {
    definition = agent
    return { dispose: async () => { disposed = true } }
  } } } })
  return { definition, isDisposed: () => disposed, release, rpc }
}
