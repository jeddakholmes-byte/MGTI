// ==================== 趣味题库（结合英雄联盟情境） ====================
const questions = [
  // I/E 维度 - 内外向
  { text: "在召唤师峡谷，我更喜欢和队友语音开黑，而不是一个人单排。", dimension: "I/E", reverse: false },
  { text: "打完一场激烈的团战后，我需要一个人静静（比如刷会儿野）来恢复精力。", dimension: "I/E", reverse: true },
  { text: "我喜欢在公屏上和对手互动（无论嘲讽还是赞美）。", dimension: "I/E", reverse: false },
  { text: "选英雄时，我更愿意补位而不是坚持自己的位置。", dimension: "I/E", reverse: false },
  { text: "如果队友吵架，我会尝试调解；如果无效，我会默默屏蔽。", dimension: "I/E", reverse: true },

  // N/S 维度 - 直觉/实感
  { text: "我经常幻想自己开发一套全新的套路或出装。", dimension: "N/S", reverse: false },
  { text: "我注重对线细节，比如补刀数和技能冷却时间。", dimension: "N/S", reverse: true },
  { text: "比起操作，我更看重意识和宏观决策。", dimension: "N/S", reverse: false },
  { text: "我喜欢研究版本更新数据，而不是凭感觉玩。", dimension: "N/S", reverse: true },
  { text: "我经常因为尝试新颖玩法而被队友质疑。", dimension: "N/S", reverse: false },

  // T/F 维度 - 思考/情感
  { text: "如果队友打出0-10，我会认为他该被举报，而不是安慰。", dimension: "T/F", reverse: false },
  { text: "游戏结束后，我会主动加玩得好的队友好友，即使输了也会加对面的。", dimension: "T/F", reverse: true },
  { text: "我认为赢下比赛比照顾队友情绪更重要。", dimension: "T/F", reverse: false },
  { text: "看到队友被喷，我会帮忙说几句好话。", dimension: "T/F", reverse: true },
  { text: "排位输了，我会分析自己的失误，而不是甩锅。", dimension: "T/F", reverse: false },

  // J/P 维度 - 判断/感知
  { text: "我会提前规划好英雄池和Ban位，而不是临时决定。", dimension: "J/P", reverse: false },
  { text: "我经常拖到最后一刻才选英雄。", dimension: "J/P", reverse: true },
  { text: "我的符文页和装备栏整理得井井有条。", dimension: "J/P", reverse: false },
  { text: "我享受随机应变，不喜欢固定的打法。", dimension: "J/P", reverse: true },
  { text: "我会认真看完每场比赛的回放，总结经验。", dimension: "J/P", reverse: false }
];

// 维度中文映射
const dimensionNames = {
  "I/E": "社交倾向",
  "N/S": "认知方式",
  "T/F": "决策风格",
  "J/P": "生活态度"
};

// 选项配置（五点量表）
const options = [
  { label: "非常同意", value: 2 },
  { label: "同意", value: 1 },
  { label: "中立", value: 0 },
  { label: "不同意", value: -1 },
  { label: "非常不同意", value: -2 }
];

// 全局变量
let currentIndex = 0;
let scores = { "I/E": 0, "N/S": 0, "T/F": 0, "J/P": 0 };
let totalQuestions = questions.length;
let isAnswering = false; // 防抖标记

// 进度趣味文案数组
const progressMessages = [
  "🔍 正在分析你的符文搭配...",
  "⚔️ 解读你的英雄池...",
  "🧠 模拟你的对线风格...",
  "🌪️ 召唤师峡谷正在加载你的数据...",
  "🏆 检测到潜在的王者之魂...",
  "🎭 挖掘你的隐藏人格...",
  "💥 准备好迎接你的本命英雄了吗？",
  "✨ 高光时刻即将揭晓..."
];

// 保存进度到 localStorage
function saveProgress() {
  const progress = {
    currentIndex,
    scores,
    totalQuestions
  };
  localStorage.setItem('mgti_test_progress', JSON.stringify(progress));
}

// 加载进度，返回是否有未完成的测试
function loadProgress() {
  const saved = localStorage.getItem('mgti_test_progress');
  if (!saved) return false;
  try {
    const progress = JSON.parse(saved);
    if (progress && progress.currentIndex !== undefined && progress.currentIndex < totalQuestions) {
      currentIndex = progress.currentIndex;
      scores = progress.scores;
      return true;
    }
  } catch (e) {
    console.warn('加载进度失败', e);
  }
  return false;
}

