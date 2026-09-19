import { createShapeId, toRichText, type TLShapeId, type TLShapePartial } from 'tldraw';

import {
  assertShapeOp,
  type BoardSuggestion,
  PENDING_META_KEY,
  type ShapeOp,
} from './board-suggestion-ops';

export {
  assertBoardSuggestion,
  assertShapeOp,
  journeyStageSuggestion,
  mockSuggestionFromPrompt,
  partitionPending,
  PENDING_META_KEY,
  swimlaneSuggestion,
  type BoardSuggestion,
  type GeoColor,
  type PendingPartition,
  type ShapeOp,
} from './board-suggestion-ops';

export type SuggestionApplyPlan = {
  creates: TLShapePartial[];
  labelUpdates: { shapeId: TLShapeId; label: string }[];
  deletes: TLShapeId[];
};

function geoPartial(
  parentId: TLShapeId,
  op: Extract<ShapeOp, { kind: 'add_geo' | 'add_note' }>,
  suggestionId: string,
  fill: 'none' | 'semi' | 'solid',
): TLShapePartial {
  const color = op.color ?? (op.kind === 'add_note' ? 'yellow' : 'blue');
  return {
    id: createShapeId(),
    type: 'geo',
    x: op.x,
    y: op.y,
    parentId,
    meta: { [PENDING_META_KEY]: suggestionId },
    props: {
      geo: 'rectangle',
      w: op.w,
      h: op.h,
      richText: toRichText(op.label),
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

/** Map suggestion ops to tldraw creates / updates / deletes. */
export function suggestionToPartials(
  suggestion: BoardSuggestion,
  frameId: TLShapeId,
): SuggestionApplyPlan {
  const creates: TLShapePartial[] = [];
  const labelUpdates: { shapeId: TLShapeId; label: string }[] = [];
  const deletes: TLShapeId[] = [];

  for (let i = 0; i < suggestion.ops.length; i++) {
    const op = assertShapeOp(suggestion.ops[i], i);
    switch (op.kind) {
      case 'add_geo':
        creates.push(geoPartial(frameId, op, suggestion.id, 'semi'));
        break;
      case 'add_note':
        creates.push(geoPartial(frameId, op, suggestion.id, 'solid'));
        break;
      case 'update_label':
        labelUpdates.push({ shapeId: op.shapeId as TLShapeId, label: op.label });
        break;
      case 'delete_shape':
        deletes.push(op.shapeId as TLShapeId);
        break;
      default: {
        const _exhaustive: never = op;
        throw new Error(`Unhandled ShapeOp ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  return { creates, labelUpdates, deletes };
}
