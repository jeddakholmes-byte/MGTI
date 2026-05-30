// ==================== MGTI 测试核心逻辑 ====================
// My Game Type Indicator
// V5.1: 修复选项高亮残留与焦点黏滞问题，保留阶段性选择页与匿名答题记录提交。

document.addEventListener("DOMContentLoaded", async () => {
  const PROGRESS_KEY = "mgti_progress_v5_answer_state_fix";
  const PROGRESS_VERSION = "5.1-answer-state-fix";
  const DIMENSION_IDS = window.MGTI_DIMENSION_IDS || ["TAC", "TEA", "EMO", "DEC", "PRE"];
  const ANSWER_THROTTLE_MS = 300;
  const SCORE_MIN = -2;
  const SCORE_MAX = 2;
  const CONSISTENCY_SIGNIFICANT_RAW_ABS = 1;
  const DEFAULT_BASE_QUESTION_COUNT = 20;
  const DEFAULT_CONTINUE_STEP_COUNT = 10;

  const ANSWER_OPTIONS = [
    { label: "非常同意", value: -2, emoji: "🔥" },
    { label: "比较同意", value: -1, emoji: "👍" },
    { label: "说不清", value: 0, emoji: "🤔" },
    { label: "比较不同意", value: 1, emoji: "🙅" },
    { label: "非常不同意", value: 2, emoji: "🧊" }
  ];

  const questionArea = document.getElementById("question-area");
  const resultArea = document.getElementById("result-area");
  const resumeBanner = document.getElementById("resume-banner");
  const resumeYesBtn = document.getElementById("resume-yes");
  const resumeNoBtn = document.getElementById("resume-no");

  let questionPool = [];
  let activeQuestions = [];
  let currentIndex = 0;
  let userScores = createEmptyDimensionMap();
  let dimensionCounts = createEmptyDimensionMap();
  let answerRecords = [];
  let isAnswering = false;
  let lastAnswerTime = 0;
  let totalQuestions = 0;
  let currentTargetCount = 0;
  let consistencyReport = createEmptyConsistencyReport();
  let lastResultPayload = null;
  let hasSubmittedAnonymousResult = false;

  try {
    showLoading("✨ 正在抽取本局峡谷精神状态题...");

    if (typeof window.loadChampions !== "function") {
      throw new Error("window.loadChampions 不存在。请确认 data.js 已在 test.js 之前引入。");
    }

    await window.loadChampions();

    questionPool = Array.isArray(window.questions) ? window.questions.slice() : [];
    activeQuestions = selectActiveQuestions(questionPool);
    window.MGTI_ACTIVE_QUESTIONS = activeQuestions;
    currentTargetCount = getInitialQuestionTarget();
    totalQuestions = currentTargetCount;

    if (!activeQuestions.length || !totalQuestions) {
      showError("题库为空或抽题失败。请检查 data/questions.json。", true);
      return;
    }

    if (!Array.isArray(window.championsData) || window.championsData.length === 0) {
      showError("英雄数据为空。请检查 data/champions.json 和 data/heroes_profile.json。", true);
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
    showError("加载失败。请检查 data.js、questions.json、champions.json、heroes_profile.json 是否正常。", true);
  }

  function selectActiveQuestions(pool) {
    const questions = Array.isArray(pool) ? pool.filter(Boolean) : [];
    const sampling = window.questionMeta?.sampling || {};

    if (!questions.length) return [];

    if (sampling.enabled === false) {
      return shuffleArray(questions).map((question, index) => ({
        ...question,
        _activeIndex: index,
        _poolId: question.id || `Q${index + 1}`
      }));
    }

    // 渐进式抽题：保留完整 80 题候选池，但按“每轮每维度一组相反题”的方式排列。
    // 这样前 20 道天然覆盖五个维度，每个维度 2 组题；继续做 10 道时也会均衡追加。
    if (sampling.strategy === "progressive-choice-balanced-pairs" || sampling.showChoiceAfterBase === true) {
      return buildProgressiveQuestionList(questions, sampling);
    }

    // 向后兼容旧版：固定抽取若干组题。
    const pairsPerDimension = Math.max(1, Number(sampling.pairsPerDimension || 3));
    const fallbackQuestionsPerDimension = Math.max(1, Number(sampling.questionsPerDimension || pairsPerDimension * 2));
    const selected = [];

    DIMENSION_IDS.forEach((dimensionId) => {
      const dimQuestions = questions.filter((q) => q.dimension === dimensionId);
      const pairGroups = groupQuestionsByPair(dimQuestions);
      const validPairs = pairGroups.filter((group) => group.low && group.high);

      if (validPairs.length) {
        const sampledPairs = shuffleArray(validPairs).slice(0, Math.min(pairsPerDimension, validPairs.length));
        sampledPairs.forEach((pair) => {
          const items = sampling.shuffleWithinPairs === false ? [pair.low, pair.high] : shuffleArray([pair.low, pair.high]);
          selected.push(...items);
        });
        return;
      }

      selected.push(...shuffleArray(dimQuestions).slice(0, fallbackQuestionsPerDimension));
    });

    const finalList = sampling.shuffleQuestions === false ? selected : shuffleArray(selected);
    return finalList.map((question, index) => ({
      ...question,
      _activeIndex: index,
      _poolId: question.id || `Q${index + 1}`
    }));
  }

  function buildProgressiveQuestionList(questions, sampling = {}) {
    const selected = [];
    const perDimensionPairs = new Map();
    const maxPairsByDimension = [];

    DIMENSION_IDS.forEach((dimensionId) => {
      const dimQuestions = questions.filter((q) => q.dimension === dimensionId);
      const pairGroups = groupQuestionsByPair(dimQuestions);
      const validPairs = pairGroups.filter((group) => group.low && group.high);

      if (!validPairs.length) {
        perDimensionPairs.set(dimensionId, []);
        maxPairsByDimension.push(0);
        return;
      }

      const shuffledPairs = shuffleArray(validPairs);
      perDimensionPairs.set(dimensionId, shuffledPairs);
      maxPairsByDimension.push(shuffledPairs.length);
    });

    const maxPairRounds = Math.max(0, ...maxPairsByDimension);

    for (let round = 0; round < maxPairRounds; round += 1) {
      DIMENSION_IDS.forEach((dimensionId) => {
        const pair = perDimensionPairs.get(dimensionId)?.[round];
        if (!pair) return;
        const items = sampling.shuffleWithinPairs === false ? [pair.low, pair.high] : shuffleArray([pair.low, pair.high]);
        selected.push(...items);
      });
    }

    // 如果某些题没有配对，也不要丢弃，放到最后作为高阶补充题。
    const selectedIds = new Set(selected.map((q) => q.id).filter(Boolean));
    const leftovers = questions.filter((q) => !selectedIds.has(q.id));
    selected.push(...shuffleArray(leftovers));

    const maxQuestions = getConfiguredMaxQuestions(sampling, selected.length);
    return selected.slice(0, maxQuestions).map((question, index) => ({
      ...question,
      _activeIndex: index,
      _poolId: question.id || `Q${index + 1}`
    }));
  }

  function getConfiguredMaxQuestions(sampling = window.questionMeta?.sampling || {}, fallback = activeQuestions.length || questionPool.length) {
    const configured = Number(sampling.maxQuestions || sampling.totalCandidateQuestions || fallback);
    if (!Number.isFinite(configured) || configured <= 0) return fallback;
    return Math.min(configured, fallback || configured);
  }

  function getInitialQuestionTarget() {
    const sampling = window.questionMeta?.sampling || {};
    const configured = Number(sampling.baseQuestionCount || sampling.totalQuestions || DEFAULT_BASE_QUESTION_COUNT);
    const base = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_BASE_QUESTION_COUNT;
    return clampQuestionTarget(base);
  }

  function getContinueStepCount() {
    const sampling = window.questionMeta?.sampling || {};
    const configured = Number(sampling.continueStepQuestions || DEFAULT_CONTINUE_STEP_COUNT);
    return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_CONTINUE_STEP_COUNT;
  }

  function getMaxQuestionCount() {
    return activeQuestions.length;
  }

  function clampQuestionTarget(value) {
    const max = Math.max(1, getMaxQuestionCount() || value || DEFAULT_BASE_QUESTION_COUNT);
    const number = Math.floor(Number(value));
    if (!Number.isFinite(number) || number <= 0) return Math.min(DEFAULT_BASE_QUESTION_COUNT, max);
    return Math.min(Math.max(1, number), max);
  }

  function shouldShowResultGate() {
    const sampling = window.questionMeta?.sampling || {};
    const gateEnabled = sampling.showChoiceAfterBase !== false;
    return gateEnabled && currentIndex >= totalQuestions && currentIndex < getMaxQuestionCount();
  }

  function extendQuestionTarget() {
    const previousTarget = totalQuestions;
    const nextTarget = clampQuestionTarget(previousTarget + getContinueStepCount());
    if (nextTarget <= previousTarget) {
      finishTest();
      return;
    }
    currentTargetCount = nextTarget;
    totalQuestions = nextTarget;
    saveProgress();
    renderQuestion();
  }

  function getCoverageLabel(answeredCount, maxCount) {
    const ratio = maxCount > 0 ? answeredCount / maxCount : 0;
    if (ratio >= 0.95) return "满血算法版";
    if (ratio >= 0.65) return "高精度版";
    if (ratio >= 0.4) return "增强版";
    return "基础速测版";
  }

  function showResultChoiceGate() {
    if (!questionArea) return;
    recalcScores();
    saveProgress();
    hideResult();

    const answeredCount = Math.min(currentIndex, getMaxQuestionCount());
    const maxCount = getMaxQuestionCount();
    const nextTarget = clampQuestionTarget(totalQuestions + getContinueStepCount());
    const nextCount = Math.max(0, nextTarget - answeredCount);
    const coverage = maxCount > 0 ? Math.round((answeredCount / maxCount) * 100) : 0;
    const nextCoverage = maxCount > 0 ? Math.round((nextTarget / maxCount) * 100) : 100;
    const coverageLabel = getCoverageLabel(answeredCount, maxCount);

    questionArea.style.display = "block";
    questionArea.dataset.state = "choice-gate";
    questionArea.innerHTML = `
      <div class="choice-gate-card">
        <div class="choice-gate-eyebrow">已完成 ${answeredCount} 道 · ${coverageLabel}</div>
        <h2 class="choice-gate-title">现在可以出结果，也可以继续校准</h2>
        <p class="choice-gate-text">
          你已经完成基础题量。现在可以直接根据当前五维均值匹配本命英雄。
          也可以继续做题。继续做得越多，系统覆盖的候选题越多，随机题目带来的偏差越小，结果越接近完整算法。
        </p>

        <div class="choice-accuracy-box" aria-label="算法覆盖度">
          <div class="choice-accuracy-head">
            <span>当前题库覆盖度</span>
            <strong>${coverage}%</strong>
          </div>
          <div class="choice-accuracy-track">
            <div class="choice-accuracy-fill" style="width:${coverage}%;"></div>
          </div>
          <p>继续一次将追加 ${nextCount || 0} 道题，覆盖度提升到约 ${nextCoverage}%。做得越多，五维画像越稳定。</p>
        </div>

        <div class="choice-gate-actions">
          <button id="show-result-now-btn" class="btn-primary" type="button">直接出结果</button>
          ${nextCount > 0 ? `<button id="continue-more-btn" class="btn-outline" type="button">继续做 ${nextCount} 道</button>` : ""}
        </div>

        <button id="choice-prev-btn" class="choice-back-btn" type="button">← 返回上一题修改答案</button>
      </div>
    `;

    const showNowBtn = document.getElementById("show-result-now-btn");
    if (showNowBtn) showNowBtn.addEventListener("click", finishTest);

    const continueBtn = document.getElementById("continue-more-btn");
    if (continueBtn) continueBtn.addEventListener("click", extendQuestionTarget);

    const prevBtn = document.getElementById("choice-prev-btn");
    if (prevBtn) prevBtn.addEventListener("click", goToPreviousQuestion);
  }

  function groupQuestionsByPair(questions) {
    const map = new Map();
    questions.forEach((question) => {
      const key = question.consistencyPairId || `${question.dimension}-${question.id || Math.random()}`;
      if (!map.has(key)) map.set(key, { id: key, items: [] });
      map.get(key).items.push(question);
    });

    return Array.from(map.values()).map((group) => ({
      id: group.id,
      low: group.items.find((item) => inferQuestionPolarity(item) === "low"),
      high: group.items.find((item) => inferQuestionPolarity(item) === "high"),
      items: group.items
    }));
  }

  function renderQuestion() {
    if (!questionArea) return;

    // 关键修复：进入下一题前先清掉上一题的临时视觉状态和浏览器焦点。
    // 这可以避免移动端 sticky hover / focus 把上一题的高光带到下一题。
    resetTransientAnswerVisualState();
    hideResult();

    // 关键修复：只要已经达到当前阶段题量，就不再继续渲染下一题。
    // 例如基础题量为 20，道数达到 20 后必须先显示“直接出结果 / 继续做题”的选择页。
    if (currentIndex >= totalQuestions) {
      if (shouldShowResultGate()) {
        showResultChoiceGate();
      } else {
        finishTest();
      }
      return;
    }

    const q = activeQuestions[currentIndex];
    if (!q) {
      finishTest();
      return;
    }

    const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);
    const meta = getDimensionMeta(q.dimension);
    const publicName = meta?.publicName || meta?.name || q.dimension || "未知维度";
    const directionLabel = getQuestionDirectionLabel(q, meta);
    const displayText = getQuestionText(q);
    const hintText = getQuestionHint(q, meta);

    const buttonsHtml = ANSWER_OPTIONS.map((option, optionIndex) => `
      <button
        class="option-btn"
        type="button"
        data-value="${option.value}"
        data-option-index="${optionIndex}"
        data-question-index="${currentIndex}"
        aria-pressed="false"
        aria-label="${escapeAttribute(option.label)}"
        autocomplete="off"
      >
        <span class="option-emoji" aria-hidden="true">${option.emoji}</span>
        <span>${escapeHTML(option.label)}</span>
      </button>
    `).join("");

    questionArea.style.display = "block";
    questionArea.dataset.state = "question";
    questionArea.innerHTML = `
      <div class="progress-wrap">
        <div class="progress-meta">
          <span>第 ${currentIndex + 1} / ${totalQuestions} 题</span>
          <span>${progressPercent}% · 候选题库 ${getMaxQuestionCount()} 道</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
        </div>
      </div>

      <div class="question-kicker">
        <span class="dimension-pill"><span>${escapeHTML(publicName)}</span></span>
        <span class="meme-mini-badge">${escapeHTML(directionLabel)}</span>
      </div>

      <h2 class="question-text">${escapeHTML(displayText)}</h2>
      ${hintText ? `<p class="question-hint">${escapeHTML(hintText)}</p>` : ""}

      <div class="options-list">
        ${buttonsHtml}
      </div>

      <div class="question-actions">
        <button id="prev-question-btn" class="btn-outline" type="button" ${currentIndex === 0 ? "disabled" : ""}>← 上一题</button>
      </div>
    `;

    clearOptionVisualState();
    restoreCurrentQuestionAnswerVisualState();

    questionArea.querySelectorAll(".option-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        if (button.dataset.locked === "true") return;
        handleAnswer(Number(button.dataset.value));
      });
    });

    const prevButton = document.getElementById("prev-question-btn");
    if (prevButton) prevButton.addEventListener("click", goToPreviousQuestion);
  }

  function resetTransientAnswerVisualState() {
    clearOptionVisualState();
    releaseQuestionFocus();
  }

  function clearOptionVisualState() {
    if (!questionArea) return;
    questionArea.querySelectorAll(".option-btn").forEach((button) => {
      button.classList.remove("is-selected", "is-answering", "is-ghost-selected");
      button.dataset.locked = "false";
      button.setAttribute("aria-pressed", "false");
      button.removeAttribute("data-selected-value");
    });
  }

  function restoreCurrentQuestionAnswerVisualState() {
    const record = answerRecords[currentIndex];
    if (!record || !questionArea) return;
    const button = questionArea.querySelector(`.option-btn[data-value="${String(record.rawValue)}"]`);
    if (!button) return;
    button.classList.add("is-selected");
    button.setAttribute("aria-pressed", "true");
    button.dataset.selectedValue = String(record.rawValue);
  }

  function markOptionAsSelected(rawValue) {
    if (!questionArea) return;
    const value = String(rawValue);
    questionArea.querySelectorAll(".option-btn").forEach((button) => {
      const isSelected = button.dataset.value === value;
      button.classList.toggle("is-selected", isSelected);
      button.classList.add("is-answering");
      button.dataset.locked = "true";
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
      if (isSelected) button.dataset.selectedValue = value;
      else button.removeAttribute("data-selected-value");
    });
  }

  function releaseQuestionFocus() {
    const active = document.activeElement;
    if (active && questionArea && questionArea.contains(active) && typeof active.blur === "function") {
      active.blur();
    }
  }

  function getQuestionText(question) {
    const display = window.questionMeta?.display || {};
    const order = Array.isArray(display.fallbackFieldOrder) && display.fallbackFieldOrder.length
      ? display.fallbackFieldOrder
      : ["funText", "text", "plainText"];

    for (const field of order) {
      const value = String(question?.[field] || "").trim();
      if (value) return value;
    }
    return "题目加载失败。";
  }

  function getQuestionDirectionLabel(question, meta) {
    const polarity = inferQuestionPolarity(question);
    if (polarity === "high") return meta?.memeHighLabel || meta?.highLabel || "高分侧";
    return meta?.memeLowLabel || meta?.lowLabel || "低分侧";
  }

  function getQuestionHint(question, meta) {
    const tags = Array.isArray(question.tags) ? question.tags.filter(Boolean).slice(0, 2) : [];
    if (!tags.length) return "";
    return `这题在测：${tags.join(" / ")}`;
  }

  function handleAnswer(rawValue) {
    const now = Date.now();
    if (isAnswering) return;
    if (now - lastAnswerTime < ANSWER_THROTTLE_MS) return;

    const q = activeQuestions[currentIndex];
    if (!q) return;

    lastAnswerTime = now;
    isAnswering = true;

    let rawScore = clamp(toFiniteNumber(rawValue, 0), SCORE_MIN, SCORE_MAX);
    markOptionAsSelected(rawScore);
    releaseQuestionFocus();
    let score = q.reverse ? -rawScore : rawScore;
    const weight = normalizeQuestionWeight(q.weight);

    answerRecords[currentIndex] = {
      questionIndex: currentIndex,
      questionId: q.id || `Q${String(currentIndex + 1).padStart(2, "0")}`,
      dimension: q.dimension,
      polarity: inferQuestionPolarity(q),
      rawValue: rawScore,
      rawLabel: getAnswerLabelByValue(rawScore),
      score,
      weightedScore: score * weight,
      weight,
      reverse: Boolean(q.reverse),
      consistencyPairId: q.consistencyPairId || "",
      tags: Array.isArray(q.tags) ? q.tags.slice(0, 6) : [],
      text: getQuestionText(q),
      answeredAt: now
    };

    recalcScores();
    currentIndex += 1;
    saveProgress();

    window.setTimeout(() => {
      isAnswering = false;
      if (currentIndex < totalQuestions) renderQuestion();
      else if (shouldShowResultGate()) showResultChoiceGate();
      else finishTest();
    }, ANSWER_THROTTLE_MS);
  }

  function goToPreviousQuestion() {
    if (currentIndex === 0) return;
    resetTransientAnswerVisualState();
    currentIndex -= 1;
    delete answerRecords[currentIndex];
    recalcScores();
    saveProgress();
    renderQuestion();
  }

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

  function finishTest() {
    recalcScores();
    const userVec = getFinalUserVector();
    const rankedHeroes = window.championsData
      .map((hero) => {
        const heroVec = typeof window.getHeroVector === "function" ? window.getHeroVector(hero.name) : getHeroVectorFallback(hero);
        return { hero, heroVec, similarity: cosineSimilarity(userVec, heroVec) };
      })
      .sort((a, b) => b.similarity - a.similarity);

    const topFive = rankedHeroes.slice(0, 5);
    if (!topFive.length) {
      showError("没有可匹配的英雄。请检查 championsData 是否为空。", true);
      return;
    }

    const selected = topFive[Math.floor(Math.random() * topFive.length)];
    clearProgress();
    const resultMeta = {
      similarity: selected.similarity,
      topFive,
      rankedHeroes,
      consistencyReport
    };

    displayResult(selected.hero, userVec, resultMeta);
    submitAnonymousResult(selected.hero, userVec, resultMeta);
  }

  function displayResult(hero, userVec, matchInfo = {}) {
    if (!questionArea || !resultArea) return;

    questionArea.style.display = "none";
    resultArea.style.display = "block";

    const templates = window.resultTemplates || {};
    const funProfile = buildFunProfile(userVec, hero);
    const similarityPercent = formatSimilarity(matchInfo.similarity);
    const dimensionBarsHtml = buildUserDimensionBars(userVec);
    const consistencyWarningHtml = buildConsistencyWarningHtml(matchInfo.consistencyReport || consistencyReport);
    const topFiveHtml = buildTopFiveHtml(matchInfo.topFive || []);
    const dimensionDiagnosisHtml = buildDimensionDiagnosisHtml(userVec);
    const storyExcerpt = getStoryExcerpt(hero.story);
    const roleRoast = getHeroRoast(hero);

    lastResultPayload = { hero, userVec, funProfile, similarityPercent };

    resultArea.innerHTML = `
      <div class="result-content share-poster-card" id="result-poster-card">
        <div class="result-hero meme-result-hero">
          <div class="result-label">你的峡谷人格是</div>
          <h2 class="result-meme-title">${escapeHTML(funProfile.title)}</h2>
          <p class="result-meme-subtitle">${escapeHTML(funProfile.subtitle)}</p>

          <div class="hero-avatar-wrap">
            <img src="${escapeAttribute(hero.image_url || hero.splash_url || "")}" alt="${escapeAttribute(hero.name || "匹配英雄")}" class="hero-avatar" onerror="this.style.display='none';">
          </div>

          <div class="result-label">本命英雄</div>
          <h3 class="result-hero-name">${escapeHTML(hero.name || "未知英雄")}</h3>
          <p class="result-hero-title">${escapeHTML(hero.title || "")}</p>
          <div class="match-badge">匹配度 ${similarityPercent}</div>
        </div>

        ${consistencyWarningHtml}

        <section class="result-section meme-roast-card">
          <h3>系统诊断</h3>
          <p>${escapeHTML(funProfile.roast)}</p>
          <p class="muted-line">${escapeHTML(roleRoast)}</p>
        </section>

        <section class="result-section">
          <h3>你的五维画像</h3>
          ${dimensionBarsHtml}
          ${dimensionDiagnosisHtml}
        </section>

        <section class="result-section diagnosis-grid-wrap">
          <h3>队友和对手眼中的你</h3>
          <div class="diagnosis-grid">
            <div class="diagnosis-card"><strong>队友视角</strong><p>${escapeHTML(funProfile.teammateView)}</p></div>
            <div class="diagnosis-card"><strong>对手视角</strong><p>${escapeHTML(funProfile.enemyView)}</p></div>
          </div>
        </section>

        <section class="result-section">
          <h3>候选前五名</h3>
          ${topFiveHtml}
        </section>

        ${storyExcerpt ? `<section class="result-section"><h3>英雄共鸣</h3><p>${escapeHTML(storyExcerpt)}</p></section>` : ""}

        <section class="result-section share-copy-card">
          <h3>适合截图发出去的一句话</h3>
          <p id="share-copy-text">${escapeHTML(buildShareText(hero, funProfile))}</p>
        </section>

        <div class="result-actions">
          <button id="restart-test-btn" class="btn-primary" type="button">${escapeHTML(templates.funResults?.restartCopy || "重新测试")}</button>
          <button id="share-result-btn" class="btn-outline" type="button">分享结果</button>
          <button id="copy-result-btn" class="btn-outline" type="button">复制文案</button>
          <a href="catalog.html" class="btn-outline">${escapeHTML(templates.funResults?.catalogCopy || "浏览图鉴")}</a>
        </div>
      </div>
    `;

    const restartBtn = document.getElementById("restart-test-btn");
    const shareBtn = document.getElementById("share-result-btn");
    const copyBtn = document.getElementById("copy-result-btn");
    if (restartBtn) restartBtn.addEventListener("click", confirmAndResetTest);
    if (shareBtn) shareBtn.addEventListener("click", () => shareResult(hero, funProfile));
    if (copyBtn) copyBtn.addEventListener("click", async () => {
      await copyText(buildShareText(hero, funProfile));
      showToast("分享文案已复制。现在去冒犯你的朋友吧。");
    });
  }


  function submitAnonymousResult(hero, userVec, matchInfo = {}) {
    if (hasSubmittedAnonymousResult) return;
    hasSubmittedAnonymousResult = true;

    if (!window.MGTIAnalytics || typeof window.MGTIAnalytics.submitSubmission !== "function") {
      return;
    }

    const answeredRecords = answerRecords.filter(Boolean);
    const payload = {
      testVersion: PROGRESS_VERSION,
      questionBankVersion: window.questionMeta?.version || window.MGTI_CONFIG?.QUESTION_VERSION || "unknown",
      resultMode: buildResultMode(answeredRecords.length),
      questionCount: answeredRecords.length,
      totalCandidateQuestions: Array.isArray(questionPool) ? questionPool.length : 0,
      activeQuestionCount: Array.isArray(activeQuestions) ? activeQuestions.length : 0,
      scores: vectorToScoreMap(userVec),
      result: buildAnonymousResultPayload(hero, matchInfo),
      topMatches: buildAnonymousTopMatches(matchInfo.topFive || []),
      answers: buildAnonymousAnswersPayload(answeredRecords),
      consistency: sanitizeConsistencyReport(matchInfo.consistencyReport || consistencyReport),
      progressMeta: buildAnonymousProgressMeta(answeredRecords.length),
      clientMeta: {
        page: "index",
        app: "MGTI"
      }
    };

    window.MGTIAnalytics.submitSubmission(payload);
  }

  function buildResultMode(answeredCount) {
    const base = getInitialQuestionTarget();
    const step = getContinueStepCount();
    if (answeredCount <= base) return "direct_after_base";
    const extra = Math.max(0, answeredCount - base);
    const rounds = step > 0 ? Math.ceil(extra / step) : 1;
    return `direct_after_continue_${rounds}`;
  }

  function buildAnonymousProgressMeta(answeredCount) {
    const base = getInitialQuestionTarget();
    const step = getContinueStepCount();
    const maxQuestions = activeQuestions.length || questionPool.length || answeredCount;
    const continued = Math.max(0, answeredCount - base);
    return {
      base_question_count: base,
      continue_step_questions: step,
      max_questions: maxQuestions,
      final_question_count: answeredCount,
      continued_times: step > 0 ? Math.ceil(continued / step) : 0,
      finished_by: buildResultMode(answeredCount)
    };
  }

  function vectorToScoreMap(userVec) {
    const result = {};
    DIMENSION_IDS.forEach((dimensionId, index) => {
      result[dimensionId] = roundNumber(toFiniteNumber(userVec?.[index], 0), 4);
    });
    return result;
  }

  function buildAnonymousResultPayload(hero, matchInfo = {}) {
    const funProfile = buildFunProfile(getFinalUserVector(), hero);
    const similarity = toFiniteNumber(matchInfo.similarity, 0);
    return {
      hero_name: hero?.name || "",
      hero_title: hero?.title || "",
      hero_alias: hero?.alias || "",
      personality_title: funProfile.title || "",
      personality_subtitle: funProfile.subtitle || "",
      similarity: roundNumber(similarity, 6),
      match_percent: Number(formatSimilarity(similarity).replace("%", "")) || 0
    };
  }

  function buildAnonymousTopMatches(topFive = []) {
    return topFive.slice(0, 5).map((item, index) => ({
      rank: index + 1,
      hero_name: item.hero?.name || "",
      hero_title: item.hero?.title || "",
      hero_alias: item.hero?.alias || "",
      similarity: roundNumber(toFiniteNumber(item.similarity, 0), 6),
      match_percent: Number(formatSimilarity(item.similarity).replace("%", "")) || 0
    }));
  }

  function buildAnonymousAnswersPayload(records = []) {
    return records.map((record, index) => ({
      order: index + 1,
      question_id: record.questionId || record.id || `Q${index + 1}`,
      dimension: record.dimension || "",
      reverse: Boolean(record.reverse),
      polarity: record.polarity || "",
      selected_label: record.rawLabel || record.label || "",
      raw_value: toFiniteNumber(record.rawValue, 0),
      final_score: roundNumber(toFiniteNumber(record.score, 0), 4),
      weight: roundNumber(normalizeQuestionWeight(record.weight), 4),
      consistency_pair_id: record.consistencyPairId || ""
    }));
  }

  function sanitizeConsistencyReport(report = {}) {
    return {
      enabled: Boolean(report.enabled),
      answered_pairs: Number(report.answeredPairs || 0),
      contradiction_count: Number(report.contradictionCount || 0),
      strong_contradiction_count: Number(report.strongContradictionCount || 0),
      consistency_score: Number(report.consistencyScore || 100),
      should_warn: Boolean(report.shouldWarn),
      level: report.level || "ok"
    };
  }

  function roundNumber(value, digits = 4) {
    const num = toFiniteNumber(value, 0);
    const factor = 10 ** digits;
    return Math.round(num * factor) / factor;
  }

  function buildFunProfile(userVec, hero) {
    const templates = window.resultTemplates?.funResults || {};
    const sorted = DIMENSION_IDS.map((id, index) => ({ id, value: toFiniteNumber(userVec[index], 0), abs: Math.abs(toFiniteNumber(userVec[index], 0)) }))
      .sort((a, b) => b.abs - a.abs);
    const first = sorted[0] || { id: "TAC", value: 0 };
    const second = sorted[1] || { id: "TEA", value: 0 };
    const firstDir = first.value >= 0 ? "high" : "low";
    const secondDir = second.value >= 0 ? "high" : "low";
    const keyA = `${first.id}_${firstDir}_${second.id}_${secondDir}`;
    const keyB = `${second.id}_${secondDir}_${first.id}_${firstDir}`;
    const combo = templates.comboTypes?.[keyA] || templates.comboTypes?.[keyB];
    const fallbackTitle = templates.defaultMemeTitles?.[`${first.id}_${firstDir}`] || getMemeLabel(first.id, first.value);
    const secondLabel = getMemeLabel(second.id, second.value);
    const title = combo?.title || `${fallbackTitle}型${secondLabel}`;
    const subtitle = combo?.subtitle || `你最明显的倾向是「${fallbackTitle}」，其次是「${secondLabel}」。这不一定科学，但很适合截图。`;
    const roast = combo?.roast || buildFallbackRoast(first, second, hero);

    return {
      title,
      subtitle,
      roast,
      teammateView: buildTeammateView(first, second),
      enemyView: buildEnemyView(first, second)
    };
  }

  function getMemeLabel(dimensionId, value) {
    const meta = getDimensionMeta(dimensionId);
    return value >= 0
      ? (meta?.memeHighLabel || meta?.highLabel || `${dimensionId}高分`)
      : (meta?.memeLowLabel || meta?.lowLabel || `${dimensionId}低分`);
  }

  function buildFallbackRoast(first, second, hero) {
    const a = getMemeLabel(first.id, first.value);
    const b = getMemeLabel(second.id, second.value);
    return `系统把你识别为「${a}」和「${b}」的混合体。你和 ${hero.name || "这个英雄"} 的共同点是：赢的时候像理解游戏，输的时候像在给队友提供研究素材。`;
  }

  function buildTeammateView(first, second) {
    if (first.id === "TEA" && first.value < 0) return "他很强，但我们经常只能通过小地图确认他还活着。";
    if (first.id === "TEA" && first.value >= 0) return "他真的会来，但有时候来得像班主任查寝。";
    if (first.id === "EMO" && first.value >= 0) return "他一红温，全队都知道这波必须有说法。";
    if (first.id === "DEC" && first.value >= 0) return "他开了。我们还没想好，但他已经开了。";
    if (first.id === "TAC" && first.value >= 0) return "他好像一直在算东西，虽然我们不知道他算没算队友。";
    return "他有自己的节奏。理解他需要一点耐心，也需要一点血压。";
  }

  function buildEnemyView(first, second) {
    if (first.id === "TAC" && first.value >= 0) return "这个人很烦，总像提前知道我下一步要干什么。";
    if (first.id === "TAC" && first.value < 0) return "这个人操作很突然，像键盘里住了第二个人。";
    if (first.id === "PRE" && first.value >= 0) return "他玩的英雄很烦，但他自己可能也很累。";
    if (first.id === "EMO" && first.value >= 0) return "稍微刺激一下，他可能会冲；但冲过来也真的有伤害。";
    if (first.id === "DEC" && first.value < 0) return "他很难骗，像每个草丛都提前查过房。";
    return "这个人不好判断，有时很稳，有时像突然想起自己在打游戏。";
  }

  function getHeroRoast(hero) {
    const role = Array.isArray(hero.roles) ? hero.roles[0] : "";
    return window.resultTemplates?.funResults?.heroRoastsByRole?.[role]
      || "你和这个英雄的相似点是：都能把普通对局打出一点个人命运感。";
  }

  function buildUserDimensionBars(userVec) {
    return DIMENSION_IDS.map((dimensionId, index) => {
      const value = toFiniteNumber(userVec[index], 0);
      const meta = getDimensionMeta(dimensionId);
      const percent = ((value + 2) / 4) * 100;
      const label = getMemeLabel(dimensionId, value);
      return `
        <div class="dimension-bar-row">
          <div class="dimension-bar-head">
            <span>${escapeHTML(meta?.publicName || meta?.name || dimensionId)}</span>
            <strong>${escapeHTML(label)} · ${value.toFixed(2)}</strong>
          </div>
          <div class="dimension-track"><div class="dimension-fill" style="width:${Math.max(3, Math.min(100, percent))}%;"></div></div>
          <div class="dimension-scale"><span>${escapeHTML(meta?.memeLowLabel || meta?.lowLabel || "低")}</span><span>${escapeHTML(meta?.memeHighLabel || meta?.highLabel || "高")}</span></div>
        </div>`;
    }).join("");
  }

  function buildDimensionDiagnosisHtml(userVec) {
    const items = DIMENSION_IDS.map((dimensionId, index) => {
      const value = toFiniteNumber(userVec[index], 0);
      const meta = getDimensionMeta(dimensionId);
      const band = getScoreBand(dimensionId, value);
      const desc = value >= 0 ? (meta?.memeHighDesc || meta?.highDesc) : (meta?.memeLowDesc || meta?.lowDesc);
      return `<div class="dimension-explain-item"><strong>${escapeHTML(meta?.publicName || meta?.name || dimensionId)}：${escapeHTML(band.label)}</strong><p>${escapeHTML(desc || band.desc || "")}</p></div>`;
    }).join("");
    return `<div id="dimension-explanation" class="dimension-explanation">${items}</div>`;
  }

  function buildTopFiveHtml(topFive) {
    if (!Array.isArray(topFive) || !topFive.length) return `<p class="muted-line">暂无候选英雄。</p>`;
    return `<div class="top-five-list">${topFive.map((item, index) => {
      const hero = item.hero || {};
      return `<div class="top-five-item"><span class="rank-num">${index + 1}</span><img src="${escapeAttribute(hero.image_url || "")}" alt="${escapeAttribute(hero.name || "")}" onerror="this.style.display='none';"><div><strong>${escapeHTML(hero.name || "未知英雄")}</strong><small>${escapeHTML(hero.title || "")}</small></div><em>${formatSimilarity(item.similarity)}</em></div>`;
    }).join("")}</div>`;
  }

  function buildConsistencyWarningHtml(report) {
    const active = report || createEmptyConsistencyReport();
    if (!active.shouldWarn) return "";
    const copy = window.resultTemplates?.consistencyWarning || {};
    const text = active.level === "strong" ? (copy.strong || active.warningText) : (copy.soft || active.warningText);
    return `<div class="consistency-warning fun-warning"><strong>${escapeHTML(copy.title || "精神状态提示")}</strong><p>${escapeHTML(text)}</p></div>`;
  }

  function buildShareText(hero, funProfile) {
    const template = window.resultTemplates?.shareTemplate || "我测出了自己的 MGTI 峡谷人格：{{memeTitle}}，本命英雄是 {{heroName}}。";
    return template
      .replaceAll("{{heroName}}", hero.name || "未知英雄")
      .replaceAll("{{memeTitle}}", funProfile.title || "峡谷人格")
      .replaceAll("{{roast}}", funProfile.roast || "很难评价，但很像我。")
      .replaceAll("{{url}}", window.location.href.split("#")[0]);
  }

  async function shareResult(hero, funProfile) {
    const text = buildShareText(hero, funProfile);
    const url = window.location.href.split("#")[0];
    const shareData = { title: "MGTI 峡谷人格发疯测试", text, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await copyText(`${text} ${url}`);
      showToast("分享文案已复制。去让朋友也测一下。");
    } catch (error) {
      console.warn("[MGTI] 分享失败：", error);
      try {
        await copyText(`${text} ${url}`);
        showToast("分享文案已复制。");
      } catch (copyError) {
        showToast("分享失败，请手动复制页面链接。");
      }
    }
  }

  function getFinalUserVector() {
    if (typeof window.getUserVectorFromScores === "function") return window.getUserVectorFromScores(userScores, dimensionCounts);
    return DIMENSION_IDS.map((dimensionId) => {
      const count = dimensionCounts[dimensionId] || 0;
      return count > 0 ? clamp(userScores[dimensionId] / count, SCORE_MIN, SCORE_MAX) : 0;
    });
  }

  function calculateConsistencyReport(records) {
    const meta = window.questionMeta?.consistency || {};
    const enabled = meta.enabled !== false;
    const pairs = getConsistencyPairs(meta);
    if (!enabled || !pairs.length) return createEmptyConsistencyReport();

    const report = { ...createEmptyConsistencyReport(), enabled: true, warningText: meta.suggestedWarningText || "部分答案之间存在明显矛盾。" };
    const recordMap = buildAnswerRecordMap(records);
    const strongAbs = Math.max(CONSISTENCY_SIGNIFICANT_RAW_ABS, toFiniteNumber(meta.strongContradictionRawAbs, 2));

    pairs.forEach((pair) => {
      const lowRecord = recordMap.get(pair.lowQuestionId);
      const highRecord = recordMap.get(pair.highQuestionId);
      if (!lowRecord || !highRecord) return;
      const lowRaw = toFiniteNumber(lowRecord.rawValue, 0);
      const highRaw = toFiniteNumber(highRecord.rawValue, 0);
      if (Math.abs(lowRaw) < CONSISTENCY_SIGNIFICANT_RAW_ABS || Math.abs(highRaw) < CONSISTENCY_SIGNIFICANT_RAW_ABS) return;
      report.answeredPairs += 1;
      const contradicted = (lowRaw < 0 && highRaw < 0) || (lowRaw > 0 && highRaw > 0);
      if (!contradicted) return;
      const isStrong = Math.abs(lowRaw) >= strongAbs && Math.abs(highRaw) >= strongAbs;
      report.contradictionCount += 1;
      if (isStrong) report.strongContradictionCount += 1;
      report.details.push({ ...pair, lowAnswer: lowRecord.rawLabel, highAnswer: highRecord.rawLabel, strong: isStrong });
    });

    if (report.answeredPairs > 0) report.consistencyScore = Math.max(0, Math.round((1 - report.contradictionCount / report.answeredPairs) * 100));
    const minAnsweredPairs = Math.max(1, toFiniteNumber(meta.minAnsweredPairs, 3));
    const contradictionThreshold = Math.max(1, toFiniteNumber(meta.contradictionThreshold, 3));
    report.shouldWarn = report.answeredPairs >= minAnsweredPairs && (report.contradictionCount >= contradictionThreshold || report.strongContradictionCount >= Math.max(2, Math.ceil(contradictionThreshold / 2)));
    report.level = report.strongContradictionCount >= 2 || report.contradictionCount >= contradictionThreshold ? "strong" : report.contradictionCount > 0 ? "soft" : "ok";
    return report;
  }

  function getConsistencyPairs(meta) {
    if (Array.isArray(meta?.pairs) && meta.pairs.length) return meta.pairs.map(normalizeConsistencyPair).filter(Boolean);
    return buildConsistencyPairsFromQuestions();
  }

  function normalizeConsistencyPair(pair) {
    if (!pair || !pair.lowQuestionId || !pair.highQuestionId) return null;
    return { id: pair.id || `${pair.lowQuestionId}__${pair.highQuestionId}`, dimension: pair.dimension || "", lowQuestionId: pair.lowQuestionId, highQuestionId: pair.highQuestionId, relation: pair.relation || "opposite", reason: pair.reason || "相反题回答方向接近。" };
  }

  function buildConsistencyPairsFromQuestions() {
    const groups = new Map();
    activeQuestions.forEach((question) => {
      if (!question?.consistencyPairId) return;
      if (!groups.has(question.consistencyPairId)) groups.set(question.consistencyPairId, []);
      groups.get(question.consistencyPairId).push(question);
    });
    const pairs = [];
    groups.forEach((items, id) => {
      const low = items.find((item) => inferQuestionPolarity(item) === "low");
      const high = items.find((item) => inferQuestionPolarity(item) === "high");
      if (low && high) pairs.push({ id, dimension: low.dimension || high.dimension || "", lowQuestionId: low.id, highQuestionId: high.id, relation: "opposite", reason: "同一维度相反题。" });
    });
    return pairs;
  }

  function buildAnswerRecordMap(records) {
    const map = new Map();
    (records || []).forEach((record) => {
      if (!record) return;
      const id = record.questionId;
      if (id) map.set(id, { ...record, rawLabel: record.rawLabel || getAnswerLabelByValue(record.rawValue) });
    });
    return map;
  }

  function saveProgress() {
    const payload = {
      version: PROGRESS_VERSION,
      currentIndex,
      currentTargetCount,
      userScores,
      dimensionCounts,
      answerRecords,
      consistencyReport,
      totalQuestions,
      totalAvailableQuestions: getMaxQuestionCount(),
      activeQuestionIds: activeQuestions.map((q) => q.id),
      savedAt: Date.now()
    };
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload)); } catch (error) { console.warn("[MGTI] 保存进度失败：", error); }
  }

  function loadProgress() {
    try { const raw = localStorage.getItem(PROGRESS_KEY); return raw ? JSON.parse(raw) : null; } catch (error) { console.warn("[MGTI] 读取进度失败：", error); return null; }
  }

  function clearProgress() {
    try { localStorage.removeItem(PROGRESS_KEY); } catch (error) { console.warn("[MGTI] 清除进度失败：", error); }
  }

  function isValidProgress(progress) {
    if (!progress || progress.version !== PROGRESS_VERSION) return false;
    if (!Number.isInteger(progress.currentIndex) || progress.currentIndex < 0) return false;
    if (!Array.isArray(progress.answerRecords)) return false;
    if (!Array.isArray(progress.activeQuestionIds) || !progress.activeQuestionIds.length) return false;
    const restored = restoreActiveQuestionsByIds(progress.activeQuestionIds);
    if (!restored.length) return false;
    activeQuestions = restored;
    currentTargetCount = clampQuestionTarget(progress.currentTargetCount || progress.totalQuestions || getInitialQuestionTarget());
    totalQuestions = currentTargetCount;
    return progress.currentIndex <= totalQuestions && progress.currentIndex <= activeQuestions.length;
  }

  function restoreActiveQuestionsByIds(ids) {
    const map = new Map(questionPool.map((q) => [q.id, q]));
    return ids.map((id, index) => {
      const q = map.get(id);
      return q ? { ...q, _activeIndex: index, _poolId: id } : null;
    }).filter(Boolean);
  }

  function showResumePrompt(savedProgress) {
    if (!resumeBanner || !resumeYesBtn || !resumeNoBtn) {
      if (window.confirm("检测到未完成的 MGTI 测试，是否继续？")) restoreProgress(savedProgress);
      else { clearProgress(); resetTest(false); }
      return;
    }
    resumeBanner.style.display = "block";
    resumeYesBtn.onclick = () => { resumeBanner.style.display = "none"; restoreProgress(savedProgress); };
    resumeNoBtn.onclick = () => { resumeBanner.style.display = "none"; clearProgress(); resetTest(false); };
  }

  function restoreProgress(progress) {
    currentIndex = progress.currentIndex;
    userScores = normalizeSavedDimensionMap(progress.userScores);
    dimensionCounts = normalizeSavedDimensionMap(progress.dimensionCounts);
    answerRecords = Array.isArray(progress.answerRecords) ? progress.answerRecords : [];
    consistencyReport = progress.consistencyReport || createEmptyConsistencyReport();
    window.MGTI_ACTIVE_QUESTIONS = activeQuestions;
    recalcScores();
    if (currentIndex >= totalQuestions) {
      if (shouldShowResultGate()) {
        showResultChoiceGate();
      } else {
        finishTest();
      }
    } else {
      renderQuestion();
    }
  }

  function resetTest(shouldScrollTop = true) {
    activeQuestions = selectActiveQuestions(questionPool);
    window.MGTI_ACTIVE_QUESTIONS = activeQuestions;
    currentTargetCount = getInitialQuestionTarget();
    totalQuestions = currentTargetCount;
    currentIndex = 0;
    userScores = createEmptyDimensionMap();
    dimensionCounts = createEmptyDimensionMap();
    answerRecords = [];
    isAnswering = false;
    lastAnswerTime = 0;
    consistencyReport = createEmptyConsistencyReport();
    lastResultPayload = null;
    hasSubmittedAnonymousResult = false;
    clearProgress();
    hideResult();
    renderQuestion();
    if (shouldScrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function confirmAndResetTest() {
    if (!window.confirm("重新测试会重新随机抽题，并丢失当前结果。确定吗？")) return;
    resetTest(true);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
    const length = Math.min(vecA.length, vecB.length);
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < length; i += 1) {
      const a = toFiniteNumber(vecA[i], 0);
      const b = toFiniteNumber(vecB[i], 0);
      dot += a * b; normA += a * a; normB += b * b;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  function getHeroVectorFallback(hero) {
    const dimensions = hero?.dimensions || {};
    return DIMENSION_IDS.map((dimensionId) => toFiniteNumber(dimensions[dimensionId], 0));
  }

  function getStoryExcerpt(story) {
    const text = String(story || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > 150 ? `${text.slice(0, 150)}...` : text;
  }

  function showLoading(message) {
    if (!questionArea) return;
    questionArea.style.display = "block";
    questionArea.innerHTML = `<div class="loading">${escapeHTML(message)}</div>`;
  }

  function showError(message, includeReload = false) {
    if (typeof window.showUserError === "function") window.showUserError(message);
    if (!questionArea) return;
    questionArea.style.display = "block";
    questionArea.innerHTML = `<div class="mgti-error-card"><div style="font-size:2rem;margin-bottom:.8rem;">⚠️</div><h2>加载失败</h2><p>${escapeHTML(message)}</p>${includeReload ? `<button id="reload-page-btn" class="btn-primary" type="button">重新加载</button>` : ""}</div>`;
    const reloadBtn = document.getElementById("reload-page-btn");
    if (reloadBtn) reloadBtn.addEventListener("click", () => window.location.reload());
  }

  function hideResult() {
    if (resultArea) { resultArea.style.display = "none"; resultArea.innerHTML = ""; }
    if (questionArea) questionArea.style.display = "block";
  }

  function showToast(message) {
    const oldToast = document.getElementById("mgti-toast");
    if (oldToast) oldToast.remove();
    const toast = document.createElement("div");
    toast.id = "mgti-toast";
    toast.textContent = message;
    toast.className = "mgti-toast";
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2400);
  }

  function getDimensionMeta(dimensionId) {
    if (typeof window.getDimensionMeta === "function") return window.getDimensionMeta(dimensionId);
    return (window.dimensions || []).find((item) => item.id === dimensionId) || null;
  }

  function getScoreBand(dimensionId, value) {
    const number = toFiniteNumber(value, 0);
    const meta = getDimensionMeta(dimensionId);
    const bands = Array.isArray(meta?.scoreBands) ? meta.scoreBands : [];
    const matched = bands.find((band) => number >= toFiniteNumber(band.min, SCORE_MIN) && number <= toFiniteNumber(band.max, SCORE_MAX));
    return matched ? { label: matched.label || getFallbackScoreBandLabel(number), desc: matched.desc || "" } : { label: getFallbackScoreBandLabel(number), desc: "" };
  }

  function getFallbackScoreBandLabel(value) {
    if (value >= 1.2) return window.resultTemplates?.scoreBandLabels?.veryHigh || "强高分倾向";
    if (value >= 0.4) return window.resultTemplates?.scoreBandLabels?.high || "偏高分倾向";
    if (value <= -1.2) return window.resultTemplates?.scoreBandLabels?.veryLow || "强低分倾向";
    if (value <= -0.4) return window.resultTemplates?.scoreBandLabels?.low || "偏低分倾向";
    return window.resultTemplates?.scoreBandLabels?.neutral || "均衡倾向";
  }

  function inferQuestionPolarity(question) {
    if (question?.polarity === "high" || question?.polarity === "low") return question.polarity;
    return question?.reverse ? "high" : "low";
  }

  function normalizeQuestionWeight(value) {
    const weight = toFiniteNumber(value, 1);
    return weight <= 0 ? 1 : clamp(weight, 0.25, 3);
  }

  function getAnswerLabelByValue(value) {
    return ANSWER_OPTIONS.find((item) => item.value === Number(value))?.label || "未选择";
  }

  function createEmptyConsistencyReport() {
    return { enabled: false, answeredPairs: 0, contradictionCount: 0, strongContradictionCount: 0, consistencyScore: 100, shouldWarn: false, level: "ok", details: [], warningText: "部分答案可能存在矛盾。" };
  }

  function createEmptyDimensionMap() {
    return DIMENSION_IDS.reduce((acc, id) => { acc[id] = 0; return acc; }, {});
  }

  function normalizeSavedDimensionMap(value) {
    const result = createEmptyDimensionMap();
    if (!value || typeof value !== "object") return result;
    DIMENSION_IDS.forEach((id) => { result[id] = toFiniteNumber(value[id], 0); });
    return result;
  }

  function shuffleArray(values) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
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
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value).replaceAll("`", "&#096;");
  }

  window.MGTITestDebug = {
    showResultChoiceGate,
    shouldShowResultGate,
    extendQuestionTarget,
    getState: () => ({ currentIndex, currentTargetCount, userScores, dimensionCounts, answerRecords, totalQuestions, totalAvailableQuestions: getMaxQuestionCount(), consistencyReport, questionMeta: window.questionMeta || null, activeQuestions, questionPool, lastResultPayload }),
    recalcScores,
    resetTest,
    finishTest,
    calculateConsistencyReport,
    cosineSimilarity,
    selectActiveQuestions,
    showResultChoiceGate,
    extendQuestionTarget
  };
});
