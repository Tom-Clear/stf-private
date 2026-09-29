module.exports = function ProxyCtrl($scope, $window, gettext, SettingsService) {
  var PROXY_ADDRESS_PATTERN = /^[\w.\-]+:\d{1,5}$/
  // Whistle 访问地址按设备 serial 分别持久化到用户设置（RethinkDB）
  var WHISTLE_URLS_KEY = 'whistleUrls'

  $scope.proxyAddress = ''
  $scope.whistleUrl = ''
  $scope.proxyStatus = ''
  $scope.proxyBusy = false

  // 已完成地址回显的设备 serial，避免重复覆盖用户输入
  var lastLoadedSerial = null

  function setStatus(message) {
    $scope.proxyStatus = message
  }

  function currentSerial() {
    return $scope.device && $scope.device.serial ? $scope.device.serial : null
  }

  function persistWhistleUrl(serial, url) {
    var urls = angular.copy(SettingsService.get(WHISTLE_URLS_KEY) || {})
    urls[serial] = url
    SettingsService.set(WHISTLE_URLS_KEY, urls)
  }

  // shell 输出分片累积在 result.data 中，join 后才是完整结果
  function runShell(command) {
    return $scope.control.shell(command).then(function(result) {
      var data = result && result.data ? result.data : []
      return String(data.join('')).trim()
    })
  }

  // `settings get` 在键不存在时输出 null，`:0` 表示未设置代理
  function parseProxyValue(output) {
    var value = String(output || '').trim()
    if (!value || value === 'null' || value === 'NULL' || value === ':0') {
      return null
    }
    return value
  }

  // 切换到「高级」标签时面板会重新实例化，此时回显设备当前代理
  function queryCurrentProxy() {
    if (!$scope.control) {
      return
    }

    $scope.proxyBusy = true

    runShell('settings get global http_proxy')
      .then(function(output) {
        var current = parseProxyValue(output)
        $scope.$apply(function() {
          $scope.proxyBusy = false
          $scope.proxyAddress = current || ''
          setStatus(current ?
            gettext('当前代理：') + current :
            gettext('当前未设置代理')
          )
        })
      })
      .catch(function() {
        $scope.$apply(function() {
          $scope.proxyBusy = false
          setStatus(gettext('查询当前代理失败'))
        })
      })
  }

  $scope.setProxy = function() {
    var address = ($scope.proxyAddress || '').trim()

    if (!address) {
      setStatus(gettext('请输入代理地址'))
      return
    }

    if (!PROXY_ADDRESS_PATTERN.test(address)) {
      setStatus(gettext('代理地址格式应为 ip:端口 或 域名:端口'))
      return
    }

    if (!$scope.control) {
      setStatus(gettext('请先连接设备'))
      return
    }

    $scope.proxyBusy = true
    setStatus(gettext('正在设置代理...'))

    // Equivalent to: adb shell settings put global http_proxy ip:port
    runShell('settings put global http_proxy ' + address)
      .then(function() {
        $scope.$apply(function() {
          $scope.proxyBusy = false
          setStatus(gettext('代理已设置：') + address)
        })
      })
      .catch(function() {
        $scope.$apply(function() {
          $scope.proxyBusy = false
          setStatus(gettext('代理设置失败'))
        })
      })
  }

  $scope.clearProxy = function() {
    if (!$scope.control) {
      setStatus(gettext('请先连接设备'))
      return
    }

    if (!$window.confirm(gettext('确认关闭该设备的代理吗？'))) {
      return
    }

    $scope.proxyBusy = true

    // Equivalent to: adb shell settings put global http_proxy :0
    // 下发清理后立即回读，判断系统是否真正生效
    runShell('settings put global http_proxy :0')
      .then(function() {
        return runShell('settings get global http_proxy')
      })
      .then(function(output) {
        var current = parseProxyValue(output)
        $scope.$apply(function() {
          $scope.proxyBusy = false
          $scope.proxyAddress = ''
          if (current) {
            setStatus(gettext('清理指令已下发，但代理仍为：') + current +
              gettext('，若仍能抓到请求请强停被测应用或断开重连网络后重试')
            )
          }
          else {
            setStatus(gettext('代理已关闭'))
          }
        })
      })
      .catch(function() {
        $scope.$apply(function() {
          $scope.proxyBusy = false
          setStatus(gettext('关闭代理失败'))
        })
      })
  }

  $scope.openWhistleUrl = function() {
    var url = ($scope.whistleUrl || '').trim()

    if (!url) {
      setStatus(gettext('请输入 Whistle Web 访问地址'))
      return
    }

    if (url.indexOf('://') === -1) {
      url = 'http://' + url
    }

    $window.open(url, '_blank')
  }

  // 点击「保存地址」才写入数据库，不做输入即存
  $scope.saveWhistleUrl = function() {
    var serial = currentSerial()
    var url = ($scope.whistleUrl || '').trim()

    if (!serial) {
      setStatus(gettext('设备信息未就绪，请稍后重试'))
      return
    }

    if (!url) {
      setStatus(gettext('请输入 Whistle Web 访问地址'))
      return
    }

    persistWhistleUrl(serial, url)
    lastLoadedSerial = serial
    setStatus(gettext('Whistle 地址已保存'))
  }

  // 进入面板时查询用户是否保存过当前设备的地址；设备/设置可能晚于面板初始化就绪，
  // 两者任一变化时回显一次，之后不再覆盖用户正在编辑的内容
  $scope.$watch(
    function() {
      return [currentSerial(), SettingsService.get(WHISTLE_URLS_KEY)]
    }
  , function(newValue) {
      var serial = newValue[0]
      var urls = newValue[1]
      if (!serial || !urls || serial === lastLoadedSerial) {
        return
      }
      lastLoadedSerial = serial
      if (urls[serial]) {
        $scope.whistleUrl = urls[serial]
      }
    }
  , true)

  // 控制会话可能晚于面板初始化建立（设备邀请是异步的），因此兼容两种时机
  if ($scope.control) {
    queryCurrentProxy()
  }
  else {
    var stopWatch = $scope.$watch('control', function(control) {
      if (control) {
        stopWatch()
        queryCurrentProxy()
      }
    })
  }
}
