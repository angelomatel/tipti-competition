import { getGodColor } from '@/src/lib/godColors';

interface GodPillProps {
  slug: string;
  name?: string | null;
}

const GodPill: React.FC<GodPillProps> = ({ slug, name }) => {
  const colors = getGodColor(slug);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-wider"
      style={{ color: colors.primary, backgroundColor: colors.bgTint, border: `1px solid ${colors.border}` }}
    >
      {name || slug.replace('_', ' ')}
    </span>
  );
};

export default GodPill;
