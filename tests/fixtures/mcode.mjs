import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

if (process.argv[2] === '--version') {
  console.log('0.7.2')
  process.exit(0)
}
if (process.argv[2] !== 'acp') process.exit(1)

const data = process.env.MINIMAX_DATA_DIR
const log = join(data, 'trace.jsonl')
const config = JSON.parse(readFileSync(join(data, 'fixture.json'), 'utf8'))
const nativeId = 'native-session-a'
let promptId
let activeId
const trace = record => appendFileSync(log, JSON.stringify(record) + '\n')
const send = message => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n')
const update = (value, sessionId = activeId) => send({ method: 'session/update', params: { sessionId, update: value } })
const reply = (id, result) => send({ id, result })
const authError = id => send({ id, error: { code: -32000, message: 'secret-error-payload' } })
const controls = { configOptions: [{ id: 'permissionMode', currentValue: config.mode ?? 'default' }] }
trace({ operation: 'spawn', cwd: process.cwd(), inheritedCredential: !!process.env.STUDIO_ADMIN_TOKEN })

for await (const line of createInterface({ input: process.stdin })) {
  const frame = JSON.parse(line)
  trace(frame)
  const { id, method, params } = frame
  if (method === 'initialize') {
    reply(id, {
      protocolVersion: 1, agentInfo: { name: 'minimax-code' },
      authMethods: [{ type: 'terminal', id: 'minimax-code-login' }],
      agentCapabilities: {
        loadSession: true, mcpCapabilities: { http: true, sse: true },
        promptCapabilities: { image: true }, sessionCapabilities: { close: {} },
      },
    })
  } else if (method === 'authenticate') {
    if (config.login === false) authError(id)
    else reply(id, {})
  } else if (method === 'session/new') {
    if (config.login === false) authError(id)
    else {
      appendFileSync(join(data, 'persisted'), '')
      reply(id, { sessionId: nativeId, ...controls })
    }
  } else if (method === 'session/load') {
    if (params.sessionId !== nativeId || !existsSync(join(data, 'persisted'))) process.exit(2)
    activeId = nativeId
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'old reply' } })
    reply(id, controls)
  } else if (method === 'session/prompt') {
    activeId = params.sessionId
    promptId = id
    if (config.wait) continue
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'wrong session' } }, 'other')
    update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'thinking' } })
    const tool = { toolCallId: 'tool-A', kind: 'execute', name: config.nativeShell ? 'bash' : 'mcp__fixture__execute',
      title: 'Authorization: Bearer token-title',
      rawInput: { command: 'printf ok API_KEY="token command"' } }
    update({ sessionUpdate: 'tool_call', ...tool, status: 'pending' })
    send({ id: 'wrong', method: 'session/request_permission', params: { sessionId: 'other', toolCall: tool, options: [] } })
    const approvalOptions = [
      { optionId: 'forever', kind: 'allow_always' }, { optionId: 'yes', kind: 'allow_once' }, { optionId: 'no', kind: 'reject_once' },
    ]
    const questionOptions = [
      { optionId: 'questionnaire:q:first', name: 'First choice', kind: 'allow_once' },
      { optionId: 'questionnaire:q:second', name: 'Second choice', kind: 'allow_once' },
      { optionId: 'questionnaire:q:cancel', name: 'Cancel', kind: 'reject_once' },
    ]
    send({ id: 'ask', method: 'session/request_permission', params: {
      sessionId: activeId,
      toolCall: config.question ? { toolCallId: 'q', kind: 'other', title: 'Which choice?' } : tool,
      options: config.question ? questionOptions : approvalOptions,
    } })
  } else if (id === 'ask') {
    const allowed = frame.result.outcome.optionId === 'yes'
    update({ sessionUpdate: 'tool_call_update', toolCallId: 'tool-A', status: allowed ? 'completed' : 'failed' })
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hello ' } })
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'world' } })
    reply(promptId, { stopReason: 'end_turn' })
  } else if (method === 'session/cancel') {
    reply(promptId, { stopReason: 'cancelled' })
    break
  } else if (method === 'session/close') {
    reply(id, {})
  }
}
