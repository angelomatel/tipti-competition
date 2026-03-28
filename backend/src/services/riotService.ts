import { RiotClient } from '@/lib/riotClient';
import { RIOT_API_KEY } from '@/constants';

let client: RiotClient | null = null;

export function getRiotClient(): RiotClient {
  if (!client) {
    client = new RiotClient({ apiKey: RIOT_API_KEY });
  }
  return client;
}
