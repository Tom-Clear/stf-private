module.exports = function RemoteControlCtrl($scope, gettext) {
  $scope.remoteStatus = ''

  $scope.sendKeyEvent = function(keyCode) {
    if (!$scope.control) {
      $scope.remoteStatus = gettext('请先连接设备')
      return
    }

    $scope.remoteStatus = gettext('正在发送...')

    $scope.control.shell('input keyevent ' + keyCode)
      .then(function() {
        $scope.remoteStatus = '✅ keyevent ' + keyCode
      })
      .catch(function() {
        $scope.remoteStatus = '❌ ' + gettext('发送失败')
      })
  }
}
