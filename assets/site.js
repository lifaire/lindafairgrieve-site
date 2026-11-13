/* Reads the text files in /content and fills the pages. No libraries, no tracking. */
(function () {
  'use strict';

  /* ---------- helpers that work without a browser (they are tested separately) ---------- */

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isTodo(v) {
    return v === undefined || v === null || /^\s*\[?\s*TODO\s*\]?\s*$/i.test(v) || String(v).trim() === '';
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function parseContent(text) {
    var out = {}, sec = null;
    text.split(/\r?\n/).forEach(function (line) {
      var l = line.trim();
      if (!l || l.charAt(0) === '#') return;
      var m = l.match(/^\[([^\]]+)\]$/);
      if (m) { sec = m[1].trim(); out[sec] = out[sec] || {}; return; }
      var i = l.indexOf(':');
      if (sec && i > 0) out[sec][l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
    return out;
  }

  function safeUrl(u, root) {
    u = String(u).trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (u.charAt(0) === '/') return (root || '') + u.slice(1);
    if (u.charAt(0) === '#') return u;
    return null;
  }

  function inlineMd(s, root) {
    var h = esc(s);
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
      var url = safeUrl(u.replace(/&amp;/g, '&'), root);
      return url ? '<a class="inl" href="' + esc(url) + '">' + t + '</a>' : t;
    });
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    // keep a lone "I" with the next word, so it never sits alone at the end of a line
    h = h.replace(/(^|[\s>])I (?=\S)/g, '$1I\u00a0');
    return h;
  }

  function renderManifesto(text, root) {
    var html = [], para = [], quote = [], list = null, n = 0;
    function flushPara() { if (para.length) { html.push('<p>' + inlineMd(para.join(' '), root) + '</p>'); para = []; } }
    function flushQuote() { if (quote.length) { html.push('<blockquote class="quote"><p>' + inlineMd(quote.join(' '), root) + '</p></blockquote>'); quote = []; } }
    function flushList() { if (list) { html.push('<ol class="values">' + list.join('') + '</ol>'); list = null; } }
    function flushAll() { flushPara(); flushQuote(); flushList(); }
    text.split(/\r?\n/).forEach(function (raw) {
      var l = raw.trim();
      if (!l) { flushAll(); return; }
      if (/^#(?!#)/.test(l)) return;
      var hm = l.match(/^##\s+(.*)$/);
      if (hm) { flushAll(); html.push('<h2>' + inlineMd(hm[1], root) + '</h2>'); return; }
      if (l.charAt(0) === '>') { flushPara(); flushList(); quote.push(l.replace(/^>\s?/, '')); return; }
      if (/^-\s+/.test(l)) {
        flushPara(); flushQuote();
        if (!list) { list = []; n = 0; }
        n++;
        var parts = l.replace(/^-\s+/, '').split(' | ');
        var num = (n < 10 ? '0' : '') + n + '.';
        list.push('<li><span class="num">' + num + '</span><div><strong>' + inlineMd(parts[0], root) + '</strong>' +
          (parts.length > 1 ? '<p>' + inlineMd(parts.slice(1).join(' | '), root) + '</p>' : '') + '</div></li>');
        return;
      }
      flushQuote(); flushList();
      para.push(l);
    });
    flushAll();
    return html.join('\n');
  }

  function parseGlossary(text) {
    var terms = [];
    text.split(/\r?\n/).forEach(function (line) {
      var l = line.trim();
      if (!l || l.charAt(0) === '#') return;
      var i = l.indexOf('|');
      if (i < 1) return;
      var name = l.slice(0, i).trim(), def = l.slice(i + 1).trim();
      if (name && def) terms.push({ id: slug(name), name: name, def: def });
    });
    terms.sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }); });
    return terms;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { esc: esc, isTodo: isTodo, slug: slug, parseContent: parseContent, safeUrl: safeUrl, inlineMd: inlineMd, renderManifesto: renderManifesto, parseGlossary: parseGlossary };
  }
  if (typeof document === 'undefined') return;

  /* ---------- page code ---------- */

  var cache = {};          // url -> text (html and text files)
  var contentData = null;  // parsed site.txt
  var hashHandler = null;
  var busy = false;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function loadText(path) {
    if (cache[path]) return Promise.resolve(cache[path]);
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.text();
    }).then(function (t) { cache[path] = t; return t; });
  }

  function showError() {
    var e = document.getElementById('load-error');
    if (e) e.hidden = false;
  }

  function drop(el) {
    var target = el.closest('[data-optional]') || el;
    var parent = target.parentNode;
    if (parent) parent.removeChild(target);
    // a list left with no items disappears too, so it leaves no gap
    if (parent && parent.hasAttribute && parent.hasAttribute('data-hide-empty') && !parent.children.length && parent.parentNode) {
      parent.parentNode.removeChild(parent);
    }
  }

  function applyContent(content, root, scope) {
    scope = scope || document;
    function get(key) {
      var p = key.split('.');
      return content[p[0]] ? content[p[0]][p[1]] : undefined;
    }
    function each(sel, fn) { Array.prototype.forEach.call(scope.querySelectorAll(sel), fn); }
    each('[data-c]', function (el) {
      var v = get(el.getAttribute('data-c'));
      if (isTodo(v)) drop(el); else el.textContent = v;
    });
    each('[data-md]', function (el) {
      var v = get(el.getAttribute('data-md'));
      if (isTodo(v)) drop(el); else el.innerHTML = inlineMd(v, root);
    });
    each('[data-href]', function (el) {
      var v = get(el.getAttribute('data-href'));
      var url = isTodo(v) ? null : safeUrl(v, root);
      if (!url) drop(el); else el.setAttribute('href', url);
    });
    each('[data-src]', function (el) {
      var v = get(el.getAttribute('data-src'));
      var url = isTodo(v) ? null : safeUrl('/' + v.replace(/^\/+/, ''), root);
      if (!url) drop(el); else el.setAttribute('src', url);
    });
    each('[data-alt]', function (el) {
      var v = get(el.getAttribute('data-alt'));
      if (v && !isTodo(v)) el.setAttribute('alt', v);
    });
  }

  /* Turn relative links into full addresses, so they keep working after the address bar changes. */
  function absolutize(scope, base) {
    function fix(el, attr) {
      var v = el.getAttribute(attr);
      if (!v || v.charAt(0) === '#' || /^(mailto:|tel:|data:|javascript:)/i.test(v)) return;
      try { el.setAttribute(attr, new URL(v, base).href); } catch (e) {}
    }
    Array.prototype.forEach.call(scope.querySelectorAll('a[href]'), function (a) { fix(a, 'href'); });
    Array.prototype.forEach.call(scope.querySelectorAll('img[src], source[src]'), function (a) { fix(a, 'src'); });
    Array.prototype.forEach.call(scope.querySelectorAll('source[srcset]'), function (a) {
      var v = a.getAttribute('srcset');
      if (v && v.indexOf(',') === -1 && v.indexOf(' ') === -1) fix(a, 'srcset');
    });
  }

  function renderGlossary(terms, root) {
    var el = {
      search: document.getElementById('g-search'),
      letters: document.getElementById('g-letters'),
      list: document.getElementById('g-list'),
      defs: document.getElementById('g-defs'),
      acc: document.getElementById('g-acc'),
      empty: document.getElementById('g-empty')
    };
    var st = { q: '', letter: null, open: null };
    var allLetters = [];
    terms.forEach(function (t) {
      var l = t.name.charAt(0).toUpperCase();
      t.letter = l;
      if (allLetters.indexOf(l) === -1) allLetters.push(l);
    });
    var plus = '<svg class="plus" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

    function filtered() {
      var q = st.q.trim().toLowerCase();
      return terms.filter(function (t) {
        if (st.letter && t.letter !== st.letter) return false;
        return !q || (t.name + ' ' + t.def).toLowerCase().indexOf(q) !== -1;
      });
    }

    function render() {
      var f = filtered();
      el.letters.innerHTML = '<button type="button" class="letter' + (st.letter ? '' : ' on') + '" data-l="" aria-pressed="' + (!st.letter) + '">All</button>' +
        allLetters.map(function (l) {
          return '<button type="button" class="letter' + (st.letter === l ? ' on' : '') + '" data-l="' + esc(l) + '" aria-pressed="' + (st.letter === l) + '">' + esc(l) + '</button>';
        }).join('');
      el.list.innerHTML = f.map(function (t) { return '<a class="tlink" href="#t-' + t.id + '">' + esc(t.name) + '</a>'; }).join('');
      el.defs.innerHTML = f.map(function (t) {
        return '<div class="def" id="t-' + t.id + '"><h2>' + esc(t.name) + '</h2><p>' + inlineMd(t.def, root) + '</p></div>';
      }).join('');
      el.acc.innerHTML = f.map(function (t) {
        var open = st.open === t.id;
        return '<div><button type="button" class="acc" id="a-' + t.id + '" data-id="' + t.id + '" aria-expanded="' + open + '" aria-controls="p-' + t.id + '"><span>' + esc(t.name) + '</span>' + plus + '</button>' +
          '<p class="acc-def" id="p-' + t.id + '"' + (open ? '' : ' hidden') + '>' + inlineMd(t.def, root) + '</p></div>';
      }).join('');
      el.empty.hidden = f.length !== 0;
    }

    el.search.addEventListener('input', function () { st.q = el.search.value; render(); });
    el.letters.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-l]');
      if (!b) return;
      var l = b.getAttribute('data-l');
      st.letter = (l && st.letter !== l) ? l : null;
      render();
    });
    el.acc.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-id]');
      if (!b) return;
      var id = b.getAttribute('data-id');
      st.open = st.open === id ? null : id;
      render();
      var again = document.getElementById('a-' + id);
      if (again) again.focus();
    });

    function goHash() {
      var id = decodeURIComponent((location.hash || '').replace(/^#/, '')).replace(/^t-/, '');
      if (!id || !terms.some(function (t) { return t.id === id; })) return;
      if (!filtered().some(function (t) { return t.id === id; })) { st.q = ''; st.letter = null; el.search.value = ''; }
      st.open = id;
      render();
      var wide = window.matchMedia && window.matchMedia('(min-width:820px)').matches;
      var target = document.getElementById(wide ? 't-' + id : 'a-' + id);
      if (target) target.scrollIntoView({ block: 'start' });
    }
    if (hashHandler) window.removeEventListener('hashchange', hashHandler);
    hashHandler = goHash;
    window.addEventListener('hashchange', goHash);
    render();
    goHash();
  }

  /* Fill the parts of the current page that need a text file (manifesto, glossary). */
  function initPage(page, root) {
    if (page === 'manifesto') {
      return loadText(root + 'content/manifesto.txt').then(function (t) {
        var m = document.getElementById('manifesto');
        if (m) { m.innerHTML = renderManifesto(t, root); absolutize(m, location.href); }
      });
    }
    if (page === 'glossary') {
      return loadText(root + 'content/glossary.txt').then(function (t) {
        renderGlossary(parseGlossary(t), root);
      });
    }
    return Promise.resolve();
  }

  /* ---------- changing pages without a full reload ---------- */

  var OWN_PAGE = /\/(index\.html)?$/;

  function pageUrl(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;
    var u;
    try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin || !OWN_PAGE.test(u.pathname) || /404\.html$/.test(u.pathname)) return null;
    return u;
  }

  function getPage(url) {
    var key = url.split('#')[0];
    return loadText(key);
  }

  function copyHead(doc) {
    document.title = doc.title;
    var pairs = [['meta[name="description"]', 'content'], ['link[rel="canonical"]', 'href'], ['meta[property^="og:"]', 'content'], ['meta[name^="twitter:"]', 'content']];
    pairs.forEach(function (p) {
      Array.prototype.forEach.call(doc.querySelectorAll(p[0]), function (src) {
        var sel = p[0].indexOf('[property') > -1 ? 'meta[property="' + src.getAttribute('property') + '"]'
          : p[0].indexOf('name^') > -1 ? 'meta[name="' + src.getAttribute('name') + '"]' : p[0];
        var dst = document.querySelector(sel);
        if (dst) dst.setAttribute(p[1], src.getAttribute(p[1]));
      });
    });
  }

  function swapIn(html, url, push) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var newPage = doc.body.getAttribute('data-page');
    var newRoot = doc.body.getAttribute('data-root') || '';
    var oldMain = document.getElementById('main');
    var newMain = document.importNode(doc.getElementById('main'), true);

    // one calm update: content, then address, then the small header changes
    applyContent(contentData || {}, newRoot, newMain);
    absolutize(newMain, url.split('#')[0]);
    oldMain.parentNode.replaceChild(newMain, oldMain);

    if (push) { try { history.pushState({ p: 1 }, '', url); } catch (e) {} }

    var g = document.querySelector('.hero .greeting'), ng = doc.querySelector('.hero .greeting');
    if (g && ng && g.tagName !== ng.tagName) {
      var rep = document.createElement(ng.tagName.toLowerCase());
      rep.className = 'greeting';
      rep.textContent = g.textContent;
      g.parentNode.replaceChild(rep, g);
    }
    var tabs = document.querySelectorAll('.tabs .tab'), ntabs = doc.querySelectorAll('.tabs .tab');
    Array.prototype.forEach.call(tabs, function (t, i) {
      var n = ntabs[i];
      if (!n) return;
      t.classList.toggle('on', n.classList.contains('on'));
      if (n.hasAttribute('aria-current')) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    document.body.setAttribute('data-page', newPage);
    document.body.setAttribute('data-root', newRoot);
    copyHead(doc);

    var live = document.getElementById('live-status');
    if (live) live.textContent = doc.title;

    var nav = document.querySelector('.nav-area'), mainEl = document.getElementById('main');
    if (nav && mainEl) {
      var pinned = window.getComputedStyle(nav).position === 'sticky';
      var top = pinned
        ? mainEl.getBoundingClientRect().top + window.pageYOffset - nav.offsetHeight - 16
        : nav.getBoundingClientRect().top + window.pageYOffset - 16;
      if (window.pageYOffset > top) window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }
    return initPage(newPage, newRoot);
  }

  function go(url, push) {
    if (busy) return;
    busy = true;
    var main = document.getElementById('main');
    if (main && !reduce) main.classList.add('leaving');
    Promise.all([getPage(url), new Promise(function (r) { setTimeout(r, reduce ? 0 : 110); })]).then(function (r) {
      return swapIn(r[0], url, push);
    }).then(function () { busy = false; }).catch(function () {
      busy = false;
      location.href = url;
    });
  }

  /* shadow line under the pinned tabs, only while they are pinned */
  function watchPinned() {
    var navEl = document.querySelector('.nav-area');
    if (!navEl) return;
    var queued = false;
    function update() {
      queued = false;
      var pinned = window.getComputedStyle(navEl).position === 'sticky' && navEl.getBoundingClientRect().top <= 0.5;
      navEl.classList.toggle('stuck', pinned);
    }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; window.requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function enhance() {
    var live = document.createElement('div');
    live.id = 'live-status';
    live.className = 'sr';
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      var u = pageUrl(a);
      if (!u) return;
      var here = location.pathname;
      if (u.pathname === here) {
        if (!u.hash) e.preventDefault();      // same page: nothing to do
        return;                                // same page with #: normal in-page jump
      }
      e.preventDefault();
      go(u.href, true);
    });

    window.addEventListener('popstate', function () { go(location.href, false); });

    // warm the cache so a tab click feels instant
    var warm = function () {
      var seen = {};
      Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
        var u = pageUrl(a);
        if (!u) return;
        var k = u.href.split('#')[0];
        if (seen[k] || k === location.href.split('#')[0]) return;
        seen[k] = 1;
        loadText(k).catch(function () {});
      });
    };
    if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 2500 }); else setTimeout(warm, 1200);
  }

  function init() {
    var root = document.body.getAttribute('data-root') || '';
    var page = document.body.getAttribute('data-page');
    loadText(root + 'content/site.txt').then(function (t) {
      contentData = parseContent(t);
      applyContent(contentData, root);
      absolutize(document, location.href);
      if (page !== '404') enhance();
    }).catch(showError);
    initPage(page, root).catch(showError);
    watchPinned();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
