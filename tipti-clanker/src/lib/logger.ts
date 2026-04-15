import pino from 'pino';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Writable } from 'node:stream';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const isProduction = process.env.NODE_ENV === 'production';
const logFilePath = resolve(process.cwd(), process.env.LOG_FILE_PATH ?? 'logs/app.jsonl');
const consoleColorsEnabled = process.env.NO_COLOR !== '1' && process.env.NO_COLOR !== 'true';

type LogRecord = {
  level?: number | string;
  msg?: unknown;
  time?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

const levelColorsByNumber: Record<number, string> = {
  10: '\x1b[90m',
  20: '\x1b[36m',
  30: '\x1b[32m',
  40: '\x1b[33m',
  50: '\x1b[31m',
  60: '\x1b[35m',
};

const levelColorsByLabel: Record<string, string> = {
  trace: '\x1b[90m',
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
};

function colorizeMessage(record: LogRecord, message: string) {
  if (!consoleColorsEnabled) {
    return message;
  }

  const color =
    typeof record.level === 'number'
      ? levelColorsByNumber[record.level]
      : typeof record.level === 'string'
        ? levelColorsByLabel[record.level]
        : undefined;
  return color ? `${color}${message}\x1b[0m` : message;
}

function createStructuredFileStream(path: string) {
  const destination = pino.destination({ dest: path, sync: false });

  return new Writable({
    write(chunk, _encoding, callback) {
      const line = chunk.toString().trimEnd();

      try {
        const record = JSON.parse(line) as LogRecord;
        const { msg, time, level, data, ...fields } = record;
        const payload = {
          msg: typeof msg === 'string' ? msg : String(msg ?? ''),
          data: {
            ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
            ...fields,
          },
          time,
          level,
        };

        destination.write(`${JSON.stringify(payload)}\n`);
        callback();
      } catch {
        destination.write(`${line}\n`);
        callback();
      }
    },
  });
}

const msgOnlyConsoleStream = new Writable({
  write(chunk, _encoding, callback) {
    const line = chunk.toString().trimEnd();

    try {
      const record = JSON.parse(line) as LogRecord;
      const message = typeof record.msg === 'string' ? record.msg : line;
      process.stdout.write(`${colorizeMessage(record, message)}\n`, callback);
    } catch {
      process.stdout.write(`${line}\n`, callback);
    }
  },
});

function createProductionLogger() {
  mkdirSync(dirname(logFilePath), { recursive: true });

  return pino(
    {
      base: undefined,
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
    },
    pino.multistream([
      { stream: msgOnlyConsoleStream },
      { stream: createStructuredFileStream(logFilePath) },
    ]),
  );
}

export const logger = isProduction
  ? createProductionLogger()
  : pino({
      level,
      transport: { target: 'pino-pretty', options: { colorize: true } },
    });
