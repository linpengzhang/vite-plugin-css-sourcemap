import path from 'node:path';
import fs from 'node:fs';
import type { Plugin } from 'vite';
import { decode, encode } from '@jridgewell/sourcemap-codec';
import type {
  NormalizedOutputOptions,
  OutputBundle,
  ExistingRawSourceMap,
} from 'rollup';
import { EXTENSIONS, PLUGIN_NAME } from './constants';
import { hasValidExtension } from './utils';

/**
 * Checks if a sourcemap is empty (has no meaningful mappings or sources)
 */
function isEmptySourcemap(map: ExistingRawSourceMap | null): boolean {
  return (
    !map ||
    !map.mappings ||
    map.mappings === '' ||
    !map.sources ||
    map.sources.length === 0
  );
}

export interface CssSourcemapOptions {
  extensions?: string[];
  enabled?: boolean;
  folder?: string;
  getURL?: (fileName: string) => string;
  /**
   * Disable CSS minification while the plugin is active.
   *
   * Vite minifies a CSS asset after this plugin has recorded where each
   * stylesheet landed inside it, which invalidates every offset. Leaving
   * minification on therefore produces a sourcemap that resolves every
   * position to the first source.
   *
   * @default true
   */
  disableCssMinify?: boolean;
}

/**
 * A concatenated sourcemap. Declared locally rather than reusing Rollup's
 * `ExistingRawSourceMap` because the spec allows a null entry in
 * `sourcesContent` for a source whose text is unavailable, which that type
 * does not model.
 */
interface ConcatenatedSourceMap {
  version: 3;
  file: string;
  sources: string[];
  sourcesContent: (string | null)[];
  names: string[];
  mappings: string;
}

/** A stylesheet as it appeared once Vite finished compiling it. */
interface CompiledStylesheet {
  code: string;
  map: ExistingRawSourceMap | null;
}

/** Where a compiled stylesheet ended up inside the concatenated CSS asset. */
interface PlacedStylesheet {
  id: string;
  stylesheet: CompiledStylesheet;
  line: number;
  column: number;
}

export default function cssSourcemapPlugin(
  options: CssSourcemapOptions = {},
): Plugin {
  const {
    extensions = EXTENSIONS,
    enabled = true,
    folder = '',
    getURL = (fileName: string) => fileName,
    disableCssMinify = true,
  } = options;

  if (!enabled) {
    return {
      name: PLUGIN_NAME,
      apply: 'build',
    };
  }

  const compiled = new Map<string, CompiledStylesheet>();
  let sassCompiler: any = null;

  /**
   * Try to load a Sass compiler (sass-embedded or sass).
   * Returns the compiler module or false if not available.
   */
  async function getSassCompiler() {
    if (sassCompiler !== null) return sassCompiler;

    try {
      // Try sass-embedded first (preferred by Vite 7+)
      sassCompiler = await import('sass-embedded');
    } catch {
      // sass-embedded not available, trying sass
      try {
        // Fall back to sass
        sassCompiler = await import('sass');
      } catch {
        // Neither sass-embedded nor sass is installed
        sassCompiler = false;
      }
    }
    return sassCompiler;
  }

  /**
   * Compile SCSS/Sass file and extract the sourcemap.
   * This is used when Vite's CSS pipeline doesn't expose the Sass sourcemap
   * through getCombinedSourcemap() (e.g., when SCSS is a direct rollup entrypoint).
   */
  async function compileSCSS(id: string): Promise<ExistingRawSourceMap | null> {
    const sass = await getSassCompiler();
    if (!sass) return null;

    try {
      const fileContent = await fs.promises.readFile(id, 'utf-8');
      const result = sass.compileString(fileContent, {
        url: new URL(`file://${id}`),
        sourceMap: true,
        sourceMapIncludeSources: true,
      });

      if (result.sourceMap) {
        return result.sourceMap as ExistingRawSourceMap;
      }
    } catch {
      // Sass compilation failed (syntax error, file not found, etc.)
      // Will fall back to an identity mapping.
    }
    return null;
  }

  return {
    name: PLUGIN_NAME,
    apply: 'build',

    config() {
      if (!disableCssMinify) return;
      return { build: { cssMinify: false as const } };
    },

    // Left at the default order so that this runs after `vite:css` has
    // compiled a stylesheet, but before `vite:css-post` replaces it with a
    // JavaScript module.
    async transform(code, id) {
      if (!hasValidExtension(id, extensions)) return null;
      if (!code.trim()) return null;

      let map = this.getCombinedSourcemap() as ExistingRawSourceMap | null;

      if (
        isEmptySourcemap(map) &&
        (id.endsWith('.scss') || id.endsWith('.sass'))
      ) {
        // Compile the file ourselves so that @use/@import partials are
        // represented, which the combined sourcemap does not cover when SCSS
        // is a direct rollup entrypoint.
        map = await compileSCSS(id);
      }

      compiled.set(id, {
        code,
        map: isEmptySourcemap(map) ? null : map,
      });

      return null;
    },

    generateBundle: {
      // `vite:css-post` adds the CSS asset to the bundle from its own
      // generateBundle, so this has to run after it.
      order: 'post',
      handler(_options: NormalizedOutputOptions, bundle: OutputBundle) {
        for (const [fileName, asset] of Object.entries(bundle)) {
          if (asset.type !== 'asset' || !fileName.endsWith('.css')) continue;

          const css = String(asset.source);
          const placed = locateStylesheets(css, compiled);

          if (placed.length === 0) {
            this.warn(
              `No compiled stylesheet could be located inside ${fileName}, so no ` +
                `sourcemap was emitted. This usually means the asset was minified ` +
                `or rewritten after the plugin recorded it.`,
            );
            continue;
          }

          const map = buildConcatenatedSourcemap(placed, fileName);
          const mapFileName = `${asset.fileName}.map`;
          const mapBaseName = path.basename(mapFileName);

          this.emitFile({
            type: 'asset',
            fileName: path.join(path.dirname(mapFileName), folder, mapBaseName),
            source: JSON.stringify(map),
          });

          asset.source = `${css}\n/*# sourceMappingURL=${getURL(mapBaseName)} */`;
        }
      },
    },
  };
}

