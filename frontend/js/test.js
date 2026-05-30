// ==================== MGTI 测试核心逻辑 ====================
// My Game Type Indicator
// 本文件完全废除 MBTI 测试逻辑，改用 TAC / TEA / EMO / DEC / PRE 五维连续向量匹配。

document.addEventListener("DOMContentLoaded", async () => {
  // ==================== 常量 ====================
  const PROGRESS_KEY = "mgti_progress_v2";
  const PROGRESS_VERSION = "2.0";
  const DIMENSION_IDS = window.MGTI_DIMENSION_IDS || ["TAC", "TEA", "EMO", "DEC", "PRE"];
  const ANSWER_THROTTLE_MS = 300;
  const SCORE_MIN = -2;
  const SCORE_MAX = 2;
  const CONSISTENCY_SIGNIFICANT_RAW_ABS = 1;

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
  let lastAnswerTime = 0;
  let totalQuestions = 0;
  let consistencyReport = createEmptyConsistencyReport();

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
    const now = Date.now();

    if (isAnswering) return;
    if (now - lastAnswerTime < ANSWER_THROTTLE_MS) return;

    const q = window.questions[currentIndex];
    if (!q) return;

    lastAnswerTime = now;
    isAnswering = true;

    let rawScore = Number(rawValue);
    if (!Number.isFinite(rawScore)) rawScore = 0;
    rawScore = clamp(rawScore, SCORE_MIN, SCORE_MAX);

    let score = rawScore;
    if (q.reverse) {
      score = -score;
    }

    const weight = normalizeQuestionWeight(q.weight);

    answerRecords[currentIndex] = {
      questionIndex: currentIndex,
      questionId: q.id || `Q${String(currentIndex + 1).padStart(2, "0")}`,
      dimension: q.dimension,
      polarity: q.polarity || inferQuestionPolarity(q),
      rawValue: rawScore,
      rawLabel: getAnswerLabelByValue(rawScore),
      score,
      weightedScore: score * weight,
      weight,
      reverse: Boolean(q.reverse),
      consistencyPairId: q.consistencyPairId || "",
      tags: Array.isArray(q.tags) ? q.tags.slice(0, 6) : [],
      text: q.text || "",
      answeredAt: now
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
    }, ANSWER_THROTTLE_MS);
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

      const weight = normalizeQuestionWeight(record.weight);
      const baseScore = toFiniteNumber(record.score, 0);

      userScores[record.dimension] += baseScore * weight;
      dimensionCounts[record.dimension] += weight;
    });

    consistencyReport = calculateConsistencyReport(answerRecords);
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
      topFive,
      rankedHeroes,
      consistencyReport
    });
  }

  function getFinalUserVector() {
    if (typeof window.getUserVectorFromScores === "function") {
      return window.getUserVectorFromScores(userScores, dimensionCounts);
    }

    return DIMENSION_IDS.map((dimensionId) => {
      const count = dimensionCounts[dimensionId] || 0;
      if (count <= 0) return 0;
      return clamp(userScores[dimensionId] / count, SCORE_MIN, SCORE_MAX);
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

    const activeConsistencyReport = matchInfo.consistencyReport || consistencyReport || createEmptyConsistencyReport();
    const dimensionBarsHtml = buildUserDimensionBars(userVec);
    const dimensionExplanationHtml = buildDimensionExplanationHtml(userVec);
    const consistencyWarningHtml = buildConsistencyWarningHtml(activeConsistencyReport);
    const dominantAdviceHtml = buildDominantAdviceHtml(userVec);
    const roleAdviceHtml = buildRoleAdviceHtml(hero);
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

        ${consistencyWarningHtml}

        <div class="result-section" style="margin-top: 1rem;">
          <h3 style="font-size: 1.05rem; color: #e9f1f7; margin-bottom: 0.8rem;">人格解读</h3>
          <p style="color: #c0cfdf; line-height: 1.8;">
            ${escapeHTML(mainDescription)}
          </p>
        </div>

        <div class="result-section" style="margin-top: 1.2rem;">
          <h3 style="font-size: 1.05rem; color: #e9f1f7; margin-bottom: 0.8rem;">你的五维画像</h3>
          ${dimensionBarsHtml}
          ${dimensionExplanationHtml}
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

        ${dominantAdviceHtml}
        ${roleAdviceHtml}

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
      restartBtn.addEventListener("click", () => confirmAndResetTest());
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
      const band = getScoreBand(dimensionId, value);
      const percent = ((value - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100;

      return `
        <div class="dimension-item">
          <div class="dim-label">${escapeHTML(label)}</div>
          <div class="dim-bar-bg">
            <div class="dim-bar-fill" style="width: ${clamp(percent, 0, 100)}%;"></div>
          </div>
          <div class="dim-value" title="${escapeAttribute(band.label)}">${value.toFixed(2)}</div>
        </div>
      `;
    }).join("");

    return `<div class="dimension-bars">${items}</div>`;
  }

  function buildDimensionExplanationHtml(userVec) {
    const templates = window.resultTemplates || {};
    const explanations = templates.dimensionExplanations || {};

    const items = DIMENSION_IDS.map((dimensionId, index) => {
      const value = toFiniteNumber(userVec[index], 0);
      const meta = getDimensionMeta(dimensionId);
      const band = getScoreBand(dimensionId, value);
      const directionKey = getDirectionKey(value);
      const text = explanations?.[dimensionId]?.[directionKey]
        || getFallbackDimensionExplanation(meta, value);

      const leftLabel = meta?.lowLabel || "低分倾向";
      const rightLabel = meta?.highLabel || "高分倾向";
      const tendency = value > 0.5
        ? `更接近「${rightLabel}」`
        : value < -0.5
          ? `更接近「${leftLabel}」`
          : `处在「${leftLabel}」与「${rightLabel}」之间`;

      return `
        <div class="dimension-explanation-item" style="padding: 0.85rem 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <div style="display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; margin-bottom: 0.35rem;">
            <strong style="color: #e9f1f7;">${escapeHTML(meta?.name || dimensionId)}</strong>
            <span style="color: #e2b86b; font-size: 0.78rem; white-space: nowrap;">${escapeHTML(band.label)}</span>
          </div>
          <p style="color: #c0cfdf; line-height: 1.75; margin: 0;">
            ${escapeHTML(tendency)}。${escapeHTML(text)}
          </p>
        </div>
      `;
    }).join("");

    return `
      <div id="dimension-explanation" class="dimension-explanation" style="margin-top: 1rem; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 0.2rem 0.9rem;">
        ${items}
      </div>
    `;
  }

  function getFallbackDimensionExplanation(meta, value) {
    if (!meta) return "该维度代表你在游戏行为中的稳定倾向。";

    if (value > 0.5) return meta.highDesc || "你更偏向该维度的高分侧行为。";
    if (value < -0.5) return meta.lowDesc || "你更偏向该维度的低分侧行为。";

    return `你会在「${meta.lowLabel || "低分侧"}」和「${meta.highLabel || "高分侧"}」之间切换，具体表现取决于英雄、阵容和局势。`;
  }

  function buildConsistencyWarningHtml(report) {
    if (!report || !report.shouldWarn) return "";

    const template = window.resultTemplates?.consistencyWarning || {};
    const title = template.title || "答案一致性提醒";
    const message = report.level === "strong"
      ? (template.strong || report.warningText)
      : (template.soft || report.warningText);

    const detailItems = (report.details || []).slice(0, 3).map((item) => {
      const dimensionMeta = getDimensionMeta(item.dimension);
      return `
        <li style="margin-top: 0.35rem; color: #c0cfdf; line-height: 1.65;">
          ${escapeHTML(dimensionMeta?.name || item.dimension || "相关维度")}：${escapeHTML(item.reason || "两道相反题选择方向接近。")}
        </li>
      `;
    }).join("");

    return `
      <div class="consistency-warning" style="margin-top: 1rem; padding: 1rem; border-radius: 16px; border: 1px solid rgba(255,107,107,0.42); background: rgba(255,107,107,0.08);">
        <div style="display: flex; justify-content: space-between; gap: 0.8rem; align-items: center; margin-bottom: 0.45rem;">
          <h3 style="font-size: 1rem; color: #ffb4b4; margin: 0;">⚠️ ${escapeHTML(title)}</h3>
          <span style="color: #ffb4b4; font-size: 0.78rem; white-space: nowrap;">一致性 ${report.consistencyScore}%</span>
        </div>
        <p style="color: #f0c7c7; line-height: 1.75; margin: 0;">${escapeHTML(message)}</p>
        ${detailItems ? `<ul style="margin: 0.55rem 0 0 1.1rem; padding: 0;">${detailItems}</ul>` : ""}
      </div>
    `;
  }

  function buildDominantAdviceHtml(userVec) {
    const dominant = getDominantUserDimension(userVec);
    const adviceMap = window.resultTemplates?.resultAdviceByDominantDimension || {};

    if (!dominant || dominant.absValue < 0.5) return "";

    const key = `${dominant.id}_${dominant.value >= 0 ? "high" : "low"}`;
    const advice = adviceMap[key];
    if (!advice) return "";

    const meta = getDimensionMeta(dominant.id);
    return `
      <div class="result-section" style="margin-top: 1.2rem;">
        <h3 style="font-size: 1.05rem; color: #e9f1f7; margin-bottom: 0.8rem;">主导倾向建议</h3>
        <p style="color: #c0cfdf; line-height: 1.8;">
          你最鲜明的维度是「${escapeHTML(meta?.name || dominant.id)}」。${escapeHTML(advice)}
        </p>
      </div>
    `;
  }

  function buildRoleAdviceHtml(hero) {
    const roles = Array.isArray(hero?.roles) ? hero.roles : [];
    const roleDescriptions = window.resultTemplates?.roleDescriptions || {};
    const roleSuggestions = window.resultTemplates?.roleSuggestions || {};

    const items = roles.slice(0, 2).map((role) => {
      const desc = roleDescriptions[role];
      const suggestions = Array.isArray(roleSuggestions[role]) ? roleSuggestions[role].slice(0, 2) : [];
      if (!desc && suggestions.length === 0) return "";

      return `
        <div style="padding: 0.85rem 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <strong style="color: #e2b86b;">${escapeHTML(getRoleLabel(role))}</strong>
          ${desc ? `<p style="color: #c0cfdf; line-height: 1.75; margin: 0.35rem 0 0;">${escapeHTML(desc)}</p>` : ""}
          ${suggestions.length ? `<ul style="margin: 0.45rem 0 0 1.1rem; padding: 0; color: #8d9db0; line-height: 1.7;">${suggestions.map((text) => `<li>${escapeHTML(text)}</li>`).join("")}</ul>` : ""}
        </div>
      `;
    }).join("");

    if (!items.trim()) return "";

    return `
      <div class="result-section" style="margin-top: 1.2rem;">
        <h3 style="font-size: 1.05rem; color: #e9f1f7; margin-bottom: 0.8rem;">匹配英雄打法建议</h3>
        <div style="background: rgba(255,255,255,0.035); border-radius: 16px; padding: 0.15rem 0.9rem;">
          ${items}
        </div>
      </div>
    `;
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

  // ==================== 答案一致性与计分辅助 ====================
  function normalizeQuestionWeight(value) {
    const weight = toFiniteNumber(value, 1);
    if (weight <= 0) return 1;
    return clamp(weight, 0.25, 3);
  }

  function inferQuestionPolarity(question) {
    if (question?.polarity === "high" || question?.polarity === "low") {
      return question.polarity;
    }
    return question?.reverse ? "high" : "low";
  }

  function getAnswerLabelByValue(value) {
    const option = ANSWER_OPTIONS.find((item) => item.value === Number(value));
    return option?.label || "未选择";
  }

  function createEmptyConsistencyReport() {
    return {
      enabled: false,
      answeredPairs: 0,
      contradictionCount: 0,
      strongContradictionCount: 0,
      consistencyScore: 100,
      shouldWarn: false,
      level: "ok",
      details: [],
      warningText: "部分答案可能存在矛盾，建议重新测试。"
    };
  }

  function calculateConsistencyReport(records) {
    const meta = window.questionMeta?.consistency || {};
    const enabled = meta.enabled !== false;
    const pairs = getConsistencyPairs(meta);

    if (!enabled || pairs.length === 0) {
      return createEmptyConsistencyReport();
    }

    const report = {
      ...createEmptyConsistencyReport(),
      enabled: true,
      warningText: meta.suggestedWarningText || "部分答案之间存在明显矛盾，结果可能不够稳定。建议重新测试。"
    };

    const recordMap = buildAnswerRecordMap(records);
    const strongAbs = Math.max(
      CONSISTENCY_SIGNIFICANT_RAW_ABS,
      toFiniteNumber(meta.strongContradictionRawAbs, 2)
    );

    pairs.forEach((pair) => {
      const lowRecord = recordMap.get(pair.lowQuestionId);
      const highRecord = recordMap.get(pair.highQuestionId);

      if (!lowRecord || !highRecord) return;

      const lowRaw = toFiniteNumber(lowRecord.rawValue, 0);
      const highRaw = toFiniteNumber(highRecord.rawValue, 0);

      if (Math.abs(lowRaw) < CONSISTENCY_SIGNIFICANT_RAW_ABS || Math.abs(highRaw) < CONSISTENCY_SIGNIFICANT_RAW_ABS) {
        return;
      }

      report.answeredPairs += 1;

      const sameAgreeDirection = lowRaw < 0 && highRaw < 0;
      const sameRejectDirection = lowRaw > 0 && highRaw > 0;
      const contradicted = sameAgreeDirection || sameRejectDirection;

      if (!contradicted) return;

      const isStrong = Math.abs(lowRaw) >= strongAbs && Math.abs(highRaw) >= strongAbs;
      report.contradictionCount += 1;
      if (isStrong) report.strongContradictionCount += 1;

      report.details.push({
        id: pair.id,
        dimension: pair.dimension,
        reason: pair.reason,
        lowQuestionId: pair.lowQuestionId,
        highQuestionId: pair.highQuestionId,
        lowAnswer: lowRecord.rawLabel || getAnswerLabelByValue(lowRaw),
        highAnswer: highRecord.rawLabel || getAnswerLabelByValue(highRaw),
        strong: isStrong
      });
    });

    if (report.answeredPairs > 0) {
      report.consistencyScore = Math.max(
        0,
        Math.round((1 - report.contradictionCount / report.answeredPairs) * 100)
      );
    }

    const minAnsweredPairs = Math.max(1, toFiniteNumber(meta.minAnsweredPairs, 3));
    const contradictionThreshold = Math.max(1, toFiniteNumber(meta.contradictionThreshold, 3));

    report.shouldWarn = report.answeredPairs >= minAnsweredPairs
      && (
        report.contradictionCount >= contradictionThreshold
        || report.strongContradictionCount >= Math.max(2, Math.ceil(contradictionThreshold / 2))
      );

    report.level = report.strongContradictionCount >= 2 || report.contradictionCount >= contradictionThreshold
      ? "strong"
      : report.contradictionCount > 0
        ? "soft"
        : "ok";

    return report;
  }

  function buildAnswerRecordMap(records) {
    const map = new Map();

    (records || []).forEach((record) => {
      if (!record) return;
      const question = window.questions?.[record.questionIndex];
      const id = record.questionId || question?.id;
      if (!id) return;

      map.set(id, {
        ...record,
        questionId: id,
        rawLabel: record.rawLabel || getAnswerLabelByValue(record.rawValue)
      });
    });

    return map;
  }

  function getConsistencyPairs(meta) {
    if (Array.isArray(meta?.pairs) && meta.pairs.length > 0) {
      return meta.pairs
        .map(normalizeConsistencyPair)
        .filter(Boolean);
    }

    return buildConsistencyPairsFromQuestions();
  }

  function normalizeConsistencyPair(pair) {
    if (!pair || !pair.lowQuestionId || !pair.highQuestionId) return null;

    return {
      id: pair.id || `${pair.lowQuestionId}__${pair.highQuestionId}`,
      dimension: pair.dimension || "",
      lowQuestionId: pair.lowQuestionId,
      highQuestionId: pair.highQuestionId,
      relation: pair.relation || "opposite",
      reason: pair.reason || "两道相反题的回答方向接近。"
    };
  }

  function buildConsistencyPairsFromQuestions() {
    const groups = new Map();

    (window.questions || []).forEach((question) => {
      if (!question?.consistencyPairId) return;
      if (!groups.has(question.consistencyPairId)) {
        groups.set(question.consistencyPairId, []);
      }
      groups.get(question.consistencyPairId).push(question);
    });

    const pairs = [];
    groups.forEach((items, id) => {
      const low = items.find((item) => inferQuestionPolarity(item) === "low");
      const high = items.find((item) => inferQuestionPolarity(item) === "high");
      if (!low || !high) return;

      pairs.push({
        id,
        dimension: low.dimension || high.dimension || "",
        lowQuestionId: low.id,
        highQuestionId: high.id,
        relation: "opposite",
        reason: "这两道题分别描述同一维度的低分侧与高分侧行为。"
      });
    });

    return pairs;
  }

  // ==================== 进度保存与恢复 ====================
  function saveProgress() {
    const payload = {
      version: PROGRESS_VERSION,
      currentIndex,
      userScores,
      dimensionCounts,
      answerRecords,
      consistencyReport,
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
    lastAnswerTime = 0;
    consistencyReport = createEmptyConsistencyReport();

    clearProgress();
    hideResult();
    renderQuestion();

    if (shouldScrollTop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function confirmAndResetTest() {
    const confirmed = window.confirm("重新测试将丢失当前所有答案，确定吗？");
    if (!confirmed) return;
    resetTest(true);
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
    if (typeof window.showUserError === "function") {
      window.showUserError(message);
    }

    if (!questionArea) return;

    questionArea.style.display = "block";
    questionArea.innerHTML = `
      <div class="mgti-error-card" style="text-align: center;">
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

  function getScoreBand(dimensionId, value) {
    const number = toFiniteNumber(value, 0);
    const meta = getDimensionMeta(dimensionId);
    const bands = Array.isArray(meta?.scoreBands) ? meta.scoreBands : [];

    const matched = bands.find((band) => {
      const min = toFiniteNumber(band.min, SCORE_MIN);
      const max = toFiniteNumber(band.max, SCORE_MAX);
      return number >= min && number <= max;
    });

    if (matched) {
      return {
        label: matched.label || getFallbackScoreBandLabel(number),
        desc: matched.desc || ""
      };
    }

    return {
      label: getFallbackScoreBandLabel(number),
      desc: ""
    };
  }

  function getFallbackScoreBandLabel(value) {
    if (value >= 1.2) return window.resultTemplates?.scoreBandLabels?.veryHigh || "强高分倾向";
    if (value >= 0.4) return window.resultTemplates?.scoreBandLabels?.high || "偏高分倾向";
    if (value <= -1.2) return window.resultTemplates?.scoreBandLabels?.veryLow || "强低分倾向";
    if (value <= -0.4) return window.resultTemplates?.scoreBandLabels?.low || "偏低分倾向";
    return window.resultTemplates?.scoreBandLabels?.neutral || "均衡倾向";
  }

  function getDirectionKey(value) {
    if (value > 0.5) return "high";
    if (value < -0.5) return "low";
    return "mid";
  }

  function getRoleLabel(role) {
    const labels = {
      assassin: "刺客",
      fighter: "战士",
      mage: "法师",
      marksman: "射手",
      support: "辅助",
      tank: "坦克"
    };

    return labels[role] || role || "未知定位";
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
      totalQuestions,
      consistencyReport,
      questionMeta: window.questionMeta || null
    }),
    recalcScores,
    resetTest,
    finishTest,
    calculateConsistencyReport,
    cosineSimilarity
  };
});