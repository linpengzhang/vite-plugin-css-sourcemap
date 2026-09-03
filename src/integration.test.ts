import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { build } from 'vite';
import { resolve } from 'path';
import { readFile, readdir } from 'fs/promises';
import { rimraf } from 'rimraf';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

describe('vite-plugin-css-sourcemap integration', () => {
  const playgroundDir = resolve(__dirname, '../playground');
  const distDir = resolve(playgroundDir, 'dist');
  const assetsDir = resolve(distDir, 'assets');
  const customDistDir = resolve(playgroundDir, 'dist-custom');
  const customAssetsDir = resolve(customDistDir, 'assets');

  beforeEach(async () => {
    await rimraf(distDir);
    await rimraf(customDistDir);
  });

  it('should generate sourcemap files in the correct custom location', async () => {
    const sourceMapsOutput = 'sourcemaps';
    await build({
      root: playgroundDir,
      build: {
        outDir: 'dist',
      },
      configFile: false,
      plugins: [
        (await import('./index')).default({
          folder: sourceMapsOutput,
          getURL: (fileName) => `${sourceMapsOutput}/${fileName}`,
        }),
      ],
    });
    const sourceMapsDir = resolve(assetsDir, sourceMapsOutput);
    const files = await readdir(assetsDir);
    const sourceMapsFiles = await readdir(sourceMapsDir);

    const cssFiles = files.filter((file) => file.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);

    const mapFiles = sourceMapsFiles
      .filter((file) => file.endsWith('.map'))
      .map((file) => [file, `${sourceMapsOutput}/${file}`]);

    expect(mapFiles.length).toBeGreaterThan(0);

    const sourceMapFiles = Object.fromEntries(mapFiles);

    for (const cssFile of cssFiles) {
      const mapFile = `${cssFile}.map`;
      expect(sourceMapFiles).toHaveProperty(mapFile);

      const cssContent = await readFile(resolve(assetsDir, cssFile), 'utf-8');
      expect(cssContent).toContain(
        `/*# sourceMappingURL=${sourceMapFiles[mapFile]} */`,
      );
    }
  });

  it('should generate sourcemap files in the correct location', async () => {
    await build({
      root: playgroundDir,
      build: {
        outDir: 'dist',
      },
      configFile: false,
      plugins: [(await import('./index')).default()],
    });
    const sourceMapsDir = resolve(assetsDir);
    const files = await readdir(assetsDir);
    const sourceMapsFiles = await readdir(sourceMapsDir);

    const cssFiles = files.filter((file) => file.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);

    const mapFiles = sourceMapsFiles
      .filter((file) => file.endsWith('.map'))
      .map((file) => [file, `${file}`]);

    expect(mapFiles.length).toBeGreaterThan(0);

    const sourceMapFiles = Object.fromEntries(mapFiles);

    for (const cssFile of cssFiles) {
      const mapFile = `${cssFile}.map`;
      expect(sourceMapFiles).toHaveProperty(mapFile);

      const cssContent = await readFile(resolve(assetsDir, cssFile), 'utf-8');
      expect(cssContent).toContain(
        `/*# sourceMappingURL=${sourceMapFiles[mapFile]} */`,
      );
    }
  });

  it('should generate sourcemap files in a custom dist location', async () => {
    await build({
      root: playgroundDir,
      build: {
        outDir: customDistDir,
      },
      configFile: false,
      plugins: [(await import('./index')).default()],
    });
    const sourceMapsDir = resolve(customAssetsDir);
    const files = await readdir(customAssetsDir);
    const sourceMapsFiles = await readdir(sourceMapsDir);

    const cssFiles = files.filter((file) => file.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);

    const mapFiles = sourceMapsFiles
      .filter((file) => file.endsWith('.map'))
      .map((file) => [file, `${file}`]);

    expect(mapFiles.length).toBeGreaterThan(0);

    const sourceMapFiles = Object.fromEntries(mapFiles);

    for (const cssFile of cssFiles) {
      const mapFile = `${cssFile}.map`;
      expect(sourceMapFiles).toHaveProperty(mapFile);

      const cssContent = await readFile(
        resolve(customAssetsDir, cssFile),
        'utf-8',
      );
      expect(cssContent).toContain(
        `/*# sourceMappingURL=${sourceMapFiles[mapFile]} */`,
      );
    }
  });

  it('should generate sourcemap files in the correct custom location and a custom dist location', async () => {
    const sourceMapsOutput = 'sourcemaps';
    await build({
      root: playgroundDir,
      build: {
        outDir: customDistDir,
      },
      configFile: false,
      plugins: [
        (await import('./index')).default({
          folder: sourceMapsOutput,
          getURL: (fileName) => `${sourceMapsOutput}/${fileName}`,
        }),
      ],
    });
    const sourceMapsDir = resolve(customAssetsDir, sourceMapsOutput);
    const files = await readdir(customAssetsDir);
    const sourceMapsFiles = await readdir(sourceMapsDir);

    const cssFiles = files.filter((file) => file.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);

    const mapFiles = sourceMapsFiles
      .filter((file) => file.endsWith('.map'))
      .map((file) => [file, `${sourceMapsOutput}/${file}`]);

    expect(mapFiles.length).toBeGreaterThan(0);

    const sourceMapFiles = Object.fromEntries(mapFiles);

    for (const cssFile of cssFiles) {
      const mapFile = `${cssFile}.map`;
      expect(sourceMapFiles).toHaveProperty(mapFile);

      const cssContent = await readFile(
        resolve(customAssetsDir, cssFile),
        'utf-8',
      );
      expect(cssContent).toContain(
        `/*# sourceMappingURL=${sourceMapFiles[mapFile]} */`,
      );
    }
  });

  it('should generate sourcemap files using entryFileNames: "[name].js"', async () => {
    await build({
      root: playgroundDir,
      build: {
        outDir: distDir,
        sourcemap: true,
        minify: false,
        emptyOutDir: true,
        rollupOptions: {
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: 'js/[name].js',
            assetFileNames: 'assets/[name].[ext]',
          },
        },
      },
      configFile: false,
      plugins: [
        (await import('./index')).default({
          extensions: ['.scss', '.css', '.less'],
        }),
      ],
    });
    const sourceMapsDir = resolve(assetsDir);
    const files = await readdir(assetsDir);
    const sourceMapsFiles = await readdir(sourceMapsDir);

    const cssFiles = files.filter((file) => file.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);

    const mapFiles = sourceMapsFiles
      .filter((file) => file.endsWith('.map'))
      .map((file) => [file, `${file}`]);

    expect(mapFiles.length).toBeGreaterThan(0);

    const sourceMapFiles = Object.fromEntries(mapFiles);

    for (const cssFile of cssFiles) {
      const mapFile = `${cssFile}.map`;
      expect(sourceMapFiles).toHaveProperty(mapFile);

      const cssContent = await readFile(resolve(assetsDir, cssFile), 'utf-8');
      expect(cssContent).toContain(
        `/*# sourceMappingURL=${sourceMapFiles[mapFile]} */`,
      );
    }

    for (const sourceMapFile of Object.values(sourceMapFiles)) {
      const sourceMapContent = await readFile(
        resolve(assetsDir, sourceMapFile as string),
        'utf-8',
      );

      expect(sourceMapContent).not.toBe('null');
    }
  });

  it('should generate sourcemap files using entryFileNames: "[name].js" and assetFileNames empty', async () => {
    await build({
      root: playgroundDir,
      build: {
        outDir: distDir,
        sourcemap: true,
        minify: false,
        emptyOutDir: true,
        rollupOptions: {
          input: {
            foo: 'playground/foo.html',
          },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: 'js/[name].js',
          },
        },
      },
      configFile: false,
      plugins: [
        (await import('./index')).default({
          extensions: ['.scss', '.css', '.less'],
        }),
      ],
    });
    const sourceMapsDir = resolve(assetsDir);
    const files = await readdir(assetsDir);
    const sourceMapsFiles = await readdir(sourceMapsDir);

    const cssFiles = files.filter((file) => file.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);

    const mapFiles = sourceMapsFiles
      .filter((file) => file.endsWith('.map'))
      .map((file) => [file, `${file}`]);

    expect(mapFiles.length).toBeGreaterThan(0);

    const sourceMapFiles = Object.fromEntries(mapFiles);

    for (const cssFile of cssFiles) {
      const mapFile = `${cssFile}.map`;
      expect(sourceMapFiles).toHaveProperty(mapFile);

      const cssContent = await readFile(resolve(assetsDir, cssFile), 'utf-8');
      expect(cssContent).toContain(
        `/*# sourceMappingURL=${sourceMapFiles[mapFile]} */`,
      );
    }

    for (const sourceMapFile of Object.values(sourceMapFiles)) {
      const sourceMapContent = await readFile(
        resolve(assetsDir, sourceMapFile as string),
        'utf-8',
      );

      expect(sourceMapContent).not.toBe('null');
    }
  });

  afterAll(async () => {
    await rimraf(distDir);
    await rimraf(customDistDir);
  });
});

