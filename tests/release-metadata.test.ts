import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('content candidate version parity', () => {
  it('aligns the package, root Bazel module and Bzlmod-linked npm_package', async () => {
    const [packageText, moduleText, buildText] = await Promise.all(
      ['package.json', 'MODULE.bazel', 'BUILD.bazel'].map((path) => readFile(path, 'utf8')),
    );
    const manifest = JSON.parse(packageText);
    const moduleVersion = moduleText.match(/^module\([\s\S]*?\bversion\s*=\s*"([^"]+)"/)?.[1];
    const packageRule = buildText.match(/\bnpm_package\(\s*name\s*=\s*"pkg",([\s\S]*?)\n\)/)?.[1];
    const packageVersion = packageRule?.match(/\bversion\s*=\s*"([^"]+)"/)?.[1];

    expect(manifest.name).toBe('@tummycrypt/tinyland-content');
    expect(manifest.version).toBe('1.2.0');
    expect(moduleVersion).toBe(manifest.version);
    expect(packageVersion).toBe(manifest.version);
  });

  it('keeps JavaScript package mechanics without provider publication hooks', async () => {
    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    expect(manifest).not.toHaveProperty('publishConfig');
    for (const hook of ['prepublish', 'prepublishOnly', 'publish', 'postpublish']) {
      expect(manifest.scripts).not.toHaveProperty(hook);
    }
    expect(manifest.packageManager).toBe('pnpm@10.13.1');
    expect(manifest.scripts).toMatchObject({
      build: 'tsc', typecheck: 'tsc --noEmit', test: 'vitest run', 'check:package': 'publint',
    });
  });
});
