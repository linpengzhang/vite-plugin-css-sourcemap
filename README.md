# vite-plugin-css-sourcemap

A Vite plugin for handling CSS sourcemaps. This plugin ensures that CSS sourcemaps are properly generated and referenced in your Vite builds.

> [!IMPORTANT]
> This plugin is only meant for the build phase, to generate sourcemap files for your build.
> It doesn't work on dev mode.

## Features

- Automatically generates sourcemaps for CSS files
- Supports custom sourcemap file locations
- Configurable sourcemap URL generation
- Works with Vite's build process
- Compatible with Vite 5.x through 8.x

## Installation

```bash
npm install vite-plugin-css-sourcemap --save-dev
# or
yarn add vite-plugin-css-sourcemap --dev
# or
pnpm add vite-plugin-css-sourcemap --save-dev
```

## Usage

Add the plugin to your Vite configuration:

```js
// vite.config.js
import { defineConfig } from 'vite';
import cssSourcemap from 'vite-plugin-css-sourcemap';

export default defineConfig({
  plugins: [cssSourcemap()],
});
```

## Configuration Options

The plugin accepts the following options:

```js
cssSourcemap({
  // Enable/disable the plugin
  enabled: true,

  // Custom extensions to process (default: ['.css', '.scss'])
  extensions: ['.css', '.scss', '.less'],

  // Custom folder for sourcemap files
  folder: 'sourcemaps',

  // Custom function to generate sourcemap URLs
  getURL: (fileName) => `sourcemaps/${fileName}`,

  // Keep Vite's CSS minification on (default: false, i.e. minification is
  // disabled while the plugin is active)
  disableCssMinify: true,
});
```

### Options

| Option             | Type                           | Default                  | Description                                                |
| ------------------ | ------------------------------ | ------------------------ | ---------------------------------------------------------- |
| `enabled`          | `boolean`                      | `true`                   | Enable or disable the plugin                               |
| `extensions`       | `string[]`                     | `['.css', '.scss']`      | File extensions to process                                 |
| `folder`           | `string`                       | `''`                     | Custom folder for sourcemap files                          |
| `getURL`           | `(fileName: string) => string` | `(fileName) => fileName` | Custom function to generate sourcemap URLs                 |
| `disableCssMinify` | `boolean`                      | `true`                   | Disable Vite's CSS minification while the plugin is active |

## Examples

### Basic Usage

```js
// vite.config.js
import { defineConfig } from 'vite';
import cssSourcemap from 'vite-plugin-css-sourcemap';

export default defineConfig({
  plugins: [cssSourcemap()],
});
```

### Custom Sourcemap Location

```js
// vite.config.js
import { defineConfig } from 'vite';
import cssSourcemap from 'vite-plugin-css-sourcemap';

export default defineConfig({
  plugins: [
    cssSourcemap({
      folder: 'sourcemaps',
    }),
  ],
});
```

### Custom Sourcemap URL Generation

```js
// vite.config.js
import { defineConfig } from 'vite';
import cssSourcemap from 'vite-plugin-css-sourcemap';

export default defineConfig({
  plugins: [
    cssSourcemap({
      getURL: (fileName) => `/assets/sourcemaps/${fileName}`,
    }),
  ],
});
```

### Process Additional File Types

```js
// vite.config.js
import { defineConfig } from 'vite';
import cssSourcemap from 'vite-plugin-css-sourcemap';

export default defineConfig({
  plugins: [
    cssSourcemap({
      extensions: ['.css', '.scss', '.less'],
    }),
  ],
});
```

## How It Works

This plugin hooks into Vite's build process to:

1. Intercept CSS file processing
2. Generate sourcemaps for CSS files
3. Emit the sourcemap files to the output directory
4. Add sourcemap references to the CSS files

The plugin works by:

1. Using the `transform` hook to capture each stylesheet after Vite has
   compiled it, along with whatever sourcemap the preprocessor produced
2. Using the `generateBundle` hook, ordered after `vite:css-post`, to find
   where each stylesheet was placed inside the concatenated CSS asset
3. Translating each stylesheet's mappings into the asset's coordinate space and
   emitting the combined sourcemap alongside it
4. Allows configuring the sourcemap URL based on the provided options

### Why CSS minification is disabled

Vite minifies a CSS asset after this plugin has recorded where each stylesheet
landed inside it. Minifying collapses the asset onto a handful of lines, which
invalidates those positions and produces a sourcemap that resolves every
position back to the first source.

The plugin therefore turns CSS minification off by default. If you would rather
keep it on and forgo accurate sourcemaps, set `disableCssMinify: false`.

## Compatibility

This plugin is compatible with:

- Vite 5.x
- Vite 6.x
- Vite 7.x
- Vite 8.x (including the Rolldown-based build)

## License

MIT
