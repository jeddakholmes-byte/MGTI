// ==================== MGTI 英雄图鉴逻辑 ====================
// 本文件完全移除 MBTI 展示与筛选逻辑。
// 功能：加载英雄数据、搜索、排序、渲染卡片、展示 MGTI 五维详情模态框。

(function () {
  // ==================== 全局状态 ====================
  let allChampions = [];
  let currentKeyword = "";
  let currentSortDimension = "default";

  const DIMENSION_IDS = window.MGTI_DIMENSION_IDS || ["TAC", "TEA", "EMO", "DEC", "PRE"];

  const ROLE_LABELS = {
    assassin: "刺客",
    fighter: "战士",
    mage: "法师",
    marksman: "射手",
    support: "辅助",
    tank: "坦克"
  };

  // ==================== 初始化 ====================
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(initCatalog);

  async function initCatalog() {
    try {
      showGridLoading("✨ 正在召唤英雄，请稍候...");

      if (typeof window.loadChampions !== "function") {
        throw new Error("window.loadChampions 不存在。请确认 data.js 已在 catalog.js 之前引入。");
      }

      const loadedChampions = await window.loadChampions();

      allChampions = Array.isArray(loadedChampions)
        ? loadedChampions.map((champion, index) => ({
          ...champion,
          _catalogIndex: index
        }))
        : [];

      if (!allChampions.length) {
        showGridLoading("❌ 英雄数据为空，请检查 champions.json 和 heroes_profile.json。");
        updateResultCount(0);
        return;
      }

      ensureCatalogHeader();
      setupFilters();
      applyFiltersAndRender();
    } catch (error) {
      console.error("[MGTI Catalog] 初始化失败：", error);
      showGridLoading("❌ 加载失败，请刷新页面重试");
      updateResultCount(0);
    }
  }

  // ==================== 页面头部修正 ====================
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

    ensureSortSelect();
  }

  function ensureSortSelect() {
    const filterBar = document.querySelector(".filter-bar");
    if (!filterBar) return;

    const oldMbtiFilter = document.getElementById("mbti-filter");
    let sortSelect = document.getElementById("sort-filter");

    if (!sortSelect) {
      sortSelect = document.createElement("select");
      sortSelect.id = "sort-filter";
      sortSelect.className = "sort-filter mbti-filter";
      sortSelect.innerHTML = `
        <option value="default">默认排序</option>
        <option value="TAC">战术风格</option>
        <option value="TEA">团队角色</option>
        <option value="EMO">情绪反应</option>
        <option value="DEC">决策速度</option>
        <option value="PRE">英雄偏好</option>
      `;
    }

    if (oldMbtiFilter) {
      oldMbtiFilter.replaceWith(sortSelect);
    } else if (!filterBar.contains(sortSelect)) {
      filterBar.appendChild(sortSelect);
    }
  }

  // ==================== 筛选与排序 ====================
  function setupFilters() {
    const searchInput = document.getElementById("search-input");
    const sortSelect = document.getElementById("sort-filter");

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        currentKeyword = searchInput.value || "";
        applyFiltersAndRender();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        currentSortDimension = sortSelect.value || "default";
        applyFiltersAndRender();
      });
    }
  }

  function applyFiltersAndRender() {
    const keyword = normalizeSearchKeyword(currentKeyword);

    let filtered = allChampions.filter((champion) => {
      if (!keyword) return true;
      return isChampionMatched(champion, keyword);
    });

    filtered = sortChampions(filtered, currentSortDimension);

    renderChampionGrid(filtered);
    updateResultCount(filtered.length);
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
    const fields = [
      champion.name,
      champion.title,
      champion.alias,
      ...(Array.isArray(champion.roles) ? champion.roles : []),
      ...(Array.isArray(champion.tags) ? champion.tags : [])
    ];

    return fields.some((field) => {
      return String(field || "").toLowerCase().includes(keyword);
    });
  }

  function sortChampions(champions, sortDimension) {
    const copied = [...champions];

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

  // ==================== 渲染英雄网格 ====================
  function renderChampionGrid(champions) {
    const grid = document.getElementById("champion-grid");
    if (!grid) return;

    if (!Array.isArray(champions) || champions.length === 0) {
      grid.innerHTML = `<div class="loading">✨ 没有找到匹配的英雄，试试其他关键词吧</div>`;
      return;
    }

    grid.innerHTML = champions.map((champion) => buildChampionCard(champion)).join("");

    grid.querySelectorAll(".champion-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, a, .btn, .btn-primary, .btn-outline")) return;

        const index = Number(card.dataset.index);
        const champion = allChampions.find((item) => item._catalogIndex === index);

        if (champion) {
          showDetailModal(champion);
        }
      });
    });
  }

  function buildChampionCard(champion) {
    const storyPlain = getStorySnippet(champion.story, 120);
    const avatarUrl = champion.image_url || champion.splash_url || "";
    const tagsHtml = buildChampionTags(champion);
    const dominant = getDominantDimension(champion.dimensions);

    return `
      <div 
        class="champion-card" 
        data-index="${escapeAttribute(champion._catalogIndex)}"
        data-name="${escapeAttribute(champion.name)}"
        data-dominant="${escapeAttribute(dominant?.id || "")}"
      >
        <div class="champion-avatar">
          <img 
            src="${escapeAttribute(avatarUrl)}" 
            alt="${escapeAttribute(champion.name || "英雄头像")}" 
            loading="lazy" 
            onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'"
          >
        </div>

        <div class="champion-name">${escapeHTML(champion.name || "未知英雄")}</div>
        <div class="champion-title">${escapeHTML(champion.title || "符文之地英雄")}</div>

        ${tagsHtml ? `<div class="champion-tags">${tagsHtml}</div>` : `<div class="champion-tags"></div>`}

        <div class="story-snippet">${escapeHTML(storyPlain)}</div>
      </div>
    `;
  }

  function buildChampionTags(champion) {
    const dominant = getDominantDimension(champion.dimensions);

    if (!dominant) return "";

    const meta = getDimensionMeta(dominant.id);
    if (!meta) return "";

    const label = dominant.value >= 0 ? meta.highLabel : meta.lowLabel;
    const dimensionName = meta.name || dominant.id;

    return `
      <span class="tag" title="${escapeAttribute(dimensionName)}：${escapeAttribute(formatDimensionValue(dominant.value))}">
        ${escapeHTML(label)}
      </span>
    `;
  }

  // ==================== 详情模态框 ====================
  function showDetailModal(champion) {
    const modal = ensureModal();
    const bodyDiv = modal.querySelector("#modal-body");

    if (!bodyDiv) return;

    const splashUrl = champion.splash_url || champion.image_url || "";
    const storyFull = stripHTML(champion.story || "没有详细故事");
    const roleHtml = buildRoleTags(champion);
    const dimensionBarsHtml = buildDimensionBars(champion.dimensions);
    const dimensionSummaryHtml = buildDimensionSummary(champion);
    const dominant = getDominantDimension(champion.dimensions);
    const dominantText = buildDominantText(dominant);
    const roleDescription = buildRoleDescription(champion);

    bodyDiv.innerHTML = `
      <div class="modal-splash">
        <img 
          src="${escapeAttribute(splashUrl)}" 
          alt="${escapeAttribute(champion.name || "英雄原画")}" 
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
          该画像基于英雄的背景故事、定位与技能机制预设。数值范围为 -2 到 +2，越靠右越接近该维度的高分倾向。
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
    document.body.style.overflow = "hidden";
  }

  function ensureModal() {
    let modal = document.querySelector(".modal");

    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modal-content">
          <span class="close-modal" aria-label="关闭">&times;</span>
          <div id="modal-body"></div>
        </div>
      `;
      document.body.appendChild(modal);

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
    document.body.style.overflow = "";
  }

  // ==================== 五维展示 ====================
  function buildDimensionBars(dimensions) {
    const normalized = normalizeDimensions(dimensions);

    const items = DIMENSION_IDS.map((dimensionId) => {
      const meta = getDimensionMeta(dimensionId);
      const value = normalized[dimensionId];
      const percent = ((value + 2) / 4) * 100;

      return `
        <div class="dimension-item">
          <div class="dim-label" title="${escapeAttribute(meta?.name || dimensionId)}">
            ${escapeHTML(meta?.name || dimensionId)}
          </div>
          <div class="dim-bar-bg" title="${escapeAttribute(getDimensionRangeTitle(meta, value))}">
            <div class="dim-bar-fill" style="width: ${clamp(percent, 0, 100)}%;"></div>
          </div>
          <div class="dim-value">${escapeHTML(formatDimensionValue(value))}</div>
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

      return `
        <div style="display:flex; gap:0.8rem; padding:0.55rem 0; border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="width:72px; color:#e2b86b; flex-shrink:0;">${escapeHTML(meta?.name || dimensionId)}</div>
          <div style="flex:1; color:#cbdbe2;">
            ${escapeHTML(label || "均衡")}
            <span style="opacity:0.75;">｜${escapeHTML(desc || "暂无描述")}</span>
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

  function getDominantDimension(dimensions) {
    if (typeof window.getDominantDimension === "function") {
      return window.getDominantDimension(dimensions, 0.5);
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

    if (!best || best.absValue < 0.5) return null;
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

    return `这位英雄最突出的倾向是「${label}」。在「${meta.name}」维度上，TA 更接近「${desc}」这一端。`;
  }

  function getDimensionRangeTitle(meta, value) {
    if (!meta) return formatDimensionValue(value);

    const side = value >= 0
      ? `${meta.highLabel}：${meta.highDesc}`
      : `${meta.lowLabel}：${meta.lowDesc}`;

    return `${meta.name} ${formatDimensionValue(value)}｜${side}`;
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

  // ==================== 数据工具 ====================
  function getDimensionMeta(dimensionId) {
    if (typeof window.getDimensionMeta === "function") {
      return window.getDimensionMeta(dimensionId);
    }

    return (window.dimensions || []).find((dimension) => dimension.id === dimensionId) || null;
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

  function updateResultCount(count) {
    const headerText = document.querySelector(".catalog-header p");
    if (!headerText) return;

    let countSpan = headerText.querySelector(".result-count");

    if (!countSpan) {
      countSpan = document.createElement("span");
      countSpan.className = "result-count";
      countSpan.style.marginLeft = "0.5rem";
      countSpan.style.fontSize = "0.9rem";
      countSpan.style.opacity = "0.8";
      headerText.appendChild(countSpan);
    }

    countSpan.textContent = `共 ${count} 位英雄`;
  }

  function showGridLoading(message) {
    const grid = document.getElementById("champion-grid");
    if (!grid) return;
    grid.innerHTML = `<div class="loading">${escapeHTML(message)}</div>`;
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
    rerender: applyFiltersAndRender,
    showDetailModal
  };
})();