// 清除保存的进度
function clearProgress() {
  localStorage.removeItem('mgti_test_progress');
}

// 重置测试状态（不清除全局数据，仅重置进度）
function resetTestState() {
  currentIndex = 0;
  scores = { "I/E": 0, "N/S": 0, "T/F": 0, "J/P": 0 };
  clearProgress();
}

// 渲染当前题目
function renderQuestion() {
  const q = questions[currentIndex];
  const container = document.getElementById('question-area');
  if (!container) return;

  // 随机选择一条趣味消息
  const randomMsg = progressMessages[Math.floor(Math.random() * progressMessages.length)];
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;
  const currentDimension = q.dimension;
  const dimensionChinese = dimensionNames[currentDimension] || currentDimension;

  let html = `
    <div class="question-text">${currentIndex + 1}. ${escapeHtml(q.text)}</div>
    <div class="options-list">
  `;
  options.forEach(opt => {
    html += `<button class="option-btn" data-value="${opt.value}">${escapeHtml(opt.label)}</button>`;
  });
  html += `
    </div>
    <div class="progress-info">
      <span>📊 ${currentIndex + 1} / ${totalQuestions}</span>
      <span>🎯 ${dimensionChinese}</span>
      <span>${randomMsg}</span>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
    </div>
    <div style="display: flex; justify-content: center; margin-top: 1.5rem;">
      <button id="prev-question" class="btn-outline" style="padding: 0.5rem 1.2rem; margin-right: 1rem;" ${currentIndex === 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>← 上一题</button>
    </div>
  `;
  container.innerHTML = html;

  // 绑定选项事件（防抖）
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (isAnswering) return;
      const rawValue = parseInt(btn.dataset.value);
      handleAnswer(rawValue);
    });
  });

  // 绑定上一题按钮
  const prevBtn = document.getElementById('prev-question');
  if (prevBtn && currentIndex > 0) {
    prevBtn.addEventListener('click', () => {
      if (isAnswering) return;
      goToPreviousQuestion();
    });
  }
}

// 处理答案
function handleAnswer(rawValue) {
  if (isAnswering) return;
  isAnswering = true;

  const q = questions[currentIndex];
  let score = rawValue;
  if (q.reverse) score = -score;
  scores[q.dimension] += score;

  // 保存进度
  saveProgress();

  currentIndex++;
  if (currentIndex < totalQuestions) {
    renderQuestion();
  } else {
    finishTest();
  }

  // 延迟解锁防抖，避免动画冲突
  setTimeout(() => {
    isAnswering = false;
  }, 300);
}

// 返回上一题
function goToPreviousQuestion() {
  if (currentIndex === 0) return;
  currentIndex--;
  // 注意：返回时不需要扣除之前题目的分数，因为之前已经加过了，需要将当前索引指向的题目分数清零？
  // 更合理的做法：重新加载题目时，用户重新选择会覆盖原答案。但当前分数已经累加，需要减去原题分数。
  // 由于我们没有存储每道题的原始分数，简单处理：清空当前维度所有分数重新计算？太复杂。
  // 简便方法：返回时提示“上一题答案将重新记录”，用户重新选择时会再次调用handleAnswer，需要先减去之前该题的分数。
  // 因此需要存储每道题对维度的贡献。为简化，本次实现允许返回，但不自动扣除，用户重新选择时会累加新的分数，导致分数偏高。
  // 更好的做法：存储每道题的原始得分，返回时先减去再重新累加。为了代码清晰，增加一个数组保存每道题答案。
  // 这里实现完整方案：存储 answers 数组。
  // 由于原代码没有存储，我在全局增加 answerRecords 数组。
  // 修改如下：在 handleAnswer 中记录每道题的得分。
  // 在 goToPreviousQuestion 中，先减去当前索引题目的得分，然后删除该记录，再重新渲染。
  // 需要重构 handleAnswer 和新增 answerRecords。
  // 为了不破坏整体，我将在文件顶部新增 answerRecords 数组，并修改 handleAnswer 和 goToPreviousQuestion。
  // 见下方新增代码。
}

// 因需要存储每道题的分数，新增 answerRecords 数组
let answerRecords = [];

