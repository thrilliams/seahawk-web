import { htmlPlugin } from '@craftamap/esbuild-plugin-html';
import { execSync } from 'child_process';
import { build, BuildOptions, context, Plugin } from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import { definePlugin } from 'esbuild-plugin-define';
import { sassPlugin } from 'esbuild-sass-plugin';
import fg from 'fast-glob';
import packageJson from './package.json';

const DEV_MODE = process.env.NODE_ENV !== 'production';

const STRIP_TILDE_PLUGIN: Plugin = {
    name: 'strip-tilde',
    // eslint-disable-next-line @typescript-eslint/no-shadow
    setup(build) {
        // eslint-disable-next-line sonarjs/slow-regex
        build.onResolve({ filter: /~.*\.(woff2|ttf)$/ }, (args) => {
            return { path: require.resolve(args.path.slice(1)) };
        });
    }
};

const SASS_PLUGIN = sassPlugin({
    type: 'css',
    embedded: true,
    cssImports: true
});

const HTML_PLUGIN = htmlPlugin({
    files: [
        {
            entryPoints: ['src/index.jsx'],
            filename: 'index.html',
            htmlTemplate: `<!DOCTYPE html>
<html class="preload" dir="ltr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <link rel="manifest" href="manifest.json">
    <meta name="format-detection" content="telephone=no">
    <meta name="msapplication-tap-highlight" content="no">
    <meta http-equiv="X-UA-Compatibility" content="IE=Edge">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="application-name" content="Seahawk">
    <meta name="robots" content="noindex, nofollow, noarchive">
    <meta name="referrer" content="no-referrer">

    <meta id="themeColor" name="theme-color" content="#202020">

    <link rel="apple-touch-icon" sizes="180x180" href="./branding/favicons/touchicon.png">
    <link rel="shortcut icon" href="./branding/favicons/favicon.ico">
    <meta name="msapplication-TileImage" content="./branding/favicons/touchicon144.png">
    <meta name="msapplication-TileColor" content="#333333">

    <title>Seahawk</title>

    <style>
        .transparentDocument,
        .backgroundContainer-transparent:not(.withBackdrop) {
            background: none !important;
            background-color: transparent !important;
        }

        .layout-tv .mouseIdle,
        .layout-tv .mouseIdle button,
        .layout-tv .mouseIdle select,
        .layout-tv .mouseIdle input,
        .layout-tv .mouseIdle textarea,
        .layout-tv .mouseIdle a,
        .layout-tv .mouseIdle label,
        .transparentDocument .mouseIdle,
        .transparentDocument .mouseIdle button,
        .transparentDocument .mouseIdle select,
        .transparentDocument .mouseIdle input,
        .transparentDocument .mouseIdle textarea,
        .transparentDocument .mouseIdle a,
        .transparentDocument .mouseIdle label,
        .screensaver-noScroll.mouseIdle,
        .screensaver-noScroll.mouseIdle button,
        .screensaver-noScroll.mouseIdle select,
        .screensaver-noScroll.mouseIdle input,
        .screensaver-noScroll.mouseIdle textarea,
        .screensaver-noScroll.mouseIdle a,
        .screensaver-noScroll.mouseIdle label {
            cursor: none !important;
        }

        .preload {
            background-color: #101010;
        }

        .hide,
        .layout-desktop .hide-desktop,
        .layout-mobile .hide-mobile,
        .layout-tv .hide-tv,
        .mouseIdle .hide-mouse-idle,
        .mouseIdle-tv .hide-mouse-idle-tv {
            display: none !important;
        }

        .mainDrawerHandle {
            position: fixed;
            top: 0;
            bottom: 0;
            z-index: 1;
            width: 0.8em;
            padding-left: env(safe-area-inset-left);
            caret-color: transparent;
        }

        [dir="ltr"] .mainDrawerHandle {
            left: 0;
        }

        [dir="rtl"] .mainDrawerHandle {
            left: 0;
        }
    </style>
</head>
<body dir="ltr">
    <div id="reactRoot">
        <div class="splashLogo"></div>
    </div>${DEV_MODE ? "<script>new EventSource('/esbuild').addEventListener('change', () => location.reload())</script>" : ''}
</body>
</html>
`
        }
    ]
});

