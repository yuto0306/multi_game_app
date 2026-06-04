/*  
===========================================================
 MultiGameApp（最終完成版）
 - 既存コードを極力維持しつつ以下を統合
   ・50問対応（自動スコア計算）
   ・BGM音量バランス（menu/psycho/horror）
   ・効果音追加（footstep / door）とランダム化（足音の揺らぎ）
   ・ホラー演出の最適配置（足音・ドア音を自然に配置）
   ・既存の機能（BGMフェード / darkFade / flash / graph / shareFrame / appLogo 等）は維持
   ・ホラー画像8枚（imgフォルダ上から順）を利用した演出追加
===========================================================
*/

/* ============================================================
   ▼ ホラーゲーム：画像8枚（上から順）
============================================================ */
const horrorImages = [
  "img/Copilot_20260604_114335.jpg", // ① 廃病院の外観
  "img/Copilot_20260604_114451.jpg", // ② 廊下の奥に人影
  "img/Copilot_20260604_114735.jpg", // ③ ベッド横に影
  "img/Copilot_20260604_114742.jpg", // ④ 非常口の緑の光
  "img/Copilot_20260604_114941.jpg", // ⑤ 背後に立つ影
  "img/Copilot_20260604_115354.jpg", // ⑥ ハッピーエンド
  "img/Copilot_20260604_115401.png", // ⑦ バッドエンド
  "img/Copilot_20260604_115412.jpg"  // ⑧ ？？？エンド
];

class MultiGameApp {
  constructor(rootElm) {
    this.rootElm = rootElm;
    this.quizData = null;

    // ゲームの状態をまとめて管理
    this.gameStatus = {
      mode: null,   // "psycho" or "horror"
      step: 1,      // 診断の現在の質問番号
      results: []   // 診断の回答結果
    };

    // BGM 管理（HTMLAudioElement を参照）
    this.bgmElements = {
      menu: document.getElementById("bgm-menu"),
      psycho: document.getElementById("bgm-psycho"),
      horror: document.getElementById("bgm-horror")
    };
    // BGM ターゲット音量（バランス調整）
    this.bgmTargetVolumes = {
      menu: 0.35,
      psycho: 0.45,
      horror: 0.55
    };
    this.currentBgmKey = null;
    this.bgmFadeTimer = null;

    // SE 再生管理（footstep の揺らぎ用設定）
    this.footstepConfig = {
      minRate: 0.9,
      maxRate: 1.15,
      minVol: 0.6,
      maxVol: 0.9
    };
  }

  /* -----------------------------
      初期化（データ読み込み）
  ----------------------------- */
  async init() {
    await this.fetchQuizData();
    this.displayTitleScreen();
  }

  async fetchQuizData() {
    try {
      const res = await fetch("quiz.json");
      this.quizData = await res.json();
    } catch (e) {
      this.rootElm.innerText = "データの読み込みに失敗しました";
      console.error(e);
    }
  }

  /* -----------------------------
      画面切り替え
  ----------------------------- */
  replaceView(elm) {
    this.rootElm.innerHTML = "";
    this.rootElm.appendChild(elm);
  }

  /* -----------------------------
      タイトル画面（豪華版）
  ----------------------------- */
  displayTitleScreen() {
    this.playBGM("menu"); // タイトルBGM

    const html = `
      <div class="titleScreen fadeIn">
        <div class="appLogo">Psycho × Horror</div>
        <h1>マルチ診断＆ホラーゲーム</h1>
        <p>あなたはどちらで遊ぶ？</p>

        <button class="primary psychoBtn">サイコパス診断</button>
        <button class="secondary horrorBtn">ホラー選択ゲーム</button>
      </div>
    `;

    const parent = document.createElement("div");
    parent.innerHTML = html;

    // 診断ゲームへ
    parent.querySelector(".psychoBtn").addEventListener("click", () => {
      this.gameStatus.mode = "psycho";
      this.playSE("click");
      this.playBGM("psycho");
      this.displayPsychoStart();
    });

    // ホラーゲームへ
    parent.querySelector(".horrorBtn").addEventListener("click", () => {
      this.gameStatus.mode = "horror";
      this.playSE("click");
      this.playBGM("horror");
      this.displayHorrorStart();
    });

    this.replaceView(parent);
  }

