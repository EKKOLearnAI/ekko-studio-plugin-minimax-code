import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { apply, createMiniMaxSession } from '../server.mjs'
import { childEnvironment, executableCandidates } from '../engine.mjs'
import { definitionOf, message, nativeDefault, owner, request, setup } from './fixtures/host.mjs'

test('registration exposes global and scoped streaming chat and protects native account settings', async t => {
  const { session, run, identity } = await setup(t)
  const { definition, release, isDisposed } = definitionOf(apply)
  assert.equal(definition.id, 'minimax-code')
  assert.equal(definition.agentApiVersion, 1)
  assert.deepEqual(definition.features, { surfaces: ['chat'], streaming: true, resume: false })
  assert.deepEqual(Object.keys(definition.modes), ['global', 'scoped'])
  assert.deepEqual(definition.modes.scoped.protocols, ['chat_completions'])
  assert.match(definition.management.installGuideUrl, /^https:\/\//)
  assert.deepEqual(await definition.getStatus(run), { installed: true, version: '0.7.2', source: 'external' })
  const catalog = await definition.modes.global.listModels(run)
  assert.equal(catalog.status, 'ready')
  assert.deepEqual(catalog.models.map(model => model.id), [nativeDefault])
  const foreignProfile = { ...identity, profile: 'other' }
  assert.equal((await definition.getStatus({ ...run, identity: foreignProfile })).installed, false)
  assert.equal((await definition.modes.global.listModels({ ...run, identity: { ...identity, userId: 18 } })).status, 'error')
  assert.throws(() => definition.runtime.createSession({ ...session, identity: foreignProfile }), /available only/)
  const engine = definition.runtime.createSession(session)
  await assert.rejects(engine.run(request('hello'), { ...run, identity: { ...identity, sessionId: 'chat-b' } }), /available only/)
  await assert.rejects(engine.run(request('hello'), { ...run, model: { model: 'unadvertised' } }), /native default/)
  await engine.dispose()
  await release()
  assert.equal(isDisposed(), true)
})

test('missing executable and signed-out engine produce actionable status with no native error payload', async t => {
  const { root, run, session, trace } = await setup(t, { login: false })
  const { definition } = definitionOf(apply)
  assert.equal((await definition.modes.global.listModels(run)).status, 'auth_required')
  await assert.rejects(definition.runtime.createSession(session).run(request('hello'), run), error =>
    /mcode login/.test(error.message) && !error.message.includes('secret-error-payload'))
  assert.equal((await trace()).some(frame => frame.method === 'session/prompt'), false)
  process.env.EKKO_MINIMAX_CODE_EXECUTABLE = join(root, 'missing.mjs')
  assert.equal((await definition.getStatus(run)).source, 'not-installed')
  assert.equal((await definition.modes.global.listModels(run)).status, 'not_installed')
})

test('resolves workspaces, maps MCP transports and attachments, streams once, and forwards an explicit denial', async t => {
  const { paths, session, run, trace, events, approvals } = await setup(t)
  const engine = createMiniMaxSession(owner, session)
  const input = {
    input: [message('current'), { type: 'file', assetId: 'f' }, { type: 'image', assetId: 'i' }],
    instructions: [{ kind: 'workspace', text: 'Use the selected workspace' }],
    history: [{ role: 'assistant', content: [message('prior result')] }],
  }
  run.mcpServers = {
    local: { command: process.execPath, args: ['bridge.mjs'], env: { PORT: '1' } },
    remote: { type: 'http', url: 'https://example.test/mcp', headers: { Authorization: 'Bearer test-only' } },
    stream: { type: 'sse', url: 'https://example.test/sse' },
  }
  const filePath = join(paths.runtimeDir, 'file name.txt')
  run.attachments = {
    resolve: async id => id === 'f'
      ? { localPath: filePath, name: 'file name.txt', mediaType: 'text/plain', size: 3 }
      : { localPath: join(paths.runtimeDir, 'cat.png'), name: 'cat.png', mediaType: 'image/png', size: 3 },
    read: async id => { assert.equal(id, 'i'); return Buffer.from([1, 2, 3]) },
  }
  const result = await engine.run(input, run)
  assert.deepEqual(result, { content: [message('hello world')], finishReason: 'stop' })
  assert.deepEqual(events.map(e => e.type), ['reasoning.summary.delta', 'tool.started', 'tool.failed', 'text.delta', 'text.delta'])
  assert.equal(events.filter(e => e.type === 'text.delta').map(e => e.text).join(''), result.content[0].text)
  assert.equal(approvals.length, 1)
  for (const secret of ['token-title', 'token command']) assert.equal(JSON.stringify(approvals).includes(secret), false)
  const frames = await trace()
  assert.equal(frames[0].cwd, paths.workspaceDir)
  assert.equal(frames[0].inheritedCredential, false)
  const open = frames.find(f => f.method === 'session/new').params
  assert.equal(open.cwd, paths.workspaceDir)
  assert.deepEqual(open.mcpServers, [
    { name: 'local', command: process.execPath, args: ['bridge.mjs'], env: [{ name: 'PORT', value: '1' }] },
    { name: 'remote', type: 'http', url: 'https://example.test/mcp', headers: [{ name: 'Authorization', value: 'Bearer test-only' }] },
    { name: 'stream', type: 'sse', url: 'https://example.test/sse', headers: [] },
  ])
  const blocks = frames.find(f => f.method === 'session/prompt').params.prompt
  assert.ok(blocks.some(block => block.text === 'prior result'))
  assert.ok(blocks.some(block => block.text === '[workspace]\nUse the selected workspace'))
  assert.ok(blocks.some(block => block.type === 'resource_link' && block.uri === pathToFileURL(filePath).href))
  assert.ok(blocks.some(block => block.type === 'image' && block.data === 'AQID'))
  assert.deepEqual(frames.find(f => f.id === 'wrong').result.outcome, { outcome: 'cancelled' })
  assert.deepEqual(frames.find(f => f.id === 'ask').result.outcome, { outcome: 'selected', optionId: 'no' })
  assert.ok(frames.some(f => f.method === 'session/close'))
  await engine.dispose()
})

test('approval is once per request and a missing approval channel grants nothing', async t => {
  const { session, run, trace } = await setup(t)
  const engine = createMiniMaxSession(owner, session)
  run.interactions = { approve: async () => ({ outcome: 'approved' }) }
  await engine.run(request('one'), run)
  run.interactions = { approve: async () => { throw new Error('no approval channel') } }
  await engine.run(request('two'), run)
  assert.deepEqual((await trace()).filter(f => f.id === 'ask').map(f => f.result.outcome), [
    { outcome: 'selected', optionId: 'yes' }, { outcome: 'cancelled' },
  ])
})

test('the built-in shell receives one-time approval without calling Studio approvals', async t => {
  const { session, run, trace, events } = await setup(t, { nativeShell: true })
  let prompts = 0
  run.interactions = { approve: async () => { prompts++; return { outcome: 'denied' } } }
  await createMiniMaxSession(owner, session).run(request('shell'), run)
  const frames = await trace()
  assert.equal(prompts, 0)
  assert.deepEqual(frames.find(frame => frame.id === 'ask').result.outcome, { outcome: 'selected', optionId: 'yes' })
  assert.deepEqual(frames.find(frame => frame.id === 'wrong').result.outcome, { outcome: 'cancelled' })
  assert.ok(events.some(event => event.type === 'tool.completed'))
})

test('non-default native permission mode is rejected before submitting a prompt', async t => {
  const { session, run, trace } = await setup(t, { mode: 'bypassPermissions' })
  await assert.rejects(createMiniMaxSession(owner, session).run(request('blocked'), run), /Select Ask/)
  assert.equal((await trace()).some(f => f.method === 'session/prompt'), false)
})

test('invalid image input fails before opening a native session', async t => {
  const { session, run, trace } = await setup(t)
  run.attachments = { resolve: async () => ({ name: 'raw.tiff', mediaType: 'image/tiff', size: 10 }) }
  const input = { ...request('image'), input: [{ type: 'image', assetId: 'asset' }] }
  await assert.rejects(createMiniMaxSession(owner, session).run(input, run), /PNG, JPEG, WebP or GIF/)
  assert.equal((await trace()).some(f => f.method === 'session/new'), false)
})

for (const cancelBy of ['signal', 'deadline', 'dispose']) {
  test(`${cancelBy} sends ACP cancellation for the active native ID and releases the turn`, async t => {
    const { session, run, trace, waitForPrompt } = await setup(t, { wait: true })
    const engine = createMiniMaxSession(owner, session)
    const controller = new AbortController()
    const result = engine.run(request('wait'), {
      ...run, signal: controller.signal, deadlineAt: Date.now() + (cancelBy === 'deadline' ? 2_000 : 30_000),
    })
    const rejected = assert.rejects(result, cancelBy === 'deadline' ? /timed out/ : /cancelled/)
    await waitForPrompt()
    await assert.rejects(engine.run(request('concurrent turn'), run), /already running/)
    if (cancelBy === 'signal') controller.abort()
    if (cancelBy === 'dispose') await engine.dispose()
    await rejected
    assert.deepEqual((await trace()).find(f => f.method === 'session/cancel').params, { sessionId: 'native-session-a' })
  })
}

test('candidate native checkpoint restores once after engine restart, ignores replay, and rejects foreign bindings', async t => {
  const { paths, session, run, trace } = await setup(t)
  const first = createMiniMaxSession(owner, session, true)
  await first.run(request('first'), run)
  const saved = JSON.parse(JSON.stringify(await first.checkpoint()))
  await first.dispose()
  assert.throws(() => createMiniMaxSession(owner, { ...session, resumeState: { ...saved, schemaVersion: 2 } }, true), /checkpoint version/)
  const second = createMiniMaxSession(owner, { ...session, resumeState: saved }, true)
  const result = await second.run({ ...request('second'), history: [{ role: 'user', content: [message('first')] }] }, run)
  assert.deepEqual(result.content, [message('hello world')])
  assert.deepEqual(await second.checkpoint(), saved)
  const frames = await trace()
  assert.equal(frames.filter(f => f.operation === 'spawn').length, 2)
  assert.deepEqual(frames.find(f => f.method === 'session/load').params, { sessionId: saved.data.nativeId, cwd: paths.workspaceDir, mcpServers: [] })
  assert.deepEqual(frames.filter(f => f.method === 'session/prompt').at(-1).params.prompt, [message('second')])
  const other = { ...session, identity: { ...session.identity, sessionId: 'another' }, resumeState: saved }
  await assert.rejects(createMiniMaxSession(owner, other, true).run(request('different conversation'), {
    ...run, identity: other.identity,
  }), /checkpoint belongs to another/)
})

test('executable discovery keeps absolute paths and uses npm JavaScript entrypoints on Windows', () => {
  assert.deepEqual(executableCandidates({
    PATH: 'relative;C:\\Tools', APPDATA: 'C:\\Users\\tester\\AppData\\Roaming',
  }, 'C:\\Users\\tester', 'win32'), [
    'C:\\Tools\\mcode.exe',
    'C:\\Tools\\node_modules\\@minimax-ai\\code\\cli.js',
    'C:\\Users\\tester\\AppData\\Roaming\\npm\\mcode.exe',
    'C:\\Users\\tester\\AppData\\Roaming\\npm\\node_modules\\@minimax-ai\\code\\cli.js',
  ])
  assert.throws(() => executableCandidates({ EKKO_MINIMAX_CODE_EXECUTABLE: 'C:\\Tools\\mcode.cmd' }, '', 'win32'), /absolute CLI binary or JavaScript/)
  assert.deepEqual(childEnvironment({
    PATH: '.:/usr/bin', MAVIS_DATA_DIR: '/tmp/code-data', MINIMAX_API_KEY: 'secret', NODE_OPTIONS: '--require=unknown',
  }, '/home/tester', 'linux'), { PATH: '/usr/bin', MINIMAX_DATA_DIR: '/tmp/code-data' })
})

test('abort releases a turn even when an output consumer stops accepting updates', async t => {
  const { session, run } = await setup(t)
  const engine = createMiniMaxSession(owner, session)
  const controller = new AbortController()
  const started = Promise.withResolvers()
  run.output.emit = async event => {
    if (event.type === 'text.delta') {
      started.resolve()
      await new Promise(() => {})
    }
  }
  const turn = engine.run(request('wait on output'), { ...run, signal: controller.signal })
  const rejected = assert.rejects(turn, /turn cancelled/)
  await started.promise
  controller.abort()
  await rejected
})

test('a native questionnaire selects only the matching Studio answer', async t => {
  const { session, run, trace, approvals } = await setup(t, { question: true })
  const engine = createMiniMaxSession(owner, session)
  run.interactions.clarify = async item => {
    assert.deepEqual(item, { question: 'Which choice?', choices: ['First choice', 'Second choice'] })
    return { outcome: 'answered', text: 'Second choice' }
  }
  await engine.run(request('listen for question'), run)
  run.interactions.clarify = async () => ({ outcome: 'answered', text: 'unknown answer' })
  await engine.run(request('unrecognized answer'), run)
  assert.equal(approvals.length, 0)
  assert.deepEqual((await trace()).filter(frame => frame.id === 'ask').map(frame => frame.result.outcome), [
    { outcome: 'selected', optionId: 'questionnaire:q:second' }, { outcome: 'cancelled' },
  ])
})
