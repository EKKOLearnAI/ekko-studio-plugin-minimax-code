import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { isMap, parseDocument } from './vendor/yaml.mjs'

const fileLimit = 1024 * 1024
const disabledSkill = 'SKILL.md.studio-disabled'
const mask = '••••••••'
const reserved = new Set(['__proto__', 'constructor', 'prototype'])
const deviceName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const queue = new Map()
const own = (object, key) => Object.hasOwn(object, key) ? object[key] : undefined
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = value => createHash('sha256').update(value).digest('hex')
const skillName = name => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 64 && !deviceName.test(name) && !reserved.has(name)
const mcpName = name => /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(name) && !reserved.has(name)

async function inspect(path) {
  try { return await lstat(path) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}

async function readText(path) {
  const entry = await inspect(path)
  if (!entry) return undefined
  if (!entry.isFile() || entry.size > fileLimit) throw new Error('Configuration must be a regular file of at most 1 MiB.')
  return readFile(path, 'utf8')
}

async function atomicWrite(path, text, mode = 0o600) {
  if (Buffer.byteLength(text) > fileLimit) throw new Error('Configuration exceeds 1 MiB.')
  const temp = join(dirname(path), `.studio-${randomUUID()}.tmp`)
  try {
    await writeFile(temp, text, { mode, flag: 'wx' })
    await rename(temp, path)
  } finally { await rm(temp, { force: true }) }
}

function mutate(path, work) {
  const previous = queue.get(path) || Promise.resolve()
  const next = previous.catch(() => {}).then(work)
  queue.set(path, next)
  return next.finally(() => { if (queue.get(path) === next) queue.delete(path) })
}

function expectRevision(expected, current) {
  if (expected !== current) throw new Error('This configuration changed. Refresh it before editing.')
}

function parseYaml(text) {
  try {
    const document = parseDocument(text)
    if (!document.errors.length && (document.contents === null || isMap(document.contents))) {
      return { document, value: document.toJS({ maxAliasCount: 20 }) ?? {} }
    }
  } catch { /* Avoid returning fragments of configuration containing credentials. */ }
  throw new Error('Expected valid YAML containing a mapping.')
}

function skillMetadata(markdown, name) {
  const frontmatter = skillHeader(markdown)
  if (!frontmatter || frontmatter.index !== 0) throw new Error('SKILL.md requires YAML frontmatter with name and description.')
  const { value: metadata } = parseYaml(frontmatter[1])
  if (metadata.name !== name || typeof metadata.description !== 'string' || !metadata.description.trim()) {
    throw new Error('The frontmatter name must match the skill directory, and description is required.')
  }
  return metadata.description.trim()
}

function skillHeader(markdown) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m.exec(markdown)
  return match?.index === 0 ? match : undefined
}

async function skillFiles(directory, name) {
  const folder = join(directory, name)
  const entry = await inspect(folder)
  if (entry && !entry.isDirectory()) return { readOnly: true }
  const active = join(folder, 'SKILL.md')
  const disabled = join(folder, disabledSkill)
  const [a, d] = await Promise.all([inspect(active), inspect(disabled)])
  if (a && d || a && !a.isFile() || d && !d.isFile()) return { readOnly: true }
  return { folder, active, disabled, file: a ? active : d ? disabled : undefined, enabled: Boolean(a) }
}

async function readSkill(directory, name) {
  const files = await skillFiles(directory, name)
  if (files.readOnly) throw new Error('This Skill points outside the editable directory or has conflicting files.')
  if (!files.file) return { name, markdown: '', enabled: true, revision: '' }
  const markdown = await readText(files.file)
  if (markdown === undefined) throw new Error('This Skill changed. Refresh it before editing.')
  return { name, markdown, enabled: files.enabled, revision: hash(`${files.enabled}:\n${markdown}`) }
}