  /* -----------------------------
      BGM（フェード切り替え）
      - HTML の <audio id="bgm-..."> を利用
      - フェードは setInterval で実装
      - 各トラックのターゲット音量は bgmTargetVolumes で調整
  ----------------------------- */
  playBGM(key) {
    if (!this.bgmElements[key]) return;

    // 既に同じBGMなら何もしない
    if (this.currentBgmKey === key) return;

    const newElm = this.bgmElements[key];
    const targetVol = this.bgmTargetVolumes[key] ?? 0.5;

    const startNew = () => {
      try {
        newElm.volume = 0;
        newElm.currentTime = 0;
        newElm.play().catch(() => {});
        this.fadeAudio(newElm, 0, targetVol, 600);
        this.currentBgmKey = key;
      } catch (e) {
        console.warn("BGM play error", e);
      }
    };

    // フェードアウトしてから切り替える
    if (this.currentBgmKey && this.bgmElements[this.currentBgmKey]) {
      const oldElm = this.bgmElements[this.currentBgmKey];
      this.fadeAudio(oldElm, oldElm.volume || 0.5, 0, 400, () => {
        try { oldElm.pause(); } catch (e) {}
        startNew();
      });
    } else {
      startNew();
    }
  }

  // audio 要素のフェード
  fadeAudio(audioElm, from, to, duration, onComplete) {
    if (!audioElm) {
      if (onComplete) onComplete();
      return;
    }
    if (this.bgmFadeTimer) clearInterval(this.bgmFadeTimer);

    const steps = 24;
    let current = 0;
    audioElm.volume = from;

    this.bgmFadeTimer = setInterval(() => {
      current++;
      const t = current / steps;
      const vol = from + (to - from) * t;
      audioElm.volume = Math.max(0, Math.min(1, vol));

      if (current >= steps) {
        clearInterval(this.bgmFadeTimer);
        this.bgmFadeTimer = null;
        if (onComplete) onComplete();
      }
    }, Math.max(10, duration / steps));
  }

  /* -----------------------------
      効果音（プリロード済み audio 要素を利用）
      - seName: "click" | "scare" | "whisper" | "footstep" | "door"
      - footstep は再生速度と音量をランダム化して怖さを増す
  ----------------------------- */
  playSE(seName) {
    try {
      const id = `se-${seName}`;
      const base = document.getElementById(id);
      if (!base) return;

      // footstep は揺らぎをつける
      if (seName === "footstep") {
        const clone = base.cloneNode(true);
        clone.id = `${id}-${Date.now()}`;
        // ランダムな再生速度と音量で不規則さを演出
        const rate = this._rand(this.footstepConfig.minRate, this.footstepConfig.maxRate);
        const vol = this._rand(this.footstepConfig.minVol, this.footstepConfig.maxVol);
        clone.playbackRate = rate;
        clone.volume = vol;
        document.body.appendChild(clone);
        clone.play().catch(() => {});
        clone.addEventListener("ended", () => clone.remove());
        // 念のためタイムアウトで削除
        setTimeout(() => { if (clone && clone.parentNode) clone.remove(); }, 4000);
        return;
      }

      // door は少し低めの音量で鳴らすことが多い
      if (seName === "door") {
        const clone = base.cloneNode(true);
        clone.id = `${id}-${Date.now()}`;
        clone.volume = 0.75;
        document.body.appendChild(clone);
        clone.play().catch(() => {});
        clone.addEventListener("ended", () => clone.remove());
        setTimeout(() => { if (clone && clone.parentNode) clone.remove(); }, 4000);
        return;
      }

      // その他は通常再生（clone して重ねられる）
      const clone = base.cloneNode(true);
      clone.id = `${id}-${Date.now()}`;
      clone.volume = 0.8;
      document.body.appendChild(clone);
      clone.play().catch(() => {});
      clone.addEventListener("ended", () => clone.remove());
      setTimeout(() => { if (clone && clone.parentNode) clone.remove(); }, 3000);
    } catch (e) {
      console.warn("SE play error", e);
    }
  }

