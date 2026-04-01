import Image from 'next/image';

interface AvatarProps {
  src?: string;
  alt: string;
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 32,
  md: 40,
  lg: 56,
} as const;

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-xl',
} as const;

const Avatar: React.FC<AvatarProps> = ({ src, alt, initials, size = 'md' }) => {
  const sizeClass = SIZE_CLASSES[size];
  const pixelSize = SIZE_MAP[size];

  if (src) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden relative`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${pixelSize}px`}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold`} style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)' }}>
      {initials}
    </div>
  );
};

export default Avatar;
