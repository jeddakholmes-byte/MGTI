// ==================== MGTI 英雄图鉴逻辑 ====================
// My Game Type Indicator
// 本文件完全移除 MBTI 展示与筛选逻辑。
// 功能：加载英雄数据、搜索、排序、按维度筛选、分批渲染卡片、展示 MGTI 五维详情模态框。

(function () {
  "use strict";

  // ==================== 全局状态 ====================
  let allChampions = [];
  let filteredChampions = [];
  let currentKeyword = "";
  let currentSortDimension = "default";
  let currentDimFilter = "all";
  let visibleCount = 50;
  let renderedCount = 0;
  let loadMoreObserver = null;
  let isLoadingMore = false;
  let searchTimer = null;

  const PAGE_SIZE = 50;
  const DIMENSION_THRESHOLD = 0.5;
  const EXTREME_THRESHOLD = 1.2;
  const BALANCED_THRESHOLD = 0.45;

  const DIMENSION_IDS = window.MGTI_DIMENSION_IDS || ["TAC", "TEA", "EMO", "DEC", "PRE"];

  const ROLE_LABELS = {
    assassin: "刺客",
    fighter: "战士",
    mage: "法师",
    marksman: "射手",
    support: "辅助",
    tank: "坦克"
  };

  const DIMENSION_FALLBACK_META = {
    TAC: {
      name: "战术风格",
      lowLabel: "直觉型",
      highLabel: "谋略型",
      lowDesc: "凭手感、反应和肌肉记忆操作，不刻意记录冷却。",
      highDesc: "会计算技能冷却、兵线状态、资源时间和换血收益。"
    },
    TEA: {
      name: "团队角色",
      lowLabel: "独行侠",
      highLabel: "团队核心",
      lowDesc: "更喜欢单带、单杀、绕后和独立创造优势。",
      highDesc: "愿意保护、开团、支援和围绕团队胜利调整打法。"
    },
    EMO: {
      name: "情绪反应",
      lowLabel: "冷静",
      highLabel: "激情",
      lowDesc: "逆风时仍能稳定执行计划，不轻易被节奏带走。",
      highDesc: "容易被击杀、残血和团战机会点燃，打法更有冲劲。"
    },
    DEC: {
      name: "决策速度",
      lowLabel: "谨慎",
      highLabel: "果敢",
      lowDesc: "倾向等待视野、队友和关键技能到位后再动手。",
      highDesc: "看到机会会快速出手，愿意用先手决定局面。"
    },
    PRE: {
      name: "英雄偏好",
      lowLabel: "传统",
      highLabel: "异类",
      lowDesc: "偏好稳定、清晰、容错较高的传统输出或功能角色。",
      highDesc: "偏好高操作、高风险、高上限或机制独特的英雄。"
    }
  };

  // ==================== 初始化 ====================
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  ready(initCatalog);

  async function initCatalog() {
    installUserErrorBoundary();

    try {
      showGridLoading("✨ 正在召唤英雄，请稍候...");

      if (typeof window.loadChampions !== "function") {
        throw new Error("window.loadChampions 不存在。请确认 data.js 已在 catalog.js 之前引入。");
      }

      const loadedChampions = await window.loadChampions();

      allChampions = Array.isArray(loadedChampions)
        ? loadedChampions.map((champion, index) => normalizeChampionForCatalog(champion, index))
        : [];

      if (!allChampions.length) {
        showGridEmpty("英雄数据为空，请检查 champions.json 和 heroes_profile.json。", "数据为空");
        updateResultCount(0, 0, 0);
        return;
      }

      ensureCatalogHeader();
      setupFilters();
      applyFiltersAndRender({ resetVisible: true });
    } catch (error) {
      console.error("[MGTI Catalog] 初始化失败：", error);
      showUserError("英雄图鉴加载失败。请检查 data.js、champions.json 与 heroes_profile.json 是否可以正常访问。", {
        title: "加载失败"
      });
      showGridEmpty("加载失败，请刷新页面重试。若仍然失败，请检查数据文件路径。", "加载失败");
      updateResultCount(0, 0, 0);
    }
  }

  function normalizeChampionForCatalog(champion, index) {
    const source = champion && typeof champion === "object" ? champion : {};
    return {
      ...source,
      _catalogIndex: index,
      dimensions: normalizeDimensions(source.dimensions),
      roles: Array.isArray(source.roles) ? source.roles.filter(Boolean) : [],
      tags: Array.isArray(source.tags) ? source.tags.filter(Boolean) : []
    };
  }

  // ==================== 页面头部与筛选控件 ====================
  function ensureCatalogHeader() {
    const header = document.querySelector(".catalog-header");
    if (!header) return;

    const title = header.querySelector("h1");
    if (title && !header.querySelector(".mgti-subtitle")) {
      const subtitle = document.createElement("div");
      subtitle.className = "mgti-subtitle";
      subtitle.textContent = window.MGTI_FULLNAME || "My Game Type Indicator";
      subtitle.style.marginTop = "0.4rem";
      subtitle.style.color = "#e2b86b";
      subtitle.style.fontSize = "0.95rem";
      subtitle.style.letterSpacing = "0.08em";
      subtitle.style.opacity = "0.9";
      title.insertAdjacentElement("afterend", subtitle);
    }

    const desc = header.querySelector("p");
    if (desc) {
      desc.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.includes("MBTI")) {
          node.textContent = node.textContent.replaceAll("MBTI", "MGTI");
        }
      });
    }

    ensureFilterBar();
  }

  function ensureFilterBar() {
    let filterBar = document.querySelector(".filter-bar");
    const header = document.querySelector(".catalog-header");

    if (!filterBar && header) {
      filterBar = document.createElement("div");
      filterBar.className = "filter-bar";
      header.appendChild(filterBar);
    }

    if (!filterBar) return;

    ensureSearchInput(filterBar);
    ensureSortSelect(filterBar);
    ensureDimensionFilter(filterBar);
  }

  function ensureSearchInput(filterBar) {
    let searchInput = document.getElementById("search-input");

    if (!searchInput) {
      searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.id = "search-input";
      searchInput.className = "search-input";
      searchInput.placeholder = "搜索英雄名称或别称（如：亚索、EZ、盲僧、劫）...";
      searchInput.autocomplete = "off";
      searchInput.setAttribute("aria-label", "搜索英雄名称或别称");
      filterBar.prepend(searchInput);
    }
  }

  function ensureSortSelect(filterBar) {
    const oldMbtiFilter = document.getElementById("mbti-filter");
    let sortSelect = document.getElementById("sort-filter");

    if (!sortSelect) {
      sortSelect = document.createElement("select");
      sortSelect.id = "sort-filter";
      sortSelect.className = "sort-filter mbti-filter";
      sortSelect.setAttribute("aria-label", "选择英雄排序维度");
      sortSelect.innerHTML = buildSortOptionsHTML();
    } else {
      sortSelect.innerHTML = buildSortOptionsHTML(sortSelect.value);
    }

    if (oldMbtiFilter && oldMbtiFilter !== sortSelect) {
      oldMbtiFilter.replaceWith(sortSelect);
    } else if (!filterBar.contains(sortSelect)) {
      filterBar.appendChild(sortSelect);
    }
  }

  function ensureDimensionFilter(filterBar) {
    let dimFilter = document.getElementById("dim-filter");

    if (!dimFilter) {
      dimFilter = document.createElement("select");
      dimFilter.id = "dim-filter";
      dimFilter.className = "dim-filter sort-filter";
      dimFilter.setAttribute("aria-label", "按 MGTI 维度倾向筛选英雄");
      filterBar.appendChild(dimFilter);
    }

    dimFilter.innerHTML = buildDimensionFilterOptionsHTML(dimFilter.value || currentDimFilter);
  }

  function buildSortOptionsHTML(selected = currentSortDimension) {
    const options = [
      ["default", "默认排序"],
      ["dominant", "风格鲜明度"],
      ...DIMENSION_IDS.map((dimensionId) => {
        const meta = getDimensionMeta(dimensionId);
        return [dimensionId, meta?.name || dimensionId];
      })
    ];

    return options.map(([value, label]) => {
      return `<option value="${escapeAttribute(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(label)}</option>`;
    }).join("");
  }

  function buildDimensionFilterOptionsHTML(selected = "all") {
    const options = [
      ["all", "全部英雄"],
      ["balanced", "五维均衡型"],
      ["extreme", "风格鲜明型"],
      ["separator_basic", "──────────"]
    ];

    DIMENSION_IDS.forEach((dimensionId) => {
      const meta = getDimensionMeta(dimensionId);
      const name = meta?.name || dimensionId;
      const highLabel = meta?.highLabel || "高分";
      const lowLabel = meta?.lowLabel || "低分";
      options.push([`${dimensionId}_high`, `${name}｜${highLabel} > +${DIMENSION_THRESHOLD}`]);
      options.push([`${dimensionId}_low`, `${name}｜${lowLabel} < -${DIMENSION_THRESHOLD}`]);
    });

    return options.map(([value, label]) => {
      if (String(value).startsWith("separator")) {
        return `<option value="${escapeAttribute(value)}" disabled>${escapeHTML(label)}</option>`;
      }
      return `<option value="${escapeAttribute(value)}" ${value === selected ? "selected" : ""}>${escapeHTML(label)}</option>`;
    }).join("");
  }

  // ==================== 筛选与排序 ====================
  function setupFilters() {
    const searchInput = document.getElementById("search-input");
    const sortSelect = document.getElementById("sort-filter");
    const dimFilter = document.getElementById("dim-filter");

    if (searchInput && !searchInput.dataset.mgtiBound) {
      searchInput.dataset.mgtiBound = "true";
      searchInput.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
          currentKeyword = searchInput.value || "";
          applyFiltersAndRender({ resetVisible: true });
        }, 120);
      });
    }

    if (sortSelect && !sortSelect.dataset.mgtiBound) {
      sortSelect.dataset.mgtiBound = "true";
      sortSelect.addEventListener("change", () => {
        currentSortDimension = sortSelect.value || "default";
        applyFiltersAndRender({ resetVisible: true });
      });
    }

    if (dimFilter && !dimFilter.dataset.mgtiBound) {
      dimFilter.dataset.mgtiBound = "true";
      dimFilter.addEventListener("change", () => {
        currentDimFilter = dimFilter.value || "all";
        applyFiltersAndRender({ resetVisible: true });
      });
    }
  }

  function applyFiltersAndRender(options = {}) {
    const shouldResetVisible = options.resetVisible !== false;

    try {
      const keyword = normalizeSearchKeyword(currentKeyword);

      let filtered = allChampions.filter((champion) => {
        const keywordMatched = !keyword || isChampionMatched(champion, keyword);
        const dimensionMatched = isChampionDimensionMatched(champion, currentDimFilter);
        return keywordMatched && dimensionMatched;
      });

      filtered = sortChampions(filtered, currentSortDimension);
      filteredChampions = filtered;

      if (shouldResetVisible) {
        visibleCount = Math.min(PAGE_SIZE, filteredChampions.length);
        renderedCount = 0;
        disconnectLoadMoreObserver();
      }

      renderChampionGrid(filteredChampions, { append: false });
      updateResultCount(filteredChampions.length, Math.min(visibleCount, filteredChampions.length), allChampions.length);
    } catch (error) {
      console.error("[MGTI Catalog] 筛选或渲染失败：", error);
      showUserError("筛选英雄时出现问题，已停止本次渲染。请刷新页面或清空筛选条件后重试。", {
        title: "筛选失败"
      });
      showGridEmpty("筛选失败，请清空条件后重试。", "筛选失败");
    }
  }

  function normalizeSearchKeyword(keyword) {
    const raw = String(keyword || "").trim();
    if (!raw) return "";

    const lower = raw.toLowerCase();

    if (window.heroAliasMap) {
      if (window.heroAliasMap[raw]) return String(window.heroAliasMap[raw]).toLowerCase();
      if (window.heroAliasMap[lower]) return String(window.heroAliasMap[lower]).toLowerCase();
    }

    if (typeof window.searchChampionName === "function") {
      const resolved = window.searchChampionName(raw);
      if (resolved && resolved !== raw) return String(resolved).toLowerCase();
    }

    return lower;
  }

  function isChampionMatched(champion, keyword) {
    const roles = Array.isArray(champion.roles) ? champion.roles : [];
    const roleLabels = roles.map((role) => ROLE_LABELS[role] || role);
    const dimensionLabels = getChampionDimensionSearchLabels(champion);

    const fields = [
      champion.name,
      champion.title,
      champion.alias,
      ...roles,
      ...roleLabels,
      ...(Array.isArray(champion.tags) ? champion.tags : []),
      ...dimensionLabels
    ];

    return fields.some((field) => String(field || "").toLowerCase().includes(keyword));
  }

  function getChampionDimensionSearchLabels(champion) {
    const dominant = getDominantDimension(champion.dimensions, 0.5);
    if (!dominant) return [];

    const meta = getDimensionMeta(dominant.id);
    const label = dominant.value >= 0 ? meta?.highLabel : meta?.lowLabel;
    return [dominant.id, meta?.name, label].filter(Boolean);
  }

  function isChampionDimensionMatched(champion, filterValue) {
    const filter = String(filterValue || "all");

    if (!filter || filter === "all" || filter.startsWith("separator")) {
      return true;
    }

    const values = DIMENSION_IDS.map((dimensionId) => getDimensionValue(champion, dimensionId));
    const maxAbs = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

    if (filter === "balanced") {
      return maxAbs <= BALANCED_THRESHOLD;
    }

    if (filter === "extreme") {
      return maxAbs >= EXTREME_THRESHOLD;
    }

    const match = filter.match(/^([A-Z]{3})_(high|low)$/);
    if (!match) return true;

    const [, dimensionId, side] = match;
    const value = getDimensionValue(champion, dimensionId);

    if (side === "high") return value > DIMENSION_THRESHOLD;
    if (side === "low") return value < -DIMENSION_THRESHOLD;

    return true;
  }

  function sortChampions(champions, sortDimension) {
    const copied = [...champions];

    if (sortDimension === "dominant") {
      return copied.sort((a, b) => {
        const bMax = getMaxAbsDimensionValue(b);
        const aMax = getMaxAbsDimensionValue(a);
        if (bMax !== aMax) return bMax - aMax;
        return a._catalogIndex - b._catalogIndex;
      });
    }

    if (!sortDimension || sortDimension === "default" || !DIMENSION_IDS.includes(sortDimension)) {
      return copied.sort((a, b) => a._catalogIndex - b._catalogIndex);
    }

    return copied.sort((a, b) => {
      const bValue = getDimensionValue(b, sortDimension);
      const aValue = getDimensionValue(a, sortDimension);

      if (bValue !== aValue) return bValue - aValue;
      return a._catalogIndex - b._catalogIndex;
    });
  }

  function getMaxAbsDimensionValue(champion) {
    return DIMENSION_IDS.reduce((max, dimensionId) => {
      return Math.max(max, Math.abs(getDimensionValue(champion, dimensionId)));
    }, 0);
  }

  // ==================== 分批渲染英雄网格 ====================
  function renderChampionGrid(champions, options = {}) {
    const grid = document.getElementById("champion-grid");
    if (!grid) return;

    const list = Array.isArray(champions) ? champions : [];
    const shouldAppend = options.append === true;

    bindGridDelegatedClick(grid);

    if (list.length === 0) {
      renderedCount = 0;
      disconnectLoadMoreObserver();
      grid.innerHTML = `<div class="empty-state"><h2>没有找到匹配的英雄</h2><p>可以换一个英雄名、别称，或把维度筛选切回“全部英雄”。</p></div>`;
      return;
    }

    const end = Math.min(visibleCount, list.length);
    const start = shouldAppend ? renderedCount : 0;

    if (!shouldAppend) {
      grid.innerHTML = "";
      renderedCount = 0;
    } else {
      removeLoadMoreControls(grid);
    }

    const batchHtml = list.slice(start, end).map((champion) => buildChampionCard(champion)).join("");
    grid.insertAdjacentHTML("beforeend", batchHtml);
    renderedCount = end;

    renderLoadMoreControls(grid, list.length, end);
    setupLoadMoreObserver();
  }

  function bindGridDelegatedClick(grid) {
    if (grid.dataset.mgtiCardBound) return;

    grid.dataset.mgtiCardBound = "true";
    grid.addEventListener("click", (event) => {
      if (event.target.closest("button, a, .btn, .btn-primary, .btn-outline, select, input")) return;

      const card = event.target.closest(".champion-card");
      if (!card) return;

      const index = Number(card.dataset.index);
      const champion = allChampions.find((item) => item._catalogIndex === index);

      if (champion) {
        showDetailModal(champion);
      }
    });
  }

  function buildChampionCard(champion) {
    const storyPlain = getStorySnippet(champion.story, 120);
    const avatarUrl = champion.image_url || champion.splash_url || "";
    const tagsHtml = buildChampionTags(champion);
    const dominant = getDominantDimension(champion.dimensions, 0.5);
    const dominantMeta = dominant ? getDimensionMeta(dominant.id) : null;
    const dominantTitle = dominant && dominantMeta
      ? `${dominantMeta.name} ${formatDimensionValue(dominant.value)}`
      : "五维均衡";

    return `
      <article 
        class="champion-card" 
        data-index="${escapeAttribute(champion._catalogIndex)}"
        data-name="${escapeAttribute(champion.name)}"
        data-dominant="${escapeAttribute(dominant?.id || "balanced")}"
        tabindex="0"
        role="button"
        aria-label="查看 ${escapeAttribute(champion.name || "英雄")} 的 MGTI 画像"
      >
        <div class="champion-avatar">
          <img 
            src="${escapeAttribute(avatarUrl)}" 
            alt="${escapeAttribute(champion.name || "英雄头像")}" 
            loading="lazy" 
            decoding="async"
            onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'"
          >
        </div>

        <div class="champion-name">${escapeHTML(champion.name || "未知英雄")}</div>
        <div class="champion-title">${escapeHTML(champion.title || "符文之地英雄")}</div>

        ${tagsHtml ? `<div class="champion-tags" title="${escapeAttribute(dominantTitle)}">${tagsHtml}</div>` : `<div class="champion-tags"></div>`}

        <div class="story-snippet">${escapeHTML(storyPlain)}</div>
      </article>
    `;
  }

  function buildChampionTags(champion) {
    const dominant = getDominantDimension(champion.dimensions, 0.5);

    if (!dominant) {
      return `<span class="tag" title="五维倾向均衡">均衡型</span>`;
    }

    const meta = getDimensionMeta(dominant.id);
    if (!meta) return "";

    const label = dominant.value >= 0 ? meta.highLabel : meta.lowLabel;
    const dimensionName = meta.name || dominant.id;

    return `
      <span class="tag" title="${escapeAttribute(dimensionName)}：${escapeAttribute(formatDimensionValue(dominant.value))}">
        ${escapeHTML(label || dimensionName)}
      </span>
    `;
  }

  function removeLoadMoreControls(grid) {
    grid.querySelectorAll(".catalog-load-more, .catalog-load-sentinel").forEach((node) => node.remove());
  }

  function renderLoadMoreControls(grid, total, rendered) {
    removeLoadMoreControls(grid);

    const hasMore = rendered < total;

    if (!hasMore) {
      grid.insertAdjacentHTML("beforeend", `
        <div class="catalog-load-more" aria-live="polite">
          <button class="load-more-btn" type="button" disabled aria-disabled="true">
            已显示全部 ${escapeHTML(String(total))} 位英雄
          </button>
        </div>
      `);
      return;
    }

    const nextCount = Math.min(PAGE_SIZE, total - rendered);
    grid.insertAdjacentHTML("beforeend", `
      <div class="catalog-load-more" aria-live="polite">
        <button id="load-more-btn" class="load-more-btn" type="button">
          继续加载 ${escapeHTML(String(nextCount))} 位英雄 · 已显示 ${escapeHTML(String(rendered))}/${escapeHTML(String(total))}
        </button>
      </div>
      <div id="catalog-load-sentinel" class="catalog-load-sentinel" aria-hidden="true"></div>
    `);

    const loadMoreBtn = document.getElementById("load-more-btn");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", loadMoreChampions, { once: true });
    }
  }

  function loadMoreChampions() {
    if (isLoadingMore) return;
    if (!filteredChampions.length) return;

    const nextVisibleCount = Math.min(visibleCount + PAGE_SIZE, filteredChampions.length);
    if (nextVisibleCount <= visibleCount) return;

    isLoadingMore = true;
    visibleCount = nextVisibleCount;

    window.requestAnimationFrame(() => {
      try {
        renderChampionGrid(filteredChampions, { append: true });
        updateResultCount(filteredChampions.length, Math.min(visibleCount, filteredChampions.length), allChampions.length);
      } finally {
        isLoadingMore = false;
      }
    });
  }

  function setupLoadMoreObserver() {
    disconnectLoadMoreObserver();

    const sentinel = document.getElementById("catalog-load-sentinel");
    if (!sentinel || typeof IntersectionObserver !== "function") return;

    loadMoreObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting) {
        loadMoreChampions();
      }
    }, {
      root: null,
      rootMargin: "360px 0px 360px 0px",
      threshold: 0.01
    });

    loadMoreObserver.observe(sentinel);
  }

  function disconnectLoadMoreObserver() {
    if (loadMoreObserver) {
      loadMoreObserver.disconnect();
      loadMoreObserver = null;
    }
  }

  // ==================== 详情模态框 ====================
  function showDetailModal(champion) {
    try {
      const modal = ensureModal();
      const bodyDiv = modal.querySelector("#modal-body");

      if (!bodyDiv) return;

      const splashUrl = champion.splash_url || champion.image_url || "";
      const storyFull = stripHTML(champion.story || "没有详细故事");
      const roleHtml = buildRoleTags(champion);
      const dimensionBarsHtml = buildDimensionBars(champion.dimensions);
      const dimensionSummaryHtml = buildDimensionSummary(champion);
      const dominant = getDominantDimension(champion.dimensions, 0.5);
      const dominantText = buildDominantText(dominant);
      const roleDescription = buildRoleDescription(champion);
      const detailedAdvice = buildCatalogAdvice(champion);

      bodyDiv.innerHTML = `
        <div class="modal-splash">
          <img 
            src="${escapeAttribute(splashUrl)}" 
            alt="${escapeAttribute(champion.name || "英雄原画")}" 
            loading="lazy"
            decoding="async"
            onerror="this.src='https://via.placeholder.com/800x450?text=Image+Not+Found'"
          >
        </div>

        <h2>${escapeHTML(champion.name || "未知英雄")}</h2>
        <p><strong>称号：</strong>${escapeHTML(champion.title || "未知")}</p>

        ${roleHtml ? `<div class="champion-tags" style="justify-content:flex-start; margin: 0.8rem 0;">${roleHtml}</div>` : ""}

        <div class="analysis-section" style="margin-top: 1rem;">
          <h3>📊 MGTI 五维画像</h3>
          <p>${escapeHTML(dominantText)}</p>
          ${dimensionBarsHtml}
          ${dimensionSummaryHtml}
        </div>

        <div class="analysis-section">
          <h3>🎮 游戏风格解读</h3>
          <p>${escapeHTML(roleDescription)}</p>
          <div class="advice">
            <strong>💡 图鉴说明</strong>
            ${escapeHTML(detailedAdvice)}
          </div>
        </div>

        <div class="analysis-section">
          <h3>📖 背景故事</h3>
          <p style="white-space: pre-wrap; font-size:0.9rem; line-height:1.6;">
            ${escapeHTML(storyFull.substring(0, 2000))}${storyFull.length > 2000 ? "……" : ""}
          </p>
          ${storyFull.length > 2000
          ? `<p style="text-align:right; font-size:0.8rem; opacity:0.7;">故事较长，已截取前 2000 字</p>`
          : ""
        }
        </div>
      `;

      modal.style.display = "flex";
      document.body.classList.add("no-scroll");
      document.body.style.overflow = "hidden";
    } catch (error) {
      console.error("[MGTI Catalog] 展示英雄详情失败：", error);
      showUserError("英雄详情展示失败，请稍后重试。", { title: "详情加载失败" });
    }
  }

  function ensureModal() {
    let modal = document.querySelector(".modal");

    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.innerHTML = `
        <div class="modal-content">
          <button class="close-modal" type="button" aria-label="关闭">&times;</button>
          <div id="modal-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    if (!modal.dataset.mgtiBound) {
      modal.dataset.mgtiBound = "true";

      const closeBtn = modal.querySelector(".close-modal");
      if (closeBtn) {
        closeBtn.addEventListener("click", closeModal);
      }

      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          closeModal();
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.style.display === "flex") {
          closeModal();
        }
      });
    }

    return modal;
  }

  function closeModal() {
    const modal = document.querySelector(".modal");
    if (modal) {
      modal.style.display = "none";
    }
    document.body.classList.remove("no-scroll");
    document.body.style.overflow = "";
  }

  // ==================== 五维展示 ====================
  function buildDimensionBars(dimensions) {
    const normalized = normalizeDimensions(dimensions);

    const items = DIMENSION_IDS.map((dimensionId) => {
      const meta = getDimensionMeta(dimensionId);
      const value = normalized[dimensionId];
      const percent = ((value + 2) / 4) * 100;
      const band = getScoreBand(meta, value);

      return `
        <div class="dimension-item">
          <div class="dim-label" title="${escapeAttribute(meta?.name || dimensionId)}">
            ${escapeHTML(meta?.name || dimensionId)}
          </div>
          <div class="dim-bar-bg" title="${escapeAttribute(getDimensionRangeTitle(meta, value))}">
            <div class="dim-bar-fill" style="width: ${clamp(percent, 0, 100)}%;"></div>
          </div>
          <div class="dim-value" title="${escapeAttribute(band?.label || "")}">${escapeHTML(formatDimensionValue(value))}</div>
        </div>
        <div style="display:flex; justify-content:space-between; gap:0.5rem; margin:-0.35rem 0 0.55rem 76px; font-size:0.68rem; color:#788899;">
          <span>${escapeHTML(meta?.lowLabel || "低")}</span>
          <span>${escapeHTML(meta?.highLabel || "高")}</span>
        </div>
      `;
    }).join("");

    return `<div class="dimension-bars">${items}</div>`;
  }

  function buildDimensionSummary(champion) {
    const normalized = normalizeDimensions(champion.dimensions);

    const rows = DIMENSION_IDS.map((dimensionId) => {
      const meta = getDimensionMeta(dimensionId);
      const value = normalized[dimensionId];
      const label = value >= 0 ? meta?.highLabel : meta?.lowLabel;
      const desc = value >= 0 ? meta?.highDesc : meta?.lowDesc;
      const band = getScoreBand(meta, value);
      const title = band?.label ? `${band.label}｜${formatDimensionValue(value)}` : formatDimensionValue(value);
      const bandDesc = band?.desc || desc || "暂无描述";

      return `
        <div style="display:flex; gap:0.8rem; padding:0.65rem 0; border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="width:72px; color:#e2b86b; flex-shrink:0;">${escapeHTML(meta?.name || dimensionId)}</div>
          <div style="flex:1; color:#cbdbe2;">
            <strong>${escapeHTML(label || "均衡")}</strong>
            <span style="opacity:0.75;">｜${escapeHTML(title)}</span>
            <div style="margin-top:0.25rem; font-size:0.82rem; opacity:0.78; line-height:1.55;">${escapeHTML(bandDesc)}</div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div style="margin-top:1rem; background:rgba(255,255,255,0.035); border-radius:18px; padding:0.4rem 0.9rem;">
        ${rows}
      </div>
    `;
  }

  function getDominantDimension(dimensions, threshold = 0.5) {
    if (typeof window.getDominantDimension === "function") {
      return window.getDominantDimension(dimensions, threshold);
    }

    const normalized = normalizeDimensions(dimensions);
    let best = null;

    DIMENSION_IDS.forEach((dimensionId) => {
      const value = normalized[dimensionId];
      const absValue = Math.abs(value);

      if (!best || absValue > best.absValue) {
        best = {
          id: dimensionId,
          value,
          absValue
        };
      }
    });

    if (!best || best.absValue < threshold) return null;
    return best;
  }

  function buildDominantText(dominant) {
    if (!dominant) {
      return "这位英雄的 MGTI 画像较为均衡，没有明显偏向某一个单一维度。";
    }

    const meta = getDimensionMeta(dominant.id);

    if (!meta) {
      return `这位英雄在 ${dominant.id} 维度上表现最明显。`;
    }

    const label = dominant.value >= 0 ? meta.highLabel : meta.lowLabel;
    const desc = dominant.value >= 0 ? meta.highDesc : meta.lowDesc;
    const band = getScoreBand(meta, dominant.value);
    const bandLabel = band?.label ? `，属于「${band.label}」` : "";

    return `这位英雄最突出的倾向是「${label}」${bandLabel}。在「${meta.name}」维度上，TA 更接近「${desc}」这一端。`;
  }

  function buildCatalogAdvice(champion) {
    const normalized = normalizeDimensions(champion.dimensions);
    const dominant = getDominantDimension(normalized, 0.5);
    const dominantMeta = dominant ? getDimensionMeta(dominant.id) : null;

    const base = "该画像基于英雄背景故事、定位、技能机制与玩家常见玩法预设。数值范围为 -2 到 +2，越靠右越接近该维度的高分倾向。";

    if (!dominant || !dominantMeta) {
      return `${base} 这位英雄的数值比较均衡，适合作为多风格玩家的中间参照。`;
    }

    const sideLabel = dominant.value >= 0 ? dominantMeta.highLabel : dominantMeta.lowLabel;
    return `${base} 当前英雄最强特征为「${dominantMeta.name}｜${sideLabel}」，适合用来理解该维度的极端或半极端样本。`;
  }

  function getDimensionRangeTitle(meta, value) {
    if (!meta) return formatDimensionValue(value);

    const side = value >= 0
      ? `${meta.highLabel}：${meta.highDesc}`
      : `${meta.lowLabel}：${meta.lowDesc}`;
    const band = getScoreBand(meta, value);
    const bandText = band?.label ? `｜${band.label}` : "";

    return `${meta.name} ${formatDimensionValue(value)}${bandText}｜${side}`;
  }

  function getScoreBand(meta, value) {
    const bands = Array.isArray(meta?.scoreBands) ? meta.scoreBands : [];
    return bands.find((band) => {
      const min = toFiniteNumber(band.min, -Infinity);
      const max = toFiniteNumber(band.max, Infinity);
      return value >= min && value <= max;
    }) || null;
  }

  // ==================== 角色与描述 ====================
  function buildRoleTags(champion) {
    if (!Array.isArray(champion.roles) || champion.roles.length === 0) {
      return "";
    }

    return champion.roles.map((role) => {
      const label = ROLE_LABELS[role] || role;
      return `<span class="tag">${escapeHTML(label)}</span>`;
    }).join("");
  }

  function buildRoleDescription(champion) {
    const templates = window.resultTemplates || {};
    const roleDescriptions = templates.roleDescriptions || {};
    const roles = Array.isArray(champion.roles) ? champion.roles : [];

    if (roles.length === 0) {
      return "这位英雄的定位较为开放，可以根据玩家理解形成不同的游戏风格。";
    }

    const descriptions = roles
      .map((role) => roleDescriptions[role])
      .filter(Boolean);

    if (descriptions.length > 0) {
      return descriptions.join(" ");
    }

    const roleLabels = roles.map((role) => ROLE_LABELS[role] || role).join("、");
    return `这位英雄的主要定位是 ${roleLabels}。TA 的 MGTI 数值可以辅助理解其战斗节奏与玩家风格。`;
  }

  // ==================== 错误提示与用户反馈 ====================
  function installUserErrorBoundary() {
    if (typeof window.showUserError !== "function") {
      window.showUserError = showUserError;
    }

    if (!window.__MGTI_CATALOG_ERROR_BOUNDARY__) {
      window.__MGTI_CATALOG_ERROR_BOUNDARY__ = true;

      window.addEventListener("error", (event) => {
        if (String(event?.filename || "").includes("catalog")) {
          showUserError("图鉴页面发生脚本错误。请刷新页面重试。", { title: "页面错误" });
        }
      });

      window.addEventListener("unhandledrejection", (event) => {
        const message = String(event?.reason?.message || event?.reason || "");
        if (message.includes("MGTI") || message.includes("catalog") || message.includes("Champions")) {
          showUserError("图鉴数据处理失败。请检查网络或数据文件。", { title: "数据错误" });
        }
      });
    }
  }

  function showUserError(message, options = {}) {
    const title = options.title || "提示";
    const duration = toFiniteNumber(options.duration, 4200);
    let toast = document.getElementById("mgti-user-toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "mgti-user-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      toast.style.position = "fixed";
      toast.style.left = "50%";
      toast.style.bottom = "24px";
      toast.style.transform = "translateX(-50%) translateY(16px)";
      toast.style.maxWidth = "min(92vw, 520px)";
      toast.style.padding = "0.85rem 1rem";
      toast.style.borderRadius = "18px";
      toast.style.border = "1px solid rgba(226, 184, 107, 0.35)";
      toast.style.background = "rgba(20, 28, 38, 0.96)";
      toast.style.color = "#e9f1f7";
      toast.style.boxShadow = "0 22px 60px rgba(0,0,0,0.45)";
      toast.style.zIndex = "9999";
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.22s ease, transform 0.22s ease";
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div style="font-weight:700; color:#e2b86b; margin-bottom:0.25rem;">${escapeHTML(title)}</div>
      <div style="font-size:0.9rem; line-height:1.55;">${escapeHTML(message)}</div>
    `;

    window.clearTimeout(toast._mgtiTimer);
    window.requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    });

    toast._mgtiTimer = window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(16px)";
    }, duration);
  }

  function showGridLoading(message) {
    const grid = document.getElementById("champion-grid");
    if (!grid) return;
    grid.innerHTML = `<div class="loading">${escapeHTML(message)}</div>`;
  }

  function showGridEmpty(message, title = "没有结果") {
    const grid = document.getElementById("champion-grid");
    if (!grid) return;
    grid.innerHTML = `
      <div class="empty-state">
        <h2>${escapeHTML(title)}</h2>
        <p>${escapeHTML(message)}</p>
      </div>
    `;
  }

  function updateResultCount(totalFiltered, shown = visibleCount, totalAll = allChampions.length) {
    const headerText = document.querySelector(".catalog-header p");
    if (!headerText) return;

    let countSpan = headerText.querySelector(".result-count");

    if (!countSpan) {
      countSpan = document.createElement("span");
      countSpan.className = "result-count";
      countSpan.style.marginLeft = "0.5rem";
      countSpan.style.fontSize = "0.9rem";
      countSpan.style.opacity = "0.9";
      headerText.appendChild(countSpan);
    }

    const safeFiltered = Math.max(0, Number(totalFiltered) || 0);
    const safeShown = Math.min(safeFiltered, Math.max(0, Number(shown) || 0));
    const safeTotal = Math.max(safeFiltered, Number(totalAll) || safeFiltered);

    if (safeFiltered === safeTotal) {
      countSpan.textContent = `共 ${safeFiltered} 位英雄 · 已显示 ${safeShown} 位`;
    } else {
      countSpan.textContent = `筛选出 ${safeFiltered}/${safeTotal} 位英雄 · 已显示 ${safeShown} 位`;
    }
  }

  // ==================== 数据工具 ====================
  function getDimensionMeta(dimensionId) {
    if (typeof window.getDimensionMeta === "function") {
      const meta = window.getDimensionMeta(dimensionId);
      if (meta) return meta;
    }

    const fromData = (window.dimensions || []).find((dimension) => dimension.id === dimensionId);
    return fromData || DIMENSION_FALLBACK_META[dimensionId] || null;
  }

  function getDimensionValue(champion, dimensionId) {
    return toFiniteNumber(champion?.dimensions?.[dimensionId], 0);
  }

  function normalizeDimensions(dimensions) {
    if (typeof window.normalizeDimensionObject === "function") {
      return window.normalizeDimensionObject(dimensions);
    }

    const source = dimensions && typeof dimensions === "object" ? dimensions : {};

    return DIMENSION_IDS.reduce((acc, dimensionId) => {
      acc[dimensionId] = clamp(toFiniteNumber(source[dimensionId], 0), -2, 2);
      return acc;
    }, {});
  }

  // ==================== 字符串与安全工具 ====================
  function getStorySnippet(story, length = 120) {
    const plain = stripHTML(story || "").replace(/\s+/g, " ").trim();

    if (!plain) return "暂无故事";

    return plain.length > length ? `${plain.substring(0, length)}...` : plain;
  }

  function stripHTML(value) {
    return String(value || "").replace(/<[^>]*>/g, "");
  }

  function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatDimensionValue(value) {
    const number = toFiniteNumber(value, 0);
    return number > 0 ? `+${number.toFixed(1)}` : number.toFixed(1);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value).replaceAll("`", "&#096;");
  }

  // ==================== 调试导出 ====================
  window.MGTICatalogDebug = {
    getAllChampions: () => allChampions,
    getFilteredChampions: () => filteredChampions,
    getVisibleCount: () => visibleCount,
    rerender: () => applyFiltersAndRender({ resetVisible: true }),
    loadMore: loadMoreChampions,
    showDetailModal,
    setDimensionFilter: (value) => {
      currentDimFilter = value || "all";
      const dimFilter = document.getElementById("dim-filter");
      if (dimFilter) dimFilter.value = currentDimFilter;
      applyFiltersAndRender({ resetVisible: true });
    }
  };
})();
