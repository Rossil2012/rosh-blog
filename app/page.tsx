import dynamic from 'next/dynamic';

const Rosh = dynamic(() => import('@/components/Terminal'), { ssr: false });

export default function Home() {
  return (
    <Rosh />
  );
}
