// 定义 MBTI 维度与问题
const questions = [
  { text: "在社交场合中，你通常……", options: ["喜欢成为焦点，能量来自外界", "安静观察，需要独处恢复能量"], dimension: "I/E", reverse: false },
  { text: "你更倾向于……", options: ["关注具体事实和细节", "关注整体模式和可能性"], dimension: "N/S", reverse: false },
  { text: "做决定时，你更看重……", options: ["逻辑分析和客观原则", "人情和谐与个人价值"], dimension: "T/F", reverse: false },
  { text: "你更喜欢的生活方式……", options: ["计划性强，喜欢条理清晰", "灵活随性，适应变化"], dimension: "J/P", reverse: false },
  { text: "别人通常认为你……", options: ["务实、脚踏实地", "富有想象力、喜欢新概念"], dimension: "N/S", reverse: false },
  { text: "在团队工作中，你倾向于……", options: ["主导进程，明确分工", "协调关系，让大家都参与"], dimension: "T/F", reverse: true },
  { text: "你更容易被……", options: ["明确规则和结构所吸引", "开放自由的可能性所吸引"], dimension: "J/P", reverse: false },
  { text: "你的精力主要来自……", options: ["与外界的互动", "独处的思考"], dimension: "I/E", reverse: false }
];

let currentQuestionIndex = 0;
let answers = { "I/E": 0, "N/S": 0, "T/F": 0, "J/P": 0 };
let totalQuestions = questions.length;

// 渲染当前问题
function renderQuestion() {
  const q = questions[currentQuestionIndex];
  const container = document.getElementById('question-area');
  if (!container) return;

  let html = `
        <div class="question-text">${currentQuestionIndex + 1}. ${q.text}</div>
        <div class="options-list">
    `;
  q.options.forEach((opt, idx) => {
    html += `<button class="option-btn" data-opt="${idx}">${opt}</button>`;
  });
  html += `</div><div class="progress-info"><span>第 ${currentQuestionIndex + 1} / ${totalQuestions} 题</span><span>探索英雄人格</span></div>`;
  container.innerHTML = html;

  // 绑定事件
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const selected = parseInt(btn.dataset.opt);
      handleAnswer(selected);
    });
  });
}

function handleAnswer(selectedIdx) {
  const q = questions[currentQuestionIndex];
  // 选项0 倾向第一项(外向/实感/思考/判断)， 选项1倾向第二项(内向/直觉/情感/感知)
  let score = (selectedIdx === 0) ? 1 : -1;
  if (q.reverse) score = -score;  // 反向题处理

  const dim = q.dimension;
  answers[dim] += score;

  currentQuestionIndex++;
  if (currentQuestionIndex < totalQuestions) {
    renderQuestion();
  } else {
    finishTest();
  }
}

function finishTest() {
  // 计算最终 MBTI 字母
  const ie = answers["I/E"] >= 0 ? "E" : "I";
  const ns = answers["N/S"] >= 0 ? "N" : "S";
  const tf = answers["T/F"] >= 0 ? "T" : "F";
  const jp = answers["J/P"] >= 0 ? "J" : "P";
  const mbtiResult = ie + ns + tf + jp;

  // 查找匹配英雄（优先完全匹配，若无则随机一个相近）
  let matchedChampion = null;
  if (championsData.length === 0) {
    // 数据未加载，稍后重试
    setTimeout(() => finishTest(), 200);
    return;
  }
  const exactMatches = championsData.filter(c => c.mbti === mbtiResult);
  if (exactMatches.length > 0) {
    matchedChampion = exactMatches[Math.floor(Math.random() * exactMatches.length)];
  } else {
    // 降级：推荐任意英雄
    matchedChampion = championsData[Math.floor(Math.random() * championsData.length)];
  }

  // 展示结果
  displayResult(matchedChampion, mbtiResult);
}

function displayResult(champion, mbti) {
  const questionArea = document.getElementById('question-area');
  const resultArea = document.getElementById('result-area');
  questionArea.style.display = 'none';
  resultArea.style.display = 'block';

  const storySnippet = champion.story ? champion.story.replace(/<[^>]*>/g, '').substring(0, 280) + "..." : "暂无故事简介。";

  resultArea.innerHTML = `
        <div class="champion-match">
            <div class="mbti-badge">${mbti}</div>
            <div class="match-name">${champion.name}</div>
            <div class="match-title">${champion.title || '符文之地英雄'}</div>
        </div>
        <div class="story-preview">
            ${storySnippet}
        </div>
        <div style="margin-top: 1rem;">
            <button id="restart-test" class="btn-primary">重新测试</button>
            <a href="catalog.html" class="btn-outline" style="margin-left: 1rem;">浏览图鉴</a>
        </div>
    `;
  document.getElementById('restart-test')?.addEventListener('click', () => {
    resetTest();
  });
}

function resetTest() {
  currentQuestionIndex = 0;
  answers = { "I/E": 0, "N/S": 0, "T/F": 0, "J/P": 0 };
  const questionArea = document.getElementById('question-area');
  const resultArea = document.getElementById('result-area');
  questionArea.style.display = 'block';
  resultArea.style.display = 'none';
  renderQuestion();
}

// 页面加载初始化
window.addEventListener('DOMContentLoaded', async () => {
  await loadChampions();
  renderQuestion();
});