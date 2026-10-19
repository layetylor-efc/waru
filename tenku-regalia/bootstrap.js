/* Classic script so a module-load failure cannot leave an endless loading screen. */
(function () {
  'use strict';
  var ready = false;
  var timer;
  function fail(reason) {
    if (ready) return;
    clearTimeout(timer);
    var box = document.getElementById('loading');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '';
    var title = document.createElement('p');
    title.textContent = '起動処理を完了できませんでした';
    var message = document.createElement('p');
    message.textContent = '保存データを残したまま、もう一度読み込みます。';
    var retry = document.createElement('button');
    retry.className = 'primary blue';
    retry.id = 'startupRetry';
    retry.textContent = '再読み込み';
    retry.onclick = function () { location.reload(); };
    var details = document.createElement('details');
    var summary = document.createElement('summary');
    summary.textContent = 'エラーの詳細';
    var text = document.createElement('pre');
    text.id = 'startupErrorDetail';
    text.textContent = '天空のレガリア v0.4.2\n' + String(reason || '読み込みが中断されました').slice(0, 500);
    details.appendChild(summary);
    details.appendChild(text);
    box.appendChild(title);
    box.appendChild(message);
    box.appendChild(retry);
    box.appendChild(details);
    box.setAttribute('data-startup-state', 'failed');
  }
  window.RegaliaBoot = {
    fail: fail,
    ready: function () {
      ready = true;
      clearTimeout(timer);
      var box = document.getElementById('loading');
      box.hidden = true;
      box.setAttribute('data-startup-state', 'ready');
    }
  };
  window.addEventListener('error', function (event) {
    if (event.target && event.target.tagName === 'SCRIPT') fail('起動ファイルを読み込めません: ' + event.target.getAttribute('src'));
    else if (event.message) fail(event.message);
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    fail(event.reason && event.reason.message ? event.reason.message : event.reason);
  });
  timer = setTimeout(function () { fail('読み込みに時間がかかっています。再読み込みしてください。'); }, 20000);
}());
