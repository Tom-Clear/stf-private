/**
 * STF 自定义工具模块
 * 1. 替换 Navigation 遵板为"语音发送"
 * 2. 替换 Clipboard 遵板为"UI自动化"链接
 * 3. 隐藏下方重复的 tab（截图、自动化、高级、文件管理、信息）
 * 4. 在下方日志 tab 前增加"遥控器"tab
 * 5. 设备列表备注显示功能
 * 6. 设备列表细节tab"占用"功能
 * 7. 设备列表细节tab"删除设备"功能（仅断开连接状态）
 */
(function () {
    'use strict';

    var CHECK_INTERVAL = 1500;
    var voiceInjected = false;
    var uiaInjected = false;
    var bottomTabsProcessed = false;


    /** UI自动化页面地址模板 */
    var UIAUTOMATION_URL_TEMPLATE = 'http://10.18.220.50:8000/uiautomation/uiautomation_device_detail/{serial}/';

    // ========== 工具函数 ==========

    function buildVoiceCommand(text) {
        var safeText = text.replace(/"/g, '\\"');
        return 'am broadcast -a com.hisense.speech.core.START ' +
            '--es source wechat --es rectext "' + safeText + '"';
    }

    function executeViaShellInput(command) {
        var shellInput = document.querySelector('.stf-shell input[type="text"]') ||
            document.querySelector('.stf-shell input') ||
            document.querySelector('[ng-controller="ShellCtrl"] input');
        if (!shellInput) return false;

        try {
            var ngModelCtrl = angular.element(shellInput).controller('ngModel');
            if (ngModelCtrl) {
                var scope = angular.element(shellInput).scope();
                scope.$apply(function () {
                    ngModelCtrl.$setViewValue(command);
                    ngModelCtrl.$render();
                });
            } else {
                shellInput.value = command;
                shellInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } catch (e) {
            shellInput.value = command;
            shellInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        setTimeout(function () {
            var form = shellInput.closest('form');
            if (form) angular.element(form).triggerHandler('submit');
            shellInput.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
            }));
        }, 100);
        return true;
    }

    function sendKeyEvent(keyCode) {
        return executeViaShellInput('input keyevent ' + keyCode);
    }

    // ========== 1. 替换 Navigation -> 语音发送 ==========

    function injectVoicePanel() {
        if (voiceInjected) return true;
        var navWidget = document.querySelector('.stf-navigation');
        if (!navWidget) return false;

        navWidget.innerHTML =
            '<div class="heading">' +
            '<i class="fa fa-microphone stacked-icon-icon color-blue"></i> ' +
            '<span>\u8BED\u97F3\u53D1\u9001</span>' +
            '</div>' +
            '<div class="widget-content padded">' +
            '<div class="input-group">' +
            '<input id="stf-voice-input" type="text" class="form-control" ' +
            'placeholder="\u8BF7\u8F93\u5165\u8981\u53D1\u9001\u7684\u8BED\u97F3\u6587\u672C..." ' +
            'style="background:#fff;color:#333;" />' +
            '<span class="input-group-btn">' +
            '<button id="stf-voice-send-btn" class="btn btn-primary-outline">\u53D1\u9001</button>' +
            '</span>' +
            '</div>' +
            '<div id="stf-voice-status" style="font-size:12px;margin-top:8px;min-height:18px;color:#999;"></div>' +
            '</div>';

        var input = document.getElementById('stf-voice-input');
        var btn = document.getElementById('stf-voice-send-btn');
        var status = document.getElementById('stf-voice-status');

        function sendVoice() {
            var text = input.value.trim();
            if (!text) { status.style.color = '#d9534f'; status.textContent = '\u8BF7\u8F93\u5165\u8BED\u97F3\u6587\u672C'; return; }
            status.style.color = '#999'; status.textContent = '\u6B63\u5728\u53D1\u9001...';
            var ok = executeViaShellInput(buildVoiceCommand(text));
            if (ok) { status.style.color = '#5cb85c'; status.textContent = '\u2705 \u547D\u4EE4\u5DF2\u53D1\u9001'; input.value = ''; }
            else { status.style.color = '#d9534f'; status.textContent = '\u274C \u8BF7\u5148\u6253\u5F00 Shell \u9762\u677F'; }
        }
        btn.addEventListener('click', sendVoice);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendVoice(); });

        voiceInjected = true;
        return true;
    }

    // ========== 2. 替换 Clipboard -> UI自动化链接 ==========

    /**
     * 从当前 STF URL 中提取设备的 ip:port
     * URL 格式：http://10.18.220.50:7100/#!/control/10.18.129.145:5176
     * 提取结果：10.18.129.145:5176
     */
    function extractDeviceSerialFromURL() {
        var hash = window.location.hash || '';
        var match = hash.match(/#!?\/control\/([^\/]+)/);
        if (match && match[1]) return match[1];
        return null;
    }

    function injectUIAPanel() {
        if (uiaInjected) return true;
        var clipWidget = document.querySelector('.stf-clipboard');
        if (!clipWidget) return false;

        var serial = extractDeviceSerialFromURL();
        var uiaUrl = serial ? UIAUTOMATION_URL_TEMPLATE.replace('{serial}', serial) : '';

        clipWidget.innerHTML =
            '<div class="heading">' +
            '<i class="fa fa-robot stacked-icon-icon color-purple"></i> ' +
            '<span>设备拓展功能</span>' +
            '</div>' +
            '<div class="widget-content padded">' +
            (uiaUrl ?
                '<a id="stf-uia-link" href="' + uiaUrl + '" target="_blank" ' +
                'class="btn btn-primary-outline" style="width:100%;text-decoration:none;display:block;">' +
                '<i class="fa fa-external-link"></i> 打开设备拓展功能页面</a>' :
                '<div id="stf-uia-status" style="font-size:12px;color:#d9534f;">' +
                '❌ 未检测到设备信息，请在控制页面使用</div>') +
            '<div id="stf-uia-info" style="font-size:11px;margin-top:6px;color:#999;">' +
            (serial ? '设备: ' + serial : '') +
            '</div>' +
            '</div>';

        uiaInjected = true;
        return true;
    }

    // ========== 3. 隐藏下方重复 tab + 4. 注入遥控器 tab ==========

    function processBottomTabs() {
        if (bottomTabsProcessed) return true;

        // STF 下方 tab 区域：pane-id="control-bottom-tabs"
        // 结构是 nice-tabs 指令，内部有 ul.nav-tabs > li 和 .tab-content > .tab-pane
        var bottomPane = document.querySelector('[pane-id="control-bottom-tabs"]');
        if (!bottomPane) return false;

        var tabLinks = bottomPane.querySelectorAll('ul.nav-tabs > li, ul.nav > li');
        if (tabLinks.length === 0) return false;

        // 需要隐藏的重复 tab 关键词（与上方 topTabs 中的 sharedTabs 重复）
        var hideTitles = ['screenshots', 'screenshot', 'automation', 'advanced', 'file explorer', 'info',
            '\u622A\u5C4F', '\u81EA\u52A8\u5316', '\u9AD8\u7EA7', '\u6587\u4EF6', '\u4FE1\u606F'];

        // 收集 tab-pane 容器
        var tabPanes = bottomPane.querySelectorAll('.tab-content > .tab-pane, .tab-content > div');

        var logsTabLi = null;
        var logsTabIndex = -1;

        for (var i = 0; i < tabLinks.length; i++) {
            var text = (tabLinks[i].textContent || '').trim().toLowerCase();
            var shouldHide = false;
            for (var h = 0; h < hideTitles.length; h++) {
                if (text.indexOf(hideTitles[h]) !== -1) {
                    shouldHide = true;
                    break;
                }
            }
            if (shouldHide) {
                tabLinks[i].style.display = 'none';
                // 同时隐藏对应的 tab-pane
                if (tabPanes[i]) tabPanes[i].style.display = 'none';
            }
            // 找到 Logs tab 的位置
            if (text.indexOf('logs') !== -1 || text.indexOf('\u65E5\u5FD7') !== -1) {
                logsTabLi = tabLinks[i];
                logsTabIndex = i;
            }
        }

        // 在 Logs tab 前面插入遥控器 tab
        if (logsTabLi) {
            injectRemoteTab(bottomPane, logsTabLi, logsTabIndex);
        }

        bottomTabsProcessed = true;
        return true;
    }

    /**
     * 注入遥控器 tab
     */
    function injectRemoteTab(bottomPane, logsTabLi, logsTabIndex) {
        var tabList = logsTabLi.parentElement;

        // 创建遥控器 tab 标签
        var remoteLi = document.createElement('li');
        remoteLi.setAttribute('role', 'presentation');
        remoteLi.innerHTML = '<a href="javascript:void(0)" role="tab" style="cursor:pointer;">' +
            '<i class="fa fa-gamepad color-purple"></i> \u9065\u63A7\u5668</a>';

        tabList.insertBefore(remoteLi, logsTabLi);

        // 创建遥控器 tab 内容面板
        var tabContent = bottomPane.querySelector('.tab-content');
        if (!tabContent) return;

        var remotePane = document.createElement('div');
        remotePane.className = 'tab-pane';
        remotePane.id = 'stf-remote-pane';
        remotePane.innerHTML = buildRemoteControlHTML();

        // 插入到 tab-content 中
        var logsPaneRef = tabContent.children[logsTabIndex];
        if (logsPaneRef) {
            tabContent.insertBefore(remotePane, logsPaneRef);
        } else {
            tabContent.appendChild(remotePane);
        }

        // 绑定 tab 切换逻辑
        remoteLi.querySelector('a').addEventListener('click', function () {
            // 取消所有 tab 的 active 状态
            var allLi = tabList.querySelectorAll('li');
            for (var i = 0; i < allLi.length; i++) {
                allLi[i].classList.remove('active');
            }
            var allPanes = tabContent.querySelectorAll('.tab-pane');
            for (var j = 0; j < allPanes.length; j++) {
                allPanes[j].classList.remove('active', 'in');
            }
            // 激活遥控器 tab
            remoteLi.classList.add('active');
            remotePane.classList.add('active', 'in');
        });

        // 绑定遥控器按键事件
        bindRemoteEvents();

        // 自动切换到遥控器 tab
        (function activateRemoteTab() {
            var allLi = tabList.querySelectorAll('li');
            for (var i = 0; i < allLi.length; i++) {
                allLi[i].classList.remove('active');
            }
            var allPanes = tabContent.querySelectorAll('.tab-pane');
            for (var j = 0; j < allPanes.length; j++) {
                allPanes[j].classList.remove('active', 'in');
            }
            remoteLi.classList.add('active');
            remotePane.classList.add('active', 'in');
        })();
    }

    /**
     * 构建遥控器界面 HTML
     * 仿照电视遥控器布局
     */
    function buildRemoteControlHTML() {
        var css =
            '<style>' +
            '#stf-remote { padding: 15px; background: #fff; user-select: none; }' +
            '#stf-remote .remote-body {' +
            '  max-width: 280px; margin: 0 auto; background: #f5f5f5;' +
            '  border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);' +
            '}' +
            '#stf-remote .remote-row {' +
            '  display: flex; justify-content: center; align-items: center;' +
            '  gap: 8px; margin-bottom: 10px;' +
            '}' +
            '#stf-remote .remote-btn {' +
            '  display: inline-flex; align-items: center; justify-content: center;' +
            '  border: 1px solid #ddd; background: #fff; color: #333;' +
            '  border-radius: 8px; cursor: pointer; font-size: 13px;' +
            '  transition: all 0.15s; min-width: 60px; height: 40px; padding: 0 10px;' +
            '}' +
            '#stf-remote .remote-btn:hover { background: #e8e8e8; }' +
            '#stf-remote .remote-btn:active { background: #d0d0d0; transform: scale(0.95); }' +
            '#stf-remote .remote-btn i { margin-right: 4px; }' +
            '#stf-remote .remote-btn.btn-ok {' +
            '  width: 70px; height: 70px; border-radius: 50%;' +
            '  background: #2196F3; color: #fff; font-size: 14px; font-weight: bold;' +
            '  border-color: #1976D2;' +
            '}' +
            '#stf-remote .remote-btn.btn-ok:hover { background: #1976D2; }' +
            '#stf-remote .remote-btn.btn-ok:active { background: #1565C0; }' +
            '#stf-remote .remote-btn.btn-dir {' +
            '  width: 60px; height: 50px; font-size: 18px;' +
            '}' +
            '#stf-remote .dpad {' +
            '  display: grid; grid-template-columns: 60px 70px 60px;' +
            '  grid-template-rows: 50px 70px 50px;' +
            '  gap: 4px; justify-content: center; align-items: center;' +
            '  margin: 15px auto;' +
            '}' +
            '#stf-remote .dpad > * { display: flex; align-items: center; justify-content: center; }' +
            '#stf-remote .remote-status {' +
            '  text-align: center; font-size: 11px; color: #999; min-height: 16px; margin-top: 8px;' +
            '}' +
            '</style>';

        var html = css +
            '<div id="stf-remote">' +
            '<div class="remote-body">' +
            // 第一行：音量+、设置、信号源、音量-
            '<div class="remote-row">' +
            '<button class="remote-btn" data-key="24"><i class="fa fa-volume-up"></i>+</button>' +
            '<button class="remote-btn" data-key="25"><i class="fa fa-volume-down"></i>-</button>' +
            '<button class="remote-btn" data-key="176"><i class="fa fa-cog"></i></button>' +
            '<button class="remote-btn" data-key="178"><i class="fa fa-desktop"></i></button>' +
            '</div>' +
            // 方向键 + 确认键（十字布局）
            '<div class="dpad">' +
            '<div></div>' +
            '<button class="remote-btn btn-dir" data-key="19"><i class="fa fa-chevron-up"></i></button>' +
            '<div></div>' +
            '<button class="remote-btn btn-dir" data-key="21"><i class="fa fa-chevron-left"></i></button>' +
            '<button class="remote-btn btn-ok" data-key="23">\u786E\u8BA4</button>' +
            '<button class="remote-btn btn-dir" data-key="22"><i class="fa fa-chevron-right"></i></button>' +
            '<div></div>' +
            '<button class="remote-btn btn-dir" data-key="20"><i class="fa fa-chevron-down"></i></button>' +
            '<div></div>' +
            '</div>' +
            // 底部：主页、菜单
            '<div class="remote-row">' +
            '<button class="remote-btn" data-key="142"><i class="fa fa-home"></i>\u4E3B\u9875</button>' +
            '<button class="remote-btn" data-key="4"><i class="fa fa-reply"></i>\u8FD4\u56DE</button>' +
            '<button class="remote-btn" data-key="82"><i class="fa fa-bars"></i>\u83DC\u5355</button>' +
            '</div>' +
            '<div class="remote-status" id="stf-remote-status"></div>' +
            '</div>' +
            '</div>';

        return html;
    }

    /**
     * 绑定遥控器按键点击事件
     */
    function bindRemoteEvents() {
        var buttons = document.querySelectorAll('#stf-remote .remote-btn');
        var status = document.getElementById('stf-remote-status');

        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', function () {
                var keyCode = this.getAttribute('data-key');
                var label = this.textContent.trim();
                if (!keyCode) return;

                var ok = sendKeyEvent(keyCode);
                if (status) {
                    if (ok) {
                        status.style.color = '#5cb85c';
                        status.textContent = '\u2705 ' + label + ' (keyevent ' + keyCode + ')';
                    } else {
                        status.style.color = '#d9534f';
                        status.textContent = '\u274C \u8BF7\u5148\u6253\u5F00 Shell \u9762\u677F';
                    }
                }
            });
        }
    }

    // ========== 5. 设备列表备注显示功能 ==========

    /** STF 接口地址 */
    var DEVICE_API_BASE = '/api/v1/devices';
    var deviceNotesLoaded = false;
    /** serial -> notes 的缓存 */
    var deviceNotesCache = {};

    /**
     * 从 li 的 id 中提取 serial
     * 格式：d825549-10.18.89.232:5555 -> 10.18.89.232:5555
     */
    function extractSerial(liId) {
        if (!liId) return null;
        var idx = liId.indexOf('-');
        return idx !== -1 ? liId.substring(idx + 1) : liId;
    }

    /** 从接口获取设备信息，提取 notes 字段 */
    function loadDeviceNotes() {
        if (deviceNotesLoaded) return;
        deviceNotesLoaded = true;

        var xhr = new XMLHttpRequest();
        xhr.open('GET', DEVICE_API_BASE, true);
        xhr.timeout = 5000;
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if (data && Array.isArray(data.devices)) {
                            for (var i = 0; i < data.devices.length; i++) {
                                var dev = data.devices[i];
                                if (dev.serial && dev.notes) {
                                    deviceNotesCache[dev.serial] = dev.notes;
                                }
                            }
                        }
                        console.log('[STF-Custom] 设备备注加载成功', deviceNotesCache);
                    } catch (e) {
                        console.warn('[STF-Custom] 解析设备备注失败', e);
                    }
                } else {
                    console.warn('[STF-Custom] 获取设备备注失败:', xhr.status);
                }
                applyDeviceNotes();
            }
        };
        xhr.onerror = function () {
            console.warn('[STF-Custom] 设备备注接口请求失败');
            applyDeviceNotes();
        };
        xhr.send();
    }

    /** 将设备备注应用到列表 */
    function applyDeviceNotes() {
        var items = document.querySelectorAll('.devices-icon-view > li');
        for (var i = 0; i < items.length; i++) {
            var li = items[i];
            var serial = extractSerial(li.id);
            if (!serial) continue;

            var nameEl = li.querySelector('.device-name');
            if (!nameEl) continue;
            // 已处理过则跳过
            if (nameEl.classList.contains('stf-name-processed')) continue;

            var notes = deviceNotesCache[serial];
            if (!notes) continue;

            // 显示 notes 内容
            var nameSpan = document.createElement('span');
            nameSpan.className = 'device-name-text';
            nameSpan.textContent = notes;
            nameSpan.title = 'serial: ' + serial;

            nameEl.textContent = '';
            nameEl.appendChild(nameSpan);
            nameEl.classList.add('stf-name-processed');
        }
    }

    /** 处理设备列表入口 */
    function processDeviceList() {
        var items = document.querySelectorAll('.devices-icon-view > li');
        if (items.length === 0) return;
        if (!deviceNotesLoaded) {
            loadDeviceNotes();
        } else {
            applyDeviceNotes();
        }
    }

    // ========== 6. 设备列表细节tab"占用"功能 ==========

    /** 注入占用按钮样式 */
    function injectOccupyStyle() {
        if (document.getElementById('stf-occupy-style')) return;
        var style = document.createElement('style');
        style.id = 'stf-occupy-style';
        style.textContent =
            '.stf-occupy-btn {' +
            '  margin-left: 4px; cursor: pointer;' +
            '}' +
            '.stf-occupy-overlay {' +
            '  position: fixed; top: 0; left: 0; right: 0; bottom: 0;' +
            '  background: rgba(0,0,0,0.4); z-index: 10000;' +
            '  display: flex; align-items: center; justify-content: center;' +
            '}' +
            '.stf-occupy-dialog {' +
            '  background: #fff; border-radius: 8px; padding: 24px;' +
            '  min-width: 320px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);' +
            '}' +
            '.stf-occupy-dialog h4 { margin: 0 0 16px; font-size: 16px; color: #333; }' +
            '.stf-occupy-dialog label { font-size: 13px; color: #666; display: block; margin-bottom: 6px; }' +
            '.stf-occupy-dialog input[type="number"] {' +
            '  width: 100%; padding: 8px; font-size: 14px; border: 1px solid #ccc;' +
            '  border-radius: 4px; box-sizing: border-box; outline: none;' +
            '}' +
            '.stf-occupy-dialog input[type="number"]:focus { border-color: #2196F3; }' +
            '.stf-occupy-dialog .btn-row {' +
            '  display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;' +
            '}' +
            '.stf-occupy-dialog .btn-row button {' +
            '  padding: 6px 18px; border-radius: 4px; cursor: pointer;' +
            '  font-size: 13px; border: 1px solid #ccc; background: #fff; color: #333;' +
            '}' +
            '.stf-occupy-dialog .btn-row .btn-confirm {' +
            '  background: #2196F3; color: #fff; border-color: #1976D2;' +
            '}' +
            '.stf-occupy-dialog .btn-row .btn-confirm:hover { background: #1976D2; }';
        document.head.appendChild(style);
    }

    /** 显示占用弹窗 */
    function showOccupyDialog(serial) {
        var overlay = document.createElement('div');
        overlay.className = 'stf-occupy-overlay';
        overlay.innerHTML =
            '<div class="stf-occupy-dialog">' +
            '<h4>\u8BBE\u5907\u5360\u7528</h4>' +
            '<label>\u5360\u7528\u65F6\u957F\uFF08\u5C0F\u65F6\uFF09</label>' +
            '<input type="number" min="1" value="24" />' +
            '<div class="btn-row">' +
            '<button class="btn-cancel">\u53D6\u6D88</button>' +
            '<button class="btn-confirm">\u786E\u8BA4</button>' +
            '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var hoursInput = overlay.querySelector('input[type="number"]');
        hoursInput.focus();
        hoursInput.select();

        function closeDialog() {
            if (overlay.parentElement) document.body.removeChild(overlay);
        }

        overlay.querySelector('.btn-cancel').addEventListener('click', closeDialog);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeDialog();
        });

        overlay.querySelector('.btn-confirm').addEventListener('click', function () {
            var hours = parseFloat(hoursInput.value);
            if (isNaN(hours) || hours <= 0) {
                hoursInput.style.borderColor = '#d9534f';
                return;
            }
            var timeoutMs = Math.round(hours * 3600 * 1000);

            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/v1/user/devices', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        console.log('[STF-Custom] \u5360\u7528\u6210\u529F:', serial, hours + 'h');
                    } else {
                        console.warn('[STF-Custom] \u5360\u7528\u5931\u8D25:', xhr.status, xhr.responseText);
                        alert('\u5360\u7528\u5931\u8D25\uFF08' + xhr.status + '\uFF09\uFF0C\u8BF7\u91CD\u8BD5');
                    }
                    closeDialog();
                }
            };
            xhr.onerror = function () {
                alert('\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC');
                closeDialog();
            };
            xhr.send(JSON.stringify({ serial: serial, timeout: timeoutMs }));
        });

        hoursInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') overlay.querySelector('.btn-confirm').click();
            if (e.key === 'Escape') closeDialog();
        });
    }

    /**
     * 判断设备状态是否应该隐藏占用按钮
     * 断开连接、停止使用等状态不展示
     */
    function isDisabledStatus(statusText) {
        if (!statusText) return true;
        var lower = statusText.toLowerCase();
        // 中文状态
        if (lower.indexOf('\u65AD\u5F00') !== -1) return true;       // 断开
        if (lower.indexOf('\u505C\u6B62\u4F7F\u7528') !== -1) return true; // 停止使用
        // 英文状态
        if (lower.indexOf('disconnect') !== -1) return true;
        if (lower.indexOf('offline') !== -1) return true;
        if (lower.indexOf('absent') !== -1) return true;
        if (lower.indexOf('stop') !== -1) return true;
        return false;
    }

    /**
     * 在设备列表细节tab中，遍历每行，在"使用"按钮后注入"占用"按钮
     * STF 细节视图是表格，每行对应一个设备
     */
    function processOccupyButtons() {
        // 细节视图的表格行
        var rows = document.querySelectorAll('device-list-details tr, devices-list-view tr, table.devices tr');
        if (rows.length === 0) return;

        injectOccupyStyle();

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            // 已处理过则跳过
            if (row.classList.contains('stf-occupy-processed')) continue;
            row.classList.add('stf-occupy-processed');

            // 查找"使用"按钮（STF 中通常是 ng-click="use(device)" 或包含"使用"/"Use"文本的按钮/链接）
            var useBtn = row.querySelector('[ng-click*="use("]') ||
                row.querySelector('[ng-click*="controlUse"]');
            if (!useBtn) {
                // 尝试通过按钮文本查找
                var btns = row.querySelectorAll('button, a.btn');
                for (var b = 0; b < btns.length; b++) {
                    var btnText = (btns[b].textContent || '').trim().toLowerCase();
                    if (btnText === 'use' || btnText === '\u4F7F\u7528') {
                        useBtn = btns[b];
                        break;
                    }
                }
            }
            if (!useBtn) continue;

            // 从行的 id 属性提取 serial，格式：d422572-10.18.89.232:5555
            var serial = extractSerial(row.id);
            if (!serial) continue;

            // 从状态列文本判断是否需要隐藏
            var statusText = '';
            var statusCell = row.querySelector('a.device-status, .device-status, [ng-bind*="status"], [ng-bind*="state"]');
            if (statusCell) statusText = statusCell.textContent || '';

            if (isDisabledStatus(statusText)) continue;

            // 创建占用按钮
            var occupyBtn = document.createElement('button');
            occupyBtn.className = useBtn.className + ' stf-occupy-btn';
            occupyBtn.innerHTML = '<i class="fa fa-lock"></i> \u5360\u7528';
            occupyBtn.setAttribute('data-serial', serial);
            occupyBtn.addEventListener('click', (function (s) {
                return function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    showOccupyDialog(s);
                };
            })(serial));

            useBtn.parentNode.insertBefore(occupyBtn, useBtn.nextSibling);
        }
    }

    // ========== 7. 设备列表细节tab"删除设备"功能 ==========

    /** 删除设备接口基础地址 */
    var DELETE_DEVICE_API = '/api/v1/devices/';

    /**
     * 判断是否为"断开连接"状态
     */
    function isDisconnectedStatus(statusText) {
        if (!statusText) return false;
        var lower = statusText.toLowerCase();
        if (lower.indexOf('\u65AD\u5F00') !== -1) return true;         // 断开
        if (lower.indexOf('disconnect') !== -1) return true;
        if (lower.indexOf('offline') !== -1) return true;
        if (lower.indexOf('absent') !== -1) return true;
        return false;
    }

    /**
     * 遍历细节tab表格行，在"断开连接"状态的行中添加"删除"按钮
     */
    function processDeleteButtons() {
        var rows = document.querySelectorAll('device-list-details tr, devices-list-view tr, table.devices tr');
        if (rows.length === 0) return;

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            // 已处理过则跳过
            if (row.classList.contains('stf-delete-processed')) continue;
            row.classList.add('stf-delete-processed');

            // 从行的 id 属性提取 serial
            var serial = extractSerial(row.id);
            if (!serial) continue;

            // 获取状态列文本
            var statusText = '';
            var statusCell = row.querySelector('a.device-status, .device-status, [ng-bind*="status"], [ng-bind*="state"]');
            if (statusCell) statusText = statusCell.textContent || '';

            // 仅在断开连接状态时添加删除按钮
            if (!isDisconnectedStatus(statusText)) continue;

            // 断开连接状态下没有"使用"按钮，直接在状态元素后面插入删除按钮
            var anchor = statusCell;
            if (!anchor) continue;

            var deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-xs btn-danger-outline stf-delete-btn';
            deleteBtn.style.marginLeft = '4px';
            deleteBtn.innerHTML = '<i class="fa fa-trash"></i> \u5220\u9664';
            deleteBtn.setAttribute('data-serial', serial);
            deleteBtn.addEventListener('click', (function (s) {
                return function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!confirm('\u786E\u8BA4\u8981\u5220\u9664\u8BBE\u5907 ' + s + ' \u5417\uFF1F')) return;

                    fetch(DELETE_DEVICE_API + encodeURIComponent(s), {
                        headers: {
                            'accept': '*/*',
                            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6'
                        },
                        body: null,
                        method: 'DELETE',
                        mode: 'cors',
                        credentials: 'include'
                    }).then(function (resp) {
                        if (resp.ok) {
                            console.log('[STF-Custom] \u5220\u9664\u8BBE\u5907\u6210\u529F:', s);
                            alert('\u8BBE\u5907 ' + s + ' \u5220\u9664\u6210\u529F');
                            // 移除该行
                            var tr = e.target.closest('tr');
                            if (tr) tr.remove();
                        } else {
                            console.warn('[STF-Custom] \u5220\u9664\u8BBE\u5907\u5931\u8D25:', resp.status);
                            alert('\u5220\u9664\u5931\u8D25\uFF08' + resp.status + '\uFF09\uFF0C\u8BF7\u91CD\u8BD5');
                        }
                    }).catch(function (err) {
                        console.error('[STF-Custom] \u5220\u9664\u8BBE\u5907\u8BF7\u6C42\u5F02\u5E38:', err);
                        alert('\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC');
                    });
                };
            })(serial));

            anchor.parentNode.insertBefore(deleteBtn, anchor.nextSibling);
        }
    }

    // ========== 主逻辑 ==========

    function checkAndResetState() {
        if (voiceInjected && !document.getElementById('stf-voice-input')) {
            voiceInjected = false;
        }
        if (uiaInjected && !document.getElementById('stf-uia-link') && !document.getElementById('stf-uia-status')) {
            uiaInjected = false;
        }
        if (bottomTabsProcessed && !document.getElementById('stf-remote-pane')) {
            bottomTabsProcessed = false;
        }
        // 路由切换回设备列表时，需要重新处理
        if (!document.querySelector('.devices-icon-view > li .stf-name-processed')) {
            deviceNotesLoaded = false;
        }
    }

    function tryInject() {
        checkAndResetState();
        processDeviceList();
        processOccupyButtons();
        processDeleteButtons();
        var v = injectVoicePanel();
        var u = injectUIAPanel();
        var b = processBottomTabs();
        return v && u && b;
    }

    function init() {
        console.log('[STF-Custom] \u81EA\u5B9A\u4E49\u5DE5\u5177\u6A21\u5757\u521D\u59CB\u5316...');

        // 持续监听 DOM 变化，不断尝试注入
        // STF 是单页应用，路由切换时 DOM 会被销毁重建
        var observer = new MutationObserver(function () {
            tryInject();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // 定时检查作为备用（处理 MutationObserver 可能遗漏的情况）
        setInterval(function () {
            tryInject();
        }, CHECK_INTERVAL);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
