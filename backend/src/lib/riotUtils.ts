import type { TFTLeagueEntryDTO } from '@/types/RiotAPI';
import { TftQueueType } from '@/lib/riotClient';

/** Returns the ranked TFT league entry from a list of league entries, or undefined if not ranked. */
export function findRankedEntry(entries: TFTLeagueEntryDTO[]): TFTLeagueEntryDTO | undefined {
  return entries.find((e) => e.queueType === TftQueueType.RANKED);
}
