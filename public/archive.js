const collection = document.querySelector('.collection');

if (collection) {
  const controls = document.querySelector('.controls');
  const cards = Array.from(collection.children);
  const filters = Array.from(controls.querySelectorAll('[data-filter]'));
  const mobileFilter = document.querySelector('#mobile-filter');
  const views = Array.from(controls.querySelectorAll('[data-view]'));
  const search = document.querySelector('#search');
  const searchToggle = document.querySelector('.search-toggle');
  const searchPanel = document.querySelector('.search-panel');
  const empty = document.querySelector('.empty');
  const marks = Array.from(document.querySelectorAll('.mark'));
  const mapLabel = document.querySelector('#map-label');
  const params = new URLSearchParams(location.hash.slice(1));
  let group = filters.find(button => button.dataset.filter === params.get('format'))?.dataset.filter || 'All work';
  let layout = params.get('view') === 'list' ? 'list' : 'gallery';
  search.value = params.get('q') || '';
  controls.hidden = false;

  function setSearchOpen(open) {
    searchPanel.hidden = !open;
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) search.focus();
  }

  function display(updateUrl = true) {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    cards.forEach((card, i) => {
      const matchesGroup = group === 'All work' || card.dataset.group === group;
      const matchesText = !query || (card.textContent + ' ' + card.dataset.text).toLocaleLowerCase().includes(query);
      card.hidden = !(matchesGroup && matchesText);
      marks[i].classList.toggle('muted', card.hidden);
      if (!card.hidden) count++;
    });
    mobileFilter.value = group;
    filters.forEach(button => button.setAttribute('aria-pressed', String(group === button.dataset.filter)));
    views.forEach(button => button.setAttribute('aria-pressed', String(layout === button.dataset.view)));
    collection.classList.toggle('is-list', layout === 'list');
    document.querySelector('#results').textContent = count + (count === 1 ? ' piece' : ' pieces');
    empty.hidden = count !== 0;
    if (updateUrl) {
      const state = new URLSearchParams();
      for (const [key, value] of [['format', group === 'All work' ? '' : group], ['q', search.value], ['view', layout === 'list' ? layout : '']]) {
        if (value) state.set(key, value);
      }
      const url = new URL(location.href);
      url.hash = state.toString();
      history.replaceState(null, '', url);
    }
  }
  function closeSearch() {
    search.value = '';
    display();
    setSearchOpen(false);
    searchToggle.focus();
  }
  filters.forEach(button => button.addEventListener('click', () => {
    group = button.dataset.filter;
    display();
  }));
  mobileFilter.addEventListener('change', () => {
    group = mobileFilter.value;
    display();
  });
  views.forEach(button => button.addEventListener('click', () => {
    layout = button.dataset.view;
    display();
  }));
  searchToggle.addEventListener('click', () => {
    if (searchPanel.hidden) setSearchOpen(true);
    else closeSearch();
  });
  document.querySelector('#close-search').addEventListener('click', closeSearch);
  search.addEventListener('input', () => display());
  empty.querySelector('button').addEventListener('click', () => {
    group = 'All work';
    closeSearch();
    filters[0].focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !searchPanel.hidden) closeSearch();
    if (event.key === '/' && event.target !== search && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      setSearchOpen(true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!searchPanel.hidden && !search.value && !event.target.closest('.search-wrap')) setSearchOpen(false);
  });
  const map = document.querySelector('.map-grid');
  const mapDefault = mapLabel.textContent;
  function mapCaption(target) {
    const mark = target?.closest('.mark');
    mapLabel.textContent = mark ? mark.getAttribute('aria-label') : mapDefault;
  }
  marks.forEach((mark, i) => { mark.tabIndex = i ? -1 : 0; });
  map.addEventListener('pointerover', event => mapCaption(event.target));
  map.addEventListener('pointerleave', () => mapCaption(document.activeElement));
  map.addEventListener('focusin', event => {
    marks.forEach(mark => { mark.tabIndex = mark === event.target ? 0 : -1; });
    mapCaption(event.target);
  });
  map.addEventListener('focusout', event => mapCaption(event.relatedTarget));
  map.addEventListener('keydown', event => {
    const index = marks.indexOf(event.target);
    const columns = getComputedStyle(map).gridTemplateColumns.split(' ').length;
    const steps = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns, Home: -index, End: marks.length - 1 - index};
    if (index >= 0 && Object.hasOwn(steps, event.key)) {
      event.preventDefault();
      marks[Math.min(marks.length - 1, Math.max(0, index + steps[event.key]))].focus();
    }
  });
  if (search.value) {
    searchPanel.hidden = false;
    searchToggle.setAttribute('aria-expanded', 'true');
  }
  display(false);
}