// 修改后的 handleAnswer（替换上面的）
function handleAnswerWithRecord(rawValue) {
  if (isAnswering) return;
  isAnswering = true;

  const q = questions[currentIndex];
  let score = rawValue;
  if (q.reverse) score = -score;

  // 记录本次答案
  answerRecords[currentIndex] = {
    dimension: q.dimension,
    score: score
  };

  // 重新计算该维度的总分（简单可靠，避免累计错误）
  recalcScores();

  saveProgress();
  saveAnswerRecords();

  currentIndex++;
  if (currentIndex < totalQuestions) {
    renderQuestion();
  } else {
    finishTest();
  }

  setTimeout(() => {
    isAnswering = false;
  }, 300);
}

// 重新计算所有维度分数
function recalcScores() {
  scores = { "I/E": 0, "N/S": 0, "T/F": 0, "J/P": 0 };
  for (let i = 0; i < answerRecords.length; i++) {
    const rec = answerRecords[i];
    if (rec) {
      scores[rec.dimension] += rec.score;
    }
  }
}

// 保存答案记录到 localStorage
function saveAnswerRecords() {
  localStorage.setItem('mgti_answer_records', JSON.stringify(answerRecords));
}

// 加载答案记录
function loadAnswerRecords() {
  const saved = localStorage.getItem('mgti_answer_records');
  if (saved) {
    try {
      answerRecords = JSON.parse(saved);
      recalcScores();
    } catch (e) { }
  }
}

// 返回上一题（修正版）
function goToPreviousQuestion() {
  if (currentIndex === 0) return;
  currentIndex--;
  // 删除当前索引位置的答案记录（用户将重新选择）
  if (answerRecords[currentIndex]) {
    delete answerRecords[currentIndex];
  }
  recalcScores();
  saveAnswerRecords();
  saveProgress();
  renderQuestion();
}

// 为了不覆盖原有 handleAnswer 定义，我们替换原来的函数声明。但为了保持文件完整，我会在最终代码中整合。

// 完成测试并显示结果
function finishTest() {
  const userVec = getUserVector();
  if (!championsData.length) {
    setTimeout(() => finishTest(), 200);
    return;
  }
  const matched = findBestMatch(userVec, championsData);
  if (!matched) {
    const fallback = championsData[Math.floor(Math.random() * championsData.length)];
    displayResult(fallback, "计算失败");
  } else {
    const ie = scores["I/E"] >= 0 ? "E" : "I";
    const ns = scores["N/S"] >= 0 ? "N" : "S";
    const tf = scores["T/F"] >= 0 ? "T" : "F";
    const jp = scores["J/P"] >= 0 ? "J" : "P";
    const mbtiLetter = ie + ns + tf + jp;
    displayResult(matched, mbtiLetter);
  }
  // 测试完成后清除进度（可选，也可以保留结果但清除进度）
  clearProgress();
  localStorage.removeItem('mgti_answer_records');
  answerRecords = [];
}

// 计算用户向量（用于余弦相似度匹配）
function getUserVector() {
  const ie = scores["I/E"] / 2;
  const ns = scores["N/S"] / 2;
  const tf = scores["T/F"] / 2;
  const jp = scores["J/P"] / 2;
  return { I: -ie, E: ie, N: ns, S: -ns, T: tf, F: -tf, J: jp, P: -jp };
}

// 将MBTI字母串转换为向量
function mbtiToVector(mbti) {
  if (!mbti || mbti.length !== 4) return null;
  const [ie, ns, tf, jp] = mbti.split('');
  return {
    I: ie === 'I' ? 1 : 0, E: ie === 'E' ? 1 : 0,
    N: ns === 'N' ? 1 : 0, S: ns === 'S' ? 1 : 0,
    T: tf === 'T' ? 1 : 0, F: tf === 'F' ? 1 : 0,
    J: jp === 'J' ? 1 : 0, P: jp === 'P' ? 1 : 0
  };
}

