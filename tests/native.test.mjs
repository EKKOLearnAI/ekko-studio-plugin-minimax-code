import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { apply, createMiniMaxSession } from '../server.mjs'
import { childEnvironment, findEngine } from '../engine.mjs'
import { definitionOf, message, owner, request, setup } from './fixtures/host.mjs'

const exec = promisify(execFile)
const cli = process.env.EKKO_MINIMAX_NATIVE_TEST_CLI
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGMQVnD4jw8zjAwFAFlJXIGMqkDaAAAAAElFTkSuQmCC', 'base64')

test('official CLI checks an empty profile, streams text and attachments, and restores the same native session in a new process', {
  skip: !cli && 'set EKKO_MINIMAX_NATIVE_TEST_CLI to an external mcode executable',
  timeout: 70_000,
}, async t => {
  const { data, paths, run, session, events } = await setup(t, { cli })
  const { definition, release } = definitionOf(apply)
  t.after(release)
  const status = await definition.getStatus(run)
  assert.ok(status.installed && status.version, JSON.stringify(status))
  t.diagnostic(`MiniMax Code CLI ${status.version}`)
  assert.equal((await definition.modes.global.listModels(run)).status, 'auth_required')
  await writeFile(join(data, 'config.yaml'), 'permissionMode: default\n', { mode: 0o600 })

  const model = 'studio-mcode-local'
  const credential = 'isolated-test-key'
  const requests = []
  const server = createServer(async (req, res) => {
    if (req.url?.split('?')[0] !== '/v1/chat/completions' || req.headers.authorization !== `Bearer ${credential}`) {
      res.writeHead(404).end()
      return
    }
    let data = ''
    for await (const chunk of req) data += chunk
    const body = JSON.parse(data)
    requests.push(body)
    const content = JSON.stringify(body.messages).includes('second-native-marker') ? 'second native answer' : 'first native answer'
    const common = { id: 'completion-local', created: 1, model }
    const usage = { prompt_tokens: 20, completion_tokens: 3, total_tokens: 23 }
    if (!body.stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ...common, usage, object: 'chat.completion', choices: [
        { index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' },
      ] }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    const write = choice => res.write(`data: ${JSON.stringify({ ...common, object: 'chat.completion.chunk', choices: [{ index: 0, ...choice }] })}\n\n`)
    write({ delta: { role: 'assistant', content }, finish_reason: null })
    write({ delta: {}, finish_reason: 'stop' })
    res.end('data: [DONE]\n\n')
  }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  const baseUrl = `http://127.0.0.1:${server.address().port}/v1`
  const engine = await findEngine()
  await exec(engine.executable, [...engine.prefix, 'provider', 'add', '--name', 'Local Test', '--base-url', baseUrl,
    '--api-format', 'openai-completions', '--model', model, '--api-key-env', 'MCODE_TEST_KEY', '--support-image', '--use'], {
    cwd: paths.workspaceDir, env: { ...childEnvironment(), MCODE_TEST_KEY: credential }, timeout: 15_000,
  })
  assert.equal((await definition.modes.global.listModels(run)).status, 'ready')
  requests.length = 0

  const filePath = join(paths.workspaceDir, 'fixture file.txt')
  await writeFile(filePath, 'example file')
  run.attachments = {
    resolve: async id => id === 'file'
      ? { name: 'fixture file.txt', localPath: filePath, mediaType: 'text/plain', size: 12 }
      : { name: 'fixture.png', mediaType: 'image/png', size: png.length },
    read: async () => png,
  }
  const first = createMiniMaxSession(owner, session, true)
  t.after(() => first.dispose())
  const firstRequest = request('first-native-marker')
  firstRequest.input.push({ type: 'file', assetId: 'file' }, { type: 'image', assetId: 'image' })
  assert.deepEqual(await first.run(firstRequest, { ...run, deadlineAt: Date.now() + 25_000 }), {
    content: [message('first native answer')], finishReason: 'stop',
  })
  const saved = JSON.parse(JSON.stringify(await first.checkpoint()))
  assert.ok(saved.data.nativeId)
  await first.dispose()
  assert.ok(requests.length > 0)
  assert.ok(requests.some(({ messages }) => JSON.stringify(messages).includes('fixture%20file.txt')), 'the model received the resource link')
  assert.ok(requests.some(({ messages }) => messages.some(message =>
    Array.isArray(message.content) && message.content.some(part => /^data:image\/(?:png|jpeg|webp);base64,/.test(part.image_url?.url)))),
  'the model received inline image data')

  events.length = 0
  requests.length = 0
  const second = createMiniMaxSession(owner, { ...session, resumeState: saved }, true)
  t.after(() => second.dispose())
  const secondRequest = request('second-native-marker')
  secondRequest.history.push({ role: 'user', content: [message('first-native-marker')] })
  assert.deepEqual(await second.run(secondRequest, { ...run, deadlineAt: Date.now() + 25_000 }), {
    content: [message('second native answer')], finishReason: 'stop',
  })
  assert.deepEqual(await second.checkpoint(), saved)
  assert.equal(events.filter(event => event.type === 'text.delta').map(event => event.text).join(''), 'second native answer')
  const resumedTurn = requests.find(({ messages }) => JSON.stringify(messages).includes('second-native-marker'))
  assert.ok(resumedTurn, 'the model received the resumed chat turn')
  const resumedMessages = JSON.stringify(resumedTurn.messages)
  assert.equal([...resumedMessages.matchAll(/first-native-marker/g)].length, 1)
  assert.match(resumedMessages, /first native answer/)
})

test('scoped mode uses the selected Studio model through a private relay without native login', {
  skip: !cli && 'set EKKO_MINIMAX_NATIVE_TEST_CLI to an external mcode executable',
  timeout: 45000,
}, async t => {
  const { data, session, run } = await setup(t, { cli })
  const model = 'studio-scope/model'
  const token = 'fixture-studio-lease'
  let promptReceived = false
  const endpoint = createServer(async (req, res) => {
    const parts = []
    for await (const chunk of req) parts.push(chunk)
    const body = JSON.parse(Buffer.concat(parts).toString())
    assert.equal(req.url, '/studio/v1/chat/completions')
    assert.equal(req.headers.authorization, `Bearer ${token}`)
    assert.equal(body.model, model)
    promptReceived ||= JSON.stringify(body.messages).includes('scoped-turn-marker')
    const base = { id: 'scoped-test', created: 1, model, object: 'chat.completion.chunk' }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: 'scoped answer' }, finish_reason: null }] })}\n\n`)
    res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`)
    res.end('data: [DONE]\n\n')
  }).listen(0, '127.0.0.1')
  await once(endpoint, 'listening')
  t.after(() => new Promise(resolve => { endpoint.close(resolve); endpoint.closeAllConnections() }))
  await writeFile(join(data, 'config.yaml'), 'defaultModel: unrelated/model\npermissionMode: full-access\n')
  const { definition, release } = definitionOf(apply)
  t.after(release)
  const identity = { ...session.identity, profile: 'scoped-other-profile' }
  const scoped = definition.runtime.createSession({ ...session, identity, mode: 'scoped' })
  t.after(() => scoped.dispose())
  assert.deepEqual(await scoped.run(request('scoped-turn-marker'), {
    ...run, identity, mode: 'scoped', deadlineAt: Date.now() + 35000, model: {
      model, provider: 'fixture', token, apiMode: 'chat_completions', contextWindow: 32000, outputLimit: 1000,
      baseUrl: `http://127.0.0.1:${endpoint.address().port}/studio/v1`,
    },
  }), { content: [message('scoped answer')], finishReason: 'stop' })
  assert.ok(promptReceived)
  const { readFile, readdir } = await import('node:fs/promises')
  assert.match(await readFile(join(data, 'config.yaml'), 'utf8'), /unrelated\/model/)
  assert.equal((await readdir(run.paths.runtimeDir)).filter(name => name.startsWith('mcode-scoped-')).length, 0)
})

