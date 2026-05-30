// ==================== 题库 ====================
const questions = [
  // I/E 维度 (外向 E 为正，内向 I 为负)
  { text: "我喜欢成为派对或聚会的焦点。", dimension: "I/E", reverse: false },
  { text: "和一群人相处后，我需要独处来充电。", dimension: "I/E", reverse: true },
  { text: "我更喜欢和朋友一起工作而不是单独工作。", dimension: "I/E", reverse: false },
  { text: "在社交场合，我通常是主动开口的人。", dimension: "I/E", reverse: false },
  { text: "周末我更喜欢宅在家里而不是出去社交。", dimension: "I/E", reverse: true },

  // N/S 维度 (直觉 N 为正，实感 S 为负)
  { text: "我更喜欢思考未来可能发生的事情，而不是眼前的现实。", dimension: "N/S", reverse: false },
  { text: "我注重具体事实和细节多于抽象概念。", dimension: "N/S", reverse: true },
  { text: "我经常产生新的创意和想法。", dimension: "N/S", reverse: false },
  { text: "我喜欢按部就班、有条理地做事。", dimension: "N/S", reverse: true },
  { text: "我更喜欢学习理论概念而不是具体操作。", dimension: "N/S", reverse: false },

  // T/F 维度 (思考 T 为正，情感 F 为负)
  { text: "做决定时，我主要依靠逻辑分析。", dimension: "T/F", reverse: false },
  { text: "我很在乎他人的感受，有时会为此牺牲原则。", dimension: "T/F", reverse: true },
  { text: "我认为公平比仁慈更重要。", dimension: "T/F", reverse: false },
  { text: "我很容易被他人的情绪感染。", dimension: "T/F", reverse: true },
  { text: "评价一个方案时，我更看重它的效果而非它是否让人舒服。", dimension: "T/F", reverse: false },

  // J/P 维度 (判断 J 为正，感知 P 为负)
  { text: "我喜欢提前制定详细的计划。", dimension: "J/P", reverse: false },
  { text: "我经常拖延任务到最后一刻。", dimension: "J/P", reverse: true },
  { text: "我的生活空间通常很整洁有序。", dimension: "J/P", reverse: false },
  { text: "我喜欢临时做决定，保持灵活性。", dimension: "J/P", reverse: true },
  { text: "我倾向于完成一件事后再开始另一件。", dimension: "J/P", reverse: false }
];

// 选项配置（五点量表）
const options = [
  { label: "非常同意", value: 2 },
  { label: "同意", value: 1 },
  { label: "中立", value: 0 },
  { label: "不同意", value: -1 },
  { label: "非常不同意", value: -2 }
];

let currentIndex = 0;
let scores = { "I/E": 0, "N/S": 0, "T/F": 0, "J/P": 0 };
let totalQuestions = questions.length;

function renderQuestion() {
  const q = questions[currentIndex];
  const container = document.getElementById('question-area');
  if (!container) return;

  let html = `
        <div class="question-text">${currentIndex + 1}. ${q.text}</div>
        <div class="options-list">
    `;
  options.forEach(opt => {
    html += `<button class="option-btn" data-value="${opt.value}">${opt.label}</button>`;
  });
  html += `</div><div class="progress-info"><span>${currentIndex + 1} / ${totalQuestions}</span><span>探索你的英雄人格</span></div>`;
  container.innerHTML = html;

  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rawValue = parseInt(btn.dataset.value);
      handleAnswer(rawValue);
    });
  });
}

function handleAnswer(rawValue) {
  const q = questions[currentIndex];
  let score = rawValue;
  if (q.reverse) score = -score;
  scores[q.dimension] += score;

  currentIndex++;
  if (currentIndex < totalQuestions) {
    renderQuestion();
  } else {
    finishTest();
  }
}

function getUserVector() {
  const ie = scores["I/E"] / 2;
  const ns = scores["N/S"] / 2;
  const tf = scores["T/F"] / 2;
  const jp = scores["J/P"] / 2;
  return { I: -ie, E: ie, N: ns, S: -ns, T: tf, F: -tf, J: jp, P: -jp };
}

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
}

function displayResult(champion, mbtiLetter) {
  const questionArea = document.getElementById('question-area');
  const resultArea = document.getElementById('result-area');
  questionArea.style.display = 'none';
  resultArea.style.display = 'block';

  const storyPreview = champion.story ? champion.story.replace(/<[^>]*>/g, '').substring(0, 280) + "..." : "暂无故事简介。";
  const avatarUrl = champion.image_url || 'https://ddragon.leagueoflegends.com/cdn/15.5.1/img/champion/default.png';

  // 获取深度解析（优先英雄专属，否则按MBTI通用）
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
            <div class="match-name">${champion.name}</div>
            <div class="match-title">${champion.title || '符文之地英雄'}</div>
        </div>
        <div class="analysis-section">
            <h3>📊 人格解析</h3>
            <p><strong>${analysis.title}</strong></p>
            <p>${analysis.traits}</p>
            <div class="analysis-grid">
                <div class="strengths"><strong>✨ 优势</strong><br>${analysis.strengths}</div>
                <div class="weaknesses"><strong>⚠️ 劣势</strong><br>${analysis.weaknesses}</div>
            </div>
            <div class="advice"><strong>💡 成长建议</strong><br>${analysis.advice}</div>
            <div class="quote"><strong>🎭 英雄语录</strong><br>“${analysis.quote}”</div>
        </div>
        <div class="story-preview">
            <strong>📖 背景故事</strong><br>${storyPreview}
        </div>
        <div style="margin-top: 1rem;">
            <button id="restart-test" class="btn-primary">重新测试</button>
            <a href="catalog.html" class="btn-outline" style="margin-left: 1rem;">浏览图鉴</a>
        </div>
    `;
  const restartBtn = document.getElementById('restart-test');
  if (restartBtn) restartBtn.addEventListener('click', resetTest);
}

function resetTest() {
  currentIndex = 0;
  scores = { "I/E": 0, "N/S": 0, "T/F": 0, "J/P": 0 };
  const questionArea = document.getElementById('question-area');
  const resultArea = document.getElementById('result-area');
  questionArea.style.display = 'block';
  resultArea.style.display = 'none';
  renderQuestion();
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadChampions();
  renderQuestion();
});