  // 小さな乱数ユーティリティ
  _rand(min, max) {
    return Math.random() * (max - min) + min;
  }

    /* =========================================================
      サイコパス診断（50問対応）
      - quiz.json の totalQuestions または stepN の数を自動検出
  ========================================================= */

  // 診断スタート画面
  displayPsychoStart() {
    this.gameStatus.step = 1;
    this.gameStatus.results = [];

    const total = this.getTotalQuestions();
    const html = `
      <div class="start fadeIn">
        <h2>サイコパス診断</h2>
        <p>${total}問の心理テストであなたのタイプを診断します。</p>

        <button class="primary startBtn">診断を開始する</button>
        <button class="secondary backBtn">タイトルに戻る</button>
      </div>
    `;

    const parent = document.createElement("div");
    parent.innerHTML = html;

    parent.querySelector(".startBtn").addEventListener("click", () => {
      this.playSE("click");
      this.displayPsychoQuestion();
    });

    parent.querySelector(".backBtn").addEventListener("click", () => {
      this.playSE("click");
      this.displayTitleScreen();
    });

    this.replaceView(parent);
  }

  // 質問数を自動検出（quiz.json に meta.totalQuestions があればそれを優先）
  getTotalQuestions() {
    if (!this.quizData) return 20;
    if (this.quizData.meta && Number.isInteger(this.quizData.meta.totalQuestions)) {
      return this.quizData.meta.totalQuestions;
    }
    // カウント stepN のキー
    let count = 0;
    for (const k in this.quizData) {
      if (/^step\d+$/.test(k)) count++;
    }
    return count || 20;
  }

  // 診断の質問画面
  displayPsychoQuestion() {
    const total = this.getTotalQuestions();
    const stepKey = `step${this.gameStatus.step}`;
    const q = this.quizData[stepKey];

    // フォールバック
    if (!q) {
      // もし質問が足りない場合は結果へ
      this.displayPsychoResult();
      return;
    }

    const choiceStrs = q.choices.map((c, idx) => `
      <label class="choiceCard" data-choice-index="${idx}">
        <input type="radio" name="choice" value="${c}">
        <span>${c}</span>
      </label>
    `);

    const html = `
      <div class="questionView fadeIn">
        <h2>Q${this.gameStatus.step} / ${total}</h2>
        <p class="questionText">${q.word}</p>

        <div class="choices">${choiceStrs.join("")}</div>

        <button class="primary nextBtn">次へ</button>
      </div>
    `;

    const parent = document.createElement("div");
    parent.innerHTML = html;

    // 選択肢クリックで効果音（クリック音）
    parent.querySelectorAll(".choiceCard").forEach(card => {
      card.addEventListener("click", () => {
        this.playSE("click");
      });
    });

    parent.querySelector(".nextBtn").addEventListener("click", () => {
      const checked = parent.querySelector("input[name='choice']:checked");

      if (!checked) {
        this.triggerShake(parent);
        this.playSE("scare");
        alert("選択肢を選んでください");
        return;
      }

      this.addPsychoResult(checked.value);

      const totalQ = this.getTotalQuestions();
      if (this.gameStatus.step >= totalQ) {
        this.displayPsychoResult();
      } else {
        this.gameStatus.step++;
        this.displayPsychoQuestion();
      }
    });

    this.replaceView(parent);
  }

  // 診断の回答保存
  addPsychoResult(selected) {
    const stepKey = `step${this.gameStatus.step}`;
    const q = this.quizData[stepKey];

    this.gameStatus.results.push({
      selected,
      correct: q ? q.answer : null
    });
  }

