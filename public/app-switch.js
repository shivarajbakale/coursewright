/*
 * Sends each screen to the right Coursewright app before either one loads.
 *
 * Phones and iPads get the reader (/m/), desktops get the full app (/). A course or chapter maps to
 * the same course or chapter in the other app; pages only the full app has (new course, notes,
 * sources, projects) stay where they are. `?app=reader` or `?app=full` overrides for this visit (the
 * browser tab's session), so a phone that opens the full app once still gets the reader next time;
 * `?app=auto` forgets it. The dev servers (5173, 5174) are left alone.
 *
 * Plain script, not a module, so it runs before the first paint. Both apps serve it from public/.
 */
(function (root) {
  var KEY = 'cw-app';
  var COURSE = /^\/courses\/([^/]+)(?:\/chapters\/([^/]+))?\/?$/;

  /** The reader page for a full-app path, or null when the reader has no such page. */
  function toReader(path) {
    if (path === '/' || path === '') return '/m/';
    var m = COURSE.exec(path);
    if (!m) return null;
    return '/m/courses/' + m[1] + (m[2] ? '/chapters/' + m[2] : '');
  }

  /** The full-app page for a reader path; anything without a match goes to the library. */
  function toFull(path) {
    var rest = path.replace(/^\/m(?=\/|$)/, '') || '/';
    return COURSE.test(rest) ? rest.replace(/\/$/, '') : '/';
  }

  /** A phone or a tablet. iPadOS Safari calls itself a Mac, so a "Mac" with a touch screen is an iPad. */
  function handheld(nav, width) {
    var ua = nav.userAgent || '';
    var touch = (nav.maxTouchPoints || 0) > 1;
    if (/iPhone|iPod|iPad/.test(ua)) return true;
    if (/Macintosh/.test(ua) && touch) return true;
    if (/Android/.test(ua)) return true;
    return touch && width < 700;
  }

  /** Where this page should go, or null to stay. `pref` is 'reader', 'full' or null (decide by device). */
  function target(path, isHandheld, pref) {
    var inReader = path === '/m' || path.indexOf('/m/') === 0;
    var want = pref === 'reader' || pref === 'full' ? pref : isHandheld ? 'reader' : 'full';
    if (inReader && want === 'full') return toFull(path);
    if (!inReader && want === 'reader') return toReader(path);
    return null;
  }

  root.cwAppSwitch = { target: target, toReader: toReader, toFull: toFull, handheld: handheld };
  if (root.__cwNoAppSwitch) return;

  try {
    var loc = root.location;
    var params = new URLSearchParams(loc.search);
    var asked = params.get('app');
    var pref = null;
    try {
      if (asked === 'auto') root.sessionStorage.removeItem(KEY);
      else if (asked === 'reader' || asked === 'full') root.sessionStorage.setItem(KEY, asked);
      pref = root.sessionStorage.getItem(KEY);
    } catch (e) {
      pref = asked === 'reader' || asked === 'full' ? asked : null;
    }
    if (asked) params.delete('app');
    var query = params.toString() ? '?' + params.toString() : '';
    if ((loc.port === '5173' || loc.port === '5174') && !asked) return;

    var to = target(loc.pathname, handheld(root.navigator, root.innerWidth), pref);
    if (to && to !== loc.pathname) loc.replace(to + query + loc.hash);
    else if (asked) root.history.replaceState(null, '', loc.pathname + query + loc.hash);
  } catch (e) {
    // Never block either app from loading.
  }
})(window);