describe('vite-plugin-css-sourcemap SCSS entrypoint integration', () => {
  const scssPlaygroundDir = resolve(__dirname, '../playground-scss-entrypoint');
  const distDir = resolve(scssPlaygroundDir, 'dist');
  const assetsDir = resolve(distDir, 'assets');

  beforeEach(async () => {
    await rimraf(distDir);
  });

  it('should generate sourcemap for SCSS as direct rollup entrypoint', async () => {
    await build({
      root: scssPlaygroundDir,
      build: {
        outDir: distDir,
        sourcemap: true,
        minify: false,
        emptyOutDir: true,
        rollupOptions: {
          input: {
            main: resolve(scssPlaygroundDir, 'javascript/main.js'),
            styles: resolve(scssPlaygroundDir, 'styles/main.scss'),
          },
          output: {
            entryFileNames: 'js/[name].js',
            chunkFileNames: 'js/[name].[hash].js',
            assetFileNames: 'assets/[name].[ext]',
          },
        },
      },
      configFile: false,
      plugins: [
        (await import('./index')).default({
          extensions: ['.css', '.scss'],
        }),
      ],
    });

    const files = await readdir(assetsDir);
    const cssFiles = files.filter((file) => file.endsWith('.css'));
    const mapFiles = files.filter((file) => file.endsWith('.css.map'));

    expect(cssFiles.length).toBeGreaterThan(0);
    expect(mapFiles.length).toBeGreaterThan(0);

    for (const cssFile of cssFiles) {
      const mapFile = `${cssFile}.map`;
      expect(mapFiles).toContain(mapFile);

      const cssContent = await readFile(resolve(assetsDir, cssFile), 'utf-8');
      expect(cssContent).toContain(`/*# sourceMappingURL=${mapFile} */`);
    }
  });

  it('should include all SCSS partials in sourcemap sources', async () => {
    await build({
      root: scssPlaygroundDir,
      build: {
        outDir: distDir,
        sourcemap: true,
        minify: false,
        emptyOutDir: true,
        rollupOptions: {
          input: {
            main: resolve(scssPlaygroundDir, 'javascript/main.js'),
            styles: resolve(scssPlaygroundDir, 'styles/main.scss'),
          },
          output: {
            entryFileNames: 'js/[name].js',
            chunkFileNames: 'js/[name].[hash].js',
            assetFileNames: 'assets/[name].[ext]',
          },
        },
      },
      configFile: false,
      plugins: [
        (await import('./index')).default({
          extensions: ['.css', '.scss'],
        }),
      ],
    });

    const files = await readdir(assetsDir);
    const mapFiles = files.filter((file) => file.endsWith('.css.map'));

    expect(mapFiles.length).toBeGreaterThan(0);

    const mapContent = await readFile(resolve(assetsDir, mapFiles[0]), 'utf-8');
    const sourcemap = JSON.parse(mapContent);

    expect(sourcemap.sources).toBeDefined();
    expect(Array.isArray(sourcemap.sources)).toBe(true);

    // The sourcemap should include multiple SCSS files (main + partials)
    // not just the entrypoint
    expect(sourcemap.sources.length).toBeGreaterThan(1);

    // Check that partials are included (they should contain partial file names)
    const sourceNames = sourcemap.sources.map((s: string) =>
      s.split('/').pop(),
    );

    // Should include at least some of the partials
    const expectedPartials = [
      '_variables.scss',
      '_reset.scss',
      '_layout.scss',
      '_buttons.scss',
      '_cards.scss',
      '_forms.scss',
      '_utilities.scss',
    ];

    const foundPartials = expectedPartials.filter((partial) =>
      sourceNames.some((name: string) => name === partial),
    );

    // We should find most of the partials in the sourcemap
    expect(foundPartials.length).toBeGreaterThanOrEqual(5);
  });

  afterAll(async () => {
    await rimraf(distDir);
  });
});

