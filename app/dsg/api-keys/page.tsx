'use client';

import { useEffect, useState } from 'react';
import { Key, Copy, Check, Trash2, ExternalLink, RefreshCw } from 'lucide-react';

type KeyRow = {
  key_id: string;
  key_prefix: string;
  label: string;
  plan_id: string;
  calls_limit: number;
  period_start: string;
  period_end: string;
  created_at: string;
  stripe_subscription_id: string | null;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState<{ keyId: string; rawKey: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [label, setLabel] = useState('Default');
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch('/api/dsg/mcp/keys');
      if (!res.ok) throw new Error(await res.text());
      const { data } = await res.json() as { data: KeyRow[] };
      setKeys(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchKeys(); }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/dsg/mcp/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { data } = await res.json() as { data: { keyId: string; rawKey: string; keyPrefix: string; label: string } };
      setNewKey({ keyId: data.keyId, rawKey: data.rawKey });
      await fetchKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate key');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setRevoking(keyId);
    setError(null);
    try {
      const res = await fetch(`/api/dsg/mcp/keys?keyId=${keyId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setKeys((prev) => prev.filter((k) => k.key_id !== keyId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke key');
    } finally {
      setRevoking(null);
    }
  }

  async function handleSubscribe(keyId: string) {
    setSubscribing(keyId);
    setError(null);
    try {
      const res = await fetch('/api/dsg/mcp/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { data } = await res.json() as { data: { checkoutUrl: string } };
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
      setSubscribing(null);
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="rounded-3xl border border-violet-500/20 bg-violet-500/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-violet-400" />
            <div>
              <h1 className="text-lg font-bold text-violet-100">API Keys</h1>
              <p className="mt-0.5 text-sm text-violet-300/70">
                DSG ONE MCP access — ฿490/month · 10,000 calls/month
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Reveal modal */}
        {newKey && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-3">
            <p className="font-semibold text-emerald-300">Key generated — copy it now</p>
            <p className="text-xs text-emerald-200/70">This is the only time your key is shown. Store it securely.</p>
            <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-mono text-sm text-emerald-300">
              <span className="flex-1 break-all">{newKey.rawKey}</span>
              <button
                onClick={() => copyKey(newKey.rawKey)}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-emerald-300 transition-colors"
                aria-label="Copy key"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30 transition-colors"
            >
              I have saved my key
            </button>
          </div>
        )}

        {/* Generate form */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">Generate New Key</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Cursor, Claude Desktop)"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Generate
            </button>
          </div>
        </div>

        {/* Keys table */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60">
          <div className="border-b border-slate-700/50 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-300">Your Keys</h2>
          </div>
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">
              No active keys — generate one above
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {keys.map((k) => {
                const hasSubscription = !!k.plan_id && k.plan_id !== 'MCP_490_INACTIVE';
                return (
                  <div key={k.key_id} className="px-5 py-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-xs text-violet-300">
                          {k.key_prefix}…
                        </span>
                        <span className="truncate text-sm text-slate-200">{k.label}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!k.stripe_subscription_id ? (
                          <button
                            onClick={() => handleSubscribe(k.key_id)}
                            disabled={subscribing === k.key_id}
                            className="flex items-center gap-1.5 rounded-lg bg-violet-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
                          >
                            {subscribing === k.key_id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <ExternalLink className="h-3 w-3" />
                            )}
                            Subscribe ฿490/mo
                          </button>
                        ) : (
                          <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                            Active
                          </span>
                        )}
                        <button
                          onClick={() => handleRevoke(k.key_id)}
                          disabled={revoking === k.key_id}
                          className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                          aria-label="Revoke key"
                        >
                          {revoking === k.key_id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>{k.plan_id}</span>
                      <span>Limit: {k.calls_limit.toLocaleString()} calls</span>
                      <span>Renews {new Date(k.period_end).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Claude Desktop config */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Claude Desktop Config</h2>
          <pre className="overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-300">
{`{
  "mcpServers": {
    "dsg-one": {
      "command": "node",
      "args": ["/path/to/mcp/dsg-one-mcp/dist/index.js"],
      "env": {
        "DSG_APP_URL": "https://dsg-one-v1.vercel.app",
        "DSG_API_KEY": "<your-key>"
      }
    }
  }
}`}
          </pre>
        </div>

      </div>
    </div>
  );
}