test('official CLI executes a shell command without a Studio approval in both modes', {
  skip: !cli && 'set EKKO_MINIMAX_NATIVE_TEST_CLI to an external mcode executable',
  timeout: 60000,
}, async t => {
  const { data, paths, run, session } = await setup(t, { cli })
  const { readFile, unlink } = await import('node:fs/promises')
  const model = 'studio-terminal-model'
  const token = 'isolated-terminal-token'
  const marker = 'shell-command-proof.txt'
  let prompts = 0
  let toolResults = 0
  const endpoint = createServer(async (req, res) => {
    if (req.url !== '/v1/chat/completions' || req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(404).end()
      return
    }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())
    const afterTool = body.messages.some(message => message.role === 'tool' && message.tool_call_id === 'call_shell')
    if (afterTool) toolResults++
    const base = { id: 'terminal-test', created: 1, model, object: 'chat.completion.chunk' }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    const write = choice => res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, ...choice }] })}\n\n`)
    if (afterTool) {
      write({ delta: { role: 'assistant', content: 'command completed' }, finish_reason: null })
      write({ delta: {}, finish_reason: 'stop' })
    } else {
      write({ delta: { role: 'assistant', tool_calls: [{
        index: 0, id: 'call_shell', type: 'function',
        function: { name: 'bash', arguments: JSON.stringify({ command: `echo studio-terminal-ok > ${marker}` }) },
      }] }, finish_reason: null })
      write({ delta: {}, finish_reason: 'tool_calls' })
    }
    res.end('data: [DONE]\n\n')
  }).listen(0, '127.0.0.1')
  await once(endpoint, 'listening')
  t.after(() => new Promise(resolve => { endpoint.close(resolve); endpoint.closeAllConnections() }))
  const baseUrl = `http://127.0.0.1:${endpoint.address().port}/v1`
  await writeFile(join(data, 'config.yaml'), JSON.stringify({
    permissionMode: 'default', dataContribution: { enabled: false }, defaultModel: `custom_provider:local/${model}`,
    custom_provider: { local: {
      name: 'Local Test', kind: 'custom', enabled: true, api: 'openai-completions',
      options: { apiKey: token, baseURL: baseUrl, authMode: 'api-key' }, models: { [model]: {} },
    } },
  }), { mode: 0o600 })
  for (const mode of ['global', 'scoped']) {
    const engine = createMiniMaxSession(owner, { ...session, mode })
    try {
      const binding = mode === 'global' ? run.model : {
        model, provider: 'fixture', token, apiMode: 'chat_completions', contextWindow: 32000, outputLimit: 1000, baseUrl,
      }
      const interactions = { approve: async () => { prompts++; return { outcome: 'denied' } } }
      const result = await engine.run(request('Run the shell command specified by the test model.'), {
        ...run, mode, model: binding, interactions, deadlineAt: Date.now() + 27_000,
      })
      assert.deepEqual(result, { content: [message('command completed')], finishReason: 'stop' }, mode)
      const file = join(paths.workspaceDir, marker)
      assert.equal((await readFile(file, 'utf8')).trim(), 'studio-terminal-ok', mode)
      await unlink(file)
    } finally {
      await engine.dispose()
    }
  }
  assert.ok(toolResults >= 2)
  assert.equal(prompts, 0)
})
