// Try a desktop app's URL scheme; if the page keeps focus, open the website instead.
export function launchApp(app, env) {
  const { win, doc, mobile, timeoutMs = 1500 } = env;
  const openWeb = url => {
    const tab = win.open(url, '_blank');
    if (tab) tab.opener = null;
    return !!tab;
  };
  if (mobile || !app.scheme) {
    openWeb((mobile && app.mobileHref) || app.href);
    return Promise.resolve('web');
  }
  return new Promise(resolve => {
    let left = false;
    let frame = null;
    const mark = () => { left = true; };
    const onVisibility = () => { if (doc.visibilityState === 'hidden') left = true; };
    win.addEventListener('blur', mark);
    win.addEventListener('pagehide', mark);
    doc.addEventListener('visibilitychange', onVisibility);
    const ua = win.navigator?.userAgent || '';
    const safari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR/.test(ua);
    if (/Firefox\//.test(ua) || safari) {
      // Firefox (error page) and Safari (invalid-address alert) complain about unknown top-level schemes;
      // a hidden frame fails quietly so the website fallback still runs.
      frame = doc.createElement('iframe');
      frame.style.display = 'none';
      frame.src = app.scheme;
      doc.body.append(frame);
    } else {
      try { win.location.assign(app.scheme); } catch { /* no handler */ }
    }
    win.setTimeout(() => {
      win.removeEventListener('blur', mark);
      win.removeEventListener('pagehide', mark);
      doc.removeEventListener('visibilitychange', onVisibility);
      frame?.remove();
      if (left) return resolve('app');
      resolve(openWeb(app.href) ? 'web' : 'blocked');
    }, timeoutMs);
  });
}
