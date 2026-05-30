// 存储所有英雄数据
let allChampions = [];

// 初始化图鉴页面
async function initCatalog() {
  allChampions = await loadChampions();
  renderChampionGrid(allChampions);
  setupFilters();
}

// 渲染英雄卡片网格
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
    const avatarUrl = champ.image_url || 'https://ddragon.leagueoflegends.com/cdn/15.5.1/img/champion/default.png';

    html += `
            <div class="champion-card" data-name="${champ.name}" data-mbti="${champ.mbti || '未知'}">
                <div class="champion-avatar">
                    <img src="${avatarUrl}" alt="${champ.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'">
                </div>
                <div class="champion-name">${champ.name}</div>
                <div class="champion-title">${champ.title || ''}</div>
                <div class="champion-mbti">${champ.mbti || '未知'}</div>
                <div class="story-snippet">${escapeHtml(storyPlain)}</div>
            </div>
        `;
  });
  grid.innerHTML = html;

  // 绑定卡片点击事件
  document.querySelectorAll('.champion-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.dataset.name;
      const champion = allChampions.find(c => c.name === name);
      if (champion) showDetailModal(champion);
    });
  });
}

// 简单的防XSS辅助函数
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// 设置搜索和筛选监听（支持别名）
function setupFilters() {
  const searchInput = document.getElementById('search-input');
  const mbtiSelect = document.getElementById('mbti-filter');

  const filter = () => {
    let keyword = searchInput.value.toLowerCase().trim();
    // 别名转换：如果输入词在别名映射中，替换为标准名称
    if (window.heroAliasMap && window.heroAliasMap[keyword]) {
      keyword = window.heroAliasMap[keyword];
    }
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

// 显示英雄详情模态框（含原画）
function showDetailModal(champion) {
  let modal = document.querySelector('.modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <div id="modal-body"></div>
            </div>
        `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
  }

  const bodyDiv = modal.querySelector('#modal-body');
  const storyFull = champion.story ? champion.story.replace(/<[^>]*>/g, '') : '没有详细故事';
  const splashUrl = champion.splash_url || champion.image_url || 'https://via.placeholder.com/1920x1080?text=No+Splash';

  bodyDiv.innerHTML = `
        <div class="modal-splash">
            <img src="${splashUrl}" alt="${champion.name}" onerror="this.src='https://via.placeholder.com/800x450?text=Image+Not+Found'">
        </div>
        <h2>${escapeHtml(champion.name)}</h2>
        <p><strong>称号：</strong>${escapeHtml(champion.title || '未知')}</p>
        <p><strong>MBTI：</strong>${escapeHtml(champion.mbti || '待分类')}</p>
        <p><strong>背景故事：</strong></p>
        <p style="white-space: pre-wrap; font-size:0.9rem;">${escapeHtml(storyFull.substring(0, 1200))}${storyFull.length > 1200 ? '……' : ''}</p>
    `;
  modal.style.display = 'flex';
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initCatalog);