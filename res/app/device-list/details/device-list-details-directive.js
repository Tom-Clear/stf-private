var patchArray = require('./../util/patch-array')

module.exports = function DeviceListDetailsDirective(
  $filter
, $compile
, $rootScope
, gettext
, DeviceColumnService
, GroupService
, DeviceService
, LightboxImageService
, StandaloneService
, LogcatService
) {
  return {
    restrict: 'E'
  , template: require('./device-list-details.pug')
  , scope: {
      tracker: '&tracker'
    , columns: '&columns'
    , sort: '=sort'
    , filter: '&filter'
    }
  , link: function(scope, element) {
      var tracker = scope.tracker()
      var activeColumns = []
      var activeSorting = []
      var activeFilters = []
      var table = element.find('table')[0]
      var tbody = table.createTBody()
      var rows = tbody.rows
      var prefix = 'd' + Math.floor(Math.random() * 1000000) + '-'
      var mapping = Object.create(null)
      var childScopes = Object.create(null)


      function kickDevice(device, force) {
        LogcatService.allowClean = true
        if (Object.keys(LogcatService.deviceEntries).includes(device.serial)) {
          LogcatService.deviceEntries[device.serial].allowClean = true
        }
        $rootScope.LogcatService = LogcatService
        return GroupService.kick(device, force).catch(function(e) {
          alert($filter('translate')(gettext('Device cannot get kicked from the group')))
          throw new Error(e)
        })
      }

      function inviteDevice(device) {
        $rootScope.usedDevices.push(device.serial)
        return GroupService.invite(device).then(function() {
          scope.$digest()
        })
      }

      function checkDeviceStatus(e) {
        if (e.target.classList.contains('device-status')) {
          var id = e.target.parentNode.parentNode.id
          var device = mapping[id]

          if (e.altKey && device.state === 'available') {
            inviteDevice(device)
            e.preventDefault()
          }

          if (e.shiftKey && device.state === 'available') {
            StandaloneService.open(device)
            e.preventDefault()
          }

          if ($rootScope.adminMode && device.state === 'busy') {
            kickDevice(device, true)
            e.preventDefault()
          }
          else if (device.using) {
            kickDevice(device)
            e.preventDefault()
          }
        }
      }

      function checkDeviceSmallImage(e) {
        if (e.target.classList.contains('device-small-image-img')) {
          var id = e.target.parentNode.parentNode.parentNode.id
          var device = mapping[id]

          if (device.name && device.image) {
            var title = device.name
            var enhancedPhoto800 = '/static/app/devices/photo/x800/' + device.image
            LightboxImageService.open(title, enhancedPhoto800)
          }
        }
      }

      // On clicking device-note-edit icon
      // This function will create a new angular-xeditable span
      // inside xeditableWrapper and compile it with
      // new child scope.
      // Childscope will be destroyed when the editing will be over
      function checkDeviceNote(e) {
        if (e.target.classList.contains('device-note-edit')) {

          var i = e.target
          var id = i.parentNode.parentNode.id
          var device = mapping[id]
          var xeditableWrapper = i.parentNode.firstChild
          var xeditableSpan = document.createElement('span')
          var childScope = scope.$new()

          // Ref: http://vitalets.github.io/angular-xeditable/#text-btn
          xeditableSpan.setAttribute('editable-text', 'device.notes')
          xeditableSpan.setAttribute('onbeforesave', 'updateNote(id, device.serial, $data)')
          xeditableSpan.setAttribute('onCancel', 'onDeviceNoteCancel(id)')

          childScope.id = id
          childScope.device = device
          childScopes[id] = childScope

          $compile(xeditableSpan)(childScope)
          xeditableWrapper.appendChild(xeditableSpan)

          // Trigger click to open the form.
          angular.element(xeditableSpan).triggerHandler('click')
        }
      }

      function isDisabledStatus(statusText) {
        if (!statusText) return true
        var lower = statusText.toLowerCase()
        if (lower.indexOf('断开') !== -1) return true
        if (lower.indexOf('停止使用') !== -1) return true
        if (lower.indexOf('disconnect') !== -1) return true
        if (lower.indexOf('offline') !== -1) return true
        if (lower.indexOf('absent') !== -1) return true
        if (lower.indexOf('stop') !== -1) return true
        return false
      }

      function processOccupyButtonForRow(tr, device) {
        var useBtn = tr.querySelector('a.device-status')
        if (!useBtn) return

        var occupyBtn = tr.querySelector('.stf-occupy-btn')
        if (occupyBtn) {
          occupyBtn.parentNode.removeChild(occupyBtn)
        }

        var statusText = useBtn.textContent || ''
        if (isDisabledStatus(statusText)) return

        occupyBtn = document.createElement('button')
        occupyBtn.className = 'btn btn-xs btn-primary-outline stf-occupy-btn'
        occupyBtn.style.marginLeft = '4px'
        occupyBtn.innerHTML = '<i class="fa fa-lock"></i> ' + gettext('占用')
        occupyBtn.setAttribute('data-serial', device.serial)

        useBtn.parentNode.insertBefore(occupyBtn, useBtn.nextSibling)
      }

      function isDisconnectedStatus(statusText) {
        if (!statusText) return false
        var lower = statusText.toLowerCase()
        if (lower.indexOf('断开') !== -1) return true
        if (lower.indexOf('disconnect') !== -1) return true
        if (lower.indexOf('offline') !== -1) return true
        if (lower.indexOf('absent') !== -1) return true
        return false
      }

      function processDeleteButtonForRow(tr, device) {
        var statusCell = tr.querySelector('a.device-status')
        if (!statusCell) return

        var deleteBtn = tr.querySelector('.stf-delete-btn')
        if (deleteBtn) {
          deleteBtn.parentNode.removeChild(deleteBtn)
        }

        var statusText = statusCell.textContent || ''
        if (!isDisconnectedStatus(statusText)) return

        deleteBtn = document.createElement('button')
        deleteBtn.className = 'btn btn-xs btn-danger-outline stf-delete-btn'
        deleteBtn.style.marginLeft = '4px'
        deleteBtn.innerHTML = '<i class="fa fa-trash"></i> ' + gettext('删除')
        deleteBtn.setAttribute('data-serial', device.serial)

        statusCell.parentNode.insertBefore(deleteBtn, statusCell.nextSibling)
      }

      function showOccupyDialog(serial) {
        if (document.getElementById('stf-occupy-overlay')) return

        var overlay = document.createElement('div')
        overlay.id = 'stf-occupy-overlay'
        overlay.className = 'stf-occupy-overlay'
        overlay.innerHTML = '<div class="stf-occupy-dialog">' +
          '<h4>' + gettext('设备占用') + '</h4>' +
          '<label>' + gettext('占用时长（小时）') + '</label>' +
          '<input type="number" min="1" value="24" />' +
          '<div class="btn-row">' +
          '<button class="btn-cancel">' + gettext('取消') + '</button>' +
          '<button class="btn-confirm">' + gettext('确认') + '</button>' +
          '</div>' +
          '</div>'

        document.body.appendChild(overlay)

        var hoursInput = overlay.querySelector('input[type="number"]')
        hoursInput.focus()
        hoursInput.select()

        function closeDialog() {
          if (overlay.parentElement) document.body.removeChild(overlay)
        }

        overlay.querySelector('.btn-cancel').addEventListener('click', closeDialog)
        overlay.addEventListener('click', function(e) {
          if (e.target === overlay) closeDialog()
        })

        overlay.querySelector('.btn-confirm').addEventListener('click', function() {
          var hours = parseFloat(hoursInput.value)
          if (isNaN(hours) || hours <= 0) {
            hoursInput.style.borderColor = '#d9534f'
            return
          }
          var timeoutMs = Math.round(hours * 3600 * 1000)

          DeviceService.occupy(serial, timeoutMs)
            .then(function() {
              alert(gettext('设备占用成功'))
              closeDialog()
            })
            .catch(function(err) {
              alert(gettext('占用失败') + ' (' + (err.status || '') + ')')
            })
        })

        hoursInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') overlay.querySelector('.btn-confirm').click()
          if (e.key === 'Escape') closeDialog()
        })
      }

      function checkDeviceActions(e) {
        var target = e.target
        var occupyBtn = target.classList.contains('stf-occupy-btn') ? target :
          (target.parentNode && target.parentNode.classList.contains('stf-occupy-btn') ? target.parentNode : null)

        if (occupyBtn) {
          var id = occupyBtn.parentNode.parentNode.id
          var device = mapping[id]
          if (device) {
            showOccupyDialog(device.serial)
          }
          e.preventDefault()
          e.stopPropagation()
          return
        }

        var deleteBtn = target.classList.contains('stf-delete-btn') ? target :
          (target.parentNode && target.parentNode.classList.contains('stf-delete-btn') ? target.parentNode : null)

        if (deleteBtn) {
          var id = deleteBtn.parentNode.parentNode.id
          var device = mapping[id]
          if (device) {
            if (confirm(gettext('确认要删除设备 ') + device.serial + ' 吗？')) {
              DeviceService.removeDevice(device.serial)
                .then(function() {
                  alert(gettext('设备 ') + device.serial + ' 删除成功')
                  var tr = tbody.children[id]
                  if (tr) {
                    tbody.removeChild(tr)
                  }
                  delete mapping[id]
                })
                .catch(function(err) {
                  alert(gettext('删除失败') + ' (' + (err.status || '') + ')')
                })
            }
          }
          e.preventDefault()
          e.stopPropagation()
        }
      }

      function destroyXeditableNote(id) {
        var tr = tbody.children[id]
        for (var i = 0; i < tr.cells.length; i++) {
          var col = tr.cells[i]

          if (col.firstChild &&
              col.firstChild.nodeName.toLowerCase() === 'span' &&
              col.firstChild.classList.contains('xeditable-wrapper')) {

            var xeditableWrapper = col.firstChild
            var children = xeditableWrapper.children

            // Remove all childs under xeditablerWrapper
            for (var j = 0; j < children.length; j++) {
              xeditableWrapper.removeChild(children[j])
            }
          }
        }
        childScopes[id].$destroy()
      }

      scope.updateNote = function(id, serial, note) {
        DeviceService.updateNote(serial, note)
        destroyXeditableNote(id)
      }

      scope.onDeviceNoteCancel = function(id) {
        destroyXeditableNote(id)
      }

      element.on('click', function(e) {
        checkDeviceStatus(e)
        checkDeviceSmallImage(e)
        checkDeviceNote(e)
        checkDeviceActions(e)
      })

      // Import column definitions
      scope.columnDefinitions = DeviceColumnService

      // Sorting
      scope.sortBy = function(column, multiple) {
        function findInSorting(sorting) {
          for (var i = 0, l = sorting.length; i < l; ++i) {
            if (sorting[i].name === column.name) {
              return sorting[i]
            }
          }
          return null
        }

        var swap = {
          asc: 'desc'
        , desc: 'asc'
        }

        var fixedMatch = findInSorting(scope.sort.fixed)
        if (fixedMatch) {
          fixedMatch.order = swap[fixedMatch.order]
          return
        }

        var userMatch = findInSorting(scope.sort.user)
        if (userMatch) {
          userMatch.order = swap[userMatch.order]
          if (!multiple) {
            scope.sort.user = [userMatch]
          }
        }
        else {
          if (!multiple) {
            scope.sort.user = []
          }
          scope.sort.user.push({
            name: column.name
          , order: scope.columnDefinitions[column.name].defaultOrder || 'asc'
          })
        }
      }

      // Watch for sorting changes
      scope.$watch(
        function() {
          return scope.sort
        }
      , function(newValue) {
          activeSorting = newValue.fixed.concat(newValue.user)
          scope.sortedColumns = Object.create(null)
          activeSorting.forEach(function(sort) {
            scope.sortedColumns[sort.name] = sort
          })
          sortAll()
        }
      , true
      )

      // Watch for column updates
      scope.$watch(
        function() {
          return scope.columns()
        }
      , function(newValue) {
          updateColumns(newValue)
        }
      , true
      )

      // Update now so that we don't have to wait for the scope watcher to
      // trigger.
      updateColumns(scope.columns())

      // Updates visible columns. This method doesn't necessarily have to be
      // the fastest because it shouldn't get called all the time.
      function updateColumns(columnSettings) {
        var newActiveColumns = []

        // Check what we're supposed to show now
        columnSettings.forEach(function(column) {
          if (column.selected) {
            newActiveColumns.push(column.name)
          }
        })

        // Figure out the patch
        var patch = patchArray(activeColumns, newActiveColumns)

        // Set up new active columns
        activeColumns = newActiveColumns

        return patchAll(patch)
      }

      // Updates filters on visible items.
      function updateFilters(filters) {
        activeFilters = filters
        return filterAll()
      }

      // Applies filterRow() to all rows.
      function filterAll() {
        for (var i = 0, l = rows.length; i < l; ++i) {
          filterRow(rows[i], mapping[rows[i].id])
        }
      }

      // Filters a row, perhaps removing it from view.
      function filterRow(row, device) {
        if (match(device)) {
          row.classList.remove('filter-out')
        }
        else {
          row.classList.add('filter-out')
        }
      }

      // Checks whether the device matches the currently active filters.
      function match(device) {
        for (var i = 0, l = activeFilters.length; i < l; ++i) {
          var filter = activeFilters[i]
          var column
          if (filter.field) {
            column = scope.columnDefinitions[filter.field]
            if (column && !column.filter(device, filter)) {
              return false
            }
          }
          else {
            var found = false
            for (var j = 0, k = activeColumns.length; j < k; ++j) {
              column = scope.columnDefinitions[activeColumns[j]]
              if (column && column.filter(device, filter)) {
                found = true
                break
              }
            }
            if (!found) {
              return false
            }
          }
        }
        return true
      }

      // Update now so we're up to date.
      updateFilters(scope.filter())

      // Watch for filter updates.
      scope.$watch(
        function() {
          return scope.filter()
        }
      , function(newValue) {
          updateFilters(newValue)
        }
      , true
      )

      // Calculates a DOM ID for the device. Should be consistent for the
      // same device within the same table, but unique among other tables.
      function calculateId(device) {
        return prefix + device.serial
      }

      // Compares two devices using the currently active sorting. Returns <0
      // if deviceA is smaller, >0 if deviceA is bigger, or 0 if equal.
      var compare = (function() {
        var mapping = {
          asc: 1
        , desc: -1
        }
        return function(deviceA, deviceB) {
          var diff

          // Find the first difference
          for (var i = 0, l = activeSorting.length; i < l; ++i) {
            var sort = activeSorting[i]
            diff = scope.columnDefinitions[sort.name].compare(deviceA, deviceB)
            if (diff !== 0) {
              diff *= mapping[sort.order]
              break
            }
          }

          return diff
        }
      })()

      // Creates a completely new row for the device. Means that this is
      // the first time we see the device.
      function createRow(device) {
        var id = calculateId(device)
        var tr = document.createElement('tr')
        var td

        tr.id = id

        if (!device.usable) {
          tr.classList.add('device-not-usable')
        }

        for (var i = 0, l = activeColumns.length; i < l; ++i) {
          td = scope.columnDefinitions[activeColumns[i]].build()
          scope.columnDefinitions[activeColumns[i]].update(td, device)
          tr.appendChild(td)
        }

        processOccupyButtonForRow(tr, device)
        processDeleteButtonForRow(tr, device)

        mapping[id] = device

        return tr
      }

      // Patches all rows.
      function patchAll(patch) {
        for (var i = 0, l = rows.length; i < l; ++i) {
          patchRow(rows[i], mapping[rows[i].id], patch)
        }
      }

      // Patches the given row by running the given patch operations in
      // order. The operations must take into account index changes caused
      // by previous operations.
      function patchRow(tr, device, patch) {
        for (var i = 0, l = patch.length; i < l; ++i) {
          var op = patch[i]
          switch (op[0]) {
          case 'insert':
            var col = scope.columnDefinitions[op[2]]
            tr.insertBefore(col.update(col.build(), device), tr.cells[op[1]])
            break
          case 'remove':
            tr.deleteCell(op[1])
            break
          case 'swap':
            tr.insertBefore(tr.cells[op[1]], tr.cells[op[2]])
            tr.insertBefore(tr.cells[op[2]], tr.cells[op[1]])
            break
          }
        }

        return tr
      }

      // Updates all the columns in the row. Note that the row must be in
      // the right format already (built with createRow() and patched with
      // patchRow() if necessary).
      function updateRow(tr, device) {
        var id = calculateId(device)

        tr.id = id

        if (!device.usable) {
          tr.classList.add('device-not-usable')
        }
        else {
          tr.classList.remove('device-not-usable')
        }

        for (var i = 0, l = activeColumns.length; i < l; ++i) {
          scope.columnDefinitions[activeColumns[i]].update(tr.cells[i], device)
        }

        processOccupyButtonForRow(tr, device)
        processDeleteButtonForRow(tr, device)

        return tr
      }

      // Inserts a row into the table into its correct position according to
      // current sorting.
      function insertRow(tr, deviceA) {
        return insertRowToSegment(tr, deviceA, 0, rows.length - 1)
      }

      // Inserts a row into a segment of the table into its correct position
      // according to current sorting. The value of `hi` is the index
      // of the last item in the segment, or -1 if none. The value of `lo`
      // is the index of the first item in the segment, or 0 if none.
      function insertRowToSegment(tr, deviceA, low, high) {
        var total = rows.length
        var lo = low
        var hi = high

        if (lo > hi) {
          // This means that `lo` refers to the first item of the next
          // segment (which may or may not exist), and we should put the
          // row before it.
          tbody.insertBefore(tr, lo < total ? rows[lo] : null)
        }
        else {
          var after = true
          var pivot = 0
          var deviceB

          while (lo <= hi) {
            pivot = ~~((lo + hi) / 2)
            deviceB = mapping[rows[pivot].id]

            var diff = compare(deviceA, deviceB)

            if (diff === 0) {
              after = true
              break
            }

            if (diff < 0) {
              hi = pivot - 1
              after = false
            }
            else {
              lo = pivot + 1
              after = true
            }
          }

          if (after) {
            tbody.insertBefore(tr, rows[pivot].nextSibling)
          }
          else {
            tbody.insertBefore(tr, rows[pivot])
          }
        }
      }

      // Compares a row to its siblings to see if it's still in the correct
      // position. Returns <0 if the device should actually go somewhere
      // before the previous row, >0 if it should go somewhere after the next
      // row, or 0 if the position is already correct.
      function compareRow(tr, device) {
        var prev = tr.previousSibling
        var next = tr.nextSibling
        var diff

        if (prev) {
          diff = compare(device, mapping[prev.id])
          if (diff < 0) {
            return diff
          }
        }

        if (next) {
          diff = compare(device, mapping[next.id])
          if (diff > 0) {
            return diff
          }
        }

        return 0
      }

      // Sort all rows.
      function sortAll() {
        // This could be improved by getting rid of the array copying. The
        // copy is made because rows can't be sorted directly.
        var sorted = [].slice.call(rows).sort(function(rowA, rowB) {
          return compare(mapping[rowA.id], mapping[rowB.id])
        })

        // Now, if we just append all the elements, they will be in the
        // correct order in the table.
        for (var i = 0, l = sorted.length; i < l; ++i) {
          tbody.appendChild(sorted[i])
        }
      }

      // Triggers when the tracker sees a device for the first time.
      function addListener(device) {
        var row = createRow(device)
        filterRow(row, device)
        insertRow(row, device)
      }

      // Triggers when the tracker notices that a device changed.
      function changeListener(device) {
        var id = calculateId(device)
        var tr = tbody.children[id]

        if (tr) {
          // First, update columns
          updateRow(tr, device)

          // Maybe the row is not sorted correctly anymore?
          var diff = compareRow(tr, device)

          if (diff < 0) {
            // Should go higher in the list
            insertRowToSegment(tr, device, 0, tr.rowIndex - 1)
          }
          else if (diff > 0) {
            // Should go lower in the list
            insertRowToSegment(tr, device, tr.rowIndex + 1, rows.length - 1)
          }
        }
      }

      // Triggers when a device is removed entirely from the tracker.
      function removeListener(device) {
        var id = calculateId(device)
        var tr = tbody.children[id]

        if (tr) {
          tbody.removeChild(tr)
        }

        delete mapping[id]
      }

      tracker.on('add', addListener)
      tracker.on('change', changeListener)
      tracker.on('remove', removeListener)

      // Maybe we're already late
      tracker.devices.forEach(addListener)

      scope.$on('$destroy', function() {
        tracker.removeListener('add', addListener)
        tracker.removeListener('change', changeListener)
        tracker.removeListener('remove', removeListener)
      })
    }
  }
}
