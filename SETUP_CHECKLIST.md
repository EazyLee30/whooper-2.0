# Public trial setup status

Checked on October 10, 2026.

- Public repository: https://github.com/EazyLee30/whooper-2.0
- Public trial: https://whooper.ccwu.cc
- Package: https://github.com/EazyLee30/whooper-2.0/releases/tag/v0.2.1
- Six original WHOOP data domains and original coaching instructions included.
- Fourteen authenticated read tools; tokens stay server-side.
- Clerk public OAuth client requires PKCE; MCP tokens must belong to that client.
- WHOOP callback and deployment configuration use the public trial URL.
- WHOOP app currently Sandbox, 1 of 10 members connected.
- Clerk is currently a development instance.
- WHOOP V2 webhook is registered at the canonical domain.
- User authorized real-account acceptance testing. WHOOP consent currently encounters a provider-side 400 (header/cookie too large); clearing WHOOP site cookies and restarting OAuth remains pending.
- Personal ChatGPT cloud plugin imported successfully. Authenticated tool acceptance testing and universal plugin directory submission/review remain pending.

## Self-hosting

Configure `.env.local` from `.env.example`, PostgreSQL migrations, WHOOP read scopes plus `offline`, and a Clerk public OAuth application with PKCE. Register the callbacks required by your client. Update the public URL and OAuth client ID in `plugin/mcp.json`. Configure WHOOP webhooks and cron after checking the deployed endpoints.

Never commit credentials or health data. Use the connection settings to choose an IANA timezone or delete your stored Whooper data.
