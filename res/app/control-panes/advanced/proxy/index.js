require('./proxy.css')

module.exports = angular.module('stf.advanced.proxy', [
  require('gettext').name,
  require('stf/settings').name
])
  .run(['$templateCache', function($templateCache) {
    $templateCache.put('control-panes/advanced/proxy/proxy.pug',
      require('./proxy.pug')
    )
  }])
  .controller('ProxyCtrl', require('./proxy-controller'))
