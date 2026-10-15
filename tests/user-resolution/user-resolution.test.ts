import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  configure,
  getConfig,
  resetConfig,
  resolveUser,
  userExists,
  getAllUserHandles,
  clearUserResolutionCache,
  RESERVED_ROUTES,
  isReservedRoute,
} from '../../src/user-resolution/index.js';
import type { UserResolutionConfig, AdminUser, Profile } from '../../src/user-resolution/index.js';





function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-1',
    handle: 'testuser',
    displayName: 'Test User',
    role: 'member',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<Profile> & { metadata?: Partial<Profile['metadata']> } = {}): Profile {
  const { metadata: metaOverrides, ...rest } = overrides;
  return {
    slug: 'testprofile',
    metadata: {
      handle: 'testprofile',
      name: 'Test Profile',
      role: 'member',
      ...metaOverrides,
    },
    ...rest,
  };
}

function createMockConfig(overrides: Partial<UserResolutionConfig> = {}): UserResolutionConfig {
  return {
    findUserByHandle: vi.fn().mockResolvedValue(null),
    findAllUsers: vi.fn().mockResolvedValue([]),
    loadProfiles: vi.fn().mockResolvedValue([]),
    isNoAuthMode: false,
    ...overrides,
  };
}





describe('tinyland-user-resolution', () => {
  afterEach(() => {
    resetConfig();
    clearUserResolutionCache();
    vi.restoreAllMocks();
  });

  
  
  

  describe('configure / getConfig / resetConfig', () => {
    it('should throw when getConfig is called before configure', () => {
      expect(() => getConfig()).toThrow(
        'tinyland-user-resolution: call configure() before use',
      );
    });

    it('should return config after configure is called', () => {
      const cfg = createMockConfig();
      configure(cfg);
      expect(getConfig()).toBe(cfg);
    });

    it('should allow reconfiguration', () => {
      const cfg1 = createMockConfig();
      const cfg2 = createMockConfig({ isNoAuthMode: true });
      configure(cfg1);
      expect(getConfig()).toBe(cfg1);
      configure(cfg2);
      expect(getConfig()).toBe(cfg2);
    });

    it('should throw again after resetConfig', () => {
      configure(createMockConfig());
      resetConfig();
      expect(() => getConfig()).toThrow(
        'tinyland-user-resolution: call configure() before use',
      );
    });

    it('should accept config with only required fields', () => {
      const cfg: UserResolutionConfig = {
        findUserByHandle: vi.fn().mockResolvedValue(null),
        findAllUsers: vi.fn().mockResolvedValue([]),
        loadProfiles: vi.fn().mockResolvedValue([]),
      };
      configure(cfg);
      expect(getConfig().isNoAuthMode).toBeUndefined();
    });

    it('should accept config with isNoAuthMode explicitly false', () => {
      const cfg = createMockConfig({ isNoAuthMode: false });
      configure(cfg);
      expect(getConfig().isNoAuthMode).toBe(false);
    });

    it('should accept config with isNoAuthMode explicitly true', () => {
      const cfg = createMockConfig({ isNoAuthMode: true });
      configure(cfg);
      expect(getConfig().isNoAuthMode).toBe(true);
    });
  });

  
  
  

  describe('resolveUser', () => {
    describe('directory resolution', () => {
      it('should resolve a user from the directory', async () => {
        const dbUser = makeAdminUser({
          id: 'db-1',
          handle: 'alice',
          displayName: 'Alice Wonderland',
          role: 'admin',
          avatar: '/img/alice.png',
          bio: 'Down the rabbit hole',
          pronouns: 'she/her',
          location: 'Wonderland',
          website: 'https://alice.example.com',
        });
        configure(
          createMockConfig({
            findUserByHandle: vi.fn().mockResolvedValue(dbUser),
          }),
        );

        const result = await resolveUser('alice');

        expect(result).not.toBeNull();
        expect(result!.source).toBe('directory');
        expect(result!.handle).toBe('alice');
        expect(result!.displayName).toBe('Alice Wonderland');
        expect(result!.id).toBe('db-1');
        expect(result!.role).toBe('admin');
        expect(result!.avatar).toBe('/img/alice.png');
        expect(result!.bio).toBe('Down the rabbit hole');
        expect(result!.pronouns).toBe('she/her');
        expect(result!.location).toBe('Wonderland');
        expect(result!.website).toBe('https://alice.example.com');
        expect(result!.dbUser).toBe(dbUser);
      });

      it('should return directory user even when profile also exists', async () => {
        const dbUser = makeAdminUser({ handle: 'bob' });
        configure(
          createMockConfig({
            findUserByHandle: vi.fn().mockResolvedValue(dbUser),
            loadProfiles: vi.fn().mockResolvedValue([makeProfile({ metadata: { handle: 'bob' } })]),
          }),
        );

        const result = await resolveUser('bob');
        expect(result!.source).toBe('directory');
      });

      it('should propagate directory user fields with minimal data', async () => {
        const dbUser = makeAdminUser({
          handle: 'minimal',
          displayName: 'Min',
          role: 'viewer',
        });
        configure(
          createMockConfig({
            findUserByHandle: vi.fn().mockResolvedValue(dbUser),
          }),
        );

        const result = await resolveUser('minimal');
        expect(result!.avatar).toBeUndefined();
        expect(result!.bio).toBeUndefined();
        expect(result!.pronouns).toBeUndefined();
        expect(result!.location).toBeUndefined();
        expect(result!.website).toBeUndefined();
      });

      it('should pass the handle argument to findUserByHandle', async () => {
        const findMock = vi.fn().mockResolvedValue(null);
        configure(createMockConfig({ findUserByHandle: findMock }));

        await resolveUser('specific-handle');
        expect(findMock).toHaveBeenCalledWith('specific-handle');
      });
    });

    describe('profile resolution', () => {
      it('should resolve a user from a profile when not in directory', async () => {
        const profile = makeProfile({
          slug: 'rainbow_bird',
          metadata: {
            handle: 'rainbow_bird',
            name: 'Rainbow Bird',
            role: 'contributor',
            avatar: '/img/bird.png',
            bio: 'Tweet tweet',
            pronouns: 'they/them',
            location: 'The Sky',
            website: 'https://bird.example.com',
          },
        });
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([profile]),
          }),
        );

        const result = await resolveUser('rainbow_bird');
        expect(result).not.toBeNull();
        expect(result!.source).toBe('profile');
        expect(result!.handle).toBe('rainbow_bird');
        expect(result!.displayName).toBe('Rainbow Bird');
        expect(result!.role).toBe('contributor');
        expect(result!.avatar).toBe('/img/bird.png');
        expect(result!.bio).toBe('Tweet tweet');
        expect(result!.pronouns).toBe('they/them');
        expect(result!.location).toBe('The Sky');
        expect(result!.website).toBe('https://bird.example.com');
        expect(result!.dbUser).toBeUndefined();
        expect(result!.id).toBeUndefined();
      });

      it('should use slug as handle fallback when metadata.handle is missing', async () => {
        const profile: Profile = {
          slug: 'slug-user',
          metadata: { name: 'Slug User' },
        };
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([profile]),
          }),
        );

        const result = await resolveUser('slug-user');
        expect(result!.handle).toBe('slug-user');
      });

      it('should use displayName fallback: name -> displayName -> slug', async () => {
        
        const p1: Profile = { slug: 's', metadata: { name: 'Name', displayName: 'DisplayName' } };
        configure(createMockConfig({ loadProfiles: vi.fn().mockResolvedValue([p1]) }));
        expect((await resolveUser('s'))!.displayName).toBe('Name');

        clearUserResolutionCache();

        
        const p2: Profile = { slug: 's2', metadata: { displayName: 'DN' } };
        configure(createMockConfig({ loadProfiles: vi.fn().mockResolvedValue([p2]) }));
        expect((await resolveUser('s2'))!.displayName).toBe('DN');

        clearUserResolutionCache();

        
        const p3: Profile = { slug: 'fallback-slug', metadata: {} };
        configure(createMockConfig({ loadProfiles: vi.fn().mockResolvedValue([p3]) }));
        expect((await resolveUser('fallback-slug'))!.displayName).toBe('fallback-slug');
      });

      it('should default role to "member" when profile has no role', async () => {
        const profile = makeProfile({ slug: 'norole', metadata: { name: 'No Role' } });
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([profile]),
          }),
        );

        const result = await resolveUser('norole');
        expect(result!.role).toBe('member');
      });

      it('should use social.website as fallback when website is missing', async () => {
        const profile = makeProfile({
          slug: 'social-user',
          metadata: {
            name: 'Social User',
            social: { website: 'https://social.example.com', twitter: '@social' },
          },
        });
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([profile]),
          }),
        );

        const result = await resolveUser('social-user');
        expect(result!.website).toBe('https://social.example.com');
      });

      it('should prefer metadata.website over social.website', async () => {
        const profile = makeProfile({
          slug: 'pref-user',
          metadata: {
            name: 'Pref',
            website: 'https://direct.example.com',
            social: { website: 'https://social.example.com' },
          },
        });
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([profile]),
          }),
        );

        const result = await resolveUser('pref-user');
        expect(result!.website).toBe('https://direct.example.com');
      });

      it('should return null when no profiles match', async () => {
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([]),
          }),
        );

        const result = await resolveUser('nobody');
        expect(result).toBeNull();
      });

      it('should pass handle filter to loadProfiles', async () => {
        const loadMock = vi.fn().mockResolvedValue([]);
        configure(createMockConfig({ loadProfiles: loadMock }));

        await resolveUser('query-handle');
        expect(loadMock).toHaveBeenCalledWith({ handle: 'query-handle' });
      });
    });

    describe('noauth fallback', () => {
      it('should return noauth admin when handle is "admin" and isNoAuthMode is true', async () => {
        configure(
          createMockConfig({
            isNoAuthMode: true,
          }),
        );

        const result = await resolveUser('admin');
        expect(result).not.toBeNull();
        expect(result!.source).toBe('noauth');
        expect(result!.handle).toBe('admin');
        expect(result!.displayName).toBe('Development Admin');
        expect(result!.id).toBe('noauth-admin');
        expect(result!.role).toBe('super_admin');
        expect(result!.avatar).toBe('/avatars/dev-admin.svg');
        expect(result!.bio).toBe('Local development super admin account');
      });

      it('should NOT return noauth fallback when isNoAuthMode is false', async () => {
        configure(
          createMockConfig({
            isNoAuthMode: false,
          }),
        );

        const result = await resolveUser('admin');
        expect(result).toBeNull();
      });

      it('should NOT return noauth fallback when isNoAuthMode is undefined', async () => {
        configure(
          createMockConfig({
            isNoAuthMode: undefined,
          }),
        );

        const result = await resolveUser('admin');
        expect(result).toBeNull();
      });

      it('should NOT return noauth fallback for non-admin handles', async () => {
        configure(
          createMockConfig({
            isNoAuthMode: true,
          }),
        );

        const result = await resolveUser('not-admin');
        expect(result).toBeNull();
      });

      it('should prefer directory user over noauth for "admin"', async () => {
        const dbAdmin = makeAdminUser({ handle: 'admin', role: 'super_admin' });
        configure(
          createMockConfig({
            findUserByHandle: vi.fn().mockResolvedValue(dbAdmin),
            isNoAuthMode: true,
          }),
        );

        const result = await resolveUser('admin');
        expect(result!.source).toBe('directory');
      });

      it('should prefer profile user over noauth for "admin"', async () => {
        const profile = makeProfile({ slug: 'admin', metadata: { handle: 'admin', name: 'Profile Admin' } });
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([profile]),
            isNoAuthMode: true,
          }),
        );

        const result = await resolveUser('admin');
        expect(result!.source).toBe('profile');
      });
    });

    describe('error handling', () => {
      it('should fall through to profile when findUserByHandle throws', async () => {
        const profile = makeProfile({
          slug: 'error-user',
          metadata: { handle: 'error-user', name: 'Error User' },
        });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        configure(
          createMockConfig({
            findUserByHandle: vi.fn().mockRejectedValue(new Error('DB connection failed')),
            loadProfiles: vi.fn().mockResolvedValue([profile]),
          }),
        );

        const result = await resolveUser('error-user');
        expect(result).not.toBeNull();
        expect(result!.source).toBe('profile');
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
      });

      it('should return null when both findUserByHandle and loadProfiles throw', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        configure(
          createMockConfig({
            findUserByHandle: vi.fn().mockRejectedValue(new Error('DB fail')),
            loadProfiles: vi.fn().mockRejectedValue(new Error('FS fail')),
          }),
        );

        const result = await resolveUser('doomed');
        expect(result).toBeNull();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      });

      it('should return null when loadProfiles throws (db returns null)', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockRejectedValue(new Error('FS fail')),
          }),
        );

        const result = await resolveUser('broken-profile');
        expect(result).toBeNull();
        errorSpy.mockRestore();
      });

      it('should still try noauth fallback when db and profile both fail for "admin"', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        configure(
          createMockConfig({
            findUserByHandle: vi.fn().mockRejectedValue(new Error('DB fail')),
            loadProfiles: vi.fn().mockRejectedValue(new Error('FS fail')),
            isNoAuthMode: true,
          }),
        );

        const result = await resolveUser('admin');
        expect(result).not.toBeNull();
        expect(result!.source).toBe('noauth');
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      });

      it('should log warning on directory error', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        configure(
          createMockConfig({
            findUserByHandle: vi.fn().mockRejectedValue(new Error('connection timeout')),
          }),
        );

        await resolveUser('anyone');
        expect(warnSpy).toHaveBeenCalledWith(
          '[UserResolution] Error checking directory:',
          expect.any(Error),
        );
        warnSpy.mockRestore();
      });

      it('should log error on profile loading failure', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockRejectedValue(new Error('read error')),
          }),
        );

        await resolveUser('profile-fail');
        expect(errorSpy).toHaveBeenCalledWith(
          '[UserResolution] Error loading profile:',
          expect.any(Error),
        );
        errorSpy.mockRestore();
      });
    });

    describe('edge cases', () => {
      it('should handle empty string handle', async () => {
        configure(createMockConfig());
        const result = await resolveUser('');
        expect(result).toBeNull();
      });

      it('should handle handle with special characters', async () => {
        const findMock = vi.fn().mockResolvedValue(null);
        const loadMock = vi.fn().mockResolvedValue([]);
        configure(createMockConfig({ findUserByHandle: findMock, loadProfiles: loadMock }));

        await resolveUser('user@special!');
        expect(findMock).toHaveBeenCalledWith('user@special!');
        expect(loadMock).toHaveBeenCalledWith({ handle: 'user@special!' });
      });

      it('should handle profile with empty metadata object', async () => {
        const profile: Profile = { slug: 'empty-meta', metadata: {} };
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([profile]),
          }),
        );

        const result = await resolveUser('empty-meta');
        expect(result).not.toBeNull();
        expect(result!.handle).toBe('empty-meta');
        expect(result!.displayName).toBe('empty-meta');
        expect(result!.role).toBe('member');
      });

      it('should use first profile when multiple are returned', async () => {
        const profiles = [
          makeProfile({ slug: 'first', metadata: { handle: 'multi', name: 'First' } }),
          makeProfile({ slug: 'second', metadata: { handle: 'multi', name: 'Second' } }),
        ];
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue(profiles),
          }),
        );

        const result = await resolveUser('multi');
        expect(result!.displayName).toBe('First');
      });

      it('should handle profile where social exists but social.website is undefined', async () => {
        const profile = makeProfile({
          slug: 'no-social-web',
          metadata: { name: 'NoSocialWeb', social: { twitter: '@test' } },
        });
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([profile]),
          }),
        );

        const result = await resolveUser('no-social-web');
        expect(result!.website).toBeUndefined();
      });

      it('should handle profile with undefined social', async () => {
        const profile = makeProfile({
          slug: 'no-social',
          metadata: { name: 'NoSocial' },
        });
        configure(
          createMockConfig({
            loadProfiles: vi.fn().mockResolvedValue([profile]),
          }),
        );

        const result = await resolveUser('no-social');
        expect(result!.website).toBeUndefined();
      });
    });
  });

  
  
  

  describe('profile cache', () => {
    it('should cache a resolved profile on first lookup', async () => {
      const loadMock = vi.fn().mockResolvedValue([
        makeProfile({ slug: 'cached', metadata: { handle: 'cached', name: 'Cached' } }),
      ]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      await resolveUser('cached');
      await resolveUser('cached');

      
      expect(loadMock).toHaveBeenCalledTimes(1);
    });

    it('should cache null for non-existent profile', async () => {
      const loadMock = vi.fn().mockResolvedValue([]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      await resolveUser('ghost');
      await resolveUser('ghost');

      expect(loadMock).toHaveBeenCalledTimes(1);
    });

    it('should cache null when loadProfiles throws', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const loadMock = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue([makeProfile({ slug: 'recover', metadata: { handle: 'recover', name: 'Recover' } })]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      const result1 = await resolveUser('recover');
      expect(result1).toBeNull();

      
      const result2 = await resolveUser('recover');
      expect(result2).toBeNull();
      expect(loadMock).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });

    it('should expire cache after TTL', async () => {
      const loadMock = vi.fn().mockResolvedValue([
        makeProfile({ slug: 'ttl-user', metadata: { handle: 'ttl-user', name: 'TTL' } }),
      ]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      const realDateNow = Date.now;
      let mockTime = 1000000;
      Date.now = () => mockTime;

      try {
        await resolveUser('ttl-user');
        expect(loadMock).toHaveBeenCalledTimes(1);

        
        mockTime += 61_000;

        await resolveUser('ttl-user');
        expect(loadMock).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = realDateNow;
      }
    });

    it('should NOT expire cache before TTL', async () => {
      const loadMock = vi.fn().mockResolvedValue([
        makeProfile({ slug: 'fresh', metadata: { handle: 'fresh', name: 'Fresh' } }),
      ]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      const realDateNow = Date.now;
      let mockTime = 1000000;
      Date.now = () => mockTime;

      try {
        await resolveUser('fresh');
        expect(loadMock).toHaveBeenCalledTimes(1);

        
        mockTime += 30_000;

        await resolveUser('fresh');
        expect(loadMock).toHaveBeenCalledTimes(1);
      } finally {
        Date.now = realDateNow;
      }
    });

    it('should serve different handles from the same cache window', async () => {
      const loadMock = vi.fn()
        .mockResolvedValueOnce([makeProfile({ slug: 'a', metadata: { handle: 'a', name: 'A' } })])
        .mockResolvedValueOnce([makeProfile({ slug: 'b', metadata: { handle: 'b', name: 'B' } })]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      const ra = await resolveUser('a');
      const rb = await resolveUser('b');
      expect(ra!.handle).toBe('a');
      expect(rb!.handle).toBe('b');
      expect(loadMock).toHaveBeenCalledTimes(2);

      
      const ra2 = await resolveUser('a');
      const rb2 = await resolveUser('b');
      expect(ra2!.handle).toBe('a');
      expect(rb2!.handle).toBe('b');
      expect(loadMock).toHaveBeenCalledTimes(2);
    });

    it('should reset cache with clearUserResolutionCache', async () => {
      const loadMock = vi.fn().mockResolvedValue([
        makeProfile({ slug: 'clear-test', metadata: { handle: 'clear-test', name: 'ClearTest' } }),
      ]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      await resolveUser('clear-test');
      expect(loadMock).toHaveBeenCalledTimes(1);

      clearUserResolutionCache();

      await resolveUser('clear-test');
      expect(loadMock).toHaveBeenCalledTimes(2);
    });

    it('should rebuild cache entirely after expiry (different handle)', async () => {
      const loadMock = vi.fn()
        .mockResolvedValueOnce([makeProfile({ slug: 'x', metadata: { handle: 'x', name: 'X' } })])
        .mockResolvedValueOnce([makeProfile({ slug: 'y', metadata: { handle: 'y', name: 'Y' } })])
        .mockResolvedValueOnce([makeProfile({ slug: 'x', metadata: { handle: 'x', name: 'X v2' } })]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      const realDateNow = Date.now;
      let mockTime = 1000000;
      Date.now = () => mockTime;

      try {
        await resolveUser('x');
        await resolveUser('y');
        expect(loadMock).toHaveBeenCalledTimes(2);

        
        mockTime += 61_000;

        
        const result = await resolveUser('x');
        expect(loadMock).toHaveBeenCalledTimes(3);
        
      } finally {
        Date.now = realDateNow;
      }
    });

    it('should not use profile cache for directory users', async () => {
      const dbUser = makeAdminUser({ handle: 'dbonly' });
      const findMock = vi.fn().mockResolvedValue(dbUser);
      const loadMock = vi.fn().mockResolvedValue([]);
      configure(createMockConfig({ findUserByHandle: findMock, loadProfiles: loadMock }));

      await resolveUser('dbonly');
      await resolveUser('dbonly');

      
      expect(findMock).toHaveBeenCalledTimes(2);
      
      expect(loadMock).not.toHaveBeenCalled();
    });
  });

  
  
  

  describe('userExists', () => {
    it('should return true when user exists in directory', async () => {
      configure(
        createMockConfig({
          findUserByHandle: vi.fn().mockResolvedValue(makeAdminUser({ handle: 'exists' })),
        }),
      );

      expect(await userExists('exists')).toBe(true);
    });

    it('should return true when user exists as profile', async () => {
      configure(
        createMockConfig({
          loadProfiles: vi.fn().mockResolvedValue([makeProfile({ metadata: { handle: 'profile-exists' } })]),
        }),
      );

      expect(await userExists('profile-exists')).toBe(true);
    });

    it('should return true for noauth admin when enabled', async () => {
      configure(
        createMockConfig({
          isNoAuthMode: true,
        }),
      );

      expect(await userExists('admin')).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      configure(createMockConfig());
      expect(await userExists('ghost')).toBe(false);
    });

    it('should return false for empty handle', async () => {
      configure(createMockConfig());
      expect(await userExists('')).toBe(false);
    });

    it('should delegate to resolveUser', async () => {
      const findMock = vi.fn().mockResolvedValue(null);
      const loadMock = vi.fn().mockResolvedValue([]);
      configure(createMockConfig({ findUserByHandle: findMock, loadProfiles: loadMock }));

      await userExists('check');
      expect(findMock).toHaveBeenCalledWith('check');
    });
  });

  
  
  

  describe('getAllUserHandles', () => {
    it('should return directory handles', async () => {
      configure(
        createMockConfig({
          findAllUsers: vi.fn().mockResolvedValue([
            makeAdminUser({ handle: 'db1' }),
            makeAdminUser({ handle: 'db2' }),
          ]),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles).toContain('db1');
      expect(handles).toContain('db2');
    });

    it('should return profile handles', async () => {
      configure(
        createMockConfig({
          loadProfiles: vi.fn().mockResolvedValue([
            makeProfile({ slug: 'p1', metadata: { handle: 'prof1' } }),
            makeProfile({ slug: 'p2', metadata: { handle: 'prof2' } }),
          ]),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles).toContain('prof1');
      expect(handles).toContain('prof2');
    });

      it('should merge directory and profile handles', async () => {
      configure(
        createMockConfig({
          findAllUsers: vi.fn().mockResolvedValue([makeAdminUser({ handle: 'shared' })]),
          loadProfiles: vi.fn().mockResolvedValue([
            makeProfile({ slug: 'profile-only', metadata: { handle: 'profile-only' } }),
          ]),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles).toContain('shared');
      expect(handles).toContain('profile-only');
      expect(handles.length).toBe(2);
    });

    it('should deduplicate handles present in both sources', async () => {
      configure(
        createMockConfig({
          findAllUsers: vi.fn().mockResolvedValue([makeAdminUser({ handle: 'duped' })]),
          loadProfiles: vi.fn().mockResolvedValue([
            makeProfile({ slug: 'duped', metadata: { handle: 'duped' } }),
          ]),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles.filter((h) => h === 'duped').length).toBe(1);
    });

    it('should use slug as handle when profile metadata.handle is missing', async () => {
      const profile: Profile = { slug: 'slug-handle', metadata: {} };
      configure(
        createMockConfig({
          loadProfiles: vi.fn().mockResolvedValue([profile]),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles).toContain('slug-handle');
    });

    it('should return empty array when both sources are empty', async () => {
      configure(createMockConfig());
      const handles = await getAllUserHandles();
      expect(handles).toEqual([]);
    });

    it('should handle findAllUsers error gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      configure(
        createMockConfig({
          findAllUsers: vi.fn().mockRejectedValue(new Error('DB down')),
          loadProfiles: vi.fn().mockResolvedValue([
            makeProfile({ slug: 'still-here', metadata: { handle: 'still-here' } }),
          ]),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles).toContain('still-here');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should handle loadProfiles error gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      configure(
        createMockConfig({
          findAllUsers: vi.fn().mockResolvedValue([makeAdminUser({ handle: 'db-ok' })]),
          loadProfiles: vi.fn().mockRejectedValue(new Error('FS error')),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles).toContain('db-ok');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should handle both sources throwing errors', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      configure(
        createMockConfig({
          findAllUsers: vi.fn().mockRejectedValue(new Error('DB fail')),
          loadProfiles: vi.fn().mockRejectedValue(new Error('FS fail')),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles).toEqual([]);
      warnSpy.mockRestore();
    });

    it('should call loadProfiles with empty filter object', async () => {
      const loadMock = vi.fn().mockResolvedValue([]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      await getAllUserHandles();
      expect(loadMock).toHaveBeenCalledWith({});
    });

    it('should handle large number of users', async () => {
      const dbUsers = Array.from({ length: 100 }, (_, i) =>
        makeAdminUser({ handle: `db-user-${i}` }),
      );
      const profiles = Array.from({ length: 100 }, (_, i) =>
        makeProfile({ slug: `profile-${i}`, metadata: { handle: `profile-${i}` } }),
      );
      configure(
        createMockConfig({
          findAllUsers: vi.fn().mockResolvedValue(dbUsers),
          loadProfiles: vi.fn().mockResolvedValue(profiles),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles.length).toBe(200);
    });
  });

  
  
  

  describe('RESERVED_ROUTES', () => {
    it('should be an array', () => {
      expect(Array.isArray(RESERVED_ROUTES)).toBe(true);
    });

    it('should contain expected system routes', () => {
      const expected = ['admin', 'api', 'auth', 'legal', '.well-known', '_app', '__data', 'socket.io', 'health', 'metrics'];
      for (const route of expected) {
        expect(RESERVED_ROUTES).toContain(route);
      }
    });

    it('should contain expected content routes', () => {
      const expected = ['blog', 'products', 'events', 'notes', 'videos', 'programs'];
      for (const route of expected) {
        expect(RESERVED_ROUTES).toContain(route);
      }
    });

    it('should contain expected page routes', () => {
      const expected = ['explore', 'settings', 'contact', 'about', 'privacy', 'terms'];
      for (const route of expected) {
        expect(RESERVED_ROUTES).toContain(route);
      }
    });

    it('should have all lowercase entries', () => {
      for (const route of RESERVED_ROUTES) {
        expect(route).toBe(route.toLowerCase());
      }
    });

    it('should have no duplicates', () => {
      const unique = new Set(RESERVED_ROUTES);
      expect(unique.size).toBe(RESERVED_ROUTES.length);
    });

    it('should not be empty', () => {
      expect(RESERVED_ROUTES.length).toBeGreaterThan(0);
    });

    it('should contain exactly the expected number of routes', () => {
      
      expect(RESERVED_ROUTES.length).toBe(22);
    });
  });

  
  
  

  describe('isReservedRoute', () => {
    it('should return true for a reserved route', () => {
      expect(isReservedRoute('admin')).toBe(true);
    });

    it('should return true for all reserved routes', () => {
      for (const route of RESERVED_ROUTES) {
        expect(isReservedRoute(route)).toBe(true);
      }
    });

    it('should be case-insensitive (uppercase)', () => {
      expect(isReservedRoute('ADMIN')).toBe(true);
      expect(isReservedRoute('API')).toBe(true);
      expect(isReservedRoute('Blog')).toBe(true);
    });

    it('should be case-insensitive (mixed case)', () => {
      expect(isReservedRoute('SoCkEt.Io')).toBe(true);
      expect(isReservedRoute('Health')).toBe(true);
      expect(isReservedRoute('EXPLORE')).toBe(true);
    });

    it('should return false for non-reserved routes', () => {
      expect(isReservedRoute('rainbow_bird')).toBe(false);
      expect(isReservedRoute('username123')).toBe(false);
      expect(isReservedRoute('my-profile')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isReservedRoute('')).toBe(false);
    });

    it('should return false for partial matches', () => {
      expect(isReservedRoute('admin2')).toBe(false);
      expect(isReservedRoute('blogs')).toBe(false);
      expect(isReservedRoute('api-v2')).toBe(false);
    });

    it('should return false for routes with leading/trailing spaces', () => {
      expect(isReservedRoute(' admin')).toBe(false);
      expect(isReservedRoute('admin ')).toBe(false);
    });

    it('should handle dot-prefixed reserved routes', () => {
      expect(isReservedRoute('.well-known')).toBe(true);
      expect(isReservedRoute('.Well-Known')).toBe(true);
    });

    it('should handle underscore-prefixed reserved routes', () => {
      expect(isReservedRoute('_app')).toBe(true);
      expect(isReservedRoute('__data')).toBe(true);
    });
  });

  
  
  

  describe('clearUserResolutionCache', () => {
    it('should be callable without error even when cache is empty', () => {
      expect(() => clearUserResolutionCache()).not.toThrow();
    });

    it('should be callable multiple times without error', () => {
      clearUserResolutionCache();
      clearUserResolutionCache();
      clearUserResolutionCache();
    });

    it('should force profile reload on next resolveUser call', async () => {
      const loadMock = vi.fn().mockResolvedValue([
        makeProfile({ slug: 'reload', metadata: { handle: 'reload', name: 'Reload' } }),
      ]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      await resolveUser('reload');
      expect(loadMock).toHaveBeenCalledTimes(1);

      clearUserResolutionCache();

      await resolveUser('reload');
      expect(loadMock).toHaveBeenCalledTimes(2);
    });

    it('should not affect directory lookups', async () => {
      const dbUser = makeAdminUser({ handle: 'db-clear' });
      const findMock = vi.fn().mockResolvedValue(dbUser);
      configure(createMockConfig({ findUserByHandle: findMock }));

      await resolveUser('db-clear');
      clearUserResolutionCache();
      await resolveUser('db-clear');

      
      expect(findMock).toHaveBeenCalledTimes(2);
    });
  });

  
  
  

  describe('integration scenarios', () => {
    it('should handle a full resolution cycle: db miss -> profile hit', async () => {
      const profile = makeProfile({
        slug: 'community-member',
        metadata: {
          handle: 'community-member',
          name: 'Community Member',
          role: 'member',
          avatar: '/img/community.png',
          bio: 'Active community member',
          pronouns: 'he/him',
          location: 'NYC',
          social: { website: 'https://community.example.com', mastodon: '@community@social.example' },
        },
      });

      configure(
        createMockConfig({
          findUserByHandle: vi.fn().mockResolvedValue(null),
          loadProfiles: vi.fn().mockResolvedValue([profile]),
        }),
      );

      const result = await resolveUser('community-member');
      expect(result).not.toBeNull();
      expect(result!.source).toBe('profile');
      expect(result!.website).toBe('https://community.example.com');
    });

    it('should handle reconfiguration mid-session', async () => {
      
      configure(
        createMockConfig({
          findUserByHandle: vi.fn().mockResolvedValue(makeAdminUser({ handle: 'reconf' })),
        }),
      );
      const r1 = await resolveUser('reconf');
      expect(r1!.source).toBe('directory');

      
      clearUserResolutionCache();
      configure(
        createMockConfig({
          findUserByHandle: vi.fn().mockResolvedValue(null),
          loadProfiles: vi.fn().mockResolvedValue([
            makeProfile({ slug: 'reconf', metadata: { handle: 'reconf', name: 'Reconf Profile' } }),
          ]),
        }),
      );
      const r2 = await resolveUser('reconf');
      expect(r2!.source).toBe('profile');
    });

    it('should allow checking existence then resolving without double fetch from DB', async () => {
      const findMock = vi.fn().mockResolvedValue(null);
      const loadMock = vi.fn().mockResolvedValue([
        makeProfile({ slug: 'check-resolve', metadata: { handle: 'check-resolve', name: 'CR' } }),
      ]);
      configure(createMockConfig({ findUserByHandle: findMock, loadProfiles: loadMock }));

      const exists = await userExists('check-resolve');
      expect(exists).toBe(true);

      
      const user = await resolveUser('check-resolve');
      expect(user!.handle).toBe('check-resolve');

      
      expect(findMock).toHaveBeenCalledTimes(2);
      expect(loadMock).toHaveBeenCalledTimes(1);
    });

    it('should work correctly when isReservedRoute is used as a guard before resolveUser', async () => {
      configure(
        createMockConfig({
          findUserByHandle: vi.fn().mockResolvedValue(makeAdminUser({ handle: 'admin' })),
        }),
      );

      const segment = 'admin';
      if (isReservedRoute(segment)) {
        
        expect(true).toBe(true);
      } else {
        
        expect(true).toBe(false);
      }
    });

    it('should handle getAllUserHandles returning handles that can be individually resolved', async () => {
      const dbUsers = [makeAdminUser({ handle: 'alice' }), makeAdminUser({ handle: 'bob' })];
      const profiles = [makeProfile({ slug: 'carol', metadata: { handle: 'carol', name: 'Carol' } })];

      configure(
        createMockConfig({
          findAllUsers: vi.fn().mockResolvedValue(dbUsers),
          findUserByHandle: vi.fn().mockImplementation(async (h: string) => {
            return dbUsers.find((u) => u.handle === h) || null;
          }),
          loadProfiles: vi.fn().mockImplementation(async (filter: { handle?: string }) => {
            if (filter.handle) {
              return profiles.filter((p) => p.metadata.handle === filter.handle);
            }
            return profiles;
          }),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles).toHaveLength(3);

      for (const handle of handles) {
        clearUserResolutionCache();
        const user = await resolveUser(handle);
        expect(user).not.toBeNull();
        expect(user!.handle).toBe(handle);
      }
    });
  });

  
  
  

  describe('additional edge cases', () => {
    it('should resolve directory user with extra unknown fields', async () => {
      const dbUser: AdminUser = {
        id: 'ext-1',
        handle: 'extended',
        displayName: 'Extended User',
        role: 'member',
        customField: 'custom-value',
        numericField: 42,
      };
      configure(
        createMockConfig({
          findUserByHandle: vi.fn().mockResolvedValue(dbUser),
        }),
      );

      const result = await resolveUser('extended');
      expect(result!.dbUser).toBe(dbUser);
      expect(result!.dbUser!.customField).toBe('custom-value');
    });

    it('should handle profile with extra unknown metadata fields', async () => {
      const profile: Profile = {
        slug: 'extra-meta',
        metadata: {
          handle: 'extra-meta',
          name: 'Extra',
          customTag: 'lgbtq+',
          verified: true,
        },
      };
      configure(
        createMockConfig({
          loadProfiles: vi.fn().mockResolvedValue([profile]),
        }),
      );

      const result = await resolveUser('extra-meta');
      expect(result).not.toBeNull();
      expect(result!.handle).toBe('extra-meta');
    });

    it('should handle profile with extra unknown top-level fields', async () => {
      const profile: Profile = {
        slug: 'top-extra',
        metadata: { handle: 'top-extra', name: 'Top Extra' },
        content: '# Hello\nThis is markdown content',
        rawPath: '/content/profiles/top-extra.md',
      };
      configure(
        createMockConfig({
          loadProfiles: vi.fn().mockResolvedValue([profile]),
        }),
      );

      const result = await resolveUser('top-extra');
      expect(result).not.toBeNull();
      expect(result!.source).toBe('profile');
    });

    it('should not leak directory user fields into profile resolution', async () => {
      const profile = makeProfile({
        slug: 'no-leak',
        metadata: { handle: 'no-leak', name: 'No Leak' },
      });
      configure(
        createMockConfig({
          loadProfiles: vi.fn().mockResolvedValue([profile]),
        }),
      );

      const result = await resolveUser('no-leak');
      expect(result!.dbUser).toBeUndefined();
      expect(result!.id).toBeUndefined();
    });

    it('should handle concurrent resolveUser calls for different handles', async () => {
      const loadMock = vi.fn().mockImplementation(async (filter: { handle?: string }) => {
        if (filter.handle === 'user-a') {
          return [makeProfile({ slug: 'user-a', metadata: { handle: 'user-a', name: 'A' } })];
        }
        if (filter.handle === 'user-b') {
          return [makeProfile({ slug: 'user-b', metadata: { handle: 'user-b', name: 'B' } })];
        }
        return [];
      });
      configure(createMockConfig({ loadProfiles: loadMock }));

      const [a, b] = await Promise.all([
        resolveUser('user-a'),
        resolveUser('user-b'),
      ]);

      expect(a!.handle).toBe('user-a');
      expect(b!.handle).toBe('user-b');
    });

    it('should handle directory user with empty string fields', async () => {
      const dbUser = makeAdminUser({
        handle: 'empty-fields',
        displayName: '',
        role: '',
        avatar: '',
        bio: '',
      });
      configure(
        createMockConfig({
          findUserByHandle: vi.fn().mockResolvedValue(dbUser),
        }),
      );

      const result = await resolveUser('empty-fields');
      expect(result!.displayName).toBe('');
      expect(result!.role).toBe('');
      expect(result!.avatar).toBe('');
      expect(result!.bio).toBe('');
    });

    it('should handle resolveUser throwing before configure', async () => {
      
      resetConfig();
      await expect(resolveUser('anyone')).rejects.toThrow(
        'tinyland-user-resolution: call configure() before use',
      );
    });

    it('should handle userExists throwing before configure', async () => {
      resetConfig();
      await expect(userExists('anyone')).rejects.toThrow(
        'tinyland-user-resolution: call configure() before use',
      );
    });

    it('should handle getAllUserHandles throwing before configure', async () => {
      resetConfig();
      await expect(getAllUserHandles()).rejects.toThrow(
        'tinyland-user-resolution: call configure() before use',
      );
    });

    it('should handle noauth result shape completely', async () => {
      configure(createMockConfig({ isNoAuthMode: true }));

      const result = await resolveUser('admin');
      expect(result).toEqual({
        id: 'noauth-admin',
        handle: 'admin',
        displayName: 'Development Admin',
        source: 'noauth',
        role: 'super_admin',
        avatar: '/avatars/dev-admin.svg',
        bio: 'Local development super admin account',
      });
    });

    it('should handle profile with all optional fields populated', async () => {
      const profile = makeProfile({
        slug: 'full-profile',
        metadata: {
          handle: 'full-profile',
          name: 'Full Profile User',
          displayName: 'FPU',
          role: 'editor',
          avatar: '/img/full.png',
          bio: 'A fully populated profile',
          pronouns: 'ze/zir',
          location: 'San Francisco, CA',
          website: 'https://full-profile.example.com',
          social: { website: 'https://alt.example.com', mastodon: '@full@social.example' },
        },
      });
      configure(
        createMockConfig({
          loadProfiles: vi.fn().mockResolvedValue([profile]),
        }),
      );

      const result = await resolveUser('full-profile');
      expect(result!.handle).toBe('full-profile');
      expect(result!.displayName).toBe('Full Profile User');
      expect(result!.role).toBe('editor');
      expect(result!.avatar).toBe('/img/full.png');
      expect(result!.bio).toBe('A fully populated profile');
      expect(result!.pronouns).toBe('ze/zir');
      expect(result!.location).toBe('San Francisco, CA');
      expect(result!.website).toBe('https://full-profile.example.com');
    });

    it('should return string array from getAllUserHandles (type check)', async () => {
      configure(
        createMockConfig({
          findAllUsers: vi.fn().mockResolvedValue([makeAdminUser({ handle: 'typed' })]),
        }),
      );

      const handles = await getAllUserHandles();
      expect(handles).toBeInstanceOf(Array);
      for (const h of handles) {
        expect(typeof h).toBe('string');
      }
    });

    it('should handle findUserByHandle returning undefined (treated as falsy)', async () => {
      configure(
        createMockConfig({
          findUserByHandle: vi.fn().mockResolvedValue(undefined),
          loadProfiles: vi.fn().mockResolvedValue([]),
        }),
      );

      const result = await resolveUser('undef-user');
      expect(result).toBeNull();
    });

    it('should cache boundary: exactly at TTL should still be valid', async () => {
      const loadMock = vi.fn().mockResolvedValue([
        makeProfile({ slug: 'boundary', metadata: { handle: 'boundary', name: 'Boundary' } }),
      ]);
      configure(createMockConfig({ loadProfiles: loadMock }));

      const realDateNow = Date.now;
      let mockTime = 1000000;
      Date.now = () => mockTime;

      try {
        await resolveUser('boundary');
        expect(loadMock).toHaveBeenCalledTimes(1);

        
        mockTime += 59_999;

        await resolveUser('boundary');
        
        expect(loadMock).toHaveBeenCalledTimes(1);
      } finally {
        Date.now = realDateNow;
      }
    });

    it('should handle RESERVED_ROUTES being frozen/immutable (read-only check)', () => {

      const copy = [...RESERVED_ROUTES];
      expect(copy).toEqual(RESERVED_ROUTES);
      expect(copy.length).toBe(RESERVED_ROUTES.length);
    });
  });

  // TIN-2788 (operator-ratified Option A) / TIN-455: public `@handle` authority IS
  // admin-user (directory) authority. `resolveUser('jesssullivan')` MUST resolve via
  // the repository-backed directory branch (`findUserByHandle`), never the profile
  // fallback (declined Option B) and never `null`. This locks the contract that
  // `src/hooks.server.ts` installs via `configureUserResolution({ findUserByHandle })`,
  // where `findUserByHandle` delegates to `publicHandleDirectory.findByHandle` ->
  // `adminUserRepository` (backingFile `content/auth/admin-users.json`).
  describe('TIN-2788 / TIN-455: jesssullivan directory authority (Option A)', () => {
    const JESS = makeAdminUser({
      id: 'admin-jesssullivan',
      handle: 'jesssullivan',
      displayName: 'Jess Sullivan',
      role: 'super_admin',
    });

    it('resolves jesssullivan via the directory branch when the admin-user record exists', async () => {
      const findUserByHandle = vi.fn().mockResolvedValue(JESS);
      const loadProfiles = vi.fn().mockResolvedValue([]);
      configure(createMockConfig({ findUserByHandle, loadProfiles }));

      const result = await resolveUser('jesssullivan');

      expect(result).not.toBeNull();
      // Directory (admin-user) branch — not profile, not noauth.
      expect(result!.source).toBe('directory');
      expect(result!.handle).toBe('jesssullivan');
      expect(result!.displayName).toBe('Jess Sullivan');
      expect(result!.role).toBe('super_admin');
      expect(result!.id).toBe('admin-jesssullivan');
      expect(result!.dbUser).toBe(JESS);
      // Option A, not Option B: the profile fallback must not be consulted.
      expect(findUserByHandle).toHaveBeenCalledWith('jesssullivan');
      expect(loadProfiles).not.toHaveBeenCalled();
    });

    it('directory record wins even when a profile also exists for jesssullivan', async () => {
      const findUserByHandle = vi.fn().mockResolvedValue(JESS);
      const loadProfiles = vi.fn().mockResolvedValue([
        makeProfile({
          slug: 'jesssullivan',
          metadata: { handle: 'jesssullivan', name: 'Profile Jess', role: 'member' },
        }),
      ]);
      configure(createMockConfig({ findUserByHandle, loadProfiles }));

      const result = await resolveUser('jesssullivan');

      expect(result!.source).toBe('directory');
      expect(result!.role).toBe('super_admin');
      expect(loadProfiles).not.toHaveBeenCalled();
    });

    it('does NOT resolve jesssullivan when the admin-user store is empty (current empty-PVC prod state)', async () => {
      // Mirrors prod today: the `sveltekit-content` PVC is empty (TIN-1952), so there
      // is no directory record and no profile — resolveUser falls through to null.
      // The record must be minted at runtime (bootstrap / invite-accept); a repo-side
      // `content/auth/admin-users.json` seed cannot reach the PVC (it is shadowed by
      // the PVC mount at /app/content). See docs/runbooks/tin-2788-jesssullivan-directory-record.md.
      const findUserByHandle = vi.fn().mockResolvedValue(null);
      const loadProfiles = vi.fn().mockResolvedValue([]);
      configure(createMockConfig({ findUserByHandle, loadProfiles }));

      const result = await resolveUser('jesssullivan');

      expect(result).toBeNull();
      expect(findUserByHandle).toHaveBeenCalledWith('jesssullivan');
    });
  });
});
