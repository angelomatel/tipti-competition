import Image from 'next/image';
import { Tier } from '@/src/types/Rank';

interface RankImageProps {
  tier: string;
  size?: number;
}

const TIER_TO_IMAGE_SRC: Record<Tier, string> = {
  [Tier.UNRANKED]:    '/ranks/0_unranked.png',
  [Tier.IRON]:        '/ranks/1_iron.png',
  [Tier.BRONZE]:      '/ranks/2_bronze.png',
  [Tier.SILVER]:      '/ranks/3_silver.png',
  [Tier.GOLD]:        '/ranks/4_gold.png',
  [Tier.PLATINUM]:    '/ranks/5_platinum.png',
  [Tier.EMERALD]:     '/ranks/6_emerald.png',
  [Tier.DIAMOND]:     '/ranks/7_diamond.png',
  [Tier.MASTER]:      '/ranks/8_master.png',
  [Tier.GRANDMASTER]: '/ranks/9_grandmaster.png',
  [Tier.CHALLENGER]:  '/ranks/10_challenger.png',
};

const RankImage: React.FC<RankImageProps> = ({ tier, size = 40 }) => {
  const normalized = tier.trim().toUpperCase() as Tier;
  const src = TIER_TO_IMAGE_SRC[normalized] ?? TIER_TO_IMAGE_SRC[Tier.UNRANKED];

  return (
    <Image
      src={src}
      alt={tier}
      width={size}
      height={size}
      className="object-contain"
    />
  );
};

export default RankImage;
