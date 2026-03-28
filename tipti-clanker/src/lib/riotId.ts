export interface ParsedRiotId {
  gameName: string;
  tagLine: string;
  isValid: boolean;
}

/** Parses a Riot ID string in "GameName#TAG" format. */
export function parseRiotId(account: string): ParsedRiotId {
  const parts = account.trim().split('#');
  const gameName = parts[0] ?? '';
  const tagLine = parts[1] ?? '';
  return { gameName, tagLine, isValid: !!(gameName && tagLine) };
}
