// 存储所有英雄数据
let allChampions = [];

// 初始化图鉴页面
async function initCatalog() {
  try {
    allChampions = await loadChampions();
    renderChampionGrid(allChampions);
    setupFilters();
    updateResultCount(allChampions.length);
  } catch (error) {
    console.error('初始化失败:', error);
    const grid = document.getElementById('champion-grid');
    if (grid) {
      grid.innerHTML = '<div class="loading">❌ 加载失败，请刷新页面重试</div>';
    }
  }
}

// 更新结果显示数量
function updateResultCount(count) {
  const header = document.querySelector('.catalog-header p');
  if (header && !header.querySelector('.result-count')) {
    const countSpan = document.createElement('span');
    countSpan.className = 'result-count';
    countSpan.style.marginLeft = '0.5rem';
    countSpan.style.fontSize = '0.9rem';
    countSpan.style.opacity = '0.8';
    header.appendChild(countSpan);
  }
  const countSpan = document.querySelector('.result-count');
  if (countSpan) countSpan.textContent = `共 ${count} 位英雄`;
}

// 渲染英雄卡片网格
function renderChampionGrid(champions) {
  const grid = document.getElementById('champion-grid');
  if (!grid) return;

  if (!champions.length) {
    grid.innerHTML = '<div class="loading">✨ 没有找到匹配的英雄，试试其他关键词吧</div>';
    updateResultCount(0);
    return;
  }

  let html = '';
  champions.forEach(champ => {
    const storyPlain = champ.story ? champ.story.replace(/<[^>]*>/g, '').substring(0, 120) + '...' : '暂无故事';
    const avatarUrl = champ.image_url || 'https://ddragon.leagueoflegends.com/cdn/15.5.1/img/champion/default.png';
    const mbtiDisplay = champ.mbti && champ.mbti !== '未知' ? champ.mbti : '待分类';

    html += `
      <div class="champion-card" data-name="${escapeHtml(champ.name)}" data-mbti="${mbtiDisplay}">
        <div class="champion-avatar">
          <img src="${avatarUrl}" alt="${escapeHtml(champ.name)}" loading="lazy" onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'">
        </div>
        <div class="champion-name">${escapeHtml(champ.name)}</div>
        <div class="champion-title">${escapeHtml(champ.title || '符文之地英雄')}</div>
        <div class="champion-mbti">${escapeHtml(mbtiDisplay)}</div>
        <div class="story-snippet">${escapeHtml(storyPlain)}</div>
      </div>
    `;
  });
  grid.innerHTML = html;

  // 绑定卡片点击事件（事件委托提高性能）
  grid.querySelectorAll('.champion-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const name = card.dataset.name;
      const champion = allChampions.find(c => c.name === name);
      if (champion) showDetailModal(champion);
    });
  });

  updateResultCount(champions.length);
}

// 防XSS辅助函数
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function (m) {
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

// 显示英雄详情模态框（含深度解析）
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
  const mbtiDisplay = champion.mbti && champion.mbti !== '未知' ? champion.mbti : '待分类';

  // 获取深度解析（优先英雄专属，否则按MBTI通用）
  let analysis = {
    title: "英雄本色",
    personality: mbtiDisplay,
    traits: "这位英雄的人格特质等待你亲自探索。",
    strengths: "未知",
    weaknesses: "未知",
    advice: "在符文之地继续你的冒险吧！",
    quote: "“英雄，去超越。”"
  };
  if (window.getHeroDeepAnalysis) {
    const custom = window.getHeroDeepAnalysis(champion);
    if (custom) analysis = custom;
  }

  bodyDiv.innerHTML = `
    <div class="modal-splash">
      <img src="${splashUrl}" alt="${escapeHtml(champion.name)}" onerror="this.src='https://via.placeholder.com/800x450?text=Image+Not+Found'">
    </div>
    <h2>${escapeHtml(champion.name)}</h2>
    <p><strong>称号：</strong>${escapeHtml(champion.title || '未知')}</p>
    <p><strong>MBTI：</strong>${escapeHtml(mbtiDisplay)}</p>
    
    <div class="analysis-section" style="margin-top: 1rem;">
      <h3>📊 人格解析</h3>
      <p><strong>${escapeHtml(analysis.title)}</strong></p>
      <p>${escapeHtml(analysis.traits)}</p>
      <div class="analysis-grid">
        <div class="strengths"><strong>✨ 优势</strong><br>${escapeHtml(analysis.strengths)}</div>
        <div class="weaknesses"><strong>⚠️ 劣势</strong><br>${escapeHtml(analysis.weaknesses)}</div>
      </div>
      <div class="advice"><strong>💡 成长建议</strong><br>${escapeHtml(analysis.advice)}</div>
      <div class="quote"><strong>🎭 英雄语录</strong><br>“${escapeHtml(analysis.quote)}”</div>
    </div>
    
    <h3>📖 背景故事</h3>
    <p style="white-space: pre-wrap; font-size:0.9rem; line-height:1.5;">${escapeHtml(storyFull.substring(0, 2000))}${storyFull.length > 2000 ? '……' : ''}</p>
    ${storyFull.length > 2000 ? '<p style="text-align:right; font-size:0.8rem; opacity:0.7;">故事较长，已截取前2000字</p>' : ''}
  `;
  modal.style.display = 'flex';
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initCatalog);