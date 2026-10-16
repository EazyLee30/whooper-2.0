# Public trial setup status

Checked on October 10, 2026.

- Public repository: https://github.com/EazyLee30/whooper-2.0
- Public trial: https://whooper.eazylee.si
- Package: https://github.com/EazyLee30/whooper-2.0/releases/tag/v0.2.1
- Six original WHOOP data domains and original coaching instructions included.
- Fourteen authenticated read tools; tokens stay server-side.
- Clerk public OAuth client requires PKCE; MCP tokens must belong to that client.
- WHOOP callback and deployment configuration use the public trial URL.
- WHOOP app currently Sandbox, 1 of 10 members connected.
- Clerk is currently a development instance.
- WHOOP V2 webhook is registered at the canonical domain.
- Real-account WHOOP authorization verified on October 10, 2026: active connection with all six read scopes and offline refresh. Live reads passed for profile, body measurements, cycles, recovery, sleep and workouts. The earlier provider-side 400 no longer blocks this account.
- Initial history sync completed for cycles, recovery, sleep and workouts; all four jobs finished without errors. No individual health values, record counts or credentials are published.
- Personal ChatGPT cloud plugin connected successfully. ChatGPT acceptance testing passed for connection status, one recovery record and one sleep record on October 10, 2026. Cloud MCP initialization includes the coaching instructions.
- Public directory upload is blocked before package upload: OpenAI Platform requires a verified developer identity. The current organization first requires a default valid payment method to start verification. No review has been submitted.
- Draft package v0.2.2 includes a compliant short description, support URL, five positive and three negative review cases, and simplified/traditional Chinese listing translations. Public submission still needs a terms URL, a dedicated reviewer account with sample data, and a reviewer-accessible video walkthrough. Do not use the owner's real health account for review.

## Self-hosting

Configure `.env.local` from `.env.example`, PostgreSQL migrations, WHOOP read scopes plus `offline`, and a Clerk public OAuth application with PKCE. Register the callbacks required by your client. Update the public URL and OAuth client ID in `plugin/mcp.json`. Configure WHOOP webhooks and cron after checking the deployed endpoints.

Never commit credentials or health data. Use the connection settings to choose an IANA timezone or delete your stored Whooper data.
