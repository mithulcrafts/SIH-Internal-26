window.addEventListener('error', e => {
  const err = e.error ? e.error.stack : e.message;
  document.body.innerHTML = '<div style="color:red;font-size:24px;padding:20px;z-index:9999;position:absolute;background:white;top:0;left:0;right:0;bottom:0;">' + err.replace(/\n/g, '<br/>') + '</div>';
});
