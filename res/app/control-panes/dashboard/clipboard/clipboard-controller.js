module.exports = function ClipboardCtrl($scope, $routeParams, gettext) {
  // 原有 Clipboard 剪贴板逻辑（已注释保留源码）
  // module.exports = function ClipboardCtrl() {
  //   $scope.clipboardContent = null
  //
  //   $scope.getClipboardContent = function () {
  //     console.log('getting')
  //
  //     $scope.control.copy().then(function (result) {
  //       $scope.$apply(function () {
  //         if (result.success) {
  //           if (result.lastData) {
  //             $scope.clipboardContent = result.lastData
  //           } else {
  //             $scope.clipboardContent = gettext('No clipboard data')
  //           }
  //         } else {
  //           $scope.clipboardContent = gettext('Error while getting data')
  //         }
  //       })
  //     })
  //   }
  // }

  // ===== 设备拓展功能开始 =====
  var UIAUTOMATION_URL_TEMPLATE = 'http://10.18.220.50:8000/uiautomation/uiautomation_device_detail/{serial}/'

  $scope.deviceSerial = $routeParams.serial || ($scope.device && $scope.device.serial) || ''

  function buildUiaUrl(serial) {
    return serial ? UIAUTOMATION_URL_TEMPLATE.replace('{serial}', serial) : ''
  }

  $scope.uiaUrl = buildUiaUrl($scope.deviceSerial)
  // ===== 设备拓展功能结束 =====
}
