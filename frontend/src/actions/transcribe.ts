'use client';

export interface TranscribeRequest {
  audio_data: string;
  mime_type?: string;
}

export interface TranscribeResponse {
  transcript: string;
}

export async function transcribeAudio(
  request: TranscribeRequest,
): Promise<TranscribeResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const response = await fetch(`${apiUrl}/api/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to transcribe audio');
  }

  return response.json();
}