function validateMcp(config) {
  const type = config.type ?? (config.url === undefined ? 'stdio' : 'http')
  if (type === 'stdio') {
    if (typeof config.command !== 'string' || !config.command.trim() || config.url !== undefined) {
      throw new Error('A stdio server requires a command.')
    }
  } else {
    let url
    try { if (typeof config.url === 'string') url = new URL(config.url) } catch { /* Report a configuration error below. */ }
    if (!['http', 'streamable-http', 'sse'].includes(type) || !['http:', 'https:'].includes(url?.protocol) || config.command !== undefined) {
      throw new Error('An HTTP or SSE server requires an HTTP(S) URL.')
    }
  }
  if (config.args !== undefined && (!Array.isArray(config.args) || config.args.some(item => typeof item !== 'string'))) {
    throw new Error('MCP args must be a list of strings.')
  }
  for (const key of ['env', 'headers']) {
    if (config[key] !== undefined && (!record(config[key]) || Object.values(config[key]).some(value => typeof value !== 'string'))) {
      throw new Error(`MCP ${key} must be a mapping of strings.`)
    }
  }
  if (config.enabled !== undefined) throw new Error('Use the enabled switch for this server.')
}

function hideSecrets(value, key = '', all = false) {
  if (key === 'auth' && value !== undefined) return mask
  if (Array.isArray(value)) return value.map(item => hideSecrets(item, key, all))
  if (record(value)) return Object.fromEntries(Object.entries(value).map(([name, item]) =>
    [name, hideSecrets(item, name, all || key === 'env' || key === 'headers')]))
  if (typeof value !== 'string' || !value) return value
  if (all || /(?:authorization|cookie|password|secret|token|api[-_]?key|credential)/i.test(key)) return mask
  if (key === 'url') {
    try {
      const url = new URL(value)
      if (url.username || url.password || url.search || url.hash) return mask
    } catch { /* Invalid values may still be edited. */ }
  }
  return value
}

function restoreSecrets(value, previous) {
  if (value === mask) {
    if (previous === undefined) throw new Error('Replace the masked value with a new value.')
    return previous
  }
  if (Array.isArray(value)) return value.map((item, index) => restoreSecrets(item, previous?.[index]))
  if (record(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, restoreSecrets(item, record(previous) ? own(previous, key) : undefined)]))
  return value
}

async function readMcp(file) {
  const text = await readText(file)
  if (text === undefined) return { mcpServers: {} }
  try {
    const value = JSON.parse(text)
    if (record(value) && (value.mcpServers === undefined || record(value.mcpServers))) {
      return { ...value, mcpServers: value.mcpServers ?? {} }
    }
  } catch { /* Report a generic error without credentials. */ }
  throw new Error('The native mcp.json must contain a JSON object with an mcpServers mapping.')
}

function mcpRevision(value) {
  return value === undefined ? '' : hash(JSON.stringify(value))
}

function yamlSettings(raw) {
  return {
    defaultModel: typeof raw.defaultModel === 'string' ? raw.defaultModel : '',
    permissionMode: typeof raw.permissionMode === 'string' ? raw.permissionMode : '',
    externalSkills: raw.skills?.external?.enabled !== false,
    walkUp: raw.skills?.external?.walkUp !== false,
  }
}

const modelKeys = ['custom_provider', 'minimax_api']
const runtimeKeys = ['permissionMode', 'skills', 'dataContribution']

function contentsOf(value, keys) {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]))
}

function patchSettings(document, value, submitted, keys) {
  if (Object.keys(submitted).some(key => !keys.includes(key))) throw new Error('This editor does not support one of the configuration keys.')
  const update = (path, old, next) => {
    if (JSON.stringify(old) === JSON.stringify(next)) return
    if (record(old) && record(next) && isMap(document.getIn(path, true))) {
      for (const key of Object.keys(old)) if (!Object.hasOwn(next, key)) document.deleteIn([...path, key])
      for (const [key, child] of Object.entries(next)) update([...path, key], own(old, key), child)
    } else document.setIn(path, next)
  }
  for (const key of keys) {
    if (!Object.hasOwn(submitted, key)) {
      if (document.has(key)) document.delete(key)
      continue
    }
    update([key], value[key], restoreSecrets(submitted[key], value[key]))
  }
}

