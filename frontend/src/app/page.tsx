'use client';

import { useRouter } from 'next/navigation';

import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/demo');
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      Redirecting to free demo...
    </div>
  );
}
