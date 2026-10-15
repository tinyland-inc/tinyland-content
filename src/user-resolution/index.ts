export type { AdminUser, Profile, ResolvedUser } from './types.js';
export type { UserResolutionConfig } from './config.js';
export { configure, getConfig, resetConfig } from './config.js';
export {
  resolveUser,
  userExists,
  getAllUserHandles,
  clearUserResolutionCache,
  RESERVED_ROUTES,
  isReservedRoute,
} from './resolution.js';
