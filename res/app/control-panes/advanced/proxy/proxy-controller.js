module.exports = function ProxyCtrl($scope, gettext, $filter) {
  $scope.proxy = {
    host: ''
  , port: ''
  }

  function notify(message) {
    $scope.$apply(function() {
      $scope.proxyStatus = message
    })
  }

  function runShell(command, onSuccess, onFail) {
    $scope.proxyBusy = true
    return $scope.control.shell(command)
      .then(function(result) {
        $scope.proxyBusy = false
        if (result && result.success) {
          onSuccess(result)
        }
        else {
          onFail(result && result.lastData ? result.lastData : '')
        }
      })
      .catch(function(err) {
        $scope.proxyBusy = false
        onFail(err && err.message ? err.message : '')
      })
  }

  $scope.setProxy = function() {
    var host = ($scope.proxy.host || '').trim()
    var port = ($scope.proxy.port || '').trim()

    if (!host) {
      notify($filter('translate')(gettext('请输入代理IP')))
      return
    }

    var portNum = parseInt(port, 10)
    if (!port || isNaN(portNum) || portNum < 1 || portNum > 65535) {
      notify($filter('translate')(gettext('请输入有效端口（1-65535）')))
      return
    }

    var value = host + ':' + port
    // Equivalent to: adb shell settings put global http_proxy ip:port
    runShell(
      'settings put global http_proxy ' + value
    , function() {
        notify($filter('translate')(gettext('代理已设置：')) + value)
      }
    , function(reason) {
        notify($filter('translate')(gettext('代理设置失败')) + (reason ? ': ' + reason : ''))
      }
    )
  }

  $scope.clearProxy = function() {
    var line = $filter('translate')(gettext('确认关闭该设备的代理吗？'))
    if (!confirm(line)) {
      return
    }

    // Equivalent to: adb shell settings put global http_proxy :0
    runShell(
      'settings put global http_proxy :0'
    , function() {
        $scope.proxy.host = ''
        $scope.proxy.port = ''
        notify($filter('translate')(gettext('代理已关闭')))
      }
    , function(reason) {
        notify($filter('translate')(gettext('关闭代理失败')) + (reason ? ': ' + reason : ''))
      }
    )
  }
}
