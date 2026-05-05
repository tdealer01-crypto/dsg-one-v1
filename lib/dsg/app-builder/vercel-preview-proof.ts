export type DeployProof = {
  status: 'BLOCK' | 'PREVIEW_DEPLOYED' | 'PASS';
  preview_url?: string;
  reason?: string;
};

export function verifyVercelPreview(url?: string): DeployProof {
  if (!url) return { status: 'BLOCK', reason: 'MISSING_PREVIEW_URL' };

  return {
    status: 'PREVIEW_DEPLOYED',
    preview_url: url,
    reason: 'URL_PRESENT_ONLY_HEALTH_AND_VERCEL_API_PROOF_REQUIRED',
  };
}
