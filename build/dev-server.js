require('./check-versions')()

var config = require('../config')
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = JSON.parse(config.dev.env.NODE_ENV)
}

var opn = require('opn')
var path = require('path')
var express = require('express')
var bodyParser = require('body-parser')
var webpack = require('webpack')
var proxyMiddleware = require('http-proxy-middleware')
var mockMiddleware = require('./mock-middleware')
var webpackConfig = require('./webpack.dev.conf')
var net = require('net')

// default port where dev server listens for incoming traffic
var port = process.env.PORT || config.dev.port
// automatically open browser, if not set will be false
var autoOpenBrowser = !!config.dev.autoOpenBrowser
// Define HTTP proxies to your custom API backend
// https://github.com/chimurai/http-proxy-middleware
var proxyTable = config.dev.proxyTable

var app = express()
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var compiler = webpack(webpackConfig)

var devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: webpackConfig.output.publicPath,
  quiet: true
})

var hotMiddleware = require('webpack-hot-middleware')(compiler, {
  log: () => { }
})
// force page reload when html-webpack-plugin template changes
compiler.plugin('compilation', function (compilation) {
  compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
    hotMiddleware.publish({ action: 'reload' })
    cb()
  })
})



// proxy api requests
Object.keys(proxyTable).forEach(function (context) {
  var options = proxyTable[context]
  if (typeof options === 'string') {
    options = { target: options }
  }
  app.use(proxyMiddleware(options.filter || context, options))
})
// handle fallback for HTML5 history API
app.use(require('connect-history-api-fallback')())


// serve webpack bundle output
app.use(devMiddleware)

// enable hot-reload and state-preserving
// compilation error display
app.use(hotMiddleware)


// serve pure static assets
var staticPath = path.posix.join(config.dev.assetsPublicPath, config.dev.assetsSubDirectory)
app.use(staticPath, express.static('./static'))

// 数据mock优先级最低
app.use(mockMiddleware({
  basePath: __dirname,
  mockFolder: '../mocks',
  routeFile: '../config/mock.js'
}))

// 检测port是否被占用
function probe(port, callback) {

  var server = net.createServer().listen(port)

  var calledOnce = false

  var timeoutRef = setTimeout(function () {
    calledOnce = true
    callback(false, port)
  }, 2000)

  timeoutRef.unref()

  var connected = false

  server.on('listening', function () {
    clearTimeout(timeoutRef)

    if (server)
      server.close()

    if (!calledOnce) {
      calledOnce = true
      callback(true, port)
    }
  })

  server.on('error', function (err) {
    clearTimeout(timeoutRef)

    var result = true
    if (err.code === 'EADDRINUSE')
      result = false

    if (!calledOnce) {
      calledOnce = true
      callback(result, port)
    }
  })
}


(function startPort(port) {
  probe(port, function (bl, port) {
    if (bl) {
      var uri = 'http://localhost:' + port

      var _resolve
      var readyPromise = new Promise(resolve => {
        _resolve = resolve
      })

      console.log('> Starting dev server...')
      devMiddleware.waitUntilValid(() => {
        console.log('> Listening at ' + uri + '\n')
        // when env is testing, don't need open it

        if (autoOpenBrowser && process.env.NODE_ENV !== 'testing') {
          opn(uri)
        }
        _resolve()
      })

      var server = app.listen(port, function () {
        // 自动打开浏览器
        opn(uri);
      })

      module.exports = {
        ready: readyPromise,
        close: () => {
          server.close()
        }
      }

    } else {
      startPort(port + 1)
    }

  })
}(port))