/**
 * Finds where each compiled stylesheet was placed inside the concatenated CSS
 * asset. Anything that cannot be found is skipped, which keeps a stylesheet
 * that some other plugin rewrote from corrupting its neighbours' offsets.
 */
function locateStylesheets(
  css: string,
  compiled: Map<string, CompiledStylesheet>,
): PlacedStylesheet[] {
  const placed: PlacedStylesheet[] = [];
  const claimed = new Set<number>();

  for (const [id, stylesheet] of compiled) {
    const offset = findUnclaimedOffset(css, stylesheet.code.trim(), claimed);
    if (offset === -1) continue;
    claimed.add(offset);

    const preceding = css.slice(0, offset);
    placed.push({
      id,
      stylesheet,
      line: preceding.split('\n').length - 1,
      // Vite can concatenate one stylesheet's last line and the next
      // stylesheet's first onto a single physical line, so the offset within
      // that line is what keeps their mappings apart.
      column: offset - (preceding.lastIndexOf('\n') + 1),
    });
  }

  return placed.sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * Finds an occurrence of `needle` that no other stylesheet has taken. Two
 * stylesheets can compile to byte-identical CSS, and without this they would
 * both claim the first occurrence, leaving one unreachable in the map.
 */
function findUnclaimedOffset(
  css: string,
  needle: string,
  claimed: ReadonlySet<number>,
): number {
  let offset = css.indexOf(needle);
  while (offset !== -1 && claimed.has(offset)) {
    offset = css.indexOf(needle, offset + 1);
  }
  return offset;
}

/**
 * Builds a single sourcemap for a concatenated CSS asset by shifting each
 * stylesheet's own mappings into the position it occupies in the asset.
 *
 * Concatenation places stylesheets side by side, so the individual maps cannot
 * be composed the way a chain of transforms would be; each one has to be
 * translated into the asset's coordinate space instead.
 */
function buildConcatenatedSourcemap(
  placed: PlacedStylesheet[],
  fileName: string,
): ConcatenatedSourceMap {
  const sources: string[] = [];
  const sourcesContent: (string | null)[] = [];

  const sourceIndex = (source: string, content: string | null): number => {
    const existing = sources.indexOf(source);
    if (existing !== -1) return existing;
    sources.push(source);
    sourcesContent.push(content);
    return sources.length - 1;
  };

  const lines: [number, number, number, number][][] = [];
  const addSegment = (
    line: number,
    segment: [number, number, number, number],
  ) => {
    while (lines.length <= line) lines.push([]);
    lines[line]!.push(segment);
  };

  for (const { id, stylesheet, line, column } of placed) {
    // A stylesheet owns exactly the lines its compiled CSS occupies. Segments
    // past that would land inside the next stylesheet and win its lookups.
    const span = stylesheet.code.trim().split('\n').length;
    // Only the first line is offset horizontally; later lines start at column 0.
    const shift = (index: number, col: number) =>
      index === 0 ? column + col : col;
    const decoded = stylesheet.map ? decode(stylesheet.map.mappings) : null;

    if (decoded?.some((segments) => segments.length > 0)) {
      const remapped = stylesheet.map!.sources.map((source, index) =>
        sourceIndex(
          resolveSource(id, source),
          stylesheet.map!.sourcesContent?.[index] ?? null,
        ),
      );

      decoded.slice(0, span).forEach((segments, index) => {
        for (const segment of segments) {
          if (segment.length < 4) continue;
          addSegment(line + index, [
            shift(index, segment[0]),
            remapped[segment[1]!] ?? 0,
            segment[2]!,
            segment[3]!,
          ]);
        }
      });
    } else {
      // Without a map the compiled CSS is line-for-line with its source, except
      // where a plugin generated CSS the source never spelled out. Clamping
      // keeps those lines attributed to the file that produced them rather than
      // pointing past its end.
      const index = sourceIndex(id, stylesheet.code);
      const lastLine = Math.max(0, countLines(id) - 1);
      for (let i = 0; i < span; i++) {
        addSegment(line + i, [shift(i, 0), index, Math.min(i, lastLine), 0]);
      }
    }
  }

  return {
    version: 3,
    file: path.basename(fileName),
    sources,
    sourcesContent,
    names: [],
    mappings: encode(
      lines.map((segments) => segments.sort((a, b) => a[0] - b[0])),
    ),
  };
}

function resolveSource(id: string, source: string): string {
  if (path.isAbsolute(source)) return source;
  try {
    if (source.startsWith('file://')) return new URL(source).pathname;
  } catch {
    // Not a URL; treat it as a relative path below.
  }
  return path.resolve(path.dirname(id), source);
}

function countLines(file: string): number {
  try {
    return fs.readFileSync(file, 'utf-8').split('\n').length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