  // サイコパス度計算（自動総問題数対応）
  calcPsychoScore() {
    const totalQ = this.getTotalQuestions();
    let correctCount = 0;
    for (const r of this.gameStatus.results) {
      if (r.correct && r.selected === r.correct) correctCount++;
    }
    // パーセンテージ（0-100）
    return Math.floor((correctCount / totalQ) * 100);
  }

  // タイプ判定（既存ロジックを維持）
  getTypeInfo(score) {
    const info = this.quizData.resultsInfo || {};
    if (score <= 20) return info.typeA || { title: "タイプA", desc: "" };
    if (score <= 40) return info.typeB || { title: "タイプB", desc: "" };
    if (score <= 60) return info.typeC || { title: "タイプC", desc: "" };
    if (score <= 80) return info.typeD || { title: "タイプD", desc: "" };
    return info.typeE || { title: "タイプE", desc: "" };
  }

  // 診断結果画面（グラフ表示を追加）
  displayPsychoResult() {
    const score = this.calcPsychoScore();
    const typeInfo = this.getTypeInfo(score);

    const graphHTML = `
      <div class="graphBar">
        <div class="graphFill" style="width: 0%"></div>
      </div>
    `;

    const html = `
      <div class="resultView fadeIn shareFrame" id="shareTarget">
        <h2>${typeInfo.title}</h2>
        <p class="score">サイコパス度：${score}%</p>
        ${graphHTML}
        <p class="desc">${typeInfo.desc}</p>

        <button class="primary shareBtn">結果画像を保存</button>
        <button class="secondary backBtn">タイトルに戻る</button>
      </div>
    `;

    const parent = document.createElement("div");
    parent.innerHTML = html;

    // グラフのアニメーション（DOM が描画された後に幅をセット）
    setTimeout(() => {
      const fill = parent.querySelector(".graphFill");
      if (fill) fill.style.width = `${score}%`;
    }, 50);

    parent.querySelector(".shareBtn").addEventListener("click", () => {
      this.playSE("click");
      this.captureShareImage(parent.querySelector("#shareTarget"));
    });

    parent.querySelector(".backBtn").addEventListener("click", () => {
      this.playSE("click");
      this.displayTitleScreen();
    });

    this.replaceView(parent);
  }

  /* =========================================================
      ホラー選択ゲーム（分岐＋隠しルート）
      - 画像8枚を使用
      - 足音/ドア音/囁き/スケアを最適配置
      - 既存の演出（flash / darkFade / shake）を活用
  ========================================================= */

  displayHorrorStart() {
    const html = `
      <div class="horrorStart fadeIn">
        <h2>深夜の廃病院</h2>
        <p>あなたは噂の廃病院に足を踏み入れた…</p>

        <button class="primary startHorror">探索を開始する</button>
        <button class="secondary backBtn">タイトルに戻る</button>
      </div>
    `;

    const parent = document.createElement("div");
    parent.innerHTML = html;

    // 探索開始
    parent.querySelector(".startHorror").addEventListener("click", () => {
      this.playSE("footstep");
      this.playSE("click");
      this.displayHorrorScene1();
    });

    // タイトルへ戻る
    parent.querySelector(".backBtn").addEventListener("click", () => {
      this.playSE("click");
      this.displayTitleScreen();
    });

    this.replaceView(parent);
  }

