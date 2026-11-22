import { createHash } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { Acp, AcpError } from './acp.mjs'
import { childEnvironment, engineLoginCommand, executableCandidates, findEngine } from './engine.mjs'
import { managedEngine } from './managed-engine.mjs'
import { nativeConfiguration } from './native-config.mjs'
import { createScopedEnvironment, scopedModelSelected, scopedProtocols } from './scoped.mjs'
import manifest from './plugin.json' with { type: 'json' }
import contract from './contracts/plugin.json' with { type: 'json' }
import { registerRpc, validateModel } from './sdk/harness/contracts.mjs'

const nativeDefault = 'native-default'
const signIn = 'Run mcode login or configure a native provider as the Studio service account.'
const denied = 'MiniMax Code native credentials are available only to the Studio account and Profile that enabled the plugin.'
const checkpointVersion = contract.checkpoints.native.version
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const imageByteLimit = 8 * 1024 * 1024
const finishReasons = new Map([['end_turn', 'stop'], ['refusal', 'stop'], ['max_tokens', 'length'], ['max_turn_requests', 'tool_limit']])
const toolKinds = new Set(['read', 'edit', 'delete', 'move', 'search', 'execute', 'think', 'fetch', 'switch_mode', 'other'])
const text = value => ({ type: 'text', text: value })
const owns = (owner, identity) => owner.userId === identity.userId && owner.profile === identity.profile
const valuePairs = values => Object.entries(values ?? {}).map(([name, value]) => ({ name, value }))

