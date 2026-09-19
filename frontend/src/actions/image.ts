'use client';

export interface GenerateImageRequest {
  prompt: string;
  image_data?: string | null;
  project_id: string;
  type: 'generate' | 'edit';
}

export interface GenerateImageResponse {
  image_data: string;
  text_response?: string;
  credits_remaining?: number | null;
}

export interface CreditsBalanceResponse {
  enabled: boolean;
  credits_remaining: number;
  account_id: string;
}

export async function fetchCredits(projectId: string): Promise<CreditsBalanceResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const response = await fetch(
    `${apiUrl}/api/generate-image/credits?project_id=${encodeURIComponent(projectId)}`,
  );
  if (!response.ok) {
    throw new Error('Failed to load credits');
  }
  return response.json();
}

export async function generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const response = await fetch(`${apiUrl}/api/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to generate image');
  }

  return response.json();
}