export function nativeConfiguration(dataDir) {
  const skillDir = join(dataDir, 'skills')
  const mcpFile = join(dataDir, 'mcp.json')
  const configFile = join(dataDir, 'config.yaml')

  async function checkSkillRoot() {
    const entry = await inspect(skillDir)
    if (entry && !entry.isDirectory()) throw new Error('The native Skill directory must be a local directory.')
    return Boolean(entry)
  }

  const api = {
    async listSkills() {
      const items = []
      if (await checkSkillRoot()) {
        for (const name of (await readdir(skillDir)).sort()) {
          if (!skillName(name)) continue
          const files = await skillFiles(skillDir, name)
          if (files.readOnly) {
            items.push({ name, enabled: false, description: '', readOnly: true })
          } else if (files.file) {
            let description = ''
            try {
              const markdown = await readText(files.file)
              description = skillMetadata(markdown || '', name).slice(0, 2000)
            } catch { /* Incomplete frontmatter remains editable. */ }
            items.push({ name, enabled: files.enabled, description, readOnly: false })
          }
        }
      }
      return { directory: skillDir, items }
    },
    async getSkill({ name }) {
      if (!skillName(name)) throw new Error('Use a lowercase Skill name with letters, numbers and hyphens.')
      await checkSkillRoot()
      return readSkill(skillDir, name)
    },
    async editSkill({ name, description, content, enabled, revision }) {
      const current = await api.getSkill({ name })
      expectRevision(revision, current.revision)
      if (!description.trim() || !content.trim()) throw new Error('A Skill requires a description and Markdown content.')
      const header = skillHeader(current.markdown)
      let frontmatter
      try { frontmatter = parseYaml(header?.[1] ?? '').document }
      catch { frontmatter = parseYaml('').document }
      frontmatter.set('name', name)
      frontmatter.set('description', description.trim())
      const yaml = frontmatter.toString({ lineWidth: 0, directives: false })
      const previousBody = header ? current.markdown.slice(header[0].length).replace(/^\r?\n/, '') : current.markdown
      const unchanged = current.markdown && (() => {
        try { return skillMetadata(current.markdown, name) === description.trim() && previousBody === content }
        catch { return false }
      })()
      return api.saveSkill({ name, enabled, revision, markdown: unchanged ? current.markdown : `---\n${yaml}---\n\n${content}` })
    },
    saveSkill({ name, markdown, enabled, revision }) {
      if (!skillName(name)) throw new Error('Use a lowercase Skill name with letters, numbers and hyphens.')
      skillMetadata(markdown, name)
      return mutate(skillDir, async () => {
        await checkSkillRoot()
        const current = await readSkill(skillDir, name)
        expectRevision(revision, current.revision)
        const files = await skillFiles(skillDir, name)
        if (files.readOnly) throw new Error('This Skill is read-only.')
        await mkdir(files.folder, { recursive: true, mode: 0o700 })
        const target = enabled ? files.active : files.disabled
        if (files.file && files.file !== target) {
          if (markdown !== current.markdown) await atomicWrite(files.file, markdown)
          await rename(files.file, target)
        } else {
          await atomicWrite(target, markdown)
        }
        return { ok: true }
      })
    },
    removeSkill({ name, revision }) {
      if (!skillName(name)) throw new Error('Invalid Skill name.')
      return mutate(skillDir, async () => {
        await checkSkillRoot()
        const current = await readSkill(skillDir, name)
        expectRevision(revision, current.revision)
        const { file, folder } = await skillFiles(skillDir, name)
        if (file) {
          await rm(file)
          await rmdir(folder).catch(error => { if (!['ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error })
        }
        return { ok: true }
      })
    },
    async listMcp() {
      const { mcpServers } = await readMcp(mcpFile)
      const items = Object.entries(mcpServers).filter(([name]) => mcpName(name)).map(([name, value]) => {
        const { enabled, ...config } = record(value) ? value : {}
        return { name, enabled: enabled !== false, config: hideSecrets(config), revision: mcpRevision(value) }
      })
      return { path: mcpFile, items }
    },
    saveMcp({ name, config, enabled, revision }) {
      if (!mcpName(name)) throw new Error('Use an MCP name with letters, numbers, underscores, dots or hyphens.')
      return mutate(mcpFile, async () => {
        const document = await readMcp(mcpFile)
        const previous = own(document.mcpServers, name)
        expectRevision(revision, mcpRevision(previous))
        const next = restoreSecrets(config, previous)
        validateMcp(next)
        document.mcpServers[name] = { ...next, enabled }
        await mkdir(dataDir, { recursive: true, mode: 0o700 })
        await atomicWrite(mcpFile, `${JSON.stringify(document, null, 2)}\n`)
        return { ok: true }
      })
    },
    removeMcp({ name, revision }) {
      if (!mcpName(name)) throw new Error('Invalid MCP name.')
      return mutate(mcpFile, async () => {
        const document = await readMcp(mcpFile)
        const previous = own(document.mcpServers, name)
        expectRevision(revision, mcpRevision(previous))
        if (previous !== undefined) {
          delete document.mcpServers[name]
          await atomicWrite(mcpFile, `${JSON.stringify(document, null, 2)}\n`)
        }
        return { ok: true }
      })
    },
    async getSettings() {
      const text = await readText(configFile) ?? ''
      return { path: configFile, revision: hash(text), ...yamlSettings(parseYaml(text).value) }
    },
    async getSettingsEditor() {
      const raw = await readText(configFile) ?? ''
      const { value } = parseYaml(raw)
      return {
        path: configFile, revision: hash(raw), defaultModel: yamlSettings(value).defaultModel,
        models: hideSecrets(contentsOf(value, modelKeys)), config: hideSecrets(contentsOf(value, runtimeKeys)),
      }
    },
    saveSettingsEditor({ revision, defaultModel, models, config }) {
      return mutate(configFile, async () => {
        const raw = await readText(configFile) ?? ''
        expectRevision(revision, hash(raw))
        const { document, value } = parseYaml(raw)
        const model = defaultModel.trim()
        if (model && !/^[^\s/]+\/\S+$/.test(model)) throw new Error('Enter the default model as provider/model.')
        for (const part of [models, config]) {
          for (const [key, entry] of Object.entries(part)) {
            if (key === 'permissionMode' ? typeof entry !== 'string' : entry !== mask && !record(entry)) {
              throw new Error('Expected an object for each native configuration section.')
            }
          }
        }
        if (model) document.set('defaultModel', model)
        else if (document.has('defaultModel')) document.delete('defaultModel')
        patchSettings(document, value, models, modelKeys)
        patchSettings(document, value, config, runtimeKeys)
        await mkdir(dataDir, { recursive: true, mode: 0o700 })
        await atomicWrite(configFile, document.toString({ lineWidth: 0 }))
        return { ok: true }
      })
    },
    saveSettings({ defaultModel, externalSkills, walkUp, setAsk, revision }) {
      return mutate(configFile, async () => {
        const text = await readText(configFile) ?? ''
        expectRevision(revision, hash(text))
        const { document, value: current } = parseYaml(text)
        const model = defaultModel.trim()
        if (model && !/^[^\s/]+\/\S+$/.test(model)) throw new Error('Enter the default model as provider/model.')
        const before = yamlSettings(current)
        if (model === before.defaultModel && externalSkills === before.externalSkills &&
            walkUp === before.walkUp && (!setAsk || before.permissionMode === 'default')) return { ok: true }
        if (model) document.set('defaultModel', model)
        else if (document.has('defaultModel')) document.delete('defaultModel')
        if (document.has('skills') && !isMap(document.get('skills', true)) ||
            document.hasIn(['skills', 'external']) && !isMap(document.getIn(['skills', 'external'], true))) {
          throw new Error('The native skills configuration must be a YAML mapping.')
        }
        if (externalSkills !== before.externalSkills) document.setIn(['skills', 'external', 'enabled'], externalSkills)
        if (walkUp !== before.walkUp) document.setIn(['skills', 'external', 'walkUp'], walkUp)
        if (setAsk) document.set('permissionMode', 'default')
        await mkdir(dataDir, { recursive: true, mode: 0o700 })
        await atomicWrite(configFile, document.toString({ lineWidth: 0 }))
        return { ok: true }
      })
    },
  }
  return api
}