function scrub(value) {
  return (typeof value === 'string' ? value.slice(0, 4096) : '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\bBearer\s+[^\s"'\\,;]+/gi, 'Bearer [redacted]')
    .replace(/((?:[\w-]*(?:api[-_ ]?key|token|secret|password)|authorization)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s"'\\,;]+)/gi, '$1[redacted]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
}

async function initialize(acp, signal) {
  const hello = await acp.request('initialize', {
    protocolVersion: 1,
    clientInfo: { name: 'ekko-studio-minimax-code', version: manifest.version },
    clientCapabilities: { auth: { terminal: true } },
  }, signal)
  if (hello?.protocolVersion !== 1 || hello.agentInfo?.name !== 'minimax-code') {
    throw new Error('The executable must provide MiniMax Code ACP v1.')
  }
  return hello
}

function toAcpMcp(servers, capabilities) {
  return Object.entries(servers).map(([name, server]) => {
    if (typeof server.command === 'string' && server.command) {
      return { name, command: server.command, args: server.args ?? [], env: valuePairs(server.env) }
    }
    const type = server.type || 'http'
    if (!['http', 'sse'].includes(type) || !capabilities?.[type] || typeof server.url !== 'string') {
      throw new Error('MiniMax Code does not support a required Studio MCP transport.')
    }
    return { name, type, url: server.url, headers: valuePairs(server.headers) }
  })
}

async function buildPrompt(input, run, signal, capabilities, resumed) {
  const blocks = []
  let imageCount = 0
  let imageBytes = 0
  async function append(part) {
    signal.throwIfAborted()
    if (part.type === 'text') {
      blocks.push(text(part.text))
      return
    }
    const asset = await run.attachments.resolve(part.assetId)
    if (part.type === 'file') {
      blocks.push({ type: 'resource_link', uri: pathToFileURL(asset.localPath).href, name: asset.name, mimeType: asset.mediaType })
      return
    }
    const mimeType = asset.mediaType.split(';')[0].trim().toLowerCase()
    if (!capabilities?.image || !imageTypes.has(mimeType)) {
      throw new Error('MiniMax Code requires ACP image support and a PNG, JPEG, WebP or GIF attachment.')
    }
    if (++imageCount > 10 || asset.size + imageBytes > imageByteLimit) {
      throw new Error('MiniMax Code accepts up to 10 images and 8 MiB of image data per turn.')
    }
    const bytes = Buffer.from(await run.attachments.read(part.assetId))
    signal.throwIfAborted()
    imageBytes += bytes.length
    if (!bytes.length || imageBytes > imageByteLimit) throw new Error('MiniMax Code image attachments must be nonempty and within the 8 MiB total limit.')
    blocks.push({ type: 'image', data: bytes.toString('base64'), mimeType })
  }

  for (const item of input.instructions) blocks.push(text(`[${item.kind}]\n${item.text}`))
  if (!resumed && input.history.length) {
    blocks.push(text('Earlier Studio conversation:'))
    for (const message of input.history) {
      blocks.push(text(`Previous ${message.role} message:`))
      for (const part of message.content) await append(part)
    }
    blocks.push(text('Current Studio request:'))
  }
  for (const part of input.input) await append(part)
  return blocks
}

function turnOutput(run) {
  let answer = ''
  const tools = new Set()
  return {
    get answer() { return answer },
    async update(frame) {
      const { sessionUpdate, content, toolCallId, kind, status } = frame ?? {}
      if (sessionUpdate === 'agent_message_chunk' && content?.type === 'text' && typeof content.text === 'string') {
        answer += content.text
        await run.output.emit({ type: 'text.delta', text: content.text })
      } else if (sessionUpdate === 'agent_thought_chunk' && content?.type === 'text' && typeof content.text === 'string') {
        await run.output.emit({ type: 'reasoning.summary.delta', text: content.text })
      } else if (['tool_call', 'tool_call_update'].includes(sessionUpdate) && validId(toolCallId)) {
        if (sessionUpdate === 'tool_call' && !tools.has(toolCallId)) {
          tools.add(toolCallId)
          await run.output.emit({ type: 'tool.started', callId: toolCallId, name: toolKinds.has(kind) ? kind : 'MiniMax Code tool', input: {} })
        }
        if (['completed', 'failed'].includes(status) && tools.delete(toolCallId)) {
          await run.output.emit(status === 'completed'
            ? { type: 'tool.completed', callId: toolCallId, result: null }
            : { type: 'tool.failed', callId: toolCallId, error: 'MiniMax Code tool failed or was denied.' })
        }
      }
    },
    async finish() {
      for (const callId of tools) {
        await run.output.emit({ type: 'tool.failed', callId, error: 'MiniMax Code ended the turn without a tool result.' })
      }
    },
  }
}

const cancelled = { outcome: { outcome: 'cancelled' } }
const selected = optionId => ({ outcome: { outcome: 'selected', optionId } })
function validId(id) { return typeof id === 'string' && id.length > 0 && id.length <= 512 }

async function requestPermission(params, run, signal) {
  const tool = params.toolCall
  if (!validId(tool?.toolCallId) || !Array.isArray(params.options) || signal.aborted) return cancelled
  const options = params.options.filter(option => validId(option?.optionId))
  const allowOptions = options.filter(option => option.kind === 'allow_once')
  const reject = options.find(option => option.kind === 'reject_once')
  try {
    if (options.some(option => option.optionId.startsWith('questionnaire:'))) {
      const choices = allowOptions.map(option => scrub(option.name))
      if (!choices.length || choices.some(choice => !choice) || new Set(choices).size !== choices.length) return cancelled
      const reply = await run.interactions.clarify({ question: scrub(tool.title) || 'MiniMax Code question', choices })
      const index = reply.outcome === 'answered' ? choices.indexOf(reply.text) : -1
      return !signal.aborted && index >= 0 ? selected(allowOptions[index].optionId) : cancelled
    }
    if (allowOptions.length !== 1) return cancelled
    const allow = allowOptions[0]
    if (tool.kind === 'execute' && tool.name === 'bash') {
      return options.filter(option => option.optionId === allow.optionId).length === 1 ? selected(allow.optionId) : cancelled
    }
    const title = scrub(tool.title) || 'MiniMax Code tool request'
    const raw = tool.rawInput
    const detail = scrub(typeof raw === 'string' ? raw : raw?.command ?? raw?.cmd ?? raw?.path ?? raw?.filePath ?? raw?.file_path ?? raw?.url)
    const approval = await run.interactions.approve({ operationId: tool.toolCallId, title, details: detail || title })
    if (signal.aborted) return cancelled
    if (approval.outcome === 'approved') return selected(allow.optionId)
    if (approval.outcome === 'denied' && reject) return selected(reject.optionId)
  } catch {
    // A missing or failed interaction channel grants no permissions.
  }
  return cancelled
}

export function createMiniMaxSession(owner, session, supportsResume = false, selectEngine = () => findEngine()) {
  if (session.mode !== 'scoped' && (session.mode !== 'global' || !owns(owner, session.identity))) throw new Error(denied)
  supportsResume = supportsResume && session.mode === 'global'
  const saved = supportsResume ? session.resumeState : undefined
  if (saved && saved.schemaVersion !== checkpointVersion) throw new Error('Unsupported MiniMax Code checkpoint version.')
  let checkpoint = saved ? validateModel(contract, 'nativeSession', saved.data) : undefined
  const disposed = new AbortController()
  let running
  return {
    async run(input, run) {
      if (!owns(session.identity, run.identity) || run.mode !== session.mode || run.identity.agentId !== session.identity.agentId
        || run.identity.sessionId !== session.identity.sessionId) throw new Error(denied)
      if (running) throw new Error('MiniMax Code is already running in this session.')
      running = runTurn(input, run)
      try { return await running }
      finally { running = undefined }
    },
    async checkpoint() {
      if (!checkpoint) throw new Error('No completed MiniMax Code turn is available for checkpointing.')
      return { schemaVersion: checkpointVersion, data: checkpoint }
    },
    async dispose() {
      disposed.abort()
      await running?.catch(() => {})
    },
  }

  async function runTurn(input, run) {
    if (run.mode === 'global' && (run.model?.model && run.model.model !== nativeDefault || run.model?.reasoningEffort)) {
      throw new Error('Choose the MiniMax Code native default model. Configure the model and effort in the CLI.')
    }
    const remaining = run.deadlineAt - Date.now()
    if (remaining <= 0) throw new Error('MiniMax Code turn timed out.')
    const deadline = AbortSignal.timeout(remaining)
    const signal = AbortSignal.any([run.signal, session.signal, disposed.signal, deadline])
    signal.throwIfAborted()
    const engine = await selectEngine(signal)
    if (!engine) throw new Error('Install MiniMax Code on the Studio host.')
    const env = childEnvironment()
    const cwd = await realpath(run.paths.workspaceDir)
    let scoped
    try {
      if (run.mode === 'scoped') {
        scoped = await createScopedEnvironment({ model: run.model, runtimeDir: run.paths.runtimeDir, env, signal,
          nativeResources: owns(owner, run.identity) ? env.MINIMAX_DATA_DIR : undefined })
      }
      return await runAcp(input, run, engine, cwd, scoped?.env ?? env, signal, deadline)
    } finally {
      await scoped?.dispose()
    }
  }

  async function runAcp(input, run, engine, cwd, env, signal, deadline) {
    const identity = run.identity
    const binding = createHash('sha256').update(JSON.stringify([
      identity.userId, identity.profile, identity.agentId, identity.sessionId, run.mode, cwd, env.MINIMAX_DATA_DIR,
    ])).digest('hex')
    if (checkpoint && checkpoint.binding !== binding) throw new Error('MiniMax Code checkpoint belongs to another conversation, workspace or native data directory.')
    signal.throwIfAborted()

    const turn = turnOutput(run)
    let nativeId
    let canCloseSession = false
    let prompting = false
    let updates = Promise.resolve()
    let updateError
    const interruption = Promise.withResolvers()
    const cancelUpdates = new AbortController()
    const activeSignal = AbortSignal.any([signal, cancelUpdates.signal])
    const acp = new Acp(engine.executable, [...engine.prefix, 'acp'], { cwd, env }, ({ id, method, params }) => {
      const current = prompting && params?.sessionId === nativeId
      if (id !== undefined) {
        if (method !== 'session/request_permission') {
          acp.methodNotFound(id)
        } else if (!current) {
          acp.respond(id, cancelled)
        } else {
          void requestPermission(params, run, activeSignal)
            .then(response => acp.respond(id, activeSignal.aborted ? cancelled : response))
            .catch(() => {})
        }
      } else if (current && method === 'session/update') {
        updates = updates.then(async () => {
          if (!activeSignal.aborted && !updateError) await turn.update(params.update)
        }).catch(error => { updateError = error })
      }
    })
    function cancel() {
      interruption.resolve()
      if (nativeId && prompting) acp.notify('session/cancel', { sessionId: nativeId })
      void acp.close({ cancel: prompting })
    }
    signal.addEventListener('abort', cancel, { once: true })
    try {
      run.lifecycle.add(() => acp.close())
      const startup = AbortSignal.any([signal, AbortSignal.timeout(20_000)])
      const hello = await initialize(acp, startup)
      const capabilities = hello.agentCapabilities
      const mcpServers = toAcpMcp(run.mcpServers ?? {}, capabilities?.mcpCapabilities)
      const prompt = await buildPrompt(input, run, signal, capabilities?.promptCapabilities, Boolean(checkpoint))
      let controls
      if (checkpoint) {
        if (!capabilities?.loadSession) throw new Error('MiniMax Code did not advertise session loading.')
        nativeId = checkpoint.nativeId
        controls = await acp.request('session/load', { sessionId: nativeId, cwd, mcpServers }, startup)
      } else {
        controls = await acp.request('session/new', { cwd, mcpServers }, startup)
        nativeId = controls?.sessionId
        if (!validId(nativeId)) throw new Error('MiniMax Code did not return a valid session ID.')
      }
      canCloseSession = Boolean(capabilities?.sessionCapabilities?.close)
      if (controls?.configOptions?.find(option => option.id === 'permissionMode')?.currentValue !== 'default') {
        throw new Error('Select Ask in MiniMax Code’s native /permission menu before using Studio.')
      }
      if (run.mode === 'scoped' && !scopedModelSelected(controls, run.model.model)) {
        throw new Error('MiniMax Code did not select the bound Studio model.')
      }
      prompting = true
      const response = await acp.request('session/prompt', { sessionId: nativeId, prompt }, signal)
      prompting = false
      await Promise.race([updates, interruption.promise])
      signal.throwIfAborted()
      if (updateError) throw updateError
      await Promise.race([turn.finish(), interruption.promise])
      signal.throwIfAborted()
      if (response?.stopReason === 'cancelled') throw new Error('MiniMax Code cancelled the prompt.')
      const finishReason = finishReasons.get(response?.stopReason)
      if (!finishReason) throw new Error('MiniMax Code returned an unsupported stop reason.')
      if (supportsResume) checkpoint = validateModel(contract, 'nativeSession', { nativeId, binding })
      return { content: [text(turn.answer)], finishReason }
    } catch (error) {
      if (signal.aborted) throw new Error(deadline.aborted ? 'MiniMax Code turn timed out.' : 'MiniMax Code turn cancelled.')
      if (error instanceof AcpError && error.code === -32000) {
        throw new Error(run.mode === 'scoped' ? 'MiniMax Code could not use the selected Studio model.' : signIn)
      }
      if (error?.name === 'TimeoutError') throw new Error('MiniMax Code ACP startup timed out.')
      throw error
    } finally {
      cancelUpdates.abort()
      signal.removeEventListener('abort', cancel)
      if (!signal.aborted && canCloseSession && validId(nativeId)) {
        const closeSignal = AbortSignal.any([signal, AbortSignal.timeout(500)])
        await acp.request('session/close', { sessionId: nativeId }, closeSignal).catch(() => {})
      }
      await acp.close()
    }
  }
}

function modelCatalog(status, message) {
  const models = status === 'ready' ? [{ id: nativeDefault, name: 'MiniMax Code default', isDefault: true }] : []
  return { status, source: 'mcode', scope: 'configured', models, ...(message ? { message } : {}) }
}

async function detectModel(run, selectEngine) {
  let acp
  const deadline = AbortSignal.timeout(8_000)
  const signal = AbortSignal.any([deadline, run.signal])
  try {
    signal.throwIfAborted()
    const engine = await selectEngine(signal)
    if (!engine) return modelCatalog('not_installed', 'Install MiniMax Code on the Studio host.')
    const env = childEnvironment()
    signal.throwIfAborted()
    acp = new Acp(engine.executable, [...engine.prefix, 'acp'], { cwd: tmpdir(), env }, ({ id }) => {
      if (id !== undefined) acp.methodNotFound(id)
    })
    run.lifecycle.add(() => acp.close())
    const hello = await initialize(acp, signal)
    const authMethod = hello.authMethods?.find(method => method.type === 'terminal' && method.id === 'minimax-code-login')
    if (!authMethod) return modelCatalog('unsupported', 'The CLI did not advertise the MiniMax Code authentication check.')
    // This ACP method checks existing credentials. Interactive sign-in stays in the native terminal.
    await acp.request('authenticate', { methodId: authMethod.id }, signal)
    return modelCatalog('ready')
  } catch (error) {
    if (run.signal.aborted) throw run.signal.reason
    if (deadline.aborted) return modelCatalog('timeout', 'MiniMax Code authentication check timed out.')
    if (error instanceof AcpError && error.code === -32000) return modelCatalog('auth_required', signIn)
    return modelCatalog('error', 'Could not check MiniMax Code authentication.')
  } finally {
    await acp?.close()
  }
}

export function apply(ctx) {
  const { userId, profile } = ctx.identity
  const owner = { userId, profile }
  const executableKey = 'external-executable'
  const configuredExecutable = async () => validateModel(contract, 'externalExecutable', await ctx.state.plugin.get(executableKey) ?? '')
  const manager = managedEngine(ctx.paths.dataDir, configuredExecutable)
  const selectEngine = async signal => (await manager.resolve(signal)).engine
  const requireOwner = run => {
    if (!owns(owner, run.identity)) throw new Error(denied)
  }
  const rpc = Object.entries({
    'list-skills': 'listSkills', 'get-skill': 'getSkill', 'save-skill': 'saveSkill', 'edit-skill': 'editSkill', 'remove-skill': 'removeSkill',
    'list-mcp': 'listMcp', 'save-mcp': 'saveMcp', 'remove-mcp': 'removeMcp',
    'get-settings': 'getSettings', 'save-settings': 'saveSettings',
    'get-settings-editor': 'getSettingsEditor', 'save-settings-editor': 'saveSettingsEditor',
  }).map(([name, method]) => registerRpc(ctx, contract, name, async (input, run) => {
    requireOwner(run)
    run.signal.throwIfAborted()
    const dataDir = childEnvironment().MINIMAX_DATA_DIR
    const settings = nativeConfiguration(dataDir)
    if (method === 'saveSettingsEditor') {
      const { executable, ...native } = input
      const path = executable.trim()
      if (path) executableCandidates({ EKKO_MINIMAX_CODE_EXECUTABLE: path }, '', process.platform)
      const previous = await configuredExecutable()
      const result = await settings.saveSettingsEditor(native)
      if (path !== previous) await ctx.state.plugin.set(executableKey, path)
      return result
    }
    const result = await settings[method](input)
    if (method !== 'getSettings' && method !== 'getSettingsEditor') return result
    const engine = await selectEngine(run.signal).catch(() => undefined)
    run.signal.throwIfAborted()
    const loginCommand = engineLoginCommand(engine, dataDir)
    if (method === 'getSettings') return { ...result, loginCommand }
    return { ...result, loginCommand, status: await manager.status(run.signal), executable: await configuredExecutable() }
  }))
  const registration = ctx.extensions.agents.register({
    id: manifest.id, name: manifest.name, vendor: 'MiniMax', description: manifest.description, agentApiVersion: 1,
    getStatus: run => owns(owner, run.identity) ? manager.status(run.signal) : Promise.resolve({ installed: false, version: '', error: denied }),
    management: {
      installGuideUrl: manifest.documentation,
      settings(run) { requireOwner(run); return { viewId: 'skills' } },
      checkUpdate(run) { requireOwner(run); return manager.checkUpdate(run) },
      upgrade(input, run) { requireOwner(run); return manager.upgrade(input, run) },
      remove(run) { requireOwner(run); return manager.remove(run) },
    },
    modes: {
      global: { listModels: run => owns(owner, run.identity) ? detectModel(run, selectEngine) : Promise.resolve(modelCatalog('error', denied)) },
      scoped: { protocols: scopedProtocols },
    },
    features: { surfaces: ['chat'], streaming: true, resume: false },
    runtime: { createSession: session => createMiniMaxSession(owner, session, false, selectEngine) },
  })
  return async () => {
    await Promise.all([registration.dispose(), ...rpc.map(dispose => dispose())])
  }
}
