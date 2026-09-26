//
// Copyright © 2024 contains code contributed by Orange SA, authors: Denis Barbaron - Licensed under the Apache license 2.0
//

// var _ = require('lodash')

module.exports = function NavigationCtrl($scope, $rootScope, $window, gettext, $q) {
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

  // ===== 语音环境切换功能开始 =====

  /**
   * 语音环境相关的 global settings 键
   * 全部有值 -> 测试环境（地址指向内网测试服务）
   * 全部删除 -> 正式环境（使用设备内置地址）
   * 与 tmp/debug_测试环境-语音.bat、tmp/debug_正式环境-语音.bat 保持一致
   */
  var VOICE_ENV_KEYS = [
    'areaurl'
    , 'aicloudurl'
    , 'digitalurl'
    , 'taskmaster_test'
    , 'test_url_llm'
  ]

  /** 测试环境对应的配置值 */
  var VOICE_TEST_ENV_VALUES = {
    areaurl: '10.18.224.107:83'
    , aicloudurl: '10.18.217.183:85'
    , digitalurl: '10.18.217.75:30846'
    , taskmaster_test: 'http://10.18.217.183:86'
    , test_url_llm: 'ws://10.18.217.183:86/v1.0/agent/'
  }

  /** 切换环境后需要清理数据并重启的语音相关应用 */
  var VOICE_PACKAGES = [
    'com.keylab.speech.core.vidaa'
    , 'com.keylab.speech.view.vidaa'
    , 'com.hispeech.ai.area'
    , 'com.intelligent.speech'
    , 'com.speech.enchatroom'
  ]

  var VOICE_SERVICE_ACTION = 'com.hisense.speech.core.STARTSERVICE'

  var VOICE_ENV_META = {
    test: {label: gettext('测试环境'), className: 'voice-env-test'}
    , prod: {label: gettext('正式环境'), className: 'voice-env-prod'}
    , unknown: {label: gettext('未知环境'), className: 'voice-env-unknown'}
    , loading: {label: gettext('查询中...'), className: 'voice-env-unknown'}
    , none: {label: gettext('未查询'), className: 'voice-env-unknown'}
  }

  $scope.voiceEnv = null
  $scope.voiceEnvLabel = VOICE_ENV_META.none.label
  $scope.voiceEnvClass = VOICE_ENV_META.none.className
  $scope.voiceEnvDetail = gettext('点击刷新按钮查询当前语音环境')
  $scope.voiceEnvBusy = false
  $scope.voiceEnvRestart = true
  $scope.voiceEnvTip = ''
  $scope.voiceEnvTipColor = '#999'

  function setEnvTip(message, color) {
    $scope.voiceEnvTip = message || ''
    $scope.voiceEnvTipColor = color || '#999'
  }

  // `settings get` 在键不存在时输出 null，统一转成 null 方便判断
  function normalizeSettingValue(output) {
    var value = String(output || '').trim()
    if (!value || value === 'null' || value === 'NULL') {
      return null
    }
    return value
  }

  function runShell(command) {
    return $scope.control.shell(command).then(function(result) {
      var data = result && result.data ? result.data : []
      return String(data.join('')).trim()
    })
  }

  // 顺序执行 shell 命令，单条失败不中断，最终返回失败的命令列表
  function runShellSequence(commands) {
    var failures = []
    var chain = commands.reduce(function(promise, command) {
      return promise.then(function() {
        return runShell(command).catch(function() {
          failures.push(command)
          return null
        })
      })
    }, $q.when())
    return chain.then(function() {
      return failures
    })
  }

  function queryEnvValues() {
    var values = {}
    var chain = VOICE_ENV_KEYS.reduce(function(promise, key) {
      return promise.then(function() {
        return runShell('settings get global ' + key)
          .then(function(output) {
            values[key] = normalizeSettingValue(output)
          })
          .catch(function() {
            values[key] = null
          })
      })
    }, $q.when())
    return chain.then(function() {
      return values
    })
  }

  function applyEnvResult(values) {
    var configured = []
    var missing = []

    VOICE_ENV_KEYS.forEach(function(key) {
      if (values[key]) {
        configured.push(key)
      }
      else {
        missing.push(key)
      }
    })

    var type, detail

    if (configured.length === VOICE_ENV_KEYS.length) {
      type = 'test'
      detail = configured.map(function(key) {
        return key + '=' + values[key]
      }).join(' · ')
    }
    else if (configured.length === 0) {
      type = 'prod'
      detail = gettext('未检测到测试环境地址，当前使用设备内置正式环境')
    }
    else {
      type = 'unknown'
      detail = gettext('已配置') + ': ' + configured.join(', ') +
        '；' + gettext('未配置') + ': ' + missing.join(', ')
    }

    $scope.voiceEnv = type
    $scope.voiceEnvLabel = VOICE_ENV_META[type].label
    $scope.voiceEnvClass = VOICE_ENV_META[type].className
    $scope.voiceEnvDetail = detail
  }

  // 查询设备当前所处的语音环境
  $scope.refreshVoiceEnv = function() {
    if ($scope.voiceEnvBusy) {
      return $q.when()
    }

    if (!$scope.control) {
      setEnvTip(gettext('请先连接设备'), '#d9534f')
      return $q.when()
    }

    $scope.voiceEnvBusy = true
    $scope.voiceEnvLabel = VOICE_ENV_META.loading.label
    setEnvTip('')

    return queryEnvValues()
      .then(applyEnvResult)
      .then(function() {
        setEnvTip('✅ ' + gettext('语音环境已刷新'), '#5cb85c')
      })
      .catch(function() {
        setEnvTip('❌ ' + gettext('查询语音环境失败'), '#d9534f')
      })
      .finally(function() {
        $scope.voiceEnvBusy = false
      })
  }

  // 切换语音环境：target 为 'test' 或 'prod'
  $scope.switchVoiceEnv = function(target) {
    if ($scope.voiceEnvBusy) {
      return $q.when()
    }

    if (!$scope.control) {
      setEnvTip(gettext('请先连接设备'), '#d9534f')
      return $q.when()
    }

    if ($scope.voiceEnv === target) {
      setEnvTip(gettext('当前已处于该语音环境'), '#999')
      return $q.when()
    }

    var commands = []

    if (target === 'test') {
      VOICE_ENV_KEYS.forEach(function(key) {
        commands.push('settings put global ' + key + ' ' + VOICE_TEST_ENV_VALUES[key])
      })
    }
    else {
      VOICE_ENV_KEYS.forEach(function(key) {
        commands.push('settings delete global ' + key)
      })
    }

    // 与 bat 脚本保持一致：打开语音日志、开启 foundation debug
    commands.push('settings put global speech_savelog_file 1')
    commands.push('setprop foundation_debug 2')

    if ($scope.voiceEnvRestart) {
      VOICE_PACKAGES.forEach(function(pkg) {
        commands.push('pm clear ' + pkg)
      })
      commands.push('am startservice -a ' + VOICE_SERVICE_ACTION)
    }

    var targetLabel = VOICE_ENV_META[target].label

    if ($scope.voiceEnvRestart && !$window.confirm(
      gettext('切换至') + targetLabel + gettext('将清理语音应用数据并重启语音服务，是否继续？')
    )) {
      return $q.when()
    }

    $scope.voiceEnvBusy = true
    $scope.voiceEnvLabel = VOICE_ENV_META.loading.label
    setEnvTip(gettext('正在切换至') + targetLabel + '...', '#999')

    return runShellSequence(commands)
      .then(function(failures) {
        return queryEnvValues()
          .then(applyEnvResult)
          .then(function() {
            return failures
          })
      })
      .then(function(failures) {
        if (failures.length) {
          setEnvTip('⚠️ ' + gettext('已切换至') + targetLabel + '，' +
            gettext('但有') + ' ' + failures.length + ' ' + gettext('条命令执行失败'), '#f0ad4e')
        }
        else {
          setEnvTip('✅ ' + gettext('已切换至') + targetLabel, '#5cb85c')
        }
      })
      .catch(function() {
        setEnvTip('❌ ' + gettext('切换语音环境失败，请查看设备 Shell 输出'), '#d9534f')
      })
      .finally(function() {
        $scope.voiceEnvBusy = false
      })
  }

  // 设备连接就绪后自动查询一次当前语音环境
  var voiceEnvInitialized = false
  $scope.$watch('control', function(control) {
    if (control && !voiceEnvInitialized) {
      voiceEnvInitialized = true
      $scope.refreshVoiceEnv()
    }
  })
  // ===== 语音环境切换功能结束 =====
}
