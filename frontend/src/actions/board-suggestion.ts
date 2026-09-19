'use client';

import {
  mockSuggestionFromPrompt,
  type BoardSuggestion,
} from '@/lib/board-suggestion-ops';

export interface SuggestBoardResponse {
  suggestion: BoardSuggestion;
  provider: string;
  credits_remaining?: number | null;
}

/** Call backend /api/suggest-board. Falls back to local mock if the API is down. */
export async function suggestBoard(
  prompt: string,
  projectId: string,
): Promise<SuggestBoardResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  try {
    const response = await fetch(`${apiUrl}/api/suggest-board`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, project_id: projectId }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Suggest failed (${response.status})`);
    }
    return response.json();
  } catch (err) {
    // Local fallback keeps /demo usable if backend is mid-restart.
    if (err instanceof Error && /Suggest failed|402|400|500/.test(err.message)) {
      throw err;
    }
    console.warn('suggest-board unreachable; using local mock', err);
    await new Promise((r) => setTimeout(r, 40));
    return {
      suggestion: mockSuggestionFromPrompt(prompt),
      provider: 'local-mock-fallback',
      credits_remaining: null,
    };
  }
}

/** @deprecated Prefer suggestBoard. Kept for unit fixtures. */
export async function mockSuggestBoard(prompt: string): Promise<BoardSuggestion> {
  const result = await suggestBoard(prompt, 'local-demo');
  return result.suggestion;
}
