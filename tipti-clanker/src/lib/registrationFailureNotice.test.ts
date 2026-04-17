import { describe, expect, it } from 'vitest';
import {
  buildRegistrationFailureNoticeContent,
  shouldSendRegistrationFailureNotice,
} from '@/lib/registrationFailureNotice';
import { PUBLIC_ERROR_MESSAGES } from '@/lib/publicCommandErrors';

describe('registrationFailureNotice', () => {
  it('skips channel notices for already-registered failures', () => {
    expect(shouldSendRegistrationFailureNotice(PUBLIC_ERROR_MESSAGES.alreadyRegistered)).toBe(false);
  });

  it('builds a retry notice for retryable failures', () => {
    expect(
      buildRegistrationFailureNoticeContent(
        '123',
        'Failed to verify Riot account: Could not find that Riot account.',
      ),
    ).toBe(
      '<@123> your registration failed. Failed to verify Riot account: Could not find that Riot account. Please run `/register` again.',
    );
  });

  it('does not duplicate the retry instruction when the user message already includes it', () => {
    expect(
      buildRegistrationFailureNoticeContent(
        '123',
        'God selection timed out after 3 minutes. Run `/register` again.',
      ),
    ).toBe(
      '<@123> your registration failed. God selection timed out after 3 minutes. Please run `/register` again.',
    );
  });
});
