module.exports =
  function($scope, gettext, $location, $rootScope, ScopedHotkeysService,
    $window) {

    // 左侧设备屏幕与右侧控制栏的默认分隔比例（约 65:35，三分律）
    // 若用户曾手动拖拽过分隔条，则从 localStorage 恢复其拖拽后的宽度（px）
    var REMOTE_PANE_SIZE_KEY = 'stf.controlPane.remotePaneSize'
    var DEFAULT_REMOTE_PANE_SIZE = '65% + 2px'

    function readSavedPaneSize() {
      try {
        var value = parseInt($window.localStorage.getItem(REMOTE_PANE_SIZE_KEY), 10)
        return value > 0 ? value : null
      }
      catch (e) {
        return null
      }
    }

    var savedPaneSize = readSavedPaneSize()
    $scope.remotePaneSize = savedPaneSize ? savedPaneSize + 'px' : DEFAULT_REMOTE_PANE_SIZE

    // 拖拽结束后记住设备屏幕宽度：仅当 targetSize 变为数字（即用户手动拖拽过）时持久化
    // 注：border-layout 的 pane.id 实际取的是 fa-pane 属性值（模板中为空），
    // 故改用 anchor 区分——设备屏幕是唯一 west 面板
    var westPane = null
    var savePaneSizeTimer = null
    $scope.$on('fa-pane-resize', function(event, pane) {
      if (!pane || pane.anchor !== 'west') {
        return
      }

      // 记录 west 面板实例，供重置时强制刷新（模型值可能未变化，watch 不会触发）
      westPane = pane

      // 仅当 targetSize 为数字（用户手动拖拽过）时持久化
      if (typeof pane.targetSize !== 'number') {
        return
      }

      if (savePaneSizeTimer) {
        $window.clearTimeout(savePaneSizeTimer)
      }

      savePaneSizeTimer = $window.setTimeout(function() {
        try {
          $window.localStorage.setItem(REMOTE_PANE_SIZE_KEY, String(pane.size))
        }
        catch (e) {
          // localStorage 不可用时忽略
        }
      }, 300)
    })

    // 重置：清除已记忆的分栏宽度，恢复默认 65:35 布局
    // （由设备屏幕顶部工具栏的“重置布局”按钮 device-control.pug 调用）
    $scope.resetControlPaneLayout = function() {
      try {
        $window.localStorage.removeItem(REMOTE_PANE_SIZE_KEY)
      }
      catch (e) {
        // localStorage 不可用时忽略
      }

      $scope.remotePaneSize = DEFAULT_REMOTE_PANE_SIZE

      // 关键：拖拽只改变面板内部 targetSize，模型值可能仍是默认字符串，
      // 直接赋值不会触发 pane-size 插值变化，故强制让 west 面板重排
      if (westPane) {
        westPane.setTargetSize(DEFAULT_REMOTE_PANE_SIZE)
      }
    }

    var actions = {
      previousDevice: function() {
        // console.log('prev')
      },
      nextDevice: function() {
        // console.log('next')
      },
      deviceList: function() {
        $location.path('/devices/')
      },
      switchCharset: function() {
        $scope.control.keyPress('switch_charset')
      },
      // TODO: Refactor this
      rotateLeft: function() {
        var angle = 0
        if ($scope.device && $scope.device.display) {
          angle = $scope.device.display.rotation
        }
        if (angle === 0) {
          angle = 270
        } else {
          angle -= 90
        }
        $scope.control.rotate(angle)

        if ($rootScope.standalone) {
          $window.resizeTo($window.outerHeight, $window.outerWidth)
        }

      },
      rotateRight: function() {
        var angle = 0
        if ($scope.device && $scope.device.display) {
          angle = $scope.device.display.rotation
        }
        if (angle === 270) {
          angle = 0
        } else {
          angle += 90
        }
        $scope.control.rotate(angle)

        if ($rootScope.standalone) {
          $window.resizeTo($window.outerHeight, $window.outerWidth)
        }
      },
      focusUrlBar: function() {
        // TODO: Switch tab and focus
        // console.log('focus')
      },
      takeScreenShot: function() {
        // TODO: Switch tab and take screenshot
        //$scope.takeScreenShot()
      },
      pressMenu: function() {
        $scope.control.menu()
      },
      pressHome: function() {
        $scope.control.home()
      },
      pressBack: function() {
        $scope.control.back()
      },
      pressAppSwitch: function() {
        $scope.control.appSwitch()
      },
      toggleDevice: function() {
        // $scope.controlScreen.show = !$scope.controlScreen.show
      },
      togglePlatform: function() {
        if ($rootScope.platform === 'web') {
          $rootScope.platform = 'native'
        } else {
          $rootScope.platform = 'web'
        }
      },
      scale: function() {
        // TODO: scale size
      }
    }

    ScopedHotkeysService($scope, [
      // ['shift+up', gettext('Previous Device'), actions.previousDevice],
      // ['shift+down', gettext('Next Device'), actions.nextDevice],
      ['command+shift+d', gettext('Go to Device List'), actions.deviceList],

      ['shift+space', gettext('Selects Next IME'), actions.switchCharset],
      ['command+left', gettext('Rotate Left'), actions.rotateLeft],
      ['command+right', gettext('Rotate Right'), actions.rotateRight],

      // ['command+1', gettext('Scale 100%'), actions.scale],
      // ['command+2', gettext('Scale 75%'), actions.scale],
      // ['command+3', gettext('Scale 50%'), actions.scale],

      // ['shift+l', gettext('Focus URL bar'), actions.focusUrlBar],
      // ['shift+s', gettext('Take Screenshot'), actions.takeScreenShot],

      ['command+shift+m', gettext('Press Menu button'), actions.pressMenu],
      ['command+shift+h', gettext('Press Home button'), actions.pressHome],
      ['command+shift+b', gettext('Press Back button'), actions.pressBack],

      // ['shift+i', gettext('Show/Hide device'), actions.toggleDevice],
      ['shift+w', gettext('Toggle Web/Native'), actions.togglePlatform, false]
    ])
  }
