// ACP transport adapted from ekko-studio-plugin-trae (MIT). See LICENSE.
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const frameLimit = 16 * 1024 * 1024

export class AcpError extends Error {
  constructor(code) {
    super('MiniMax Code rejected an ACP request.')
    this.code = code
  }
}

export class Acp {
  #nextId = 0
  #pending = new Map()
  #buffer = ''
  #failure
  #close
  #closed
  #exited = false
  #onFrame

  constructor(executable, args, options, onFrame) {
    this.#onFrame = onFrame
    this.child = spawn(executable, args, { ...options, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
    this.#closed = new Promise(resolve => {
      this.child.once('close', () => {
        this.#exited = true
        this.#fail(new Error('MiniMax Code ACP process exited. Check mcode login and native CLI setup.'))
        resolve()
      })
    })
    this.child.once('error', () => this.#fail(new Error('Could not start MiniMax Code ACP. Check the installed executable.')))
    this.child.stdin.on('error', () => this.#fail(new Error('MiniMax Code ACP input closed.')))
    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', chunk => this.#read(chunk))
  }

  #fail(error) {
    this.#failure ??= error
    for (const { reject } of this.#pending.values()) reject(this.#failure)
    this.#pending.clear()
  }

  #read(chunk) {
    this.#buffer += chunk
    for (let newline = this.#buffer.indexOf('\n'); newline >= 0; newline = this.#buffer.indexOf('\n')) {
      const line = this.#buffer.slice(0, newline).trim()
      this.#buffer = this.#buffer.slice(newline + 1)
      if (!line) continue
      try {
        if (Buffer.byteLength(line) > frameLimit) throw new Error()
        const frame = JSON.parse(line)
        if (!frame || frame.jsonrpc !== '2.0') throw new Error()
        if (typeof frame.method === 'string') {
          this.#onFrame(frame)
        } else if (this.#pending.has(frame.id)) {
          const { resolve, reject } = this.#pending.get(frame.id)
          this.#pending.delete(frame.id)
          if (frame.error) reject(new AcpError(frame.error.code))
          else if (Object.hasOwn(frame, 'result')) resolve(frame.result)
          else reject(new Error('MiniMax Code returned an invalid ACP response.'))
        }
      } catch {
        this.#fail(new Error('MiniMax Code sent an invalid ACP frame.'))
        return
      }
    }
    if (Buffer.byteLength(this.#buffer) > frameLimit) this.#fail(new Error('MiniMax Code sent an oversized ACP frame.'))
  }

  #send(frame) {
    if (this.#failure || this.#exited || this.child.stdin.destroyed || this.child.stdin.writableEnded) return false
    const line = JSON.stringify({ jsonrpc: '2.0', ...frame })
    if (Buffer.byteLength(line) > frameLimit) throw new Error('MiniMax Code ACP request exceeds its input limit.')
    this.child.stdin.write(line + '\n')
    return true
  }

  async request(method, params, signal) {
    signal.throwIfAborted()
    const id = ++this.#nextId
    const { promise, resolve, reject } = Promise.withResolvers()
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    this.#pending.set(id, { resolve, reject })
    try {
      if (!this.#send({ id, method, params })) throw this.#failure || new Error('MiniMax Code ACP input closed.')
      return await promise
    } finally {
      this.#pending.delete(id)
      signal.removeEventListener('abort', abort)
    }
  }

  notify(method, params) { this.#send({ method, params }) }
  respond(id, result) { this.#send({ id, result }) }
  methodNotFound(id) { this.#send({ id, error: { code: -32601, message: 'ACP client method unavailable' } }) }

  async close({ cancel = false } = {}) {
    this.#close ??= this.#stop(cancel)
    return this.#close
  }

  async #stop(cancel) {
    if (cancel) await Promise.race([this.#closed, delay(750, undefined, { ref: false })])
    if (this.#exited) return
    this.child.stdin.end()
    await Promise.race([this.#closed, delay(500, undefined, { ref: false })])
    if (this.#exited) return
    this.child.kill()
    await Promise.race([this.#closed, delay(500, undefined, { ref: false })])
    if (this.#exited) return
    this.child.kill('SIGKILL')
    await this.#closed
  }
}