const ASSETS = [
    'native-promise-only/npo.js',
    'libarchive.js/dist/worker-bundle.js',
    'libarchive.js/dist/libarchive.wasm',
    '@jellyfin/libass-wasm/dist/js/default.woff2',
    '@jellyfin/libass-wasm/dist/js/subtitles-octopus-worker.js',
    '@jellyfin/libass-wasm/dist/js/subtitles-octopus-worker.wasm',
    '@jellyfin/libass-wasm/dist/js/subtitles-octopus-worker-legacy.js',
    'pdfjs-dist/build/pdf.worker.js',
    'libpgs/dist/libpgs.worker.js'
];

const COPY_PLUGIN = copy({
    assets: [
        { from: 'src/assets/**/*', to: 'assets' },
        { from: 'src/branding/**/*', to: 'branding' },
        { from: 'src/config.json', to: 'config.json' },
        { from: 'src/robots.txt', to: 'robots.txt' },
        { from: 'src/branding/favicons/touchicon*.png', to: 'favicons' },
        ...ASSETS.map((asset) => ({
            from: `node_modules/${asset}`,
            to: 'libraries'
        }))
    ]
});

const THEMES = fg
    .globSync('themes/**/*.scss', {
        cwd: 'src'
    })
    .map((theme) => ({
        out: theme.substring(0, theme.lastIndexOf('/')) + '/theme',
        in: `src/${theme}`
    }));

const LOCALES = fg
    .globSync('date-fns/locale/*/index.js', {
        cwd: 'node_modules'
    })
    .map((locale) => ({
        out: locale.substring(0, locale.lastIndexOf('/')) + '/index',
        in: `node_modules/${locale}`
    }));

let COMMIT_SHA = '';
try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    COMMIT_SHA = execSync('git describe --always --dirty').toString().trim();
} catch (err) {
    console.warn('Failed to get commit sha. Is git installed?', err);
}

const DEFINE_PLUGIN = definePlugin({
    __COMMIT_SHA__: JSON.stringify(COMMIT_SHA),
    __JF_BUILD_VERSION__: JSON.stringify(
        process.env.WEBPACK_SERVE ?
            'Dev Server' :
            process.env.JELLYFIN_VERSION || 'Release'
    ),
    __PACKAGE_JSON_NAME__: JSON.stringify(packageJson.name),
    __PACKAGE_JSON_VERSION__: JSON.stringify(packageJson.version),
    __USE_SYSTEM_FONTS__: !!JSON.parse(process.env.USE_SYSTEM_FONTS || '0'),
    __WEBPACK_SERVE__: !!JSON.parse(process.env.WEBPACK_SERVE || '0')
});

const BUILD_OPTIONS: BuildOptions = {
    target: [
        'firefox149',
        'firefox148',
        'chrome146',
        'chrome145',
        'safari26.4',
        'safari26.3'
    ],
    bundle: true,
    minify: !DEV_MODE,
    keepNames: DEV_MODE,
    metafile: true,
    sourcemap: DEV_MODE,
    logLevel: DEV_MODE ? 'info' : 'warning',
    outdir: 'web',
    publicPath: '/web',
    loader: {
        '.png': 'file',
        '.jpg': 'file',
        '.gif': 'file',
        '.eot': 'file',
        '.woff2': 'file',
        '.woff': 'file',
        '.ttf': 'file',
        '.html': 'text',
        '.svg': 'file'
    }
};

await build({
    ...BUILD_OPTIONS,
    format: 'esm',
    entryPoints: LOCALES
});

export const ctx = await context({
    ...BUILD_OPTIONS,
    plugins: [
        STRIP_TILDE_PLUGIN,
        SASS_PLUGIN,
        COPY_PLUGIN,
        DEFINE_PLUGIN,
        HTML_PLUGIN
    ],
    entryPoints: [
        { in: 'src/index.jsx', out: 'index' },
        { in: 'src/serviceworker.js', out: 'serviceworker' },
        {
            in: 'src/components/images/blurhash.worker.ts',
            out: 'blurhashworker'
        },
        ...THEMES
    ]
});

