let allChampions = [];

async function initCatalog() {
  allChampions = await loadChampions();
  renderChampionGrid(allChampions);
  setupFilters();
}

function renderChampionGrid(champions) {
  const grid = document.getElementById('champion-grid');
  if (!grid) return;
  if (!champions.length) {
    grid.innerHTML = '<div class="loading">暂无英雄数据，请确保 champions.json 已加载</div>';
    return;
  }
  let html = '';
  champions.forEach(champ => {
    const storyPlain = champ.story ? champ.story.replace(/<[^>]*>/g, '').substring(0, 120) + '...' : '暂无故事';
    html += `
            <div class="champion-card" data-name="${champ.name}" data-mbti="${champ.mbti}">
                <div class="champion-name">${champ.name}</div>
                <div class="champion-title">${champ.title || ''}</div>
                <div class="champion-mbti">${champ.mbti || '未知'}</div>
                <div class="story-snippet">${storyPlain}</div>
            </div>
        `;
  });
  grid.innerHTML = html;

  // 绑定点击详情
  document.querySelectorAll('.champion-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      const champion = allChampions.find(c => c.name === name);
      if (champion) showDetailModal(champion);
    });
  });
}

function setupFilters() {
  const searchInput = document.getElementById('search-input');
  const mbtiSelect = document.getElementById('mbti-filter');

  const filter = () => {
    const keyword = searchInput.value.toLowerCase().trim();
    const mbtiFilter = mbtiSelect.value;
    let filtered = allChampions.filter(c => {
      const matchName = keyword === '' || c.name.toLowerCase().includes(keyword);
      const matchMbti = mbtiFilter === 'all' || c.mbti === mbtiFilter;
      return matchName && matchMbti;
    });
    renderChampionGrid(filtered);
  };

  searchInput.addEventListener('input', filter);
  mbtiSelect.addEventListener('change', filter);
}

function showDetailModal(champion) {
  // 创建模态框
  let modal = document.querySelector('.modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content"><span class="close-modal">&times;</span><div id="modal-body"></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
  }
  const bodyDiv = modal.querySelector('#modal-body');
  const storyFull = champion.story ? champion.story.replace(/<[^>]*>/g, '') : '没有详细故事';
  bodyDiv.innerHTML = `
        <h2>${champion.name}</h2>
        <p><strong>称号：</strong>${champion.title || '未知'}</p>
        <p><strong>MBTI：</strong>${champion.mbti || '待分类'}</p>
        <p><strong>背景故事：</strong></p>
        <p style="white-space: pre-wrap; font-size:0.9rem;">${storyFull.substring(0, 1200)}${storyFull.length > 1200 ? '……' : ''}</p>
    `;
  modal.style.display = 'flex';
}

window.addEventListener('DOMContentLoaded', initCatalog);