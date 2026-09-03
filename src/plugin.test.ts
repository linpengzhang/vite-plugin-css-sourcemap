import { describe, it, expect, vi } from 'vitest';
import cssSourcemap from './plugin';
import { PLUGIN_NAME } from './constants';
import { hasValidExtension } from './utils';
import type { PluginContext, OutputAsset } from 'rollup';

describe('vite-plugin-css-sourcemap', () => {
  it('should be a function', () => {
    expect(typeof cssSourcemap).toBe('function');
  });

  it('should return a plugin object with correct name', () => {
    const plugin = cssSourcemap();
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe(PLUGIN_NAME);
  });

  it('should only apply in build mode', () => {
    const plugin = cssSourcemap();
    expect(plugin.apply).toBe('build');
  });

  it('should handle disabled state', () => {
    const plugin = cssSourcemap({ enabled: false });

    expect(plugin.name).toBe(PLUGIN_NAME);
    expect(plugin.apply).toBe('build');
    expect(Object.keys(plugin)).toEqual(['name', 'apply']);
  });

  it('should accept and use custom extensions', () => {
    const customExtensions = ['.less', '.scss'];

    cssSourcemap({ extensions: customExtensions });

    expect(hasValidExtension('/path/to/file.less', customExtensions)).toBe(
      true,
    );
    expect(hasValidExtension('/path/to/file.scss', customExtensions)).toBe(
      true,
    );
    expect(hasValidExtension('/path/to/file.css', customExtensions)).toBe(
      false,
    );
  });

  it('should use default extensions when none provided', () => {
    cssSourcemap();

    expect(hasValidExtension('/path/to/file.css')).toBe(true);
    expect(hasValidExtension('/path/to/file.scss')).toBe(true);
    expect(hasValidExtension('/path/to/file.less')).toBe(false);
  });

  it('should disable CSS minification by default', () => {
    const plugin = cssSourcemap();

    const config = callConfig(plugin);

    expect(config).toEqual({ build: { cssMinify: false } });
  });

  it('should leave CSS minification alone when opted out', () => {
    const plugin = cssSourcemap({ disableCssMinify: false });

    expect(callConfig(plugin)).toBeUndefined();
  });

  it('should handle custom sourcemap URL function', async () => {
    const customPrefix = '/custom-sourcemaps/';
    const plugin = cssSourcemap({
      getURL: (fileName: string) => `${customPrefix}${fileName}`,
    });

    const asset = await runPluginOverSingleStylesheet(plugin);

    expect(asset.source).toContain(
      `/*# sourceMappingURL=${customPrefix}styles.css.map */`,
    );
  });

  it('should handle custom folder option', async () => {
    const customFolder = 'custom-sourcemaps';
    const plugin = cssSourcemap({ folder: customFolder });

    const { emitFile } = await runPluginOverSingleStylesheet(plugin);

    expect(emitFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: expect.stringContaining(`${customFolder}/`),
      }),
    );
  });

  it('should map a position back to the stylesheet it came from', async () => {
    const plugin = cssSourcemap();

    const { emitFile } = await runPluginOverSingleStylesheet(plugin);
    const map = JSON.parse(emitFile.mock.calls[0]![0].source);

    expect(map.sources).toEqual([CSS_FILE]);
    expect(map.mappings).not.toBe('');
  });
});

const CSS_FILE = '/path/to/styles.css';
const CSS_SOURCE = 'body {\n  color: red;\n}';

function callConfig(plugin: ReturnType<typeof cssSourcemap>) {
  const config = plugin.config;
  if (typeof config !== 'function') throw new Error('expected a config hook');
  return config.call({} as any, {} as any, {} as any);
}

/**
 * Drives the plugin the way Vite does: transform each stylesheet, then hand
 * generateBundle the concatenated asset those stylesheets produced.
 */
async function runPluginOverSingleStylesheet(
  plugin: ReturnType<typeof cssSourcemap>,
) {
  const emitFile = vi.fn().mockReturnValue('referenceId');
  const context = {
    emitFile,
    warn: vi.fn(),
    getCombinedSourcemap: () => ({ mappings: '', sources: [] }),
  } as unknown as PluginContext;

  const transform = plugin.transform;
  if (typeof transform !== 'function') throw new Error('expected a transform');
  await transform.call(context as any, CSS_SOURCE, CSS_FILE);

  const asset = {
    type: 'asset',
    fileName: 'styles.css',
    source: CSS_SOURCE,
    name: 'styles.css',
    needsCodeReference: false,
    names: [],
    originalFileName: 'styles.css',
    originalFileNames: [],
  } as unknown as OutputAsset;

  const generateBundle = plugin.generateBundle;
  if (typeof generateBundle !== 'object' || !generateBundle?.handler) {
    throw new Error('expected a generateBundle hook');
  }
  await generateBundle.handler.call(
    context,
    {} as any,
    { 'styles.css': asset },
    false,
  );

  return Object.assign(asset, { emitFile });
}
