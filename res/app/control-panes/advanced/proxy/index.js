module.exports = angular.module('stf.advanced.proxy', [
  require('gettext').name
])
  .run(['$templateCache', function($templateCache) {
    $templateCache.put('control-panes/advanced/proxy/proxy.pug',
      require('./proxy.pug')
    )
  }])
  .controller('ProxyCtrl', require('./proxy-controller'))
