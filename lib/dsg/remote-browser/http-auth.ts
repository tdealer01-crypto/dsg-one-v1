import {NextResponse} from 'next/server';
import {requireVerifiedDsgActor, type DsgPermission, type DsgServerActor} from '@/lib/dsg/server/context';

export type BrowserAuthResult =
  | {ok: true; actor: DsgServerActor}
  | {ok: false; response: NextResponse};

export async function authorizeRemoteBrowser(headers: Headers, permission: DsgPermission): Promise<BrowserAuthResult> {
  try {
    return {ok: true, actor: await requireVerifiedDsgActor(headers, permission)};
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DSG_AUTH_VERIFICATION_FAILED';
    const status = code === 'DSG_AUTH_REQUIRED' ? 401
      : code === 'DSG_CONTEXT_REQUIRED' || code === 'DSG_PERMISSION_DENIED' ? 403 : 503;
    return {
      ok: false,
      response: NextResponse.json(
        {ok: false, error: {code: status === 503 ? 'DSG_AUTH_VERIFICATION_FAILED' : code}},
        {status},
      ),
    };
  }
}