  /* -----------------------------
      シーン1（3分岐）
  ----------------------------- */
  displayHorrorScene1() {
    const html = `
      <div class="horrorScene fadeIn">
        <img src="${horrorImages[1]}" class="horrorImg">
        <p>暗い廊下の奥から、誰かの笑い声が……<br>
        いや、“誰か”じゃない。もっと近い、もっと低い、もっと…耳元で。</p>

        <button class="primary c1">声の方へ進む</button>
        <button class="secondary c2">別の階へ移動する</button>
        <button class="secondary c3">その場で様子を見る</button>
      </div>
    `;

    const parent = document.createElement("div");
    parent.innerHTML = html;

    // 声の方へ → バッド寄り
    parent.querySelector(".c1").addEventListener("click", () => {
      this.playSE("scare");
      this.triggerFlash(parent);
      this.triggerDarkFade();
      setTimeout(() => {
        this.playSE("door");
        this.playSE("footstep");
        this.displayHorrorScene2();
      }, 500);
    });

    // 別の階へ → ハッピー寄り
    parent.querySelector(".c2").addEventListener("click", () => {
      this.playSE("footstep");
      this.displayHorrorScene3();
    });

    // 様子を見る → 隠しルート
    parent.querySelector(".c3").addEventListener("click", () => {
      this.playSE("whisper");
      setTimeout(() => this.playSE("footstep"), 250);
      this.triggerDarkFade();
      setTimeout(() => this.displayHorrorSecretRoute(), 600);
    });

    this.replaceView(parent);
  }

  /* -----------------------------
      シーン2（バッド寄り）
  ----------------------------- */
  displayHorrorScene2() {
    const html = `
      <div class="horrorScene fadeIn">
        <img src="${horrorImages[2]}" class="horrorImg">
        <p>笑い声の部屋に入ると、誰もいないはずのベッドが、<br>
        “何かが起き上がろうとしている”ように揺れている。</p>

        <button class="primary c1">ベッドを覗き込む</button>
        <button class="secondary c2">すぐに部屋を出る</button>
      </div>
    `;

    const parent = document.createElement("div");
    parent.innerHTML = html;

    // 覗き込む → バッドエンド
    parent.querySelector(".c1").addEventListener("click", () => {
      this.playSE("scare");
      this.triggerFlash(parent);
      this.triggerDarkFade();
      setTimeout(() => {
        this.playSE("scare");
        this.displayHorrorBadEnd();
      }, 500);
    });

    // 逃げる → ハッピーエンド
    parent.querySelector(".c2").addEventListener("click", () => {
      this.playSE("footstep");
      this.displayHorrorHappyEnd();
    });

    this.replaceView(parent);
  }

  /* -----------------------------
      シーン3（ハッピー寄り）
  ----------------------------- */
  displayHorrorScene3() {
    const html = `
      <div class="horrorScene fadeIn">
        <img src="${horrorImages[3]}" class="horrorImg">
        <p>階段を降りると、非常口のランプがかすかに光っている。<br>
        ただ、その光の下には“誰かの影”が見える気がする…。</p>

        <button class="primary c1">出口へ向かう</button>
        <button class="secondary c2">もう少し探索する</button>
      </div>
    `;

    const parent = document.createElement("div");
    parent.innerHTML = html;

    // 出口へ → ハッピーエンド
    parent.querySelector(".c1").addEventListener("click", () => {
      this.playSE("footstep");
      this.displayHorrorHappyEnd();
    });

    // 探索 → バッドエンド
    parent.querySelector(".c2").addEventListener("click", () => {
      this.playSE("scare");
      this.triggerDarkFade();
      setTimeout(() => this.displayHorrorBadEnd(), 500);
    });

    this.replaceView(parent);
  }

  /* -----------------------------
      隠しルート（？？？エンド分岐）
  ----------------------------- */
  displayHorrorSecretRoute() {
    const html = `
      <div class="horrorScene fadeIn">
        <img src="${horrorImages[4]}" class="horrorImg">
        <p>静かに耳を澄ますと、あなたの名前を呼ぶ声が、<br>
        背後の“すぐそこ”から聞こえた。</p>

        <button class="primary c1">振り向く</button>
        <button class="secondary c2">振り向かない</button>
      </div>
    `;

    const parent = document.createElement("div");
    parent.innerHTML = html;

    // 振り向く → ？？？エンド
    parent.querySelector(".c1").addEventListener("click", () => {
      this.playSE("whisper");
      this.triggerFlash(parent);
      setTimeout(() => {
        this.playSE("scare");
        this.triggerDarkFade();
        setTimeout(() => this.displayHorrorSecretEnd(), 500);
      }, 300);
    });

    // 振り向かない → ハッピーエンド
    parent.querySelector(".c2").addEventListener("click", () => {
      this.playSE("footstep");
      this.displayHorrorHappyEnd();
    });

    this.replaceView(parent);
  }

