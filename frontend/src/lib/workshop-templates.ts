import { createShapeId, toRichText, type TLShapeId, type TLShapePartial } from 'tldraw';

export type WorkshopTemplateId =
  | 'journey'
  | 'prioritization-2x2'
  | 'sticky-cluster'
  | 'service-map';

export interface WorkshopTemplateMeta {
  id: WorkshopTemplateId;
  label: string;
  description: string;
}

export const WORKSHOP_TEMPLATES: WorkshopTemplateMeta[] = [
  {
    id: 'journey',
    label: 'Journey map',
    description: 'Stages across a participant journey',
  },
  {
    id: 'prioritization-2x2',
    label: 'Prioritization 2×2',
    description: 'Impact vs effort quadrants',
  },
  {
    id: 'sticky-cluster',
    label: 'Sticky cluster',
    description: 'Notes for affinity grouping',
  },
  {
    id: 'service-map',
    label: 'Service map',
    description: 'Boxes for systems and handoffs',
  },
];

type BoxColor = 'black' | 'blue' | 'green' | 'orange' | 'violet' | 'red' | 'yellow';

function box(
  parentId: TLShapeId,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: BoxColor = 'black',
  fill: 'none' | 'semi' | 'solid' = 'semi',
): TLShapePartial {
  return {
    id: createShapeId(),
    type: 'geo',
    x,
    y,
    parentId,
    props: {
      geo: 'rectangle',
      w,
      h,
      richText: toRichText(label),
      color,
      fill,
      dash: 'draw',
      size: 'm',
      font: 'sans',
      align: 'middle',
      verticalAlign: 'middle',
      labelColor: 'black',
      url: '',
      growY: 0,
      scale: 1,
    },
  };
}

/** Build tldraw shape partials for a workshop template inside a Drawing Area frame. */
export function buildWorkshopTemplateShapes(
  templateId: WorkshopTemplateId,
  frameId: TLShapeId,
  frameW: number,
  frameH: number,
): TLShapePartial[] {
  const pad = 24;
  const innerW = Math.max(frameW - pad * 2, 200);
  const innerH = Math.max(frameH - pad * 2, 160);

  switch (templateId) {
    case 'journey': {
      const stages = ['Discover', 'Decide', 'Onboard', 'Adopt', 'Expand'];
      const gap = 12;
      const stageW = (innerW - gap * (stages.length - 1)) / stages.length;
      const stageH = Math.min(120, innerH * 0.35);
      const y = pad + innerH * 0.25;
      return stages.map((label, i) =>
        box(frameId, pad + i * (stageW + gap), y, stageW, stageH, label, 'blue'),
      );
    }
    case 'prioritization-2x2': {
      const midX = frameW / 2;
      const midY = frameH / 2;
      const qw = innerW / 2 - 8;
      const qh = innerH / 2 - 8;
      return [
        box(frameId, pad, pad, qw, qh, 'High impact\nLow effort', 'green'),
        box(frameId, midX + 4, pad, qw, qh, 'High impact\nHigh effort', 'orange'),
        box(frameId, pad, midY + 4, qw, qh, 'Low impact\nLow effort', 'black', 'none'),
        box(frameId, midX + 4, midY + 4, qw, qh, 'Low impact\nHigh effort', 'red'),
      ];
    }
    case 'sticky-cluster': {
      const colors: BoxColor[] = ['yellow', 'violet', 'green', 'orange', 'blue', 'red'];
      const cols = 3;
      const noteW = Math.min(140, (innerW - 24) / cols);
      const noteH = 72;
      const shapes: TLShapePartial[] = [];
      for (let i = 0; i < 6; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        shapes.push(
          box(
            frameId,
            pad + col * (noteW + 12),
            pad + row * (noteH + 12),
            noteW,
            noteH,
            `Note ${i + 1}`,
            colors[i],
            'solid',
          ),
        );
      }
      return shapes;
    }
    case 'service-map': {
      const nodes = [
        { label: 'Client', x: pad, y: pad + 40 },
        { label: 'API', x: pad + innerW * 0.35, y: pad + 40 },
        { label: 'Data', x: pad + innerW * 0.7, y: pad + 40 },
        { label: 'Ops', x: pad + innerW * 0.35, y: pad + innerH * 0.55 },
      ];
      const nodeW = Math.min(140, innerW * 0.25);
      const nodeH = 72;
      return nodes.map((n) => box(frameId, n.x, n.y, nodeW, nodeH, n.label, 'violet'));
    }
    default: {
      const _exhaustive: never = templateId;
      return _exhaustive;
    }
  }
}
