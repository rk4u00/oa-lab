import { spawn } from 'node:child_process';
import type { IncomingMessage, Server } from 'node:http';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Docker from 'dockerode';
import { WebSocket, WebSocketServer } from 'ws';
import { EXECUTION_DRIVER, ExecutionDriver } from '../../common/driver.provider';
import { PrismaService } from '../../common/prisma.service';

type ClientMsg = { type: 'input'; data: string } | { type: 'resize'; cols: number; rows: number };

/**
 * Interactive terminal over WebSocket: ws://host/ws/terminal/:workspaceId
 * Docker driver → `docker exec` with a real TTY inside the sandbox container.
 * Local driver → plain host shell (no PTY), development only.
 */
@Injectable()
export class TerminalService {
  private readonly log = new Logger(TerminalService.name);
  private readonly docker = new Docker();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EXECUTION_DRIVER) private readonly driver: ExecutionDriver,
  ) {}

  attach(server: Server, allowedOrigin: string) {
    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req: IncomingMessage, socket, head) => {
      const m = req.url?.match(/^\/ws\/terminal\/([\w-]+)/);
      const origin = req.headers.origin;
      if (!m || (origin && origin !== allowedOrigin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => void this.handle(ws, m[1]).catch((e) => {
        ws.send(`\r\n\x1b[31m${(e as Error).message}\x1b[0m\r\n`);
        ws.close();
      }));
    });
  }

  private async handle(ws: WebSocket, workspaceId: string) {
    const w = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, include: { sectionAttempt: true } });
    if (!w) throw new Error('Workspace not found');
    if (w.sectionAttempt.status !== 'IN_PROGRESS') throw new Error('This section is no longer in progress.');
    if (w.status !== 'RUNNING' || !w.containerHandle) throw new Error(`Workspace is ${w.status.toLowerCase()} — the terminal opens once it is running.`);
    if (this.driver.name === 'local') return this.handleLocal(ws, w.hostPath);

    const container = this.docker.getContainer(w.containerHandle);
    const exec = await container.exec({
      Cmd: ['bash', '-l'],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      Env: ['TERM=xterm-256color', 'PS1=\\[\\e[32m\\]candidate\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]$ '],
      WorkingDir: '/workspace',
    });
    const stream = await exec.start({ hijack: true, stdin: true, Tty: true });
    stream.on('data', (d: Buffer) => ws.readyState === ws.OPEN && ws.send(d.toString('utf8')));
    stream.on('end', () => ws.close());
    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === 'input') stream.write(msg.data);
      else if (msg.type === 'resize' && msg.cols > 0 && msg.rows > 0) void exec.resize({ w: Math.min(msg.cols, 500), h: Math.min(msg.rows, 200) }).catch(() => undefined);
    });
    ws.on('close', () => {
      stream.write('exit\n');
      stream.end();
    });
  }

  private handleLocal(ws: WebSocket, cwd: string) {
    ws.send('\x1b[33m[local driver] UNSAFE host shell without a PTY — use the Docker driver for real assessments.\x1b[0m\r\n');
    const sh = spawn(process.env.SHELL || 'bash', ['-i'], { cwd, env: { ...process.env, TERM: 'dumb' } });
    const out = (d: Buffer) => ws.readyState === ws.OPEN && ws.send(d.toString('utf8').replace(/\n/g, '\r\n'));
    sh.stdout.on('data', out);
    sh.stderr.on('data', out);
    sh.on('exit', () => ws.close());
    let line = '';
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMsg;
        if (msg.type !== 'input') return;
        for (const ch of msg.data) {
          if (ch === '\r') {
            ws.send('\r\n');
            sh.stdin.write(line + '\n');
            line = '';
          } else if (ch === '\x7f') {
            if (line) {
              line = line.slice(0, -1);
              ws.send('\b \b');
            }
          } else if (ch === '\x03') {
            sh.kill('SIGINT');
            line = '';
          } else {
            line += ch;
            ws.send(ch);
          }
        }
      } catch {
        /* ignore */
      }
    });
    ws.on('close', () => sh.kill());
  }
}
