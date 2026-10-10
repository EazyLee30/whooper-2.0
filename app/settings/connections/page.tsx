import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ bound?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    include: { whoopConnections: true },
  });
  const conn = user?.whoopConnections?.[0];

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Connections</h1>
        <UserButton />
      </div>

      {params.bound === '1' && (
        <p style={{ background: '#e6f9ed', padding: 12, borderRadius: 8 }}>
          WHOOP connected successfully.
        </p>
      )}

      <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 24, marginTop: 24 }}>
        <h2>WHOOP</h2>
        {conn ? (
          <div>
            <p>Status: <strong>{conn.status}</strong></p>
            <p style={{ color: '#666', fontSize: 14 }}>
              Connected. Tokens are encrypted at rest and never leave the server.
            </p>
          </div>
        ) : (
          <div>
            <p style={{ color: '#666' }}>Not connected.</p>
            <a
              href="/api/auth/whoop/start"
              style={{
                display: 'inline-block',
                background: '#000',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: 8,
                textDecoration: 'none',
                marginTop: 12,
              }}
            >
              Connect WHOOP
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
