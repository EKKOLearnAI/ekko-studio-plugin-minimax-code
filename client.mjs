// Layout and interactions adapted from Ekko Studio’s MIT-licensed OMP plugin.
const text = {
  zh: {
    title: '配置编辑', skillsTitle: 'Skill 管理', mcpTitle: 'MCP 管理',
    skillsIntro: '管理本机 MiniMax Code 全局 Skill，修改同步到原生文件。启用的内容将在下一轮对话中加载。',
    mcpIntro: '管理本机 MiniMax Code 全局 MCP 服务，修改同步到原生文件。配置将在下一轮生效。',
    global: '本机全局', globalHelp: '新建内容保存在本机 MiniMax Code 全局目录，与原生 MiniMax Code 共用。', total: '全部', active: '已启用', readOnly: '外部链接 · 只读', location: '配置位置', refresh: '刷新', skillList: 'Skill 列表', selectSkill: '选择 Skill 查看详情', sources: '来源与生效方式', configuration: '运行配置',
    addSkill: '添加 Skill', addMcp: '添加 MCP 服务', search: '搜索名称或描述', emptySkills: '还没有 Skill，点击“添加 Skill”开始。', emptyMcp: '还没有 MCP 服务，点击“添加 MCP 服务”开始。', noMatches: '没有匹配的项目',
    name: '名称', nameHelp: 'Skill 使用小写字母、数字和连字符；MCP 名称还可以使用下划线和点。', description: '描述', descriptionHelp: '说明这个 Skill 适合在什么情况下使用。', content: 'Skill 内容（Markdown）', contentHelp: '填写 SKILL.md 的正文；name 和 description 会自动写入文件头。',
    mcpConfig: '服务配置（JSON）', mcpHelp: '粘贴一个服务的原生配置对象。支持 command / args / env 或 type / url / headers。已有凭证会遮蔽，保留遮蔽值即可保留原值。',
    enabled: '已启用', disabled: '已停用', enable: '启用', disable: '停用', edit: '编辑', remove: '删除', removeConfirm: '删除此项？该操作将在下一轮生效。', cancel: '取消', discard: '放弃尚未保存的编辑？', editTitle: '编辑', newTitle: '新建', enabledLabel: '在下一轮运行中启用', savedResource: '已保存，将在下一轮生效', duplicate: '这个名称已经存在，请编辑现有项目', jsonObject: '请填写 JSON 对象', loadingResources: '正在读取…', intro: '全局模式使用本页的 MiniMax Code 模型与凭证；scoped 模式使用 Studio 选择的模型。原生配置与 Studio 服务账号的 CLI 共用。',
    engine: '运行环境', status: '引擎状态', installed: '已安装', missing: '未安装', management: '打开 Agent 管理', install: '首次使用：在 Agent 管理中点击 MiniMax Code 的“安装”。已安装后可检查更新并升级。',
    executable: 'MiniMax Code 可执行文件（可选）', executableHelp: '填写已安装 CLI 的绝对路径。留空使用 Studio 的引擎选择。',
    native: '全局模型', model: '默认模型', modelHelp: '填写 provider/model；也可以留空，在聊天时选择 MiniMax Code 提供的原生模型。',
    models: '模型与凭证（JSON）', modelsHelp: '使用原生 config.yaml 的 custom_provider 或 minimax_api。已有密钥会遮蔽显示，保留遮蔽值即可保持原密钥。',
    example: '查看配置示例', config: 'MiniMax Code 运行设置（JSON）', configHelp: '编辑 permissionMode、skills 和 dataContribution。Studio 使用 Ask（default），其中终端命令自动批准。',
    save: '保存配置', saved: '配置已保存', loading: '正在读取配置…', retry: '重新读取', docs: 'MiniMax Code 配置文档', login: '终端登录命令',
  },
  en: {
    title: 'Configuration', skillsTitle: 'Skills', mcpTitle: 'MCP servers',
    skillsIntro: 'Manage local MiniMax Code global skills. Edits are saved to native files and apply on the next conversation turn.',
    mcpIntro: 'Manage local MiniMax Code global MCP servers. Edits are saved to native files and apply on the next turn.',
    global: 'Local global', globalHelp: 'New items use the local MiniMax Code global directory, shared with native MiniMax Code.', total: 'Total', active: 'Enabled', readOnly: 'External link · read-only', location: 'Configuration location', refresh: 'Refresh', skillList: 'Skill list', selectSkill: 'Select a skill to view details', sources: 'Sources and when changes apply', configuration: 'Runtime configuration',
    addSkill: 'Add skill', addMcp: 'Add MCP server', search: 'Search name or description', emptySkills: 'No skills yet. Add a skill to get started.', emptyMcp: 'No MCP servers yet. Add a server to get started.', noMatches: 'No matching items',
    name: 'Name', nameHelp: 'Skills use lowercase letters, numbers and hyphens. MCP names also accept underscores and dots.', description: 'Description', descriptionHelp: 'Describe when MiniMax Code should use this skill.', content: 'Skill content (Markdown)', contentHelp: 'Enter the SKILL.md body. The name and description frontmatter is added automatically.',
    mcpConfig: 'Server configuration (JSON)', mcpHelp: 'Paste one native server object: command / args / env, or type / url / headers. Saved credentials are masked; leave masked values to retain them.',
    enabled: 'Enabled', disabled: 'Disabled', enable: 'Enable', disable: 'Disable', edit: 'Edit', remove: 'Delete', removeConfirm: 'Delete this item? The change applies on the next turn.', cancel: 'Cancel', discard: 'Discard unsaved edits?', editTitle: 'Edit', newTitle: 'New', enabledLabel: 'Enable on the next turn', savedResource: 'Saved. Changes apply on the next turn.', duplicate: 'This name already exists. Edit the existing item.', jsonObject: 'Enter a JSON object', loadingResources: 'Loading…', intro: 'Global mode uses MiniMax Code models and credentials from this page. Scoped mode uses the model selected in Studio. Native settings are shared with the CLI on the Studio host.',
    engine: 'Runtime', status: 'Engine status', installed: 'Installed', missing: 'Not installed', management: 'Open Agent management', install: 'To get started, click Install for MiniMax Code in Agent management. Once installed, you can check for updates and upgrade.',
    executable: 'MiniMax Code executable (optional)', executableHelp: 'Enter an absolute path to an existing CLI. Leave blank to use Studio’s engine selection.',
    native: 'Global models', model: 'Default model', modelHelp: 'Use provider/model, or leave empty and choose an MiniMax Code native model in chat.',
    models: 'Models and credentials (JSON)', modelsHelp: 'Use custom_provider or minimax_api from native config.yaml. Saved secrets are masked; leave the masked value to retain a secret.',
    example: 'Configuration example', config: 'MiniMax Code runtime settings (JSON)', configHelp: 'Edit permissionMode, skills, and dataContribution. Studio uses Ask (default) and automatically approves terminal commands.',
    save: 'Save settings', saved: 'Settings saved', loading: 'Loading settings…', retry: 'Reload', docs: 'MiniMax Code configuration docs', login: 'Terminal sign-in command',
  },
}
// The iframe owns its rendering. Use the host's public theme tokens and the same
// header/card/grid/form dimensions as the other Coding Agent settings pages.
const themeStyles = `
  :root{--mc-space:var(--spacing-scale,1);--mc-border:var(--border-width,1px) solid var(--border-color);color-scheme:var(--studio-color-scheme,normal)}
  html,body,#root{height:100%;min-height:0;margin:0}#root{padding:0}
  .mc-settings *,.mc-manager *{box-sizing:border-box}
  @media(max-width:768px){.mc-manager .mc-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
  .mc-settings,.mc-manager{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;min-width:0;color:var(--text-primary);font:var(--font-size-base,14px)/var(--line-height,1.6) var(--font-family,system-ui);letter-spacing:var(--letter-spacing,normal)}
  .mc-settings button,.mc-manager button{display:inline-flex;align-items:center;justify-content:center;gap:calc(6px * var(--mc-space));min-height:var(--control-height,28px);padding:4px 10px;border:var(--mc-border);border-radius:var(--radius-component,6px);background:transparent;line-height:1.4;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}
  .mc-settings button:hover,.mc-manager button:hover{background:var(--bg-secondary)}
  .mc-settings button.primary,.mc-manager button.primary{background:var(--accent-primary);border-color:var(--accent-primary);color:var(--mc-on-accent)}
  .mc-settings button.quiet,.mc-manager button.quiet{border-color:transparent}
  .mc-manager button.danger{color:var(--error,var(--text-secondary))}
  .mc-settings button:disabled,.mc-manager button:disabled{opacity:.5;cursor:default}
  .mc-settings input,.mc-settings textarea,.mc-manager input:not([type=checkbox]),.mc-manager textarea{padding:5px 10px;border:var(--mc-border);border-radius:var(--radius-component,6px);background:var(--theme-input-bg,var(--bg-input,var(--bg-secondary)));color:var(--text-primary);font:inherit;min-width:0;max-width:100%}
  .mc-settings input:disabled,.mc-settings textarea:disabled,.mc-manager input:disabled,.mc-manager textarea:disabled{cursor:default;opacity:.5}
  .mc-settings textarea,.mc-manager textarea{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:calc(var(--font-size-base,14px) * 13 / 14);line-height:1.6;resize:vertical}
  .mc-settings :focus-visible,.mc-manager :focus-visible{outline:2px solid var(--accent-primary);outline-offset:2px}
  .mc-page-header{display:flex;flex-shrink:0;align-items:center;justify-content:space-between;gap:calc(12px * var(--mc-space));flex-wrap:wrap;padding:calc(12px * var(--mc-space)) calc(20px * var(--mc-space));border-bottom:var(--mc-border)}
  .mc-page-header h1{font-size:calc(var(--font-size-base,14px) * 16 / 14);font-weight:600;line-height:1.5;margin:0}
  .mc-page-header .mc-buttons{margin-inline-start:auto}
  .mc-page-content{flex:1;min-height:0;overflow:auto;padding:calc(20px * var(--mc-space));display:flex;flex-direction:column;gap:calc(16px * var(--mc-space));min-width:0}
  .mc-manager p,.mc-settings p{margin:0;color:var(--text-secondary);overflow-wrap:anywhere}
  .mc-source-path{display:block;font:calc(var(--font-size-base,14px) * 12 / 14)/1.6 ui-monospace,monospace;color:var(--text-muted,var(--text-secondary));overflow-wrap:anywhere}
  .mc-source-info{font-size:calc(var(--font-size-base,14px) * 12 / 14);color:var(--text-secondary)}
  .mc-source-info summary{cursor:pointer}.mc-source-info p,.mc-source-info code{margin-top:8px}
  .mc-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:calc(12px * var(--mc-space))}
  .mc-stat{padding:calc(14px * var(--mc-space));border:var(--mc-border);border-radius:var(--radius-component,8px);background:var(--theme-card-bg,var(--bg-card));display:flex;flex-direction:column;gap:6px}
  .mc-stat span{font-size:calc(var(--font-size-base,14px) * 11 / 14);color:var(--text-muted,var(--text-secondary))}.mc-stat strong{font-size:calc(var(--font-size-base,14px) * 24 / 14);font-weight:600;line-height:1}.mc-stat.active strong{color:var(--success,var(--accent-primary))}
  .mc-toolbar,.mc-buttons{display:flex;align-items:center;gap:calc(8px * var(--mc-space));flex-wrap:wrap}
  .mc-toolbar .mc-buttons{margin-inline-start:auto}
  .mc-manager .mc-toolbar input{flex:1;max-width:360px;min-width:0}
  .mc-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:calc(14px * var(--mc-space))}
  .mc-row{display:flex;flex-direction:column;gap:calc(12px * var(--mc-space));padding:calc(16px * var(--mc-space));border:var(--mc-border);border-radius:var(--radius-component,8px);background:var(--theme-card-bg,var(--bg-card));min-width:0}
  .mc-summary{flex:1;min-width:0;overflow-wrap:anywhere}.mc-summary strong{font-size:calc(var(--font-size-base,14px) * 15 / 14);font-weight:600}.mc-summary p{font-size:calc(var(--font-size-base,14px) * 13 / 14);margin-top:8px}
  .mc-row-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .mc-row-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:var(--mc-border);padding-top:10px}
  .mc-badges{display:flex;gap:6px;flex-wrap:wrap}
  .mc-badge{display:inline-flex;padding:1px 7px;border:var(--mc-border);border-radius:var(--radius-component,4px);font-size:calc(var(--font-size-base,14px) * 11 / 14);color:var(--text-secondary)}
  .mc-badge.active{color:var(--success,var(--accent-primary));border-color:currentColor}
  .mc-manager button.mc-switch{flex-shrink:0;min-height:18px;width:32px;height:18px;padding:2px;justify-content:flex-start;border:0;border-radius:12px;background:var(--text-muted)}
  .mc-manager button.mc-switch[aria-checked=true]{background:var(--accent-primary)}
  .mc-switch::after{content:'';width:14px;height:14px;border-radius:50%;background:var(--mc-on-accent);transition:transform .15s}
  .mc-switch[aria-checked=true]::after{transform:translateX(14px)}
  .mc-empty{grid-column:1/-1;text-align:center;padding:48px 16px}
  .mc-dialog{width:min(600px,calc(100vw - 32px));max-height:calc(100vh - 32px);padding:0;border:var(--mc-border);border-radius:var(--radius-component,12px);background:var(--theme-overlay-bg,var(--bg-card));color:var(--text-primary)}
  .mc-dialog::backdrop{background:color-mix(in srgb,var(--text-primary) 30%,transparent)}
  .mc-editor{display:flex;flex-direction:column;gap:calc(16px * var(--mc-space));padding:calc(24px * var(--mc-space));min-width:0}.mc-editor[hidden]{display:none}
  .mc-editor h2{font-size:18px;margin:0;font-weight:600}.mc-editor fieldset{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:16px;min-width:0}
  .mc-editor label{display:flex;flex-direction:column;gap:6px}.mc-editor label strong{font-size:14px;font-weight:500}.mc-editor label p{font-size:12px}
  .mc-editor textarea{min-height:220px;width:100%}.mc-editor .mc-check{flex-direction:row;align-items:center;gap:8px}
  .mc-editor>.mc-buttons{justify-content:flex-end;border-top:var(--mc-border);padding-top:16px}
  .mc-message{white-space:pre-wrap;overflow-wrap:anywhere}.mc-message:empty{display:none}.mc-message[role=alert]{border-inline-start:3px solid var(--accent-primary);padding-inline-start:12px}
  .mc-settings [data-theme-surface=card],.mc-manager [data-theme-surface=card]{--mc-border:var(--border-width,1px) solid var(--theme-card-border,var(--border-color));border-radius:var(--theme-card-radius,var(--radius-component,8px));box-shadow:var(--theme-card-shadow,none)}
  .mc-settings [data-theme-surface=input],.mc-manager [data-theme-surface=input]{--mc-border:var(--border-width,1px) solid var(--theme-input-border,var(--border-color));border-radius:var(--theme-input-radius,var(--radius-component,6px));box-shadow:var(--theme-input-shadow,none)}
  .mc-dialog{--mc-border:var(--border-width,1px) solid var(--theme-overlay-border,var(--border-color));border-radius:var(--theme-overlay-radius,var(--radius-component,12px));box-shadow:var(--theme-overlay-shadow,none)}
  .mc-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:calc(16px * var(--mc-space));min-width:0}
  .mc-section{display:flex;flex-direction:column;gap:12px;min-width:0;border:var(--mc-border);border-radius:var(--radius-component,10px);padding:calc(16px * var(--mc-space));background:var(--theme-card-bg,var(--bg-card))}
  .mc-section h2{font-size:calc(var(--font-size-base,14px) * 14 / 14);font-weight:600;margin:0}.mc-runtime{grid-column:1/-1}
  .mc-runtime-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.mc-runtime-heading p{font-size:12px}.mc-runtime-heading button{margin-inline-start:auto}.mc-runtime>p{font-size:12px}
  .mc-runtime .mc-field{display:grid;grid-template-columns:minmax(160px,1fr) minmax(200px,1fr);align-items:center;gap:4px 24px;margin:0}.mc-runtime .mc-field p{grid-column:1;font-size:12px}.mc-runtime .mc-field input{grid-column:2;grid-row:1/3}
  .mc-field{display:flex;flex-direction:column;gap:6px;margin:0}.mc-field strong{font-size:13px;font-weight:500}.mc-field input,.mc-field textarea{width:100%}.mc-field p{font-size:12px}
  .mc-section .mc-field:has(textarea){flex:1}.mc-field textarea{flex:1;min-height:260px}
  .mc-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mc-settings a{color:var(--accent-primary)}.mc-settings summary{cursor:pointer;color:var(--text-secondary)}.mc-settings pre{white-space:pre-wrap;overflow-wrap:anywhere}
  .mc-skills .mc-page-content{padding:0;overflow:hidden;gap:0}
  .mc-skills-layout{display:flex;flex:1;min-width:0;min-height:0}
  .mc-skills-sidebar{display:flex;flex-direction:column;width:280px;flex-shrink:0;min-height:0;border-inline-end:var(--mc-border);overflow:auto}
  .mc-skills-sidebar .mc-source-info{padding:12px;border-top:var(--mc-border);margin-top:auto}
  .mc-skills-sidebar .mc-message{padding:12px}
  .mc-skills .mc-items{display:flex;flex-direction:column;gap:2px;padding:8px}
  .mc-skill-group{margin:8px 4px 4px;font-size:12px;font-weight:500;color:var(--text-muted)}
  .mc-manager .mc-skill-select{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-width:0;text-align:start;padding:8px 12px;border-color:transparent;background:transparent;white-space:normal}
  .mc-manager .mc-skill-select[aria-pressed=true]{background:color-mix(in srgb,var(--accent-primary) 10%,transparent);color:var(--text-primary)}
  .mc-skill-select strong,.mc-skill-select small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mc-skill-select strong{font-size:13px;font-weight:500}.mc-skill-select small{font-size:11px;color:var(--text-muted,var(--text-secondary))}.mc-skill-select .mc-summary{overflow:hidden}
  .mc-skill-dot{width:6px;height:6px;flex-shrink:0;border-radius:50%;background:var(--text-muted)}.mc-skill-dot.active{background:var(--success,var(--accent-primary))}
  .mc-skill-detail{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;overflow:auto;padding:calc(16px * var(--mc-space)) calc(20px * var(--mc-space));gap:12px}
  .mc-detail-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-bottom:12px;border-bottom:var(--mc-border)}.mc-detail-heading h2{margin:0;font-size:15px;font-weight:600;overflow-wrap:anywhere}
  .mc-file-heading{padding:8px 0;border-bottom:var(--mc-border);font:12px ui-monospace,monospace;color:var(--text-muted)}
  .mc-skill-content{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}
  .mc-skills .mc-toolbar input{max-width:200px}.mc-manager .mc-back{display:none}
  @media(max-width:768px){.mc-page-header{padding:12px;gap:10px}.mc-page-content{padding:12px}.mc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.mc-items,.mc-settings-grid{grid-template-columns:1fr}.mc-dialog{width:calc(100vw - 24px)}.mc-editor{padding:16px}.mc-manager .mc-toolbar input{max-width:none}.mc-runtime .mc-field{display:flex;align-items:stretch;gap:6px}.mc-skills-sidebar{width:100%;border:0}.mc-skill-detail{display:none;padding:12px}.mc-show-detail .mc-skills-sidebar{display:none}.mc-show-detail .mc-skill-detail{display:flex}.mc-manager .mc-back{display:inline-flex}.mc-skills .mc-toolbar{flex:1;justify-content:flex-end}.mc-skills .mc-toolbar input{width:100%;max-width:180px;flex-basis:120px}}
`
export async function mount(root, ctx) {
  const t = text[(ctx.locale || navigator.language).startsWith('zh') ? 'zh' : 'en']
  const sharedStyle = document.createElement('style'); sharedStyle.textContent = themeStyles; root.append(sharedStyle)
  // The public bridge supplies the accent but no on-accent color. Choose its
  // accessible foreground here, including after the host changes theme.
  const updateContrast = () => {
    const paint = document.createElement('canvas').getContext('2d')
    paint.fillStyle = getComputedStyle(root).getPropertyValue('--accent-primary').trim() || 'CanvasText'
    paint.fillRect(0, 0, 1, 1)
    const rgb = [...paint.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4 })
    const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
    root.style.setProperty('--mc-on-accent', (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#000' : '#fff')
  }
  updateContrast()
  const appearance = new MutationObserver(updateContrast); appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
  ctx.lifecycle.add(() => appearance.disconnect())
  let disposed = false
  ctx.lifecycle.add(() => { disposed = true })
  if (['skills', 'mcp'].includes(ctx.view)) return mountResources(root, ctx, t)
  const container = document.createElement('section'); container.className = 'mc-settings'
  const element = (tag, content) => { const value = document.createElement(tag); if (content) value.textContent = content; return value }
  const status = element('p', t.loading); status.setAttribute('role', 'status')
  const runtime = element('section'); runtime.className = 'mc-section mc-runtime'; runtime.dataset.themeSurface = 'card'
  const runtimeHeading = element('div'); runtimeHeading.className = 'mc-runtime-heading'
  const version = element('p'), installHelp = element('p', t.install)
  const manage = element('button', t.management); manage.type = 'button'; manage.onclick = () => ctx.ui.navigate('/studio/agents')
  runtimeHeading.append(element('h2', t.engine), version, manage); runtime.append(runtimeHeading, installHelp)
  const field = (parent, label, help, area = false) => {
    const wrapper = element('label'); wrapper.className = 'mc-field'; wrapper.append(element('strong', label))
    const input = element(area ? 'textarea' : 'input'); input.setAttribute('aria-label', label); if (area) input.rows = 10
    input.spellcheck = false; input.dataset.themeSurface = 'input'; wrapper.append(input, element('p', help)); parent.append(wrapper); return input
  }
  const executable = field(runtime, t.executable, t.executableHelp)
  const login = element('code'); login.className = 'mc-source-path'
  const loginDetails = element('details')
  loginDetails.append(element('summary', t.login), login)
  runtime.append(loginDetails)
  const native = element('section'); native.className = 'mc-section'; native.dataset.themeSurface = 'card'; native.append(element('h2', t.native))
  const model = field(native, t.model, t.modelHelp); model.placeholder = 'provider/model'
  const models = field(native, t.models, t.modelsHelp, true)
  const example = element('details')
  const providerExample = { custom_provider: { custom: { name: 'Custom provider', kind: 'custom', enabled: true,
    api: 'openai-completions', options: { baseURL: 'https://provider.example/v1', apiKey: 'YOUR_API_KEY', authMode: 'api-key' },
    models: { 'your-model': {} } } } }
  example.append(element('summary', t.example), element('pre', JSON.stringify(providerExample, null, 2)))
  const docs = element('a', t.docs); docs.href = 'https://github.com/MiniMax-AI/minimax-code/blob/main/docs/examples.md'; docs.target = '_blank'; docs.rel = 'noopener noreferrer'; example.append(docs); native.append(example)
  const advanced = element('section'); advanced.className = 'mc-section'; advanced.dataset.themeSurface = 'card'; advanced.append(element('h2', t.configuration))
  const config = field(advanced, t.config, t.configHelp, true)
  const location = element('code'); location.className = 'mc-source-path'
  advanced.append(location)
  const actions = element('div'); actions.className = 'mc-actions'
  const save = element('button', t.save); save.type = 'button'; save.disabled = true; save.className = 'primary'
  const retry = element('button', t.retry); retry.type = 'button'; actions.append(save, retry)
  const header = element('header'); header.className = 'mc-page-header'; header.append(element('h1', t.title), actions)
  const grid = element('div'); grid.className = 'mc-settings-grid'; grid.append(runtime, native, advanced)
  const body = element('div'); body.className = 'mc-page-content'; body.append(element('p', t.intro), status, grid)
  container.append(header, body); root.append(container)
  let busy = false, settingsLoaded = false, revision = ''
  function setBusy(value) {
    busy = value; container.setAttribute('aria-busy', String(value))
    retry.disabled = value
    for (const control of [save, executable, model, models, config]) control.disabled = value || !settingsLoaded
  }
  async function load() {
    const value = await ctx.rpc.call('get-settings-editor', {})
    if (disposed) return
    executable.value = value.executable; model.value = value.defaultModel
    revision = value.revision
    location.textContent = value.path
    login.textContent = value.loginCommand; loginDetails.hidden = !value.loginCommand
    models.value = JSON.stringify(value.models, null, 2); config.value = JSON.stringify(value.config, null, 2)
    version.textContent = `${t.status}: ${value.status.installed ? `${t.installed} ${value.status.version}` : t.missing}`
    installHelp.hidden = value.status.installed
    status.textContent = value.status.error || ''
    settingsLoaded = true
  }
  retry.onclick = async () => {
    if (busy) return
    setBusy(true)
    try { await load() } catch (error) { if (!disposed) status.textContent = error.message }
    finally { if (!disposed) setBusy(false) }
  }
  save.onclick = async () => {
    if (busy) return
    setBusy(true)
    try {
      await ctx.rpc.call('save-settings-editor', { revision, executable: executable.value, defaultModel: model.value,
        models: JSON.parse(models.value), config: JSON.parse(config.value) })
      await load(); status.textContent = t.saved; ctx.ui.notify(t.saved, 'success')
    } catch (error) { if (!disposed) status.textContent = error.message }
    finally { if (!disposed) setBusy(false) }
  }
  await retry.onclick()
}


async function mountResources(root, ctx, t) {
  const skills = ctx.view === 'skills'
  let disposed = false, busy = false, loaded = false, items = [], editing = null, selected = '', baseline = ''
  let skillsDirectory = '', detailRequest = 0
  ctx.lifecycle.add(() => { disposed = true })
  const el = (tag, value, className) => {
    const node = document.createElement(tag)
    if (value) node.textContent = value
    if (className) node.className = className
    return node
  }
  const button = (label, click) => {
    const node = el('button', label); node.type = 'button'; node.onclick = click; return node
  }
  const container = el('section', '', `mc-manager${skills ? ' mc-skills' : ''}`)
  const toolbar = el('div', '', 'mc-toolbar'), search = el('input')
  search.type = 'search'; search.placeholder = t.search; search.setAttribute('aria-label', t.search); search.dataset.themeSurface = 'input'
  const add = button(skills ? t.addSkill : t.addMcp, () => showEditor()); add.className = 'primary'
  const retry = button(t.refresh, () => operation(load))
  retry.className = 'quiet'
  toolbar.append(search)
  const header = el('header', '', 'mc-page-header'), headerActions = el('div', '', 'mc-buttons')
  headerActions.append(retry)
  if (skills) { headerActions.append(add); header.append(el('h1', t.skillsTitle), toolbar, headerActions) }
  else { toolbar.append(add); header.append(el('h1', t.mcpTitle), headerActions) }
  const body = el('div', '', 'mc-page-content')
  const sourcePath = el('code', '', 'mc-source-path'); sourcePath.setAttribute('aria-label', t.location)
  const stats = el('div', '', 'mc-stats')
  const total = el('strong', '0'), active = el('strong', '0'), inactive = el('strong', '0')
  for (const [label, count] of [[t.total, total], [t.active, active], [t.disabled, inactive]]) {
    const card = el('div', '', `mc-stat${count === active ? ' active' : ''}`); card.dataset.themeSurface = 'card'; card.append(el('span', label), count); stats.append(card)
  }
  const message = el('p', t.loadingResources, 'mc-message'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite')
  const list = el('div', '', 'mc-items')
  const detail = el('div', '', 'mc-skill-detail'); detail.setAttribute('aria-label', t.content)
  const sourceInfo = el('details', '', 'mc-source-info'); sourceInfo.append(el('summary', t.sources), el('p', skills ? t.skillsIntro : t.mcpIntro), sourcePath, el('p', t.globalHelp))
  const editor = el('form', '', 'mc-editor'); editor.hidden = true
  const dialog = el('dialog', '', 'mc-dialog'); dialog.setAttribute('aria-label', skills ? t.skillsTitle : t.mcpTitle)
  dialog.append(editor)
  ctx.lifecycle.add(() => dialog.close())
  const heading = el('h2'), fields = el('fieldset')
  const field = (label, help, area = false) => {
    const wrapper = el('label'), input = el(area ? 'textarea' : 'input')
    input.required = true; input.spellcheck = false; input.setAttribute('aria-label', label); input.dataset.themeSurface = 'input'
    wrapper.append(el('strong', label), input, el('p', help)); fields.append(wrapper); return input
  }
  const name = field(t.name, t.nameHelp); name.maxLength = skills ? 64 : 128
  const description = skills ? field(t.description, t.descriptionHelp) : null
  if (description) description.maxLength = 2000
  const content = field(skills ? t.content : t.mcpConfig, skills ? t.contentHelp : t.mcpHelp, true)
  if (skills) content.maxLength = 200000
  const check = el('label', '', 'mc-check'), enabled = el('input'); enabled.type = 'checkbox'; enabled.setAttribute('aria-label', t.enabledLabel)
  check.append(enabled, el('span', t.enabledLabel)); fields.append(check)
  const actions = el('div', '', 'mc-buttons'), save = el('button', t.save); save.type = 'button'
  const values = () => JSON.stringify([name.value, description?.value, content.value, enabled.checked])
  const closeEditor = () => { editor.hidden = true; dialog.close(); editing = null; add.focus() }
  const cancelEdit = async () => {
    try {
      if (baseline !== values() && !await ctx.ui.confirm(t.discard)) return
      if (!disposed) closeEditor()
    } catch (error) { if (!disposed) setMessage(error.message, true) }
  }
  const cancel = button(t.cancel, cancelEdit)
  save.className = 'primary'
  dialog.oncancel = event => { event.preventDefault(); if (!busy) void cancelEdit() }
  const editorMessage = el('p', '', 'mc-message'); editorMessage.setAttribute('role', 'status')
  actions.append(cancel, save); editor.append(heading, fields, editorMessage, actions)
  if (skills) {
    const layout = el('div', '', 'mc-skills-layout'), sidebar = el('aside', '', 'mc-skills-sidebar')
    sidebar.setAttribute('aria-label', t.skillList); sidebar.append(message, list, sourceInfo)
    layout.append(sidebar, detail); body.append(layout)
  } else body.append(message, stats, toolbar, sourceInfo, list)
  container.append(header, body, dialog)
  root.append(container)
  const setMessage = (value, error = false) => {
    const target = dialog.open ? editorMessage : message
    target.textContent = value; target.setAttribute('role', error ? 'alert' : 'status')
  }
  function setBusy(value) {
    busy = value; fields.disabled = value; save.disabled = value; cancel.disabled = value
    container.setAttribute('aria-busy', String(value))
    search.disabled = value || !loaded; add.disabled = value || !loaded; retry.disabled = value
    for (const node of container.querySelectorAll('.mc-items button,.mc-skill-detail button')) node.disabled = value || node.dataset.readOnly === 'true'
  }
  async function load() {
    const result = await ctx.rpc.call(skills ? 'list-skills' : 'list-mcp', {})
    if (disposed) return
    items = result.items
    skillsDirectory = result.directory || ''
    sourcePath.textContent = skillsDirectory || result.path
    const enabledCount = items.filter(item => item.enabled).length
    total.textContent = String(items.length)
    active.textContent = String(enabledCount)
    inactive.textContent = String(items.length - enabledCount)
    loaded = true; renderList()
  }
  async function operation(action, success = '') {
    if (busy) return
    setBusy(true); setMessage(loaded ? '' : t.loadingResources)
    try {
      await action()
      if (disposed) return
      setMessage(success)
      if (success) ctx.ui.notify(success, 'success')
    } catch (error) { if (!disposed) setMessage(error.message, true) }
    finally { if (!disposed) setBusy(false) }
  }
  function readSkill(item) {
    item.document ??= ctx.rpc.call('get-skill', { name: item.name }).catch(error => {
      delete item.document
      throw error
    })
    return item.document
  }
  function skillBody(markdown) {
    const header = /^\uFEFF?---\r?\n[\s\S]*?^---[ \t]*(?:\r?\n|$)/m.exec(markdown)
    return header?.index === 0 ? markdown.slice(header[0].length).replace(/^\r?\n/, '') : markdown
  }
  async function showEditor(item = null) {
    if (busy || disposed) return
    try {
      if (!editor.hidden && baseline !== values() && !await ctx.ui.confirm(t.discard)) return
    } catch (error) { if (!disposed) setMessage(error.message, true); return }
    if (disposed) return
    let document
    if (skills && item) {
      await operation(async () => { document = await readSkill(item) })
      if (!document || disposed) return
    }
    editing = item ? { ...item, revision: document?.revision ?? item.revision } : null
    editorMessage.textContent = ''
    heading.textContent = `${item ? t.editTitle : t.newTitle} ${skills ? 'Skill' : 'MCP'} · ${t.global}`
    name.value = item?.name || ''; name.disabled = Boolean(item)
    if (description) description.value = item?.description || ''
    content.value = skills ? skillBody(document?.markdown ?? '') : JSON.stringify(item?.config || { type: 'stdio', command: 'npx', args: [] }, null, 2)
    enabled.checked = document?.enabled ?? item?.enabled ?? true
    baseline = values(); editor.hidden = false
    if (!dialog.open) dialog.showModal()
    ;(item ? content : name).focus()
  }
  const itemKey = item => item.name
  function resourceActions(item) {
    const actions = el('div', '', 'mc-buttons')
    const edit = button(t.edit, () => showEditor(item)); edit.className = 'quiet'; edit.setAttribute('aria-label', `${t.edit} ${item.name}`)
    const toggle = button(item.enabled ? t.disable : t.enable, () => operation(async () => {
      const input = skills ? await readSkill(item) : { name: item.name, config: item.config, revision: item.revision }
      await ctx.rpc.call(skills ? 'save-skill' : 'save-mcp', { ...input, enabled: !item.enabled })
      await load()
      if (editing && itemKey(editing) === itemKey(item)) closeEditor()
    }, t.savedResource)); toggle.className = 'mc-switch'; toggle.setAttribute('role', 'switch'); toggle.setAttribute('aria-checked', String(item.enabled)); toggle.setAttribute('aria-label', `${item.enabled ? t.disable : t.enable} ${item.name}`); toggle.textContent = ''
    const remove = button(t.remove, () => operation(async () => {
      if (!await ctx.ui.confirm(`${t.removeConfirm} (${item.name})`) || disposed) return
      const revision = skills ? (await readSkill(item)).revision : item.revision
      await ctx.rpc.call(skills ? 'remove-skill' : 'remove-mcp', { name: item.name, revision })
      await load()
      if (!disposed && editing && itemKey(editing) === itemKey(item)) closeEditor()
    })); remove.className = 'quiet danger'; remove.setAttribute('aria-label', `${t.remove} ${item.name}`)
    actions.append(edit, remove)
    if (item.readOnly) for (const node of [edit, toggle, remove]) { node.disabled = true; node.dataset.readOnly = 'true' }
    return { actions, toggle }
  }
  function renderDetail(item) {
    const request = ++detailRequest
    detail.replaceChildren()
    if (!item) { detail.append(el('p', t.selectSkill, 'mc-empty')); return }
    const heading = el('div', '', 'mc-detail-heading'), buttons = el('div', '', 'mc-buttons')
    const back = button(t.skillList, () => { container.classList.remove('mc-show-detail'); list.querySelector('[aria-pressed=true]')?.focus() }); back.className = 'mc-back quiet'
    const { actions, toggle } = resourceActions(item)
    buttons.append(actions, toggle); heading.append(back, el('h2', item.name), buttons)
    const badges = el('div', '', 'mc-badges'); badges.append(el('span', t.global, 'mc-badge'), el('span', item.enabled ? t.enabled : t.disabled, `mc-badge${item.enabled ? ' active' : ''}`))
    detail.append(heading, badges, el('p', item.description))
    if (item.readOnly) { detail.append(el('p', t.readOnly)); return }
    const file = item.enabled ? 'SKILL.md' : 'SKILL.md.studio-disabled'
    detail.append(el('code', `${skillsDirectory}/${item.name}/${file}`, 'mc-source-path'))
    const preview = el('pre', t.loadingResources, 'mc-skill-content')
    detail.append(el('div', 'SKILL.md', 'mc-file-heading'), preview)
    void readSkill(item).then(value => {
      if (!disposed && request === detailRequest) preview.textContent = skillBody(value.markdown)
    }, error => {
      if (!disposed && request === detailRequest) preview.textContent = error.message
    })
  }
  function renderList() {
    list.replaceChildren()
    const query = search.value.trim().toLocaleLowerCase()
    const filtered = items.filter(item => [item.name, item.description, item.config?.command, item.config?.url, ...(Array.isArray(item.config?.args) ? item.config.args : [])].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (!filtered.length) {
      list.append(el('p', items.length ? t.noMatches : skills ? t.emptySkills : t.emptyMcp, 'mc-empty'))
      if (skills) { container.classList.remove('mc-show-detail'); renderDetail(null) }
      return
    }
    if (skills) {
      if (!filtered.some(item => itemKey(item) === selected)) selected = itemKey(filtered[0])
      list.append(el('h2', `${t.global} · ${filtered.length}`, 'mc-skill-group'))
      for (const item of filtered) {
        const row = el('article'), summary = el('span', '', 'mc-summary')
        summary.append(el('strong', item.name), el('small', item.description))
        const select = button('', () => {
          selected = itemKey(item); container.classList.add('mc-show-detail'); renderList()
          // Keep keyboard focus when replacing the selected list row.
          const target = matchMedia('(max-width:768px)').matches ? detail.querySelector('.mc-back') : list.querySelector('[aria-pressed=true]')
          target?.focus()
        })
        select.className = 'mc-skill-select'; select.setAttribute('aria-pressed', String(selected === itemKey(item)))
        select.append(summary, el('span', '', `mc-skill-dot${item.enabled ? ' active' : ''}`)); select.setAttribute('title', `${item.description} · ${item.enabled ? t.enabled : t.disabled}${item.readOnly ? ' · ' + t.readOnly : ''}`)
        select.setAttribute('aria-label', `${item.name} · ${t.global}`)
        row.append(select); list.append(row)
      }
      renderDetail(filtered.find(item => itemKey(item) === selected)); return
    }
    for (const item of filtered) {
      const row = el('article', '', 'mc-row'), summary = el('div', '', 'mc-summary'), title = el('strong', item.name)
      row.dataset.themeSurface = 'card'
      const heading = el('div', '', 'mc-row-heading'), badges = el('div', '', 'mc-badges')
      badges.append(el('span', item.config.type || (item.config.url ? 'http' : 'stdio'), 'mc-badge'), el('span', t.global, 'mc-badge'), el('span', item.enabled ? t.enabled : t.disabled, `mc-badge${item.enabled ? ' active' : ''}`))
      heading.append(title, badges); summary.append(heading, el('p', item.config.command || item.config.url || 'MCP'))
      const { actions, toggle } = resourceActions(item), footer = el('div', '', 'mc-row-footer')
      footer.append(actions, toggle); row.append(summary, footer); list.append(row)
    }
  }
  search.oninput = renderList
  const saveResource = event => {
    event?.preventDefault()
    if (busy || !editor.reportValidity()) return
    void operation(async () => {
      const input = { name: name.value.trim(), enabled: enabled.checked, revision: editing?.revision ?? '' }
      if (skills) Object.assign(input, { description: description.value, content: content.value })
      else {
        const config = JSON.parse(content.value)
        if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(t.jsonObject)
        input.config = config
      }
      if (!editing && items.some(item => item.name === input.name)) throw new Error(t.duplicate)
      await ctx.rpc.call(skills ? 'edit-skill' : 'save-mcp', input)
      if (!disposed) { closeEditor(); await load() }
    }, t.savedResource)
  }
  // Studio permits scripts but blocks native form submission in plugin frames.
  save.onclick = saveResource
  editor.onsubmit = saveResource
  editor.onkeydown = event => {
    if (event.key === 'Enter' && !event.isComposing && event.target.tagName === 'INPUT' && event.target.type !== 'checkbox') {
      event.preventDefault()
      save.click()
    }
  }
  await operation(load)
}
