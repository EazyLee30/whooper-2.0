import { protectedResourceHandlerClerk, metadataCorsOptionsRequestHandler } from '@clerk/mcp-tools/next';
const handler = protectedResourceHandlerClerk({
  resource: `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp`,
  scopes_supported: ['openid', 'offline_access'],
  resource_name: 'Whooper',
});
export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
