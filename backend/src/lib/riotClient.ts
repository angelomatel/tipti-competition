import { RiotRequestQueue, type RiotQueueSnapshot } from '@/lib/riotQueue';
import { Tier, Division } from '@/types/Rank';

export enum TftQueueType {
  RANKED      = 'RANKED_TFT',
  TURBO       = 'RANKED_TFT_TURBO',
  DOUBLE_UP   = 'RANKED_TFT_PAIRS',
}

export enum TftQueueId {
  RANKED    = 1100,
  NORMAL    = 1090,
  TURBO     = 1130,
  DOUBLE_UP = 1160,
}

export interface AccountDTO {
  puuid: string;
  gameName?: string;
  tagLine?: string;
}

export interface MiniSeriesDTO {
  losses: number;
  progress: string;
  target: number;
  wins: number;
}

export interface TFTLeagueEntryDTO {
  leagueId: string;
  queueType: TftQueueType;
  tier: Tier;
  rank: Division;
  leaguePoints: number;
  wins: number;
  losses: number;
  veteran?: boolean;
  inactive?: boolean;
  freshBlood?: boolean;
  hotStreak?: boolean;
  miniSeries?: MiniSeriesDTO;
}

export interface TftMatchParticipantDTO {
  puuid: string;
  placement: number;
  [key: string]: any;
}

export interface TftMatchDTO {
  metadata: { match_id: string; participants: string[] };
  info: {
    game_datetime: number;
    queue_id: number;
    participants: TftMatchParticipantDTO[];
    [key: string]: any;
  };
}

export interface RiotClientOptions {
  apiKey?: string;
}

export interface RiotClientRequestMetrics {
  endpoint: string;
  queuedAt: number;
  startedAt: number;
  finishedAt: number;
  retryCount: number;
  rateLimitHitCount: number;
  statusCode: number | null;
  status: 'fulfilled' | 'rejected';
}

export type RiotClientQueueSnapshot = RiotQueueSnapshot;

export class RiotClient {
  private apiKey: string;
  private queue = new RiotRequestQueue();

  constructor(opts?: RiotClientOptions) {
    this.apiKey = opts?.apiKey ?? '';
    if (!this.apiKey) {
      throw new Error('Riot API key not set. Provide apiKey or set RIOT_API_KEY.');
    }
  }

  private mapRegionToHost(region = 'SEA'): string {
    switch (region.toUpperCase()) {
      // Regional routing (match/account endpoints)
      case 'SEA_REGIONAL': return 'sea.api.riotgames.com';
      case 'ASIA':         return 'asia.api.riotgames.com';
      case 'AMERICAS':     return 'americas.api.riotgames.com';
      case 'EUROPE':       return 'europe.api.riotgames.com';
      // Platform routing (league/summoner endpoints)
      case 'SEA':
      case 'SG':           return 'sg2.api.riotgames.com';
      case 'PH':           return 'ph2.api.riotgames.com';
      case 'TH':           return 'th2.api.riotgames.com';
      case 'TW':           return 'tw2.api.riotgames.com';
      case 'VN':           return 'vn2.api.riotgames.com';
      case 'EUW':          return 'euw1.api.riotgames.com';
      case 'NA':           return 'na1.api.riotgames.com';
      default:             return 'sg2.api.riotgames.com';
    }
  }

  getRequestMetricsSince(since: number): RiotClientRequestMetrics[] {
    return this.queue.getCompletedMetricsSince(since);
  }

  getQueueSnapshot(): RiotClientQueueSnapshot {
    return this.queue.getSnapshot();
  }

  private request(path: string, region: string, endpoint: string): Promise<any> {
    const host = this.mapRegionToHost(region);
    return this.queue.enqueue(path, host, this.apiKey, endpoint);
  }

  async getPuuidByRiotId(username: string, tagLine: string, region = 'ASIA'): Promise<string> {
    const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(username)}/${encodeURIComponent(tagLine)}`;
    const data: AccountDTO = await this.request(path, region, 'accountByRiotId');
    return data.puuid;
  }

  async getAccountByPuuid(puuid: string, region = 'ASIA'): Promise<AccountDTO> {
    const path = `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;
    return this.request(path, region, 'accountByPuuid');
  }

  async getTftLeagueByPuuid(puuid: string, region = 'SEA'): Promise<TFTLeagueEntryDTO[]> {
    const path = `/tft/league/v1/by-puuid/${encodeURIComponent(puuid)}`;
    return this.request(path, region, 'tftLeagueByPuuid');
  }

  async getMatchIdsByPuuid(puuid: string, count = 20, region = 'SEA_REGIONAL', startTime?: number): Promise<string[]> {
    let path = `/tft/match/v1/matches/by-puuid/${encodeURIComponent(puuid)}/ids?count=${count}`;
    if (startTime !== undefined) path += `&startTime=${startTime}`;
    return this.request(path, region, 'matchIdsByPuuid');
  }

  async getMatchById(matchId: string, region = 'SEA_REGIONAL'): Promise<TftMatchDTO> {
    const path = `/tft/match/v1/matches/${encodeURIComponent(matchId)}`;
    return this.request(path, region, 'matchById');
  }
}

export default RiotClient;
