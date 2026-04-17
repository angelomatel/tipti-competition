import mongoose, { Schema } from 'mongoose';
import type { MatchRecordDocument } from '@/types/Player';

const MatchRecordSchema = new Schema<MatchRecordDocument>({
  puuid:       { type: String, required: true },
  matchId:     { type: String, required: true },
  placement:   { type: Number, required: true },
  playedAt:    { type: Date, required: true },
  capturedAt:      { type: Date, default: () => new Date() },
  notifiedAt:      { type: Date, default: null },
  buffProcessed:   { type: Boolean, default: false },
  lpAttributionStatus: { type: String, enum: ['linked', 'ambiguous'], default: null },
  lpAttributionReason: { type: String, enum: ['multiple_matches_single_delta'], default: null },
});

MatchRecordSchema.index({ puuid: 1, matchId: 1 }, { unique: true });
MatchRecordSchema.index({ buffProcessed: 1, puuid: 1 });
MatchRecordSchema.index({ buffProcessed: 1, playedAt: 1 });
MatchRecordSchema.index({ notifiedAt: 1, playedAt: 1 });
MatchRecordSchema.index({ puuid: 1, playedAt: -1 });
MatchRecordSchema.index({ puuid: 1, capturedAt: -1 });

export const MatchRecord = mongoose.model<MatchRecordDocument>('MatchRecord', MatchRecordSchema, 'match_records');
