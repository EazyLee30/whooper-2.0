import { authServerMetadataHandlerClerk, metadataCorsOptionsRequestHandler } from '@clerk/mcp-tools/next';
export const GET = authServerMetadataHandlerClerk();
export const OPTIONS = metadataCorsOptionsRequestHandler();
