import Image from 'next/image';

const GOD_AVATAR_MAP: Record<string, string> = {
  varus: '/space_gods/avatars/0_Varus.png',
  ekko: '/space_gods/avatars/1_Ekko.png',
  evelynn: '/space_gods/avatars/2_Evelynn.png',
  thresh: '/space_gods/avatars/3_Thresh.png',
  yasuo: '/space_gods/avatars/4_Yasuo.png',
  soraka: '/space_gods/avatars/5_Soraka.png',
  kayle: '/space_gods/avatars/6_Kayle.png',
  ahri: '/space_gods/avatars/7_Ahri.png',
  aurelion_sol: '/space_gods/avatars/8_AurelionSol.png',
};

const GOD_IMAGE_MAP: Record<string, string> = {
  varus: '/space_gods/0_Varus.png',
  ekko: '/space_gods/1_Ekko.png',
  evelynn: '/space_gods/2_Evelynn.png',
  thresh: '/space_gods/3_Thresh.png',
  yasuo: '/space_gods/4_Yasuo.png',
  soraka: '/space_gods/5_Soraka.png',
  kayle: '/space_gods/6_Kayle.png',
  ahri: '/space_gods/7_Ahri.png',
  aurelion_sol: '/space_gods/8_AurelionSol.png',
};

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
        <span className="text-xs text-violet-300/80">{name}</span>
      )}
    </span>
  );
};

export default GodBadge;
export { GOD_IMAGE_MAP, GOD_AVATAR_MAP };
