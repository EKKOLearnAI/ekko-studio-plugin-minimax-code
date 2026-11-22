import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const scopedProtocols = ['chat_completions']
const endpoint = '/chat/completions'
const studioProvider = 'custom_provider:studio'

export function scopedModelSelected(controls, model) {
  const current = controls?.configOptions?.find(option => option.id === 'model')?.currentValue
  const expected = `m:${encodeURIComponent(studioProvider)}:${encodeURIComponent(model)}:`
  return typeof current === 'string' && current.startsWith(expected)
}

async function scopedProxy(model, signal) {
  const target = new URL(model.baseUrl)
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password ||
      target.search || target.hash || !model.token || !model.model || !scopedProtocols.includes(model.apiMode)) {
    throw new Error('The Studio scoped model binding is invalid.')
  }
  target.pathname = target.pathname.replace(/\/$/, '') + endpoint
  const key = randomBytes(24).toString('base64url')
  const server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${key}`) { res.writeHead(401).end(); return }
    if (req.method !== 'POST' || req.url !== `/v1${endpoint}`) { res.writeHead(404).end(); return }
    const connection = new AbortController()
    const disconnect = () => connection.abort()
    res.once('close', disconnect)
    try {
      const response = await fetch(target, {
        method: 'POST', body: Readable.toWeb(req), duplex: 'half', redirect: 'error',
        signal: AbortSignal.any([signal, connection.signal]),
        headers: { authorization: `Bearer ${model.token}`, 'content-type': 'application/json' },
      })
      res.writeHead(response.status, {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      })
      if (response.body) await pipeline(Readable.fromWeb(response.body), res)
      else res.end()
    } catch {
      if (!res.headersSent) res.writeHead(502).end('Studio model request failed.')
      else res.destroy()
    } finally { res.off('close', disconnect) }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const dispose = () => new Promise(resolve => {
    server.close(resolve)
    server.closeAllConnections()
  })
  return { key, baseURL: `http://127.0.0.1:${server.address().port}/v1`, dispose }
}

async function exposeNativeResources(directory, nativeDirectory) {
  if (!nativeDirectory) return
  const skills = join(nativeDirectory, 'skills')
  const mcp = join(nativeDirectory, 'mcp.json')
  const [skillEntry, mcpEntry] = await Promise.all([stat(skills).catch(missing), stat(mcp).catch(missing)])
  if (skillEntry?.isDirectory()) {
    await symlink(skills, join(directory, 'skills'), process.platform === 'win32' ? 'junction' : 'dir')
  }
  if (mcpEntry?.isFile() && mcpEntry.size <= 1024 * 1024) {
    await writeFile(join(directory, 'mcp.json'), await readFile(mcp), { mode: 0o600 })
  }
}

function missing(error) {
  if (error.code !== 'ENOENT') throw error
}

export async function createScopedEnvironment({ model, runtimeDir, env, nativeResources, signal }) {
  signal.throwIfAborted()
  await mkdir(runtimeDir, { recursive: true, mode: 0o700 })
  const directory = await mkdtemp(join(runtimeDir, 'mcode-scoped-'))
  let proxy
  const dispose = async () => {
    await proxy?.dispose()
    await rm(directory, { recursive: true, force: true, maxRetries: 3 })
  }
  try {
    proxy = await scopedProxy(model, signal)
    const limit = {
      ...(model.contextWindow > 0 ? { context: model.contextWindow } : {}),
      ...(model.outputLimit > 0 ? { output: model.outputLimit } : {}),
    }
    const config = {
      defaultModel: `${studioProvider}/${model.model}`,
      permissionMode: 'default',
      dataContribution: { enabled: false },
      skills: { external: { enabled: true } },
      custom_provider: {
        studio: {
          name: 'Studio', kind: 'custom', enabled: true, api: 'openai-completions',
          options: { apiKey: proxy.key, baseURL: proxy.baseURL, authMode: 'api-key' },
          models: {
            [model.model]: {
              ...(Object.keys(limit).length ? { limit } : {}),
              capabilities: { support_image: true },
              reasoning: Boolean(model.reasoningEffort) && !['none', 'off', 'disabled'].includes(model.reasoningEffort),
            },
          },
        },
      },
    }
    await writeFile(join(directory, 'config.yaml'), JSON.stringify(config), { mode: 0o600 })
    await exposeNativeResources(directory, nativeResources)
    signal.throwIfAborted()
    return { env: { ...env, MINIMAX_DATA_DIR: directory, MCODE_DISABLE_TELEMETRY: '1' }, dispose }
  } catch (error) {
    await dispose()
    throw error
  }
}