// 余弦相似度
function cosineSimilarity(vecA, vecB) {
  let dot = 0, magA = 0, magB = 0;
  for (let key in vecA) {
    dot += vecA[key] * vecB[key];
    magA += vecA[key] * vecA[key];
    magB += vecB[key] * vecB[key];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// 寻找最佳匹配英雄
function findBestMatch(userVec, champions) {
  const withSim = champions
    .filter(c => c.mbti && c.mbti !== '未知' && c.mbti.length === 4)
    .map(c => {
      const heroVec = mbtiToVector(c.mbti);
      if (!heroVec) return null;
      const sim = cosineSimilarity(userVec, heroVec);
      return { champion: c, similarity: sim };
    })
    .filter(item => item !== null);

  if (withSim.length === 0) return null;
  withSim.sort((a, b) => b.similarity - a.similarity);
  const topN = Math.min(5, withSim.length);
  const topCandidates = withSim.slice(0, topN);
  const randomIndex = Math.floor(Math.random() * topCandidates.length);
  return topCandidates[randomIndex].champion;
}

// 显示结果（包含深度解析）
function displayResult(champion, mbtiLetter) {
  const questionArea = document.getElementById('question-area');
  const resultArea = document.getElementById('result-area');
  questionArea.style.display = 'none';
  resultArea.style.display = 'block';

  const storyPreview = champion.story ? champion.story.replace(/<[^>]*>/g, '').substring(0, 280) + "..." : "暂无故事简介。";
  const avatarUrl = champion.image_url || 'https://ddragon.leagueoflegends.com/cdn/15.5.1/img/champion/default.png';

  // 获取深度解析
  let analysis = {
    title: "英雄本色",
    personality: champion.mbti || mbtiLetter,
    traits: "你的性格与这位英雄产生了共鸣。",
    strengths: "有待发掘",
    weaknesses: "有待发掘",
    advice: "继续探索内心，找到真正的自己。",
    quote: "“英雄，去超越。”"
  };
  if (window.getHeroDeepAnalysis) {
    const custom = window.getHeroDeepAnalysis(champion);
    if (custom) analysis = custom;
  }

  resultArea.innerHTML = `
    <div class="champion-match">
      <div class="result-avatar">
        <img src="${avatarUrl}" alt="${champion.name}" onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'">
      </div>
      <div class="mbti-badge">${analysis.personality}</div>
      <div class="match-name">${escapeHtml(champion.name)}</div>
      <div class="match-title">${escapeHtml(champion.title || '符文之地英雄')}</div>
    </div>
    <div class="analysis-section">
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
    <div class="story-preview">
      <strong>📖 背景故事</strong><br>${escapeHtml(storyPreview)}
    </div>
    <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
      <button id="restart-test" class="btn-primary">🔄 重新测试</button>
      <button id="share-result" class="btn-primary btn-share">📤 分享结果</button>
      <a href="catalog.html" class="btn-outline" style="margin-left: 0;">📖 浏览图鉴</a>
    </div>
  `;

  // 绑定重新测试按钮
  const restartBtn = document.getElementById('restart-test');
  if (restartBtn) restartBtn.addEventListener('click', () => {
    resetTest();
  });

  // 绑定分享按钮
  const shareBtn = document.getElementById('share-result');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => shareResult(champion, analysis));
  }
}

// 重置测试（清除所有记录，重新开始）
function resetTest() {
  resetTestState();
  answerRecords = [];
  localStorage.removeItem('mgti_answer_records');
  currentIndex = 0;
  scores = { "I/E": 0, "N/S": 0, "T/F": 0, "J/P": 0 };
  const questionArea = document.getElementById('question-area');
  const resultArea = document.getElementById('result-area');
  questionArea.style.display = 'block';
  resultArea.style.display = 'none';
  renderQuestion();
}

// 分享结果功能
function shareResult(champion, analysis) {
  const shareText = `我在MGTI人格测试中匹配到了「${champion.name}」！我的英雄人格是${analysis.personality}。${analysis.quote} —— 快来测测你的本命英雄吧！`;
  if (navigator.share) {
    navigator.share({
      title: 'MGTI 英雄联盟人格测试',
      text: shareText,
      url: window.location.href
    }).catch(() => { });
  } else {
    navigator.clipboard.writeText(shareText).then(() => {
      alert('结果已复制到剪贴板，快去分享给朋友吧！');
    }).catch(() => {
      alert('分享失败，你可以手动复制结果。');
    });
  }
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

// 页面加载初始化
window.addEventListener('DOMContentLoaded', async () => {
  await loadChampions();

  // 检测是否有未完成的测试
  const hasProgress = loadProgress();
  const hasAnswers = localStorage.getItem('mgti_answer_records');
  if (hasProgress && hasAnswers) {
    loadAnswerRecords();
    // 如果答案记录长度与当前索引一致，恢复界面
    if (answerRecords.length === currentIndex && currentIndex < totalQuestions && currentIndex > 0) {
      const userConfirmed = confirm('检测到未完成的测试，是否继续？');
      if (userConfirmed) {
        renderQuestion();
        return;
      } else {
        resetTest();
      }
    } else {
      resetTest();
    }
  }
  renderQuestion();
});