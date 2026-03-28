import pino from 'pino';

const level = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

export const logger = pino({
  level,
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