  /* -----------------------------
      エンディング（3種類）
  ----------------------------- */

  // ハッピーエンド
  displayHorrorHappyEnd() {
    const html = `
      <div class="ending happy fadeIn shareFrame" id="shareTarget">
        <img src="${horrorImages[5]}" class="horrorImg">
        <h2>【ハッピーエンド】</h2>
        <p>あなたは無事に廃病院から脱出した。<br>
        ただ、背後から聞こえた足音の主だけが、まだ“ここ”に残っている。</p>

        <button class="primary shareBtn">結果画像を保存</button>
        <button class="secondary backBtn">タイトルに戻る</button>
      </div>
    `;
    this.renderHorrorEnding(html);
  }

  // バッドエンド
  displayHorrorBadEnd() {
    const html = `
      <div class="ending bad fadeIn shareFrame" id="shareTarget">
        <img src="${horrorImages[6]}" class="horrorImg">
        <h2>【バッドエンド】</h2>
        <p>あなたは二度と戻れない場所へと消えていった。<br>
        次にこの廃病院を訪れるのは、誰だろうか。</p>

        <button class="primary shareBtn">結果画像を保存</button>
        <button class="secondary backBtn">タイトルに戻る</button>
      </div>
    `;
    this.renderHorrorEnding(html);
  }

  // ？？？エンド
  displayHorrorSecretEnd() {
    const html = `
      <div class="ending secret fadeIn shareFrame" id="shareTarget">
        <img src="${horrorImages[7]}" class="horrorImg">
        <h2>【？？？エンド】</h2>
        <p>あなたは“ここ”の新しい住人として迎え入れられた。<br>
        今度はあなたが、誰かの名前を呼ぶ番だ。</p>

        <button class="primary shareBtn">結果画像を保存</button>
        <button class="secondary backBtn">タイトルに戻る</button>
      </div>
    `;
    this.renderHorrorEnding(html);
  }

  /* -----------------------------
      エンディング共通処理
  ----------------------------- */
  renderHorrorEnding(html) {
    const parent = document.createElement("div");
    parent.innerHTML = html;

    // シェア画像
    parent.querySelector(".shareBtn").addEventListener("click", () => {
      this.playSE("click");
      this.captureShareImage(parent.querySelector("#shareTarget"));
    });

    // タイトルへ戻る
    parent.querySelector(".backBtn").addEventListener("click", () => {
      this.playSE("click");
      this.displayTitleScreen();
    });

    this.replaceView(parent);
  }

  /* -----------------------------
      演出（揺れ・フラッシュ・暗転）
  ----------------------------- */
  triggerShake(elm) {
    elm.classList.add("shake");
    setTimeout(() => elm.classList.remove("shake"), 400);
  }

  triggerFlash(elm) {
    elm.classList.add("flash");
    setTimeout(() => elm.classList.remove("flash"), 300);
  }

  triggerDarkFade() {
    const fade = document.createElement("div");
    fade.className = "darkFade";
    document.body.appendChild(fade);
    setTimeout(() => {
      if (fade && fade.parentNode) fade.parentNode.removeChild(fade);
    }, 700);
  }

  /* -----------------------------
      SNS風シェア画像生成
  ----------------------------- */
  captureShareImage(targetElm) {
    // html2canvas は index.html で読み込まれている前提
    html2canvas(targetElm).then(canvas => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "result.png";
      link.click();
    }).catch(e => {
      console.warn("capture error", e);
    });
  }
} // ← MultiGameApp クラスここで終了


/* -----------------------------
    アプリ起動
----------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  new MultiGameApp(document.getElementById("app")).init();
});

