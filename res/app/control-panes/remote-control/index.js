require('./remote-control.css')

module.exports = angular.module('stf.remote-control', [
  require('gettext').name
])
  .run(['$templateCache', function($templateCache) {
    $templateCache.put('control-panes/remote-control/remote-control.pug',
      require('./remote-control.pug')
    )
  }])
  .controller('RemoteControlCtrl', require('./remote-control-controller'))
