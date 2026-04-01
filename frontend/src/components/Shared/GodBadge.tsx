import Image from 'next/image';
import { GOD_AVATAR_MAP } from '@/src/lib/godData';

interface GodBadgeProps {
  slug: string;
  name?: string | null;
  size?: number;
  showName?: boolean;
}

const GodBadge: React.FC<GodBadgeProps> = ({ slug, name, size = 20, showName = true }) => {
  const imageSrc = GOD_AVATAR_MAP[slug];
  if (!imageSrc) return null;

  return (
    <span className="inline-flex items-center gap-1">
      <Image
        src={imageSrc}
        alt={name ?? slug}
        width={size}
        height={size}
        className="rounded-full"
      />
      {showName && name && (
        <span className="text-xs text-text-secondary/80">{name}</span>
      )}
    </span>
  );
};

export default GodBadge;
