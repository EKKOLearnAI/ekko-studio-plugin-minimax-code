# MiniMax Code for Ekko Studio

MiniMax Code registers as `plugin:minimax-code/minimax-code` through Studio Agent API v1. It provides streaming single chats in **global** mode with native CLI configuration and in **scoped** mode with the model selected in Studio.

## Setup

1. Load the plugin through Studio’s independent-plugin workflow. In **Agent management**, click **Install** for MiniMax Code. Studio fetches the official `@minimax-ai/code` package and verifies its version and native SQLite binding. The host needs a supported Node.js installation with npm. See the [official CLI installation guide](https://github.com/MiniMax-AI/minimax-code/blob/main/docs/installation.md).
2. Open **Settings → Configuration** for MiniMax Code. Run the displayed login command as the Studio service OS account, or configure an active provider in the native CLI. Append `--region global` for a global-region account. Select **Ask** in the native `/permission` menu or save it on the Configuration page.
3. Select **MiniMax Code** in a new single chat. Choose **MiniMax Code default** in global mode, or select a Studio provider and model in scoped mode. Both modes automatically grant one-time approval to the native shell tool. Other tool approvals and questions use the Studio interaction UI. Scoped mode uses Studio model access and works without a native MiniMax login.

Use **Check for updates** and **Update** to upgrade a Studio-managed CLI. **Delete** removes that managed CLI and retains native login, sessions, Skills and MCP configuration. Studio verifies a new installation before activating it. An external CLI stays under the control of its own installer.

Before the first managed installation, the plugin can detect an external CLI in absolute PATH entries or, on macOS/Linux, in `~/.local/bin` and `~/.minimax-code/bin`. On Windows it checks `mcode.exe` and the npm JavaScript entry beneath absolute PATH entries and `%APPDATA%\npm`. To select an external CLI explicitly, enter its absolute path on the Configuration page. The service environment variable `EKKO_MINIMAX_CODE_EXECUTABLE` takes priority when set.

## Configuration in Studio

The settings are shared with the native CLI run by the Studio service OS account. The Studio account and Profile that enable the plugin can edit them. The data directory is `MINIMAX_DATA_DIR`, `MAVIS_DATA_DIR`, or `~/.minimax`, in that order. Set an absolute path when using either environment variable.

- **Skills** shows a searchable list and Markdown preview. Edit the description and body of a native `SKILL.md`, with other frontmatter retained. Disabling parks the document next to its original path so MiniMax Code skips it. Deletion preserves companion files such as scripts and references. Linked directories are read-only.
- **MCP servers** edits the native user-level `mcp.json`, including stdio, HTTP and SSE entries. Existing headers, environment values and recognized credentials are masked in the editor. Leave the mask in place to retain the saved value.
- **Configuration** shows the engine status and edits the native default model, provider configuration and supported runtime fields in `config.yaml`. The model editor supports `custom_provider` and `minimax_api`. The runtime editor supports `permissionMode`, `skills` and `dataContribution`. Existing provider credentials are masked and kept when the mask is retained. Interactive login stays in the native CLI.

Changes apply when Studio starts the next ACP turn. Workspace, built-in and native plugin resources continue to be discovered by MiniMax Code according to its own precedence.

## Support and acceptance

- Global mode exposes the CLI’s native default model and reasoning settings. Scoped mode routes model calls through Studio’s Chat Completions proxy and checks the native ACP selection before prompting.
- Text and authorized workspace paths pass to ACP. Images use PNG, JPEG, WebP or GIF, with up to ten images and 8 MiB total per turn. The chosen model must accept images. Files pass as ACP file resource links so the engine can read them under its native file and workspace permissions.
- Studio supplies MCP transports for the current run. MiniMax Code’s own configured skills, MCP servers, and tool rules also apply.
- Each registered turn uses a fresh ACP session and includes Studio history. The native `session/load` candidate is covered by tests. Studio resume is disabled pending a live authenticated host-restart check. Group chat, workflow and API surfaces await acceptance.
- See the [runtime contract](docs/CONTRACTS.md) for session binding, inputs and resource cleanup.

## Development

Use Node.js 24.2 or later. Run `npm ci --ignore-scripts`, `npm run harness:check`, `npm test`, and `npm pack --dry-run --ignore-scripts`. GitHub Actions runs these checks on Linux, macOS, and Windows. To run the optional native test, set `EKKO_MINIMAX_NATIVE_TEST_CLI` to an absolute external `mcode` path. The test uses a temporary CLI data directory and a loopback model service.

The plugin is MIT licensed. The ACP transport and settings layout were adapted from Ekko Studio’s [TRAE](https://github.com/EKKOLearnAI/ekko-studio-plugin-trae/tree/c7a2ac10e34d2412cf18d3382c2c7b93672ea006) and [OMP](https://github.com/EKKOLearnAI/ekko-studio-plugin-omp) plugins. The bundled icon comes from the [official MiniMax AI GitHub organization](https://github.com/MiniMax-AI). The Studio SDK retains its [license](sdk/LICENSE) and [notice](sdk/NOTICE). MiniMax distributes the separate [CLI source under MIT](https://github.com/MiniMax-AI/minimax-code/blob/v0.7.2/LICENSE) with its own notices and dependencies.
