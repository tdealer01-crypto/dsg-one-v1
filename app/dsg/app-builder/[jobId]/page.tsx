import { AppBuilderJobDetailClient } from '@/components/dsg/app-builder/AppBuilderJobDetailClient';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <AppBuilderJobDetailClient jobId={jobId} />;
}
