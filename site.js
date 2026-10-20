/* 案件だけの動き：groxi株式会社（骨格の swipe.js は直さない）
 * 1. 2段のマーキー（.mq）：data-word の語を繰り返して2段に並べ、長さから1周の秒数（約50px/秒）を決める
 * 2. 背景のトンネル（.tunnel__svg）：ページごとに消失点をずらす
 * 3. 横スクロールのカード（.reel）：4秒ごとに1枚送る（そのページにいるときだけ。触ったら止める）
 * 4. 進行バー（.bar）・椅子（.sit）：ページに入ったら .is-on（出現と同じ時刻）
 */
(() => {
  document.querySelectorAll('.mq').forEach((mq) => {
    const word = mq.dataset.word || '';
    const make = (cls) => {
      const row = document.createElement('span');
      row.className = `mq__row ${cls}`;
      for (let i = 0; i < 12; i++) { const s = document.createElement('span'); s.textContent = word; row.appendChild(s); }
      return row;
    };
    mq.append(make('mq__row--a'), make('mq__row--b'));
    const fit = () => { const half = mq.querySelector('.mq__row--a').scrollWidth / 2; if (half > 50) mq.style.setProperty('--mq-t', `${(half / 50).toFixed(1)}s`); };
    fit();
    window.addEventListener('resize', fit);
  });

  const tunnel = document.querySelector('.tunnel__svg');
  const VP = [[0, 0], [-7, 5], [8, -4], [-6, -6], [0, 0], [7, 6], [-8, 3], [6, -5], [0, 4], [-5, 0], [5, 0], [0, -4]];
  document.addEventListener('pagechange', (e) => {
    if (!tunnel) return;
    const [x, y] = VP[e.detail.index % VP.length];
    tunnel.style.setProperty('--tx', `${x}%`);
    tunnel.style.setProperty('--ty', `${y}%`);
  });
  const thumb = document.querySelector('.scrollbar__thumb');
  document.addEventListener('pagechange', (e) => {
    if (thumb) thumb.style.setProperty('--pos', (e.detail.index / Math.max(1, e.detail.total - 1)).toFixed(3));
  });

  document.querySelectorAll('.reel').forEach((reel) => {
    const track = reel.querySelector('.reel__track');
    const cards = [...track.children];
    const dots = [...reel.querySelectorAll('.reel__dots span')];
    let now = 0, timer = 0, touched = false;
    const show = (i) => {
      now = (i + cards.length) % cards.length;
      track.scrollTo({ left: cards[now].offsetLeft - track.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: 'smooth' });
    };
    track.addEventListener('scroll', () => {
      const x = track.scrollLeft + track.clientWidth * 0.3;
      let k = 0;
      cards.forEach((c, i) => { if (c.offsetLeft - track.offsetLeft <= x) k = i; });
      dots.forEach((d, i) => d.classList.toggle('is-on', i === k));
    }, { passive: true });
    const page = reel.closest('.page');
    document.addEventListener('pagechange', (e) => {
      clearInterval(timer);
      if (e.detail.page === page && !touched) timer = setInterval(() => show(now + 1), Number(reel.dataset.auto) || 4000);
    });
    track.addEventListener('pointerdown', () => { touched = true; clearInterval(timer); }, { passive: true });
  });

  document.addEventListener('pagechange', (e) => {
    document.querySelectorAll('.bar, .sit').forEach((el) => el.classList.toggle('is-on', el.closest('.page') === e.detail.page));
  });
})();
