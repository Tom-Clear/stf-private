//
// Copyright © 2024 contains code contributed by Orange SA, authors: Denis Barbaron - Licensed under the Apache license 2.0
//

// var _ = require('lodash')

module.exports = function NavigationCtrl($scope, $rootScope, gettext) {
  // 原有 Navigation 浏览器导航逻辑（已注释保留源码）
  // var faviconIsSet = false
  //
  // function setUrlFavicon(url) {
  //   var FAVICON_BASE_URL = '//www.google.com/s2/favicons?domain_url='
  //   $scope.urlFavicon = FAVICON_BASE_URL + url
  //   faviconIsSet = true
  // }
  //
  // function resetFavicon() {
  //   $scope.urlFavicon = require('./default-favicon.png').default
  //   faviconIsSet = false
  // }
  //
  // resetFavicon()
  //
  // $scope.textUrlChanged = function() {
  //   if (faviconIsSet) {
  //     resetFavicon()
  //   }
  // }
  //
  // function addHttp(textUrl) {
  //   return (textUrl.replace(/\?.*/, '').indexOf('://') === -1 ? 'http://' : ''
  //     ) + textUrl
  // }
  //
  // $scope.blurUrl = false
  //
  // $scope.openURL = function() {
  //   $scope.blurUrl = true
  //   $rootScope.screenFocus = true
  //
  //   var url = addHttp($scope.textURL)
  //   setUrlFavicon(url)
  //   return $scope.control.openBrowser(url, $scope.browser)
  // }
  //
  // function setCurrentBrowser(browser) {
  //   if (browser && browser.apps) {
  //     var currentBrowser = {}
  //     if (browser.selected) {
  //       var selectedBrowser = _.head(browser.apps, 'selected')
  //       if (!_.isEmpty(selectedBrowser)) {
  //         currentBrowser = selectedBrowser
  //       }
  //     } else {
  //       var defaultBrowser = _.find(browser.apps, {name: 'Browser'})
  //       if (defaultBrowser) {
  //         currentBrowser = defaultBrowser
  //       } else {
  //         currentBrowser = _.head(browser.apps)
  //       }
  //     }
  //     $rootScope.browser = currentBrowser
  //   }
  // }
  //
  // setCurrentBrowser($scope.device ? $scope.device.browser : null)
  //
  // $scope.$watch('device.browser', function(newValue, oldValue) {
  //   if (newValue !== oldValue) {
  //     setCurrentBrowser(newValue)
  //   }
  // }, true)
  //
  // $scope.clearSettings = function() {
  //   var browser = $scope.browser
  //   $scope.control.clearBrowser(browser)
  // }

  // ===== 语音发送功能开始 =====
  $scope.voiceText = ''
  $scope.voiceStatus = ''
  $scope.voiceStatusColor = '#999'

  function buildVoiceCommand(text) {
    var safeText = text.replace(/"/g, '\\"')
    return 'am broadcast -a com.hisense.speech.core.START ' +
      '--es source wechat --es rectext "' + safeText + '"'
  }

  function setStatus(message, color) {
    $scope.voiceStatus = message
    $scope.voiceStatusColor = color || '#999'
  }

  $scope.sendVoice = function() {
    var text = ($scope.voiceText || '').trim()

    if (!text) {
      setStatus(gettext('请输入语音文本'), '#d9534f')
      return
    }

    if (!$scope.control) {
      setStatus(gettext('请先连接设备'), '#d9534f')
      return
    }

    setStatus(gettext('正在发送...'), '#999')

    $scope.control.shell(buildVoiceCommand(text))
      .then(function() {
        setStatus('✅ ' + gettext('命令已发送'), '#5cb85c')
        $scope.voiceText = ''
      })
      .catch(function() {
        setStatus('❌ ' + gettext('发送失败'), '#d9534f')
      })
  }

  $scope.onVoiceKeydown = function($event) {
    if ($event.keyCode === 13) {
      $event.preventDefault()
      $scope.sendVoice()
    }
  }
  // ===== 语音发送功能结束 =====
}
