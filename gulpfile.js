const { src, dest, watch, series, parallel } = require('gulp');
const nunjucks = require('nunjucks');
const imagemin = require('gulp-imagemin');
const server = require('browser-sync').create();
const parser = require('posthtml-parser');
const render = require('posthtml-render');
const chalk = require('chalk');
const { HtmlValidate } = require('html-validate');

const validateHtml = new HtmlValidate();
const Severity = {
  1: {
    log: chalk.yellow.bold,
    title: 'WARNING'
  },
  2: {
    log: chalk.red.bold,
    title: 'ERROR'
  }
};
const isDev = process.env.NODE_ENV === 'development';
const getPage = (tree) => tree.options.from.replace(/^.*source(\\+|\/+)(.*)\.html$/, '$2');

const buildHTML = () => src(['source/**/*.html', '!source/**/_*.html'])
  .pipe(require('gulp-posthtml')([
    (() => (tree) => {
      nunjucks.configure('source', { autoescape: false });

      return parser(nunjucks.renderString(render(tree), {
        isDev,
        page: getPage(tree)
      }));
    })(),
    (() => (tree) => {
      // Оффлайновый валидатор HTML
      const report = validateHtml.validateString(render(tree), {
        extends: [
          'html-validate:recommended',
          'html-validate:document'
        ],
				rules: {
          'no-trailing-whitespace': 'off',
          'input-missing-label': 'off',
					'require-sri': 'off'
				}
      });

      report.results.forEach(({ messages }) => {
        messages.forEach(({ column, line, message, selector, severity, ruleUrl }) => {
          if (Severity[severity]) {
            const { log, title } = Severity[severity];
            const prefix = `\n[${chalk.cyan('HtmlValidate')}] ${getPage(tree)}.html (${line}:${column})`;
            const selectorMsg = selector ? ` ${chalk.cyan(selector)}` : '';
            console.log(`${prefix}${selectorMsg}:\n${log.underline(title)}: ${log(message)}\n`);
          }
        });
      });

      return tree;
    })()
  ]))
  .pipe(require('gulp-html-beautify')())
  .pipe(dest('.'));

const buildCSS = () => src(['source/**/*.css', '!source/**/_*.css'])
  .pipe(require('gulp-postcss')([
    require('postcss-easy-import')(),
    require('stylelint')(),
    require('autoprefixer')(),
    require('postcss-reporter')({
      clearAllMessages: true,
      throwError: false
    })
  ]))
  .pipe(dest('.'));

const testBuildedCSS = () => src(['**/*.css', '!source/**/*.css', '!node_modules/**/*.css'])
  .pipe(require('gulp-postcss')([
    require('stylelint')({ fix: true }),
    require('postcss-reporter')({
      clearAllMessages: true,
      throwError: false
    })
  ]));

const optimizeImages = () => src('source/**/*.{svg,png,jpg}')
  .pipe(imagemin([
    imagemin.svgo({
      plugins: [
        {
          removeViewBox: false
        },
        {
          removeTitle: true
        },
        {
          cleanupNumericValues: {
            floatPrecision: 2
          }
        },
        {
          cleanupNumericValues: {
            floatPrecision: 2
          }
        },
        {
          convertPathData: {
            floatPrecision: 2
          }
        },
        {
          transformsWithOnePath: {
            floatPrecision: 2
          }
        },
        {
          convertTransform: {
            floatPrecision: 2
          }
        },
        {
          cleanupListOfValues: {
            floatPrecision: 2
          }
        }
      ]
    }),
    imagemin.mozjpeg({ quality: 75, progressive: true }),
    imagemin.optipng()
  ]))
  .pipe(dest('.'));

const reload = (done) => {
  server.reload();
  done();
};

const startServer = () => {
  server.init({
    cors: true,
    server: '.',
    ui: false
  });

  watch('source/**/*.html', series(buildHTML, reload));
  watch('source/**/*.css', series(buildCSS, testBuildedCSS, reload));
  watch('source/**/*.{svg,png,jpg}', series(optimizeImages, reload));
};

exports.test = testBuildedCSS;
exports.default = series(parallel(buildHTML, buildCSS, optimizeImages), testBuildedCSS, startServer);
