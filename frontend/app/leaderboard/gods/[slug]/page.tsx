import type { Metadata } from 'next';
import { BUFF_DATA } from '@/src/lib/godData';
import GodSlugPageClient from './GodSlugPageClient';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const god = BUFF_DATA.find((g) => g.slug === slug);
  const godName = god ? god.name : slug.charAt(0).toUpperCase() + slug.slice(1);

  return {
    title: godName,
  };
}

export default async function GodSlugPage({ params }: Props) {
  const { slug } = await params;

  return <GodSlugPageClient slug={slug} />;
}