describe('vite-plugin-css-sourcemap position resolution', () => {
  const playgroundDir = resolve(__dirname, '../playground');
  const distDir = resolve(playgroundDir, 'dist');
  const assetsDir = resolve(distDir, 'assets');

  beforeEach(async () => {
    await rimraf(distDir);
  });

  afterAll(async () => {
    await rimraf(distDir);
  });

  // Listing every stylesheet under `sources` is not enough on its own: a
  // sourcemap can name all of them and still resolve every position to the
  // first one. These assertions pin the mappings themselves.
  it('should resolve positions back to the stylesheet each rule came from', async () => {
    await build({
      root: playgroundDir,
      build: { outDir: 'dist' },
      configFile: false,
      logLevel: 'error',
      plugins: [(await import('./index')).default()],
    });

    const files = await readdir(assetsDir);
    const cssFile = files.find((file) => file.endsWith('.css'))!;
    const css = await readFile(resolve(assetsDir, cssFile), 'utf-8');
    const map = JSON.parse(
      await readFile(resolve(assetsDir, `${cssFile}.map`), 'utf-8'),
    );

    const tracer = new TraceMap(map);
    const lines = css.split('\n');

    const expectations: [string, string][] = [
      ['btn', 'components/button.css'],
      ['card', 'components/card.css'],
      ['form', 'components/form.css'],
      ['modal', 'components/modal.css'],
      ['fade', 'animations.css'],
    ];

    for (const [selector, expectedSource] of expectations) {
      const line = lines.findIndex(
        (text) => text.includes(selector) && text.includes('{'),
      );
      expect(
        line,
        `no rule containing "${selector}" in the built CSS`,
      ).toBeGreaterThan(-1);

      const position = originalPositionFor(tracer, {
        line: line + 1,
        column: lines[line]!.indexOf(selector),
      });

      expect(
        position.source,
        `"${selector}" resolved to the wrong stylesheet`,
      ).toContain(expectedSource);
    }
  });

  it('should spread mappings across every stylesheet rather than collapsing onto one', async () => {
    await build({
      root: playgroundDir,
      build: { outDir: 'dist' },
      configFile: false,
      logLevel: 'error',
      plugins: [(await import('./index')).default()],
    });

    const files = await readdir(assetsDir);
    const cssFile = files.find((file) => file.endsWith('.css'))!;
    const css = await readFile(resolve(assetsDir, cssFile), 'utf-8');
    const map = JSON.parse(
      await readFile(resolve(assetsDir, `${cssFile}.map`), 'utf-8'),
    );

    const tracer = new TraceMap(map);
    const resolved = new Set<string>();

    for (let line = 1; line <= css.split('\n').length; line++) {
      const { source } = originalPositionFor(tracer, { line, column: 0 });
      if (source) resolved.add(source);
    }

    expect(resolved.size).toBeGreaterThan(1);
    expect(resolved.size).toBe(map.sources.length);
  });

  // A `url()` is still an unresolved placeholder when the plugin captures the
  // stylesheet, and `vite:css-post` substitutes the hashed URL afterwards, so
  // looking for the captured text verbatim never finds it. Without allowing
  // for that, every rule in a stylesheet using a font or an image is dropped.
  it('should map stylesheets that reference an emitted asset', async () => {
    await build({
      root: playgroundDir,
      // Emit the asset as a file rather than inlining it, which is what
      // happens to any real font or image over Vite's inlining threshold.
      build: { outDir: 'dist', assetsInlineLimit: 0 },
      configFile: false,
      logLevel: 'error',
      plugins: [(await import('./index')).default()],
    });

    const files = await readdir(assetsDir);
    const cssFile = files.find((file) => file.endsWith('.css'))!;
    const css = await readFile(resolve(assetsDir, cssFile), 'utf-8');
    const map = JSON.parse(
      await readFile(resolve(assetsDir, `${cssFile}.map`), 'utf-8'),
    );

    expect(css).toContain('url(');
    expect(css).not.toContain('__VITE_ASSET__');

    // A bare reference and one carrying a fragment use different shapes of
    // placeholder, so both have to survive the rewrite.
    for (const stylesheet of ['hero.css', 'sprite.css']) {
      expect(
        map.sources.some((source: string) => source.includes(stylesheet)),
        `${stylesheet} is missing from the sourcemap`,
      ).toBe(true);
    }

    const tracer = new TraceMap(map);
    const lines = css.split('\n');
    const line = lines.findIndex((text) => text.includes('.hero-caption'));
    expect(line, 'no .hero-caption rule in the built CSS').toBeGreaterThan(-1);

    expect(
      originalPositionFor(tracer, {
        line: line + 1,
        column: lines[line]!.indexOf('.hero-caption'),
      }).source,
    ).toContain('hero.css');
  });

  // Vite lifts `@import` and `@charset` to the top of the concatenated file, so
  // a stylesheet opening with one is split in two and its compiled text never
  // appears as a single run.
  it('should map a stylesheet whose leading at-rule is hoisted', async () => {
    await build({
      root: playgroundDir,
      build: { outDir: 'dist' },
      configFile: false,
      logLevel: 'error',
      plugins: [(await import('./index')).default()],
    });

    const files = await readdir(assetsDir);
    const cssFile = files.find((file) => file.endsWith('.css'))!;
    const css = await readFile(resolve(assetsDir, cssFile), 'utf-8');
    const map = JSON.parse(
      await readFile(resolve(assetsDir, `${cssFile}.map`), 'utf-8'),
    );

    const lines = css.split('\n');
    expect(lines[0]).toContain('@import');
    expect(
      map.sources.some((source: string) => source.includes('fonts.css')),
      'fonts.css is missing from the sourcemap',
    ).toBe(true);

    // The rules must keep pointing at their original lines even though the
    // at-rule above them was moved elsewhere.
    const line = lines.findIndex((text) => text.includes('.font-heading'));
    expect(line, 'no .font-heading rule in the built CSS').toBeGreaterThan(-1);

    const position = originalPositionFor(new TraceMap(map), {
      line: line + 1,
      column: lines[line]!.indexOf('.font-heading'),
    });
    expect(position.source).toContain('fonts.css');
    expect(position.line).toBe(7);
  });

  // Claiming a start offset rather than a whole region lets a stylesheet whose
  // CSS is contained in another's take a position inside it, so the containing
  // stylesheet either goes missing or inherits the shorter one's coverage.
  it('should keep stylesheets apart when one contains the other', async () => {
    await build({
      root: playgroundDir,
      build: { outDir: 'dist' },
      configFile: false,
      logLevel: 'error',
      plugins: [(await import('./index')).default()],
    });

    const files = await readdir(assetsDir);
    const cssFile = files.find((file) => file.endsWith('.css'))!;
    const css = await readFile(resolve(assetsDir, cssFile), 'utf-8');
    const map = JSON.parse(
      await readFile(resolve(assetsDir, `${cssFile}.map`), 'utf-8'),
    );

    const tracer = new TraceMap(map);
    const resolved = new Set<string>();
    for (let line = 1; line <= css.split('\n').length; line++) {
      const { source } = originalPositionFor(tracer, { line, column: 0 });
      if (source) resolved.add(source);
    }

    for (const stylesheet of ['a11y.css', 'print.css']) {
      expect(
        [...resolved].some((source) => source.includes(stylesheet)),
        `${stylesheet} is unreachable through the sourcemap`,
      ).toBe(true);
    }

    const lines = css.split('\n');
    const line = lines.findIndex((text) => text.includes('.skip-link'));
    expect(
      originalPositionFor(tracer, {
        line: line + 1,
        column: lines[line]!.indexOf('.skip-link'),
      }).source,
    ).toContain('a11y.css');
  });
});

