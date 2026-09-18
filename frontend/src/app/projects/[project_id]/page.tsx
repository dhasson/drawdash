'use client';

import { useParams } from 'next/navigation';

import { WhiteboardCanvas } from '@/components/canvas/whiteboard-canvas';

export default function ProjectCanvasPage() {
  const params = useParams();
  const projectId = params.project_id as string;

  return <WhiteboardCanvas projectId={projectId} />;
}
