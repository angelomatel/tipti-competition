import mongoose, { Schema } from 'mongoose';
import type { PlayerDocument } from '@/types/Player';

const PlayerSchema = new Schema<PlayerDocument>({
  discordId:     { type: String, required: true, unique: true },
  puuid:         { type: String, required: true, unique: true },
  gameName:      { type: String, required: true },
  tagLine:       { type: String, required: true },
  riotId:        { type: String, required: true },
  registeredAt:  { type: Date, default: () => new Date() },
  addedBy:       { type: String, required: true },
  isActive:      { type: Boolean, default: true },
  currentTier:   { type: String, default: 'UNRANKED' },
  currentRank:   { type: String, default: '' },
  currentLP:     { type: Number, default: 0 },
  currentWins:      { type: Number, default: 0 },
  currentLosses:    { type: Number, default: 0 },
  discordAvatarUrl:    { type: String, default: '' },
  discordUsername:     { type: String, default: '' },
  godSlug:             { type: String, default: null },
  isEliminatedFromGod: { type: Boolean, default: false },
});

export const Player = mongoose.model<PlayerDocument>('Player', PlayerSchema, 'players');
