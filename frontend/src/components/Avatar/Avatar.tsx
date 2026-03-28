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
    <div className={`${sizeClass} rounded-full bg-violet-800 flex items-center justify-center text-white font-bold`}>
      {initials}
    </div>
  );
};

export default Avatar;
