import assert from 'node:assert/strict'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply } from '../server.mjs'
import { definitionOf, owner, setup } from './fixtures/host.mjs'

function calls(run, rpc) {
  return (name, body = {}) => rpc.get(name)(body, run)
}

test('edits native Skill documents without replacing linked folders or companion files', async t => {
  const { data, run } = await setup(t)
  const { definition, rpc, release } = definitionOf(apply)
  t.after(release)
  assert.deepEqual(definition.management.settings(run), { viewId: 'skills' })
  const call = calls(run, rpc)
  const nativeSkills = join(data, 'skills')
  const markdown = '---\nname: review\ndescription: >-\n  Review changes.\nmetadata:\n  owner: example\n---\n\n# Review\n'
  const blank = { name: 'review', markdown, revision: '', enabled: true }
  await call('save-skill', blank)
  const folder = join(nativeSkills, 'review')
  const companion = join(folder, 'notes.txt')
  await writeFile(companion, 'keep')
  assert.deepEqual((await call('list-skills')).items, [
    { name: 'review', enabled: true, description: 'Review changes.', readOnly: false },
  ])
  const first = await call('get-skill', { name: 'review' })
  const disabled = markdown + '\nUse the checklist.'
  await call('save-skill', { ...first, markdown: disabled, enabled: false })
  await assert.rejects(readFile(join(folder, 'SKILL.md')), { code: 'ENOENT' })
  assert.equal(await readFile(join(folder, 'SKILL.md.studio-disabled'), 'utf8'), disabled)
  await assert.rejects(call('save-skill', first), /changed/)
  const edited = await call('get-skill', { name: 'review' })
  await call('save-skill', { ...edited, enabled: true })
  assert.equal(await readFile(join(folder, 'SKILL.md'), 'utf8'), disabled)
  const restored = await call('get-skill', { name: 'review' })
  await call('remove-skill', { name: restored.name, revision: restored.revision })
  assert.equal(await readFile(companion, 'utf8'), 'keep')
  assert.deepEqual((await call('list-skills')).items, [])
  const outside = join(data, 'external')
  await mkdir(outside)
  await writeFile(join(outside, 'SKILL.md'), 'outside Studio')
  await symlink(outside, join(nativeSkills, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.equal((await call('list-skills')).items[0].readOnly, true)
  await assert.rejects(call('get-skill', { name: 'linked' }), /outside/)
  await assert.rejects(call('get-skill', { name: '../escape' }), /lowercase/)
  await assert.rejects(calls({ ...run, identity: { ...owner, profile: 'other' } }, rpc)('list-skills'), /available only/)
})

test('edits native MCP JSON with revision checks, masked credentials and other entries preserved', async t => {
  const { data, run } = await setup(t)
  const { rpc, release } = definitionOf(apply)
  t.after(release)
  const call = calls(run, rpc)
  const path = join(data, 'mcp.json')
  const doc = { metadata: { retain: true }, mcpServers: {
    docs: { type: 'http', url: 'https://example.test/mcp?apiKey=private-url', headers: { Authorization: 'private-header' }, timeout: 30 },
    local: { command: 'node', args: ['bridge.js'], env: { KEY: 'private-value' } },
  } }
  await writeFile(path, JSON.stringify(doc))
  const list = await call('list-mcp')
  assert.ok(!JSON.stringify(list).includes('private-'))
  const [docs, local] = list.items
  await Promise.all([
    call('save-mcp', { ...docs, enabled: false, config: { ...docs.config, timeout: 60 } }),
    call('save-mcp', { ...local, config: { ...local.config, args: ['new-bridge.js'] } }),
  ])
  const saved = JSON.parse(await readFile(path, 'utf8'))
  assert.deepEqual(saved, { metadata: doc.metadata, mcpServers: {
    docs: { ...doc.mcpServers.docs, enabled: false, timeout: 60 },
    local: { ...doc.mcpServers.local, enabled: true, args: ['new-bridge.js'] },
  } })
  await assert.rejects(call('remove-mcp', { name: 'docs', revision: docs.revision }), /changed/)
  const { revision } = (await call('list-mcp')).items[0]
  await call('remove-mcp', { name: 'docs', revision })
  assert.deepEqual((await call('list-mcp')).items.map(item => item.name), ['local'])
  await assert.rejects(call('save-mcp', { name: 'bad', enabled: true, revision: '', config: { url: 'file:///tmp/test' } }), /HTTP/)
})

test('patches native defaults while retaining provider settings and comments', async t => {
  const { data, run } = await setup(t)
  const { rpc, release } = definitionOf(apply)
  t.after(release)
  const call = calls(run, rpc)
  const { revision: emptyRevision } = await call('get-settings')
  await call('save-settings', { revision: emptyRevision, defaultModel: '', externalSkills: true, walkUp: false, setAsk: false })
  const path = join(data, 'config.yaml')
  assert.match(await readFile(path, 'utf8'), /walkUp: false/)
  await writeFile(path, '# native comment\ncustom_provider:\n  demo:\n    credential: private-value\nskills:\n  external:\n    duplicateWarn: false # keep this\n')
  const before = await call('get-settings')
  assert.ok(!JSON.stringify(before).includes('private-value'))
  assert.match(before.loginCommand, /MINIMAX_DATA_DIR.*login/)
  await call('save-settings', { revision: before.revision, defaultModel: 'demo/model', externalSkills: false, walkUp: true, setAsk: true })
  const raw = await readFile(path, 'utf8')
  for (const expected of ['# native comment', 'credential: private-value', 'duplicateWarn: false # keep this', 'permissionMode: default']) assert.ok(raw.includes(expected), raw)
  assert.equal((await call('get-settings')).defaultModel, 'demo/model')
  await assert.rejects(call('save-settings', { revision: before.revision, defaultModel: '', externalSkills: true, walkUp: true, setAsk: false }), /changed/)
})

test('the OMP-style editors preserve Skill frontmatter and mask native provider credentials', async t => {
  const { data, run } = await setup(t)
  const { rpc, release } = definitionOf(apply)
  t.after(release)
  const call = calls(run, rpc)
  const original = '---\nname: review\ndescription: Before\nmetadata:\n  owner: original # Keep\n---\n\nOld body\n'
  await call('save-skill', { name: 'review', markdown: original, enabled: true, revision: '' })
  const skill = await call('get-skill', { name: 'review' })
  await call('edit-skill', { name: skill.name, description: 'After', content: '    Indented content', enabled: true, revision: skill.revision })
  const { markdown } = await call('get-skill', { name: 'review' })
  for (const expected of ['description: After', 'owner: original # Keep', '\n    Indented content']) assert.ok(markdown.includes(expected))
  const path = join(data, 'config.yaml')
  await writeFile(path, 'unrelated: retained\ncustom_provider:\n  provider:\n    options:\n      apiKey: hidden-test-key\nskills:\n  external:\n    walkUp: true # Keep\n')
  const { models, config, defaultModel, executable, revision } = await call('get-settings-editor')
  assert.equal(models.custom_provider.provider.options.apiKey, '••••••••')
  assert.equal(config.skills.external.walkUp, true)
  await call('save-settings-editor', { models, config: { ...config, permissionMode: 'default',
    skills: { external: { walkUp: false } } }, defaultModel, executable, revision })
  const saved = await readFile(path, 'utf8')
  for (const expected of ['unrelated: retained', 'apiKey: hidden-test-key', 'walkUp: false # Keep', 'permissionMode: default']) assert.ok(saved.includes(expected), saved)
  const current = await call('get-settings-editor')
  await assert.rejects(call('save-settings-editor', { models, config, defaultModel, executable: '../mcode', revision: current.revision }), /absolute/)
})
