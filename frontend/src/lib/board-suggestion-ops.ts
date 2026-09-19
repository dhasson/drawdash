export const PENDING_META_KEY = 'pendingSuggestionId' as const;

export type ShapeOp =
  | {
      kind: 'add_geo';
      x: number;
      y: number;
      w: number;
      h: number;
      label: string;
      color?: GeoColor;
    }
  | {
      kind: 'add_note';
      x: number;
      y: number;
      w: number;
      h: number;
      label: string;
      color?: GeoColor;
    }
  | {
      kind: 'update_label';
      shapeId: string;
      label: string;
    }
  | {
      kind: 'delete_shape';
      shapeId: string;
    };

export type GeoColor = 'black' | 'blue' | 'green' | 'orange' | 'violet' | 'red' | 'yellow';

export interface BoardSuggestion {
  id: string;
  ops: ShapeOp[];
}

export interface PendingPartition {
  pendingIds: string[];
  otherIds: string[];
}

type ShapeMetaView = {
  id: string;
  meta?: Record<string, unknown> | null;
};

/** Fail loud on unknown or malformed ops before canvas apply. */
export function assertShapeOp(op: unknown, index: number): ShapeOp {
  if (!op || typeof op !== 'object') {
    throw new Error(`ShapeOp[${index}] is not an object`);
  }
  const rec = op as Record<string, unknown>;
  const kind = rec.kind;
  if (kind === 'add_geo' || kind === 'add_note') {
    for (const key of ['x', 'y', 'w', 'h'] as const) {
      if (typeof rec[key] !== 'number') {
        throw new Error(`ShapeOp[${index}] ${kind} missing number ${key}`);
      }
    }
    if (typeof rec.label !== 'string') {
      throw new Error(`ShapeOp[${index}] ${kind} missing string label`);
    }
    return op as ShapeOp;
  }
  if (kind === 'update_label') {
    if (typeof rec.shapeId !== 'string' || typeof rec.label !== 'string') {
      throw new Error(`ShapeOp[${index}] update_label needs shapeId and label`);
    }
    return op as ShapeOp;
  }
  if (kind === 'delete_shape') {
    if (typeof rec.shapeId !== 'string') {
      throw new Error(`ShapeOp[${index}] delete_shape needs shapeId`);
    }
    return op as ShapeOp;
  }
  throw new Error(`ShapeOp[${index}] unknown kind ${String(kind)}`);
}

export function assertBoardSuggestion(raw: unknown): BoardSuggestion {
  if (!raw || typeof raw !== 'object') {
    throw new Error('BoardSuggestion is not an object');
  }
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== 'string' || !rec.id) {
    throw new Error('BoardSuggestion.id must be a non-empty string');
  }
  if (!Array.isArray(rec.ops)) {
    throw new Error('BoardSuggestion.ops must be an array');
  }
  const ops = rec.ops.map((op, i) => assertShapeOp(op, i));
  return { id: rec.id, ops };
}

/** Split child ids by pendingSuggestionId meta for Tab commit / Esc reject. */
export function partitionPending(
  shapes: ShapeMetaView[],
  suggestionId: string,
): PendingPartition {
  const pendingIds: string[] = [];
  const otherIds: string[] = [];
  for (const shape of shapes) {
    const pending = shape.meta?.[PENDING_META_KEY];
    if (pending === suggestionId) {
      pendingIds.push(shape.id);
    } else {
      otherIds.push(shape.id);
    }
  }
  return { pendingIds, otherIds };
}

/** Fixture used by unit gate and mock Ask path. */
export function journeyStageSuggestion(suggestionId = 'sug-journey-1'): BoardSuggestion {
  const stages = ['Discover', 'Decide', 'Onboard', 'Adopt', 'Expand'];
  const gap = 12;
  const pad = 24;
  const stageW = 100;
  const stageH = 120;
  const y = 80;
  return {
    id: suggestionId,
    ops: stages.map((label, i) => ({
      kind: 'add_geo' as const,
      x: pad + i * (stageW + gap),
      y,
      w: stageW,
      h: stageH,
      label,
      color: 'blue' as const,
    })),
  };
}

/** Horizontal swimlanes under an existing journey frame. */
export function swimlaneSuggestion(
  labels: string[],
  suggestionId = 'sug-lanes-1',
): BoardSuggestion {
  const pad = 24;
  const laneH = 36;
  const laneW = 560;
  const startY = 280;
  return {
    id: suggestionId,
    ops: labels.map((label, i) => ({
      kind: 'add_geo' as const,
      x: pad,
      y: startY + i * (laneH + 8),
      w: laneW,
      h: laneH,
      label: `${label} swimlane`,
      color: 'blue' as const,
    })),
  };
}

/** Pick a mock suggestion from the Ask prompt text. */
export function mockSuggestionFromPrompt(prompt: string): BoardSuggestion {
  const id = `sug-${Date.now()}`;
  const lower = prompt.toLowerCase();
  if (
    /lane|passenger|aircraft|suitcase|baggage|swim/.test(lower)
  ) {
    return swimlaneSuggestion(['Passenger', 'Aircraft', 'Suitcase'], id);
  }
  return {
    id,
    ops: [
      {
        kind: 'add_note',
        x: 40,
        y: 260,
        w: 160,
        h: 72,
        label: prompt.trim().slice(0, 80) || 'Note',
        color: 'yellow',
      },
    ],
  };
}
