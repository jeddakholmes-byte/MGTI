// ==================== MGTI 运行配置 ====================
// 本文件需要在 data.js 之前加载。
// 目标：集中管理部署路径、题目版本、调试开关和统计配置，避免在多个 JS 文件中写死路径。
(function () {
  const path = window.location?.pathname || "/";
  const host = window.location?.hostname || "";
  const protocol = window.location?.protocol || "";
  const isLocal = protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  const isMGTIProjectPath = path === "/MGTI" || path.startsWith("/MGTI/");

  const dataBasePath = isLocal
    ? "./data/"
    : (isMGTIProjectPath ? "/MGTI/data/" : "./data/");

  window.MGTI_CONFIG = Object.freeze({
    APP_NAME: "MGTI",
    APP_FULL_NAME: "My Game Type Indicator",
    APP_VERSION: "2.1.0",
    QUESTION_VERSION: "2.0",

    DATA_BASE_PATH: dataBasePath,
    DATA_PATH_CANDIDATES: [
      dataBasePath,
      "./data/",
      "../data/",
      "/data/",
      "/MGTI/data/"
    ],

    FETCH_TIMEOUT_MS: 8000,
    DEBUG: false,

    DIMENSION_IDS: ["TAC", "TEA", "EMO", "DEC", "PRE"],

    ANALYTICS: {
      enabled: false,
      provider: "none",
      measurementId: "",
      endpoint: "",
      sampleRate: 1
    }
  });
})();
