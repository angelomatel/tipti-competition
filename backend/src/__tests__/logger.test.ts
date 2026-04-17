import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMkdirSync = vi.fn();
const mockWrite = vi.fn();
const mockPino = vi.fn(() => ({ name: 'logger' }));
const mockDestination = vi.fn(() => ({ write: mockWrite }));
const mockMultistream = vi.fn(() => ({ name: 'multistream' }));

vi.mock('node:fs', () => ({
  mkdirSync: mockMkdirSync,
}));

vi.mock('pino', () => {
  const pino = Object.assign(mockPino, {
    destination: mockDestination,
    multistream: mockMultistream,
    stdTimeFunctions: {
      isoTime: 'isoTime',
    },
  });

  return { default: pino };
});

describe('logger config', () => {
  beforeEach(() => {
    vi.resetModules();
    mockMkdirSync.mockReset();
    mockWrite.mockReset();
    mockPino.mockReset();
    mockDestination.mockReset();
    mockMultistream.mockReset();
    mockPino.mockReturnValue({ name: 'logger' });
    mockDestination.mockReturnValue({ write: mockWrite });
    mockMultistream.mockReturnValue({ name: 'multistream' });
  });

  it('uses centralized constants for development logger defaults', async () => {
    vi.doMock('@/constants', () => ({
      IS_PRODUCTION: false,
      LOG_LEVEL: 'debug',
      LOG_FILE_PATH: 'logs/app.jsonl',
      LOG_CONSOLE_COLORS_ENABLED: true,
    }));

    await import('@/lib/logger');

    expect(mockPino).toHaveBeenCalledWith({
      level: 'debug',
      transport: { target: 'pino-pretty', options: { colorize: true } },
    });
  });

  it('uses centralized constants for production logger defaults', async () => {
    vi.doMock('@/constants', () => ({
      IS_PRODUCTION: true,
      LOG_LEVEL: 'info',
      LOG_FILE_PATH: 'logs/app.jsonl',
      LOG_CONSOLE_COLORS_ENABLED: false,
    }));

    await import('@/lib/logger');

    expect(mockMkdirSync).toHaveBeenCalled();
    expect(mockPino).toHaveBeenCalledWith(
      expect.objectContaining({
        base: undefined,
        level: 'info',
      }),
      { name: 'multistream' },
    );
  });
});
