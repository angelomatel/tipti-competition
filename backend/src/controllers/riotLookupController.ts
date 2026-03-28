import type { Request, Response, NextFunction } from 'express';
import { getRiotClient } from '@/services/riotService';

export async function lookupAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const gameName = req.params['gameName'] as string;
    const tagLine = req.params['tagLine'] as string;

    const riot = getRiotClient();
    const puuid = await riot.getPuuidByRiotId(gameName, tagLine);
    const account = await riot.getAccountByPuuid(puuid);
    const leagueEntries = await riot.getTftLeagueByPuuid(puuid);
    const ranked = leagueEntries.find((e) => e.queueType === 'RANKED_TFT');

    res.json({
      gameName: account.gameName ?? gameName,
      tagLine: account.tagLine ?? tagLine,
      tier: ranked?.tier ?? 'UNRANKED',
      rank: ranked?.rank ?? '',
      leaguePoints: ranked?.leaguePoints ?? 0,
      wins: ranked?.wins ?? 0,
      losses: ranked?.losses ?? 0,
      freshBlood: ranked?.freshBlood ?? false,
      hotStreak: ranked?.hotStreak ?? false,
    });
  } catch (err: any) {
    if (err.message?.includes('404') || err.message?.includes('not found')) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    next(err);
  }
}
