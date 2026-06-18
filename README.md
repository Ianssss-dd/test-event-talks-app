# BigQuery Release Notes Hub & Tweet Composer

這是一個專為 Google Cloud BigQuery 版本資訊所設計的**即時追蹤與 Twitter/X 社群分享系統**。採用輕量且高效的 **Python Flask** 作為後端，並結合**原生 HTML、CSS（暗色系 Glassmorphism 視覺設計）與 JavaScript**，提供無需繁瑣設定、即裝即用的流暢體驗。

---

## 🌟 專案特色 (Key Features)

*   **時間軸動態渲染 (Dynamic Timeline)**
    *   自動將 BigQuery Release XML 訂閱源整理為依日期排列的精美時間軸。
    *   以微動畫（Micro-animations）和發光效果（Glow-border）增強選取狀態。
*   **智慧解析與標籤分類 (Smart Parsing & Tagging)**
    *   在前端記憶體中使用 `DOMParser` 將單日的大型 HTML 更新文件解析並拆分為多張獨立卡片。
    *   依據更新屬性自動套用專屬的視覺主題與標籤：
        *   🟢 **Feature**：新功能引進（綠色主題）
        *   🟡 **Changed**：現有功能變更或優化（橘色主題）
        *   🔴 **Deprecated**：廢棄與即將移除的功能（紅色主題）
        *   🔵 **Resolved**：問題修復與錯誤排除（藍色主題）
*   **伺服器端高效快取 (Backend Caching)**
    *   內建 5 分鐘快取機制（Cache TTL: 300秒），防止頻繁整理時對 Google 服務造成存取負擔並加速頁面讀取。
    *   **容錯備援設計**：若 Google 網路連線失敗，自動載入最近一次的快取資料，並以警告橫幅提示使用者，確保服務不中斷。
*   **多維度前端過濾與搜尋 (Instant Search & Filter)**
    *   **關鍵字搜尋**：輸入關鍵字（例如 `embeddings`、`SQL`），即時篩選相關時間軸卡片（支援防抖動 Debouncing，節省效能）。
    *   **類別過濾**：一鍵切換類別標籤（如只顯示 Features），秒級篩選。
*   **互動式推文編輯器 (Interactive Tweet Composer)**
    *   點擊時間軸上的任意卡片，右側編輯器即刻生成推文草稿。
    *   **純文字自動轉換**：自動去除複雜的 HTML 標籤，並以演算法在 280 字元限制內進行智慧內容截斷。
    *   **快捷主題標籤與網址**：一鍵開關 `#BigQuery`、`#GoogleCloud` 等標籤，以及包含該則更新的官方原網址。
    *   **字數動態監控**：即時倒數剩餘字數，並以黃色（小於 30 字）和紅色（超過限制）發出視覺警示。
    *   **Twitter Web Intent 整合**：點擊發送後直接導向 Twitter/X 官方網址，無須提供敏感的帳號密碼或付費 API Token。

---

## 🛠️ 開發技術棧 (Technologies)

*   **後端 (Backend)**: Python 3.13+, Flask, Requests, Feedparser (XML 解析)
*   **前端 (Frontend)**: 
    *   **HTML5**：語意化標籤，遵從 SEO 最佳實踐。
    *   **CSS3**：純原生 CSS 設計，使用 HSL 色彩系統、背景光暈漸層、毛玻璃特效（Glassmorphism）與 RWD 響應式佈局。
    *   **JavaScript**：原生 ES6+，處理 DOM 解析、即時篩選、動態防抖搜尋、及推文長度計算。

---

## 📂 專案目錄結構 (Project Structure)

```text
agy-cli-projects/
│
├── app.py                # Flask 後端應用程式 (資料抓取、記憶體快取與 API 接口)
├── templates/
│   └── index.html        # 主頁面 HTML 結構及 SEO 配置
│
├── static/
│   ├── css/
│   │   └── style.css     # 精美暗黑系 Glassmorphism CSS 樣式表
│   └── js/
│       └── app.js        # 前端核心邏輯 (XML 解析分組、搜尋過濾及推文生成)
│
├── .gitignore            # Git 忽略檔案設定
└── README.md             # 專案說明文件
```

---

## 🚀 快速安裝與運行步驟 (Setup & Run)

### 1. 安裝必要套件
在終端機（PowerShell 或 Command Prompt）中執行以下指令，安裝 Flask 及相關解析套件：
```powershell
python -m pip install flask requests feedparser
```

### 2. 啟動伺服器
進入專案根目錄，執行：
```powershell
python app.py
```

### 3. 開啟網頁
伺服器啟動後，在瀏覽器輸入以下網址即可使用：
**[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📖 使用操作說明 (Usage Guide)

1.  **瀏覽與更新**：網頁載入時會自動拉取最新 30 筆 Release Notes。您可以點擊右上角的 **[Refresh]** 按鈕強制刷新。
2.  **搜尋篩選**：在搜尋欄輸入關鍵字，或點擊 "Features"、"Changes" 等分類標籤，左側時間軸將會即時更新。
3.  **選擇並分享**：
    *   點選時間軸上的任何一個更新卡片，卡片將會呈現發光邊框，且右側會出現推文編輯區。
    *   您可以自由修改推文文字，點擊下方的 `#GCP`、`#BigQuery` 等標籤進行快速添加或移除。
    *   點選 **[Tweet on X / Twitter]** 按鈕，系統將自動開啟新分頁，將推文內容帶入您的 Twitter/X 發文欄位中。
