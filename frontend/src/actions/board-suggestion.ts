'use client';

import {
  mockSuggestionFromPrompt,
  type BoardSuggestion,
} from '@/lib/board-suggestion-ops';

/** Local mock suggest. No deAPI. Used until PR-B3 wires /api/suggest-board. */
export async function mockSuggestBoard(prompt: string): Promise<BoardSuggestion> {
  await new Promise((r) => setTimeout(r, 40));
  return mockSuggestionFromPrompt(prompt);
}
