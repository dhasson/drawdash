'use client';

import { WhiteboardCanvas } from '@/components/canvas/whiteboard-canvas';

export default function DemoPage() {
  return (
    <WhiteboardCanvas projectId="local-demo" localMode title="Free Demo" />
  );
}
