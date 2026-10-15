import { afterEach, describe, expect, it } from 'vitest';
import * as content from '../src/index.js';
import * as userResolution from '../src/user-resolution/index.js';

// tummycrypt_tinyland_user_resolution was merged into this module. The
// ./user-resolution subpath keeps its exact API; the root facade keeps the
// aliased names it already re-exported from the standalone package.
describe('user resolution merge', () => {
  afterEach(() => {
    userResolution.resetConfig();
    userResolution.clearUserResolutionCache();
  });

  it('keeps the original API on the ./user-resolution subpath', () => {
    expect(Object.keys(userResolution).sort()).toEqual([
      'RESERVED_ROUTES',
      'clearUserResolutionCache',
      'configure',
      'getAllUserHandles',
      'getConfig',
      'isReservedRoute',
      'resetConfig',
      'resolveUser',
      'userExists',
    ]);
  });

  it('re-exports the same bindings on the root facade', () => {
    expect(content.resolveUser).toBe(userResolution.resolveUser);
    expect(content.userExists).toBe(userResolution.userExists);
    expect(content.getAllUserHandlesFromResolution).toBe(userResolution.getAllUserHandles);
    expect(content.clearUserResolutionCache).toBe(userResolution.clearUserResolutionCache);
    expect(content.RESERVED_ROUTES).toBe(userResolution.RESERVED_ROUTES);
    expect(content.isReservedRoute).toBe(userResolution.isReservedRoute);
    expect(content.configureUserResolution).toBe(userResolution.configure);
    expect(content.getUserResolutionConfig).toBe(userResolution.getConfig);
    expect(content.resetUserResolutionConfig).toBe(userResolution.resetConfig);
  });

  it('shares one configuration between the facade and the subpath', async () => {
    content.configureUserResolution({
      findUserByHandle: async (handle) =>
        handle === 'jesssullivan'
          ? { id: 'u1', handle, displayName: 'Jess', role: 'admin' }
          : null,
      findAllUsers: async () => [],
      loadProfiles: async () => [],
    });
    const resolved = await userResolution.resolveUser('jesssullivan');
    expect(resolved?.source).toBe('directory');
    expect(await content.userExists('nobody')).toBe(false);
    userResolution.resetConfig();
    expect(() => content.getUserResolutionConfig()).toThrow(
      'tinyland-user-resolution: call configure() before use',
    );
  });
});
