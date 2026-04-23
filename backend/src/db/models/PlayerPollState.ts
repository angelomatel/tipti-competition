import mongoose, { Schema } from 'mongoose';
import type { PlayerPollStateDocument } from '@/types/PlayerPollState';

const PlayerPollStateSchema = new Schema<PlayerPollStateDocument>({
  playerId: { type: String, required: true, unique: true },
  puuid: { type: String, required: true },
  mode: { type: String, enum: ['baseline', 'hot'], default: 'baseline' },
  lastProcessedAt: { type: Date, default: null },
  lastRankPollAt: { type: Date, default: null },
  lastMatchPollAt: { type: Date, default: null },
  lastObservedActivityAt: { type: Date, default: null },
  enteredHotAt: { type: Date, default: null },
  consecutiveIdleHotPolls: { type: Number, default: 0 },
  unresolvedMatchCount: { type: Number, default: 0 },
  deferredMatchDetailCount: { type: Number, default: 0 },
  pendingMatchFetch: { type: Boolean, default: false },
  nextEligibleAt: { type: Date, default: null },
});

PlayerPollStateSchema.index({ mode: 1, nextEligibleAt: 1 });
PlayerPollStateSchema.index({ puuid: 1 });

export const PlayerPollState = mongoose.model<PlayerPollStateDocument>(
  'PlayerPollState',
  PlayerPollStateSchema,
  'player_poll_states',
);
