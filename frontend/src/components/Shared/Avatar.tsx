interface AvatarProps {
  src?: string;
  alt: string;
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-xl',
} as const;

const Avatar: React.FC<AvatarProps> = ({ src, alt, initials, size = 'md' }) => {
  const sizeClass = SIZE_CLASSES[size];

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold`} style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)' }}>
      {initials}
    </div>
  );
};

export default Avatar;
