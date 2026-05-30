// ==================== MGTI 测试核心逻辑 ====================
// My Game Type Indicator
// 本文件完全废除 MBTI 测试逻辑，改用 TAC / TEA / EMO / DEC / PRE 五维连续向量匹配。

document.addEventListener("DOMContentLoaded", async () => {
  // ==================== 常量 ====================
  const PROGRESS_KEY = "mgti_progress_v2";
  const PROGRESS_VERSION = "2.0";
  const DIMENSION_IDS = window.MGTI_DIMENSION_IDS || ["TAC", "TEA", "EMO", "DEC", "PRE"];

  // 注意：
  // 为了让题库里的 reverse 方向正确，这里的按钮 rawValue 不是“同意程度正分”，而是“低分倾向强度”。
  // 非反向题通常是低分倾向陈述：非常同意 => -2
  // 反向题通常是高分倾向陈述：非常同意 => -2，然后 reverse 后变成 +2
  const ANSWER_OPTIONS = [
    { label: "非常同意", value: -2 },
    { label: "比较同意", value: -1 },
    { label: "说不清", value: 0 },
    { label: "比较不同意", value: 1 },
    { label: "非常不同意", value: 2 }
  ];

  // ==================== DOM ====================
  const questionArea = document.getElementById("question-area");
  const resultArea = document.getElementById("result-area");
  const resumeBanner = document.getElementById("resume-banner");
  const resumeYesBtn = document.getElementById("resume-yes");
  const resumeNoBtn = document.getElementById("resume-no");

  // ==================== 状态 ====================
  let currentIndex = 0;
  let userScores = createEmptyDimensionMap();
  let dimensionCounts = createEmptyDimensionMap();
  let answerRecords = [];
  let isAnswering = false;
  let totalQuestions = 0;

  // ==================== 初始化 ====================
  try {
    showLoading("✨ 正在加载召唤师峡谷...");

    if (typeof window.loadChampions !== "function") {
      throw new Error("window.loadChampions 不存在。请确认 data.js 已在 test.js 之前引入。");
    }

    await window.loadChampions();

    if (!Array.isArray(window.questions)) {
      window.questions = [];
    }

    if (!Array.isArray(window.dimensions)) {
      window.dimensions = [];
    }

    if (!Array.isArray(window.championsData)) {
      window.championsData = [];
    }

    totalQuestions = window.questions.length;

    if (totalQuestions === 0) {
      showError("题库为空。请检查 data/questions.json 是否加载成功。");
      return;
    }

    if (window.championsData.length === 0) {
      showError("英雄数据为空。请检查 data/champions.json 和 data/heroes_profile.json 是否加载成功。");
      return;
    }

    const savedProgress = loadProgress();

    if (savedProgress && isValidProgress(savedProgress)) {
      showResumePrompt(savedProgress);
    } else {
      clearProgress();
      resetTest(false);
    }
  } catch (error) {
    console.error("[MGTI] 初始化测试失败：", error);
    showError("加载失败。请检查 data.js、questions.json、champions.json、heroes_profile.json 是否正常。");
  }

  // ==================== 渲染题目 ====================
  function renderQuestion() {
    if (!questionArea) return;

    hideResult();

    const q = window.questions[currentIndex];

    if (!q) {
      finishTest();
      return;
    }

    const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);
    const dimensionMeta = getDimensionMeta(q.dimension);
    const dimensionName = dimensionMeta?.name || q.dimension || "未知维度";

    const buttonsHtml = ANSWER_OPTIONS.map((option) => {
      return `
        <button 
          class="option-btn" 
          type="button" 
          data-value="${option.value}"
          aria-label="${escapeHTML(option.label)}"
        >
          ${escapeHTML(option.label)}
        </button>
      `;
    }).join("");

    questionArea.style.display = "block";
    questionArea.innerHTML = `
      <div class="progress-wrap" style="margin-bottom: 1.4rem;">
        <div class="progress-meta" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; color: #8d9db0; font-size: 0.85rem;">
          <span>第 ${currentIndex + 1} / ${totalQuestions} 题</span>
          <span>${progressPercent}%</span>
        </div>
        <div class="progress-bar-bg" style="width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden;">
          <div class="progress-bar-fill" style="width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, #e2b86b, #c5812e); border-radius: 999px; transition: width 0.25s ease;"></div>
        </div>
      </div>

      <div class="dimension-pill" style="text-align: center; margin-bottom: 1rem;">
        <span style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.8rem; border-radius: 999px; background: rgba(226,184,107,0.14); border: 1px solid rgba(226,184,107,0.35); color: #e2b86b; font-size: 0.8rem;">
          ${escapeHTML(dimensionName)}
        </span>
      </div>

      <h2 class="question-text">${escapeHTML(q.text || "题目加载失败")}</h2>

      <div class="options-list">
        ${buttonsHtml}
      </div>

      <div class="question-actions" style="display: flex; justify-content: center; gap: 0.8rem;">
        <button 
          id="prev-question-btn" 
          class="btn-outline" 
          type="button"
          ${currentIndex === 0 ? "disabled" : ""}
          style="${currentIndex === 0 ? "opacity: 0.45; cursor: not-allowed;" : ""}"
        >
          ← 上一题
        </button>
      </div>
    `;

    questionArea.querySelectorAll(".option-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const rawValue = Number(button.dataset.value);
        handleAnswer(rawValue);
      });
    });

    const prevButton = document.getElementById("prev-question-btn");
    if (prevButton) {
      prevButton.addEventListener("click", goToPreviousQuestion);
    }
  }

  // ==================== 处理答案 ====================
  function handleAnswer(rawValue) {
    if (isAnswering) return;

    const q = window.questions[currentIndex];
    if (!q) return;

    isAnswering = true;

    let score = Number(rawValue);
    if (!Number.isFinite(score)) score = 0;

    if (q.reverse) {
      score = -score;
    }

    answerRecords[currentIndex] = {
      questionIndex: currentIndex,
      dimension: q.dimension,
      rawValue,
      score,
      reverse: Boolean(q.reverse),
      text: q.text || ""
    };

    recalcScores();
    saveProgress();

    currentIndex += 1;

    setTimeout(() => {
      isAnswering = false;

      if (currentIndex < totalQuestions) {
        renderQuestion();
      } else {
        finishTest();
      }
    }, 300);
  }

  // ==================== 上一题 ====================
  function goToPreviousQuestion() {
    if (currentIndex === 0) return;

    currentIndex -= 1;

    // 回到上一题时，删除这道题的记录，让用户重新选择。
    delete answerRecords[currentIndex];

    recalcScores();
    saveProgress();
    renderQuestion();
  }

  // ==================== 重新计算分数 ====================
  function recalcScores() {
    userScores = createEmptyDimensionMap();
    dimensionCounts = createEmptyDimensionMap();

    answerRecords.forEach((record) => {
      if (!record || !DIMENSION_IDS.includes(record.dimension)) return;

      userScores[record.dimension] += toFiniteNumber(record.score, 0);
      dimensionCounts[record.dimension] += 1;
    });
  }

  // ==================== 完成测试 ====================
  function finishTest() {
    recalcScores();

    const userVec = getFinalUserVector();

    const rankedHeroes = window.championsData
      .map((hero) => {
        const heroVec = typeof window.getHeroVector === "function"
          ? window.getHeroVector(hero.name)
          : getHeroVectorFallback(hero);

        return {
          hero,
          heroVec,
          similarity: cosineSimilarity(userVec, heroVec)
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    const topFive = rankedHeroes.slice(0, 5);

    if (topFive.length === 0) {
      showError("没有可匹配的英雄。请检查 championsData 是否为空。");
      return;
    }

    const selected = topFive[Math.floor(Math.random() * topFive.length)];
    const matchedHero = selected.hero;

    clearProgress();

    displayResult(matchedHero, userVec, {
      similarity: selected.similarity,
      topFive
    });
  }

  function getFinalUserVector() {
    if (typeof window.getUserVectorFromScores === "function") {
      return window.getUserVectorFromScores(userScores, dimensionCounts);
    }

    return DIMENSION_IDS.map((dimensionId) => {
      const count = dimensionCounts[dimensionId] || 0;
      if (count <= 0) return 0;
      return clamp(userScores[dimensionId] / count, -2, 2);
    });
  }

  // ==================== 展示结果 ====================
  function displayResult(hero, userVec, matchInfo = {}) {
    if (!questionArea || !resultArea) return;

    questionArea.style.display = "none";
    resultArea.style.display = "block";

    const templates = window.resultTemplates || {};
    const phrases = templates.dimensionPhrases || {};
    const phraseGroup = buildUserPhraseGroup(userVec, phrases);
    const resonance = getResonanceText(userVec);
    const synergy = getRandomSynergy();
    const similarityPercent = formatSimilarity(matchInfo.similarity);

    const mainDescription = buildMainDescription({
      templates,
      phraseGroup,
      heroName: hero.name,
      resonance,
      synergy
    });

    const dimensionBarsHtml = buildUserDimensionBars(userVec);
    const topFiveHtml = buildTopFiveHtml(matchInfo.topFive || []);
    const storyExcerpt = getStoryExcerpt(hero.story);
    const heroQuote = getHeroQuote(hero);

    resultArea.innerHTML = `
      <div class="result-content">
        <div class="result-hero" style="text-align: center;">
          <div class="hero-avatar-wrap" style="display: flex; justify-content: center; margin-bottom: 1rem;">
            <img 
              src="${escapeAttribute(hero.image_url || hero.splash_url || "")}" 
              alt="${escapeAttribute(hero.name || "匹配英雄")}" 
              class="hero-avatar"
              style="width: 108px; height: 108px; object-fit: cover; border-radius: 50%; border: 2px solid #e2b86b; box-shadow: 0 0 24px rgba(226,184,107,0.35);"
              onerror="this.style.display='none';"
            >
          </div>

          <div class="result-label" style="color: #8d9db0; font-size: 0.85rem; margin-bottom: 0.35rem;">
            你的 MGTI 本命英雄是
          </div>

          <h2 style="font-size: 2rem; margin-bottom: 0.3rem; color: #f0c45a;">
            ${escapeHTML(hero.name || "未知英雄")}
          </h2>

          <p style="color: #c0cfdf; margin-bottom: 0.8rem;">
            ${escapeHTML(hero.title || "")}
          </p>

          <div style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.8rem; border-radius: 999px; background: rgba(226,184,107,0.14); border: 1px solid rgba(226,184,107,0.35); color: #e2b86b; font-size: 0.8rem; margin-bottom: 1.2rem;">
            匹配度 ${similarityPercent}
          </div>
        </div>

        <div class="result-section" style="margin-top: 1rem;">
          <h3 style="font-size: 1.05rem; color: #e9f1f7; margin-bottom: 0.8rem;">人格解读</h3>
          <p style="color: #c0cfdf; line-height: 1.8;">
            ${escapeHTML(mainDescription)}
          </p>
        </div>

        <div class="result-section" style="margin-top: 1.2rem;">
          <h3 style="font-size: 1.05rem; color: #e9f1f7; margin-bottom: 0.8rem;">你的五维画像</h3>
          ${dimensionBarsHtml}
        </div>

        <div class="result-section" style="margin-top: 1.2rem;">
          <h3 style="font-size: 1.05rem; color: #e9f1f7; margin-bottom: 0.8rem;">风格关键词</h3>
          <div class="champion-tags" style="justify-content: flex-start;">
            ${buildUserTags(userVec)}
          </div>
        </div>

        <div class="result-section" style="margin-top: 1.2rem;">
          <h3 style="font-size: 1.05rem; color: #e9f1f7; margin-bottom: 0.8rem;">英雄共鸣</h3>
          <blockquote style="margin: 0; padding: 1rem; border-left: 3px solid #e2b86b; background: rgba(255,255,255,0.04); border-radius: 12px; color: #d8e2ef; line-height: 1.8;">
            ${escapeHTML(heroQuote)}
          </blockquote>
          ${storyExcerpt ? `<p style="color: #8d9db0; line-height: 1.7; margin-top: 0.8rem;">${escapeHTML(storyExcerpt)}</p>` : ""}
        </div>

        <div class="result-section" style="margin-top: 1.2rem;">
          <h3 style="font-size: 1.05rem; color: #e9f1f7; margin-bottom: 0.8rem;">候选前五名</h3>
          ${topFiveHtml}
        </div>

        <div class="result-section" style="margin-top: 1.2rem;">
          <p style="color: #c0cfdf; line-height: 1.8;">
            ${escapeHTML(templates.defaultAdvice || "在符文之地继续你的冒险吧！")}
          </p>
          <p style="color: #8d9db0; font-size: 0.8rem; margin-top: 0.6rem;">
            MGTI · ${escapeHTML(window.MGTI_FULLNAME || "My Game Type Indicator")}
          </p>
        </div>

        <div class="result-actions" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 0.8rem; margin-top: 1.6rem;">
          <button id="restart-test-btn" class="btn-primary" type="button">重新测试</button>
          <button id="share-result-btn" class="btn-outline" type="button">分享结果</button>
          <a href="catalog.html" class="btn-outline" style="text-decoration: none;">浏览图鉴</a>
        </div>
      </div>
    `;

    const restartBtn = document.getElementById("restart-test-btn");
    const shareBtn = document.getElementById("share-result-btn");

    if (restartBtn) {
      restartBtn.addEventListener("click", () => resetTest(true));
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", () => shareResult(hero));
    }
  }

  // ==================== 结果文案 ====================
  function buildUserPhraseGroup(userVec, phrases) {
    return {
      tactics: getPhraseByVector("TAC", userVec[0], phrases),
      teamRole: getPhraseByVector("TEA", userVec[1], phrases),
      emotion: getPhraseByVector("EMO", userVec[2], phrases),
      decision: getPhraseByVector("DEC", userVec[3], phrases),
      preference: getPhraseByVector("PRE", userVec[4], phrases)
    };
  }

  function getPhraseByVector(dimensionId, value, phrases) {
    const direction = value >= 0 ? "high" : "low";
    const key = `${dimensionId}_${direction}`;

    if (phrases && phrases[key]) {
      return phrases[key];
    }

    const meta = getDimensionMeta(dimensionId);
    if (!meta) return `${dimensionId} 维度表现稳定`;

    return value >= 0
      ? `你更接近${meta.highLabel}`
      : `你更接近${meta.lowLabel}`;
  }

  function buildMainDescription({ templates, phraseGroup, heroName, resonance, synergy }) {
    const combinedTemplate = templates.combinedTemplate;
    const personalityTemplate = templates.personalityTemplate;

    const template = combinedTemplate || personalityTemplate || "{{heroName}} 与你的风格高度契合。你们都{{resonance}}。";

    return template
      .replaceAll("{{tactics}}", phraseGroup.tactics)
      .replaceAll("{{teamRole}}", phraseGroup.teamRole)
      .replaceAll("{{emotion}}", phraseGroup.emotion)
      .replaceAll("{{decision}}", phraseGroup.decision)
      .replaceAll("{{preference}}", phraseGroup.preference)
      .replaceAll("{{heroName}}", heroName || "这位英雄")
      .replaceAll("{{resonance}}", resonance)
      .replaceAll("{{synergy}}", synergy);
  }

  function getResonanceText(userVec) {
    const dominant = getDominantUserDimension(userVec);

    if (!dominant) {
      return "拥有均衡而灵活的战斗气质";
    }

    const meta = getDimensionMeta(dominant.id);
    if (!meta) {
      return "拥有鲜明的战斗风格";
    }

    const label = dominant.value >= 0 ? meta.highLabel : meta.lowLabel;
    const desc = dominant.value >= 0 ? meta.highDesc : meta.lowDesc;

    return `展现出强烈的「${label}」气质，${desc}`;
  }

  function getRandomSynergy() {
    const synergies = window.resultTemplates?.synergies;

    if (Array.isArray(synergies) && synergies.length > 0) {
      return synergies[Math.floor(Math.random() * synergies.length)];
    }

    return "展现完美的契合";
  }

  function getHeroQuote(hero) {
    if (hero.quote) return hero.quote;
    if (hero.title) return `“${hero.title}”的气质，正与你此刻的峡谷人格产生共鸣。`;
    return "真正的英雄，永远会在自己的召唤师峡谷里找到答案。";
  }

  function getStoryExcerpt(story) {
    if (!story || typeof story !== "string") return "";

    const clean = story.replace(/\s+/g, " ").trim();

    if (!clean) return "";

    return clean.length > 120 ? `${clean.slice(0, 120)}...` : clean;
  }

  // ==================== 维度展示 ====================
  function buildUserDimensionBars(userVec) {
    const items = DIMENSION_IDS.map((dimensionId, index) => {
      const value = toFiniteNumber(userVec[index], 0);
      const meta = getDimensionMeta(dimensionId);
      const label = meta?.name || dimensionId;
      const percent = ((value + 2) / 4) * 100;

      return `
        <div class="dimension-item">
          <div class="dim-label">${escapeHTML(label)}</div>
          <div class="dim-bar-bg">
            <div class="dim-bar-fill" style="width: ${clamp(percent, 0, 100)}%;"></div>
          </div>
          <div class="dim-value">${value.toFixed(2)}</div>
        </div>
      `;
    }).join("");

    return `<div class="dimension-bars">${items}</div>`;
  }

  function buildUserTags(userVec) {
    return DIMENSION_IDS.map((dimensionId, index) => {
      const value = toFiniteNumber(userVec[index], 0);
      const meta = getDimensionMeta(dimensionId);

      if (!meta) {
        return `<span class="tag">${escapeHTML(dimensionId)}</span>`;
      }

      const label = value >= 0 ? meta.highLabel : meta.lowLabel;
      return `<span class="tag">${escapeHTML(label)}</span>`;
    }).join("");
  }

  function buildTopFiveHtml(topFive) {
    if (!Array.isArray(topFive) || topFive.length === 0) {
      return `<p style="color: #8d9db0;">暂无候选英雄。</p>`;
    }

    const rows = topFive.map((item, index) => {
      const hero = item.hero || {};
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; padding: 0.65rem 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="display: flex; align-items: center; gap: 0.7rem; min-width: 0;">
            <span style="color: #e2b86b; width: 1.5rem;">${index + 1}</span>
            <img 
              src="${escapeAttribute(hero.image_url || "")}" 
              alt="${escapeAttribute(hero.name || "")}"
              style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover;"
              onerror="this.style.display='none';"
            >
            <div style="min-width: 0;">
              <div style="color: #e9f1f7;">${escapeHTML(hero.name || "未知英雄")}</div>
              <div style="color: #8d9db0; font-size: 0.75rem;">${escapeHTML(hero.title || "")}</div>
            </div>
          </div>
          <div style="color: #e2b86b; font-size: 0.85rem; white-space: nowrap;">
            ${formatSimilarity(item.similarity)}
          </div>
        </div>
      `;
    }).join("");

    return `<div style="background: rgba(255,255,255,0.035); border-radius: 16px; padding: 0.4rem 0.9rem;">${rows}</div>`;
  }

  function getDominantUserDimension(userVec) {
    let best = null;

    DIMENSION_IDS.forEach((dimensionId, index) => {
      const value = toFiniteNumber(userVec[index], 0);
      const absValue = Math.abs(value);

      if (!best || absValue > best.absValue) {
        best = {
          id: dimensionId,
          value,
          absValue
        };
      }
    });

    if (!best || best.absValue < 0.3) return null;
    return best;
  }

  // ==================== 进度保存与恢复 ====================
  function saveProgress() {
    const payload = {
      version: PROGRESS_VERSION,
      currentIndex,
      userScores,
      dimensionCounts,
      answerRecords,
      totalQuestions,
      savedAt: Date.now()
    };

    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("[MGTI] 保存进度失败：", error);
    }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn("[MGTI] 读取进度失败：", error);
      return null;
    }
  }

  function clearProgress() {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch (error) {
      console.warn("[MGTI] 清除进度失败：", error);
    }
  }

  function isValidProgress(progress) {
    if (!progress || progress.version !== PROGRESS_VERSION) return false;
    if (!Number.isInteger(progress.currentIndex)) return false;
    if (progress.currentIndex < 0 || progress.currentIndex >= totalQuestions) return false;
    if (!Array.isArray(progress.answerRecords)) return false;
    return true;
  }

  function showResumePrompt(savedProgress) {
    if (!resumeBanner || !resumeYesBtn || !resumeNoBtn) {
      const shouldResume = window.confirm("检测到未完成的 MGTI 测试，是否继续？");

      if (shouldResume) {
        restoreProgress(savedProgress);
      } else {
        clearProgress();
        resetTest(false);
      }

      return;
    }

    resumeBanner.style.display = "block";

    resumeYesBtn.onclick = () => {
      resumeBanner.style.display = "none";
      restoreProgress(savedProgress);
    };

    resumeNoBtn.onclick = () => {
      resumeBanner.style.display = "none";
      clearProgress();
      resetTest(false);
    };
  }

  function restoreProgress(progress) {
    currentIndex = progress.currentIndex;
    userScores = normalizeSavedDimensionMap(progress.userScores);
    dimensionCounts = normalizeSavedDimensionMap(progress.dimensionCounts);
    answerRecords = Array.isArray(progress.answerRecords) ? progress.answerRecords : [];

    recalcScores();
    renderQuestion();
  }

  function resetTest(shouldScrollTop = true) {
    currentIndex = 0;
    userScores = createEmptyDimensionMap();
    dimensionCounts = createEmptyDimensionMap();
    answerRecords = [];
    isAnswering = false;

    clearProgress();
    hideResult();
    renderQuestion();

    if (shouldScrollTop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ==================== 分享 ====================
  async function shareResult(hero) {
    const templates = window.resultTemplates || {};
    const shareTemplate = templates.shareTemplate || "我在 MGTI 人格测试中的本命英雄是 {{heroName}}！你也来找找属于你的英雄吧~";
    const text = shareTemplate.replaceAll("{{heroName}}", hero.name || "未知英雄");
    const url = window.location.href.split("#")[0];

    const shareData = {
      title: "MGTI 英雄联盟人格测试",
      text,
      url
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await copyText(`${text} ${url}`);
      showToast("分享文案已复制到剪贴板。");
    } catch (error) {
      console.warn("[MGTI] 分享失败：", error);

      try {
        await copyText(`${text} ${url}`);
        showToast("分享文案已复制到剪贴板。");
      } catch (copyError) {
        console.warn("[MGTI] 复制失败：", copyError);
        showToast("分享失败，请手动复制页面链接。");
      }
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";

    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  // ==================== 算法函数 ====================
  function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;

    const length = Math.min(vecA.length, vecB.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < length; i += 1) {
      const a = toFiniteNumber(vecA[i], 0);
      const b = toFiniteNumber(vecB[i], 0);

      dot += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  function getHeroVectorFallback(hero) {
    const dimensions = hero?.dimensions || {};
    return DIMENSION_IDS.map((dimensionId) => {
      return toFiniteNumber(dimensions[dimensionId], 0);
    });
  }

  // ==================== UI 工具 ====================
  function showLoading(message) {
    if (!questionArea) return;

    questionArea.style.display = "block";
    questionArea.innerHTML = `<div class="loading">${escapeHTML(message)}</div>`;
  }

  function showError(message) {
    if (!questionArea) return;

    questionArea.style.display = "block";
    questionArea.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.8rem;">⚠️</div>
        <h2 style="margin-bottom: 0.8rem;">加载失败</h2>
        <p style="color: #c0cfdf; line-height: 1.8;">${escapeHTML(message)}</p>
        <button id="reload-page-btn" class="btn-primary" type="button" style="margin-top: 1.2rem;">重新加载</button>
      </div>
    `;

    const reloadBtn = document.getElementById("reload-page-btn");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => window.location.reload());
    }
  }

  function hideResult() {
    if (resultArea) {
      resultArea.style.display = "none";
      resultArea.innerHTML = "";
    }

    if (questionArea) {
      questionArea.style.display = "block";
    }
  }

  function showToast(message) {
    const oldToast = document.getElementById("mgti-toast");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.id = "mgti-toast";
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.left = "50%";
    toast.style.bottom = "24px";
    toast.style.transform = "translateX(-50%)";
    toast.style.zIndex = "9999";
    toast.style.padding = "0.75rem 1rem";
    toast.style.borderRadius = "999px";
    toast.style.background = "rgba(20, 28, 38, 0.95)";
    toast.style.border = "1px solid rgba(226, 184, 107, 0.55)";
    toast.style.color = "#e2b86b";
    toast.style.boxShadow = "0 12px 30px rgba(0,0,0,0.35)";
    toast.style.fontSize = "0.9rem";

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2200);
  }

  // ==================== 通用工具 ====================
  function createEmptyDimensionMap() {
    return DIMENSION_IDS.reduce((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {});
  }

  function normalizeSavedDimensionMap(value) {
    const result = createEmptyDimensionMap();

    if (!value || typeof value !== "object") {
      return result;
    }

    DIMENSION_IDS.forEach((id) => {
      result[id] = toFiniteNumber(value[id], 0);
    });

    return result;
  }

  function getDimensionMeta(dimensionId) {
    if (typeof window.getDimensionMeta === "function") {
      return window.getDimensionMeta(dimensionId);
    }

    return (window.dimensions || []).find((item) => item.id === dimensionId) || null;
  }

  function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min = -2, max = 2) {
    return Math.min(max, Math.max(min, value));
  }

  function formatSimilarity(value) {
    const number = toFiniteNumber(value, 0);
    const normalized = Math.max(0, Math.min(1, (number + 1) / 2));
    return `${Math.round(normalized * 100)}%`;
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

  // 方便你在浏览器控制台调试。
  window.MGTITestDebug = {
    getState: () => ({
      currentIndex,
      userScores,
      dimensionCounts,
      answerRecords,
      totalQuestions
    }),
    resetTest,
    finishTest,
    cosineSimilarity
  };
});