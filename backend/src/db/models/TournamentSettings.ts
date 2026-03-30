import mongoose, { Schema, Document } from 'mongoose';

export interface IPhase {
  phase: number;
  startDay: string;
  endDay: string;
  eliminationCount: number;
}

export interface ITournamentSettings {
  name: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  feedChannelId: string;
  dailyChannelId: string;
  godStandingsChannelId: string;
  auditChannelId: string;
  phases: IPhase[];
  currentPhase: number;
  buffsEnabled: boolean;
}

export type TournamentSettingsDocument = ITournamentSettings & Document;

const PhaseSchema = new Schema<IPhase>({
  phase:            { type: Number, required: true },
  startDay:         { type: String, required: true },
  endDay:           { type: String, required: true },
  eliminationCount: { type: Number, required: true },
}, { _id: false });

const TournamentSettingsSchema = new Schema<TournamentSettingsDocument>({
  name:                  { type: String,   required: true },
  startDate:             { type: Date,     required: true },
  endDate:               { type: Date,     required: true },
  createdAt:             { type: Date,     default: () => new Date() },
  feedChannelId:         { type: String,   default: '' },
  dailyChannelId:        { type: String,   default: '' },
  godStandingsChannelId: { type: String,   default: '' },
  auditChannelId:        { type: String,   default: '' },
  phases:                { type: [PhaseSchema], default: [] },
  currentPhase:          { type: Number,   default: 1 },
  buffsEnabled:          { type: Boolean,  default: false },
});

export const TournamentSettings = mongoose.model<TournamentSettingsDocument>(
  'TournamentSettings',
  TournamentSettingsSchema,
  'tournament_settings',
);
