import { TIER_COLORS } from '@/src/lib/theme';

interface TierBadgeProps {
  tier: string;
  display: string;
}

const TierBadge: React.FC<TierBadgeProps> = ({ tier, display }) => (
  <span className="text-xs font-medium" style={{ color: TIER_COLORS[tier] || TIER_COLORS.UNRANKED }}>
    {display}
  </span>
);

export default TierBadge;
