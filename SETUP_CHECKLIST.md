# Public trial setup status

Checked on October 10, 2026.

- Public repository: https://github.com/EazyLee30/whooper-2.0
- Public trial: https://whooper-peach.vercel.app
- Package: https://github.com/EazyLee30/whooper-2.0/releases/tag/v0.2.0
- Six original WHOOP data domains and original coaching instructions included.
- Fourteen authenticated read tools; tokens stay server-side.
- Clerk public OAuth client requires PKCE; MCP tokens must belong to that client.
- WHOOP callback and deployment configuration use the public trial URL.
- WHOOP app currently Sandbox, 1 of 10 members connected.
- Clerk is currently a development instance.
- WHOOP webhooks are implemented but dashboard registration awaits authorization.
- Real WHOOP account / ChatGPT OAuth acceptance test awaits authorization.
- Universal plugin directory publication requires a separate submission and review.

## Self-hosting

Configure `.env.local` from `.env.example`, PostgreSQL migrations, WHOOP read scopes plus `offline`, and a Clerk public OAuth application with PKCE. Register the callbacks required by your client. Update the public URL and OAuth client ID in `plugin/mcp.json`. Configure WHOOP webhooks and cron after checking the deployed endpoints.

Never commit credentials or health data. Use the connection settings to choose an IANA timezone or delete your stored Whooper data.