// With `cssCodeSplit` each entry gets its own CSS asset. Searching every
// captured stylesheet inside every asset lets one entry's stylesheet claim the
// identical region in the other entry's asset, leaving its twin unmapped and
// its coverage attributed to the wrong file.
describe('vite-plugin-css-sourcemap split assets', () => {
  const playgroundDir = resolve(__dirname, '../playground');
  const distDir = resolve(playgroundDir, 'dist-split');
  const assetsDir = resolve(distDir, 'assets');

  beforeEach(async () => {
    await rimraf(distDir);
  });

  afterAll(async () => {
    await rimraf(distDir);
  });

  it('should attribute identical stylesheets to their own file', async () => {
    await build({
      root: playgroundDir,
      configFile: false,
      logLevel: 'error',
      build: {
        outDir: 'dist-split',
        cssCodeSplit: true,
        rollupOptions: {
          input: {
            a: resolve(playgroundDir, 'src/split/entry-a.ts'),
            b: resolve(playgroundDir, 'src/split/entry-b.ts'),
          },
        },
      },
      plugins: [(await import('./index')).default()],
    });

    const files = await readdir(assetsDir);

    for (const [entry, expected] of [
      ['a-', 'split/alpha.css'],
      ['b-', 'split/beta.css'],
    ]) {
      const cssFile = files.find(
        (file) => file.startsWith(entry!) && file.endsWith('.css'),
      );
      expect(cssFile, `no CSS asset for entry ${entry}`).toBeDefined();

      const css = await readFile(resolve(assetsDir, cssFile!), 'utf-8');
      const map = JSON.parse(
        await readFile(resolve(assetsDir, `${cssFile}.map`), 'utf-8'),
      );

      const lines = css.split('\n');
      const line = lines.findIndex((text) => text.includes('.shared-widget'));
      expect(line, 'no .shared-widget rule in the built CSS').toBeGreaterThan(
        -1,
      );

      const position = originalPositionFor(new TraceMap(map), {
        line: line + 1,
        column: 0,
      });
      expect(position.source).toContain(expected!);
    }
  });
});
