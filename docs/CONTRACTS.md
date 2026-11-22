# MiniMax Code runtime contract

## Studio Agent API v1

`plugin.json` and `package.json` share a version. `server.mjs` registers the local Agent ID `minimax-code` with the public Studio SDK. The install guide points to the external CLI instructions. The only registered surface is streaming chat. Native engine discovery returns the executable's reported version. Model discovery uses an ACP authentication check and returns the CLI default model entry when the active profile can use a provider.

The activation identity controls access to global mode and edits to native settings. Each run also checks the Agent, Studio conversation and mode. Global mode receives the native data directory with a limited OS environment. Engine diagnostics use fixed messages and the transport discards stderr. Approval previews redact common bearer tokens, key assignments and URL passwords.

Scoped mode accepts the Studio Chat Completions binding for the current turn. It starts the CLI with a private data directory and one temporary custom provider. The selected model must match the ACP session's reported selection before the runtime prompts it. A loopback relay holds the Studio lease in memory and accepts requests authenticated by a separate per-turn key. The Studio token never reaches the CLI or its files. The owner’s native Skills and MCP entries are available in scoped turns. Other accounts and Profiles use their Studio MCP transports and workspace resources. The runtime closes the relay and removes the temporary files when the turn ends.

## ACP v1

The adapter starts `mcode acp` without a shell and requires ACP protocol version 1. It sends the canonical workspace directory in the child process and in `session/new` or `session/load`. It maps Studio's stdio, HTTP and SSE MCP definitions to ACP. The CLI gets those definitions for each run. The adapter does not log or add them to the Studio checkpoint.

The prompt contains instructions, prior messages for a fresh native session, current text, authorized file resource links and supported image blocks. Upstream accepts file links as references and rejects embedded file content. Image payloads stay within the adapter's 8 MiB cap and the transport's frame limit. The adapter ignores history streaming sent by `session/load`. It forwards only active-session deltas and tool status, awaits Studio backpressure, then returns one complete assistant reply. ACP permission requests require native mode **Ask**. For the active turn in either mode, the native `bash` tool receives its one-time allow option automatically. Other tools require an explicit Studio approval, and single-choice requests use Studio clarification. Cancelled and out-of-session requests receive no grant.

Cancel, timeout and dispose signal the active native prompt and release the ACP process. Clean completion also requests ACP session close when advertised. Native model session records belong to MiniMax Code.

## Candidate checkpoint

`contracts/plugin.json` defines schema version 1. `nativeId` is the opaque native session ID. `binding` hashes the Studio account, Profile, Agent ID, conversation, mode, canonical workspace, and CLI data directory. A mismatched binding or unsupported schema fails before session load. Checkpoints contain no credential material, model payloads or ACP transcripts.

Studio registration keeps `resume: false` until a live native account and Studio host restart are exercised, including incomplete-turn recovery. Runtime tests can enable the candidate directly. With resume disabled, each turn starts a fresh native session and includes Studio history.

## Agent and configuration management

The Agent management registration exposes `getStatus`, `checkUpdate`, `upgrade`, `remove` and `settings`. It uses the actual caller identity and limits commands accessing the shared CLI to the activation account and Profile. The SDK checks the expected current version before updating or removing an engine.

The managed engine lives under the plugin data directory. It reads the official npm stable dist-tag and installs the exact requested version in a separate prefix. The staged package must report the expected CLI version and open a native SQLite database before `engine/current.json` is atomically replaced. The selection contains the active release directory name, or null after removal. A missing selection allows discovery of pre-existing external CLIs. An explicit executable override always selects an external CLI. Engine operations leave the native data directory intact.

The three `agent-settings` views use the RPCs defined in the JSON contract. Each write takes the revision read from the edited resource. Conflicts require a refresh. Writes use a temporary file in the target directory followed by rename.

- `skills/<name>/SKILL.md` stores the complete user Skill document. The editor updates the Markdown body and required fields while keeping other frontmatter. Disabling renames the file to `SKILL.md.studio-disabled`. Both names together or symbolic links make that entry read-only. Deleting the document removes the directory only if it is empty.
- `mcp.json` stores an object with an `mcpServers` mapping and optional native metadata. Each entry retains its JSON fields and uses `enabled: false` when disabled. The editor receives masked values and resolves the masks against the matching saved revision. Existing unrelated entries and root metadata are preserved.
- `config.yaml` stores the native default model, providers and runtime settings. The editor patches the supported keys and preserves unrelated values and comments. The executable override is stored in Studio plugin state. The login command is generated from the selected executable and data directory.

MiniMax Code reads these user-scope files directly. The plugin continues to pass the current Studio run’s MCP transport definitions through ACP, alongside the MiniMax runtime’s separate native discovery.
