import { spawn } from 'child_process';
import * as fs from 'fs';

export interface AntigravityExecutionOptions {
  prompt: string;
  model?: string;
  systemPersona?: string;
  conversationHistory?: Array<{ sender: string; text: string }>;
  timeoutMs?: number;
}

export class AntigravitySandboxRunner {
  private static readonly RUNNER_PATH = '/usr/local/bin/project-gemini-runner';
  private static readonly DEFAULT_MODEL = 'gemini-3.8-flash-low';
  private static readonly MAX_CONCURRENT_SLOTS = 4;
  private static readonly DEFAULT_TIMEOUT_MS = 40000;

  private static activeSlots = 0;
  private static readonly waitQueue: Array<() => void> = [];

  /**
   * Check if the Linux Bubblewrap sandbox runner is available in this environment.
   */
  public static isAvailable(): boolean {
    try {
      return fs.existsSync(this.RUNNER_PATH) && typeof spawn === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Acquire a slot for execution or wait in queue (Slot Limiter).
   */
  private static async acquireSlot(): Promise<void> {
    if (this.activeSlots < this.MAX_CONCURRENT_SLOTS) {
      this.activeSlots++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.activeSlots++;
        resolve();
      });
    });
  }

  /**
   * Release an execution slot and trigger next queued call.
   */
  private static releaseSlot(): void {
    this.activeSlots = Math.max(0, this.activeSlots - 1);
    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }

  /**
   * Sanitize user input to prevent escape, NUL-byte injection or oversized payloads.
   */
  public static sanitizePrompt(rawPrompt: string): string {
    return rawPrompt
      .replace(/\0/g, '') // strip NUL bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip unprintable control chars
      .trim()
      .slice(0, 2000); // hard limit length
  }

  /**
   * Execute prompt via the sandboxed Bubblewrap Antigravity CLI.
   */
  public static async executePrompt(options: AntigravityExecutionOptions): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error(`Antigravity sandbox runner not found at ${this.RUNNER_PATH}`);
    }

    const {
      prompt,
      model = this.DEFAULT_MODEL,
      systemPersona = '',
      conversationHistory = [],
      timeoutMs = this.DEFAULT_TIMEOUT_MS,
    } = options;

    const sanitized = this.sanitizePrompt(prompt);
    if (!sanitized) {
      return 'Prompt is empty or contains only invalid characters.';
    }

    let historySection = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const formattedTurns = conversationHistory
        .slice(-3)
        .map((m) => {
          const role = m.sender === 'user' ? 'Пользователь' : 'Ассистент';
          return `${role}: ${m.text.trim()}`;
        })
        .join('\n\n');
      historySection = `\n\n[ИСТОРИЯ ТЕКУЩЕЙ СЕССИИ]:\n${formattedTurns}`;
    }

    const compositePrompt = systemPersona
      ? `${systemPersona}${historySection}\n\n[НОВОЕ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ]:\n${sanitized}\n\n[ТВОЙ ОТВЕТ (ВЕДИ ЕСТЕСТВЕННЫЙ ДИАЛОГ С УЧЕТОМ КОНТЕКСТА ИСТОРИИ)]:\n`
      : `${historySection}\n\n[НОВОЕ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ]:\n${sanitized}\n\n[ТВОЙ ОТВЕТ]:\n`;

    await this.acquireSlot();

    return new Promise<string>((resolve, reject) => {
      let stdoutData = '';
      let stderrData = '';
      let isSettled = false;

      // Spawn in detached process group for reliable process-tree termination
      const child = spawn(
        this.RUNNER_PATH,
        ['--model', model, '--prompt', compositePrompt],
        {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
            HOME: process.env.HOME || '/root',
          },
        }
      );

      const pid = child.pid;

      const killProcessTree = () => {
        if (!pid) return;
        try {
          // Negative PID kills the entire process group
          process.kill(-pid, 'SIGTERM');
        } catch {
          // Ignore if already terminated
        }

        setTimeout(() => {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            // Ignore
          }
        }, 1000);
      };

      const finalizeSettlement = (code: number | null) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          this.releaseSlot();

          if (code === 0 && stdoutData.trim()) {
            resolve(stdoutData.trim());
          } else {
            const errMsg =
              stderrData.trim() ||
              `Process exited with code ${code}${!stdoutData.trim() ? ' and empty output' : ''}`;
            reject(new Error(errMsg));
          }
        }
      };

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          killProcessTree();
          this.releaseSlot();
          reject(new Error(`Antigravity execution timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString('utf-8');
      });

      child.stderr.on('data', (chunk) => {
        stderrData += chunk.toString('utf-8');
      });

      child.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          this.releaseSlot();
          reject(err);
        }
      });

      child.on('close', (code) => {
        finalizeSettlement(code);
      });

      child.on('exit', (code) => {
        // If stdio stream descriptors remain open from descendants, settle safely after brief drain
        setTimeout(() => {
          finalizeSettlement(code);
        }, 300);
      });
    });
  }
}
