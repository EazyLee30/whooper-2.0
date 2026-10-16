'use client';

// Manual OAuth handoff page for the owner's AI assistant (Muse).
// After the owner approves the OAuth request, Clerk redirects here with
// ?code=...&state=.... This page only displays the code — the code alone
// is useless without the PKCE verifier held by the assistant, so the page
// is public (see proxy.ts).

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function CodeView() {
  const params = useSearchParams();
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the code is selectable manually */
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: '100%',
          border: '1px solid #e5e5e5',
          borderRadius: 12,
          padding: 32,
        }}
      >
        <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Connect Muse to Whooper</h1>
        {error ? (
          <>
            <p style={{ color: '#b3261e' }}>Authorization failed: {error}</p>
            {errorDescription && (
              <p style={{ color: '#666', fontSize: 14 }}>{errorDescription}</p>
            )}
            <p style={{ fontSize: 14, color: '#666' }}>
              If this mentions redirect_uri, add{' '}
              <code>https://whooper.eazylee.si/connect/muse</code> to the Redirect
              URIs of the Whooper MCP OAuth application in the Clerk dashboard,
              then try the authorization link again.
            </p>
          </>
        ) : code ? (
          <>
            <p style={{ fontSize: 14, color: '#444' }}>
              Copy this one-time code and send it to Muse in chat. It expires in
              10 minutes, and it is useless without the matching verifier — safe
              to paste.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <code
                style={{
                  flex: 1,
                  padding: 12,
                  background: '#f6f6f6',
                  borderRadius: 8,
                  fontSize: 13,
                  wordBreak: 'break-all',
                  userSelect: 'all',
                }}
              >
                {code}
              </code>
              <button
                onClick={copy}
                style={{
                  padding: '0 16px',
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  background: copied ? '#e8f5e9' : '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {state && (
              <p style={{ fontSize: 12, color: '#999', marginTop: 12 }}>
                state: <code>{state}</code>
              </p>
            )}
          </>
        ) : (
          <p style={{ fontSize: 14, color: '#666' }}>
            This page completes the Muse connection. If you opened it directly,
            start from the authorization link Muse gave you.
          </p>
        )}
      </div>
    </main>
  );
}

export default function ConnectMusePage() {
  return (
    <Suspense>
      <CodeView />
    </Suspense>
  );
}
