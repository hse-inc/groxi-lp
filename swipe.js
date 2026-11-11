(() => {
  const SCROLL = document.documentElement.dataset.layout === 'scroll';
  const slider = document.getElementById('slider');
  const column = document.querySelector('.column');
  const pages = [...slider.querySelectorAll('.page')];
  const pad = (n) => String(n).padStart(2, '0');
  const railNow = document.querySelector('.rail-side__now');
  const railName = document.querySelector('.rail-side__name');
  const next = document.querySelector('.nextbtn');
  const nextName = document.querySelector('.nextbtn__name');

  let current = -1;
  const activate = (index) => {
    if (index === current || index < 0) return;
    current = index;
    const page = pages[index];
    pages.forEach((p) => p.classList.toggle('is-active', p === page));
    column.dataset.tone = page.dataset.tone || 'light';
    column.dataset.page = index === 0 ? 'top' : 'p';
    column.classList.toggle('is-last', index === pages.length - 1);
    column.classList.toggle('is-long', page.classList.contains('page--long'));
    if (nextName) nextName.textContent = page.dataset.next || '';
    if (railNow) railNow.textContent = pad(index);
    if (railName) railName.textContent = page.dataset.label || '';
    document.dispatchEvent(new CustomEvent('pagechange', { detail: { index, page, total: pages.length } }));
  };
  const indexFromScroll = () => {
    const mid = slider.scrollTop + slider.clientHeight / 2;
    let i = 0;
    pages.forEach((p, k) => { if (p.offsetTop <= mid) i = k; });
    return i;
  };
  let ticking = false;
  slider.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; activate(indexFromScroll()); });
  }, { passive: true });
  window.addEventListener('load', () => activate(indexFromScroll()));
  activate(indexFromScroll());

  const go = (index) => {
    const i = Math.max(0, Math.min(pages.length - 1, index));
    if (i === current) return;
    pages[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const SETTLE_MS = 300, HOLD_MS = 300, RISE_N = 3, RISE_K = 2, GLIDE_MS = 280;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let glideId = 0;
  const glide = (el) => {
    const id = ++glideId, from = slider.scrollTop, to = el.offsetTop, t0 = performance.now();
    if (reduce) { slider.scrollTop = to; return; }
    slider.style.scrollSnapType = 'none';
    const step = (n) => {
      if (id !== glideId) return;
      const p = Math.min(1, (n - t0) / GLIDE_MS), k = 1 - Math.pow(1 - p, 3);
      slider.scrollTop = from + (to - from) * k;
      if (p < 1) requestAnimationFrame(step); else slider.style.scrollSnapType = '';
    };
    requestAnimationFrame(step);
  };
  let burst = null, settleUntil = 0, target = -1, longAt = -1e9;
  window.addEventListener('wheel', (e) => {
    if (SCROLL || e.ctrlKey) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? slider.clientHeight : 1);
    if (Math.abs(e.deltaX) > Math.abs(dy)) return;
    const dir = Math.sign(dy), ad = Math.abs(dy);
    if (!dir) return;
    const t = e.timeStamp || performance.now(), now = performance.now();
    const settling = now < settleUntil;
    const gap = burst ? t - burst.lastT : Infinity;
    if (burst && dir !== burst.dir) burst.opp = (burst.opp || 0) + ad; else if (burst) burst.opp = 0;
    const reversed = !!burst && dir !== burst.dir && (ad >= 4 || burst.opp >= 10);
    const quietStart = !!burst && gap > 300 && burst.lastAd < 8 && ad >= Math.max(12, burst.lastAd * 2 + 4);
    const separate = !!burst && gap > 900;
    const renewed = !!burst && burst.taken && t - burst.takenT > 400 && burst.low < 30 && ad >= Math.max(30, burst.peak * 0.5) && ad > burst.low * 2 + 16;
    const sameStep = !!burst && Math.abs(ad / burst.unit - Math.round(ad / burst.unit)) < 0.01;
    const steady = !!burst && gap >= 150 && (gap >= 500 || !(burst.lastGap > 0 && gap > burst.lastGap * 1.2));
    const stepped = sameStep && burst.uniform && steady;
    const rising = !!burst && ad > burst.lastAd * 1.25 + 1 ? (burst.rise || 0) + 1 : 0;
    const regrown = !!burst && burst.taken && t - burst.takenT > 250 && rising >= RISE_N && ad >= burst.low * RISE_K + 6;
    const fresh = !burst || reversed || (!(settling && dir === burst.dir) && (quietStart || separate || renewed || stepped || regrown));
    if (fresh) burst = { dir, peak: ad, low: ad, taken: false, arriving: false, unit: ad, uniform: ad >= 50 };
    else if (!sameStep) burst.uniform = false;
    burst.low = ad >= burst.peak ? ad : Math.min(burst.low, ad);
    burst.peak = Math.max(burst.peak, ad);
    burst.lastGap = fresh ? 0 : gap;
    burst.lastT = t;
    burst.lastAd = ad;
    burst.rise = fresh ? 0 : rising;
    if (burst.arriving) { e.preventDefault(); return; }
    const index = settling && target >= 0 ? target : current;
    const page = pages[index];
    if (page && page.classList.contains('page--long')) {
      const top = page.offsetTop, edge = dir > 0 ? top + page.offsetHeight - slider.clientHeight : top;
      const can = dir > 0 ? slider.scrollTop < edge - 1 : slider.scrollTop > edge + 1;
      if (can && !settling) {
        longAt = now;
        burst.taken = true; burst.takenT = t;
        if (ad >= Math.abs(edge - slider.scrollTop)) { e.preventDefault(); slider.scrollTo({ top: edge, behavior: 'instant' }); }
        else if (!slider.contains(e.target)) { e.preventDefault(); slider.scrollBy({ top: dy, behavior: 'instant' }); }
        return;
      }
      if (now - longAt < HOLD_MS) { e.preventDefault(); return; }
    }
    e.preventDefault();
    burst.sum = (burst.sum || 0) + ad;
    if (burst.taken || burst.sum < 10) return;
    const nextIndex = Math.max(0, Math.min(pages.length - 1, index + dir));
    if (nextIndex === index) return;
    burst.taken = true;
    burst.takenT = t;
    burst.arriving = pages[nextIndex].classList.contains('page--long');
    target = nextIndex;
    settleUntil = now + SETTLE_MS;
    glide(pages[nextIndex]);
  }, { passive: false });

  const insideLong = (d) => {
    const page = pages[current];
    if (!page || !page.classList.contains('page--long')) return false;
    const top = page.offsetTop, bottom = top + page.offsetHeight;
    return d > 0 ? slider.scrollTop + slider.clientHeight < bottom - 1 : slider.scrollTop > top + 1;
  };

  window.addEventListener('keydown', (e) => {
    if (SCROLL) return;
    if (e.target.closest('input, textarea, select, button')) return;
    const down = ['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey);
    const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    if (!down && !up) return;
    if (insideLong(down ? 1 : -1)) return;
    e.preventDefault();
    if (e.repeat) return;
    go(current + (down ? 1 : -1));
  });
  if (next) next.addEventListener('click', (e) => { e.preventDefault(); go(current + 1); });
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    if (a === next) return;
    a.addEventListener('click', (e) => {
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (!target || !pages.includes(target)) return;
      e.preventDefault();
      go(pages.indexOf(target));
    });
  });

  const STEP_MS = 120, START_MS = 200, RESET_MS = 700;
  let timers = [], resetTimer = null;
  const play = (page) => {
    timers.forEach(clearTimeout);
    timers = [...page.querySelectorAll('.rv')].map((el, k) => setTimeout(() => el.classList.add('is-on'), START_MS + STEP_MS * k));
  };
  const reset = (except) => pages.forEach((p) => {
    if (p !== except) p.querySelectorAll('.rv.is-on').forEach((el) => el.classList.remove('is-on'));
  });
  if (SCROLL) {
    let queue = 0, queueAt = 0;
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const now = performance.now();
      if (now - queueAt > STEP_MS) queue = 0;
      queueAt = now;
      setTimeout(() => en.target.classList.add('is-on'), STEP_MS * queue++);
    }), { root: slider, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.rv').forEach((el) => io.observe(el));
  } else {
    document.addEventListener('pagechange', (e) => {
      play(e.detail.page);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => reset(e.detail.page), RESET_MS);
    });
    if (pages[current]) play(pages[current]);
  }

  document.querySelectorAll('form[data-static]').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));
})();
