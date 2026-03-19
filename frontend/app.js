(function () {
    const LoveStock = {
        config: CONFIG,

        state: {
            currentQuestion: 0,
            answers: [],
            isLocked: false,
            telegramUser: null,
            historyResult: null
        },

        questions: [
            { q: "How long ago were you last confessed to?", opts: ["Within the last month", "Sometime this year", "Can't really remember", "Never happened, I think"] },
            { q: "After a breakup, how fast do you bounce back?", opts: ["Under a week - I'm a professional", "A month, give or take", "Several months of fog", "Still loading..."] },
            { q: "In a relationship, you're usually...", opts: ["The one doing the chasing", "The one being chased", "Mutual pining until someone cracks", "Whatever the universe decides"] },
            { q: "Your average reply time to a text?", opts: ["Instant - I have no self-control", "A few minutes, casually", "When I remember", "My read receipts are off for a reason"] },
            { q: "Your ex would most likely describe you as...", opts: ["Too clingy, honestly", "A little cold, but fair", "Perfect - they just weren't ready", "I have no ex. I am the ex."] },
            { q: "Your ideal weekend looks like?", opts: ["Loud, crowded, maximum people", "A small group, good vibes", "Home, solo, do not disturb", "Purely depends on my mood"] },
            { q: "In a relationship, what matters most?", opts: ["Being truly understood", "Stability and safety", "Space to be yourself", "Growing together"] },
            { q: "Your biggest relationship asset is...", opts: ["I'm the fun one, always", "Reliable as a Swiss clock", "Radically self-sufficient", "All-in when I'm in"] }
        ],

        loadingMessages: [
            "Auditing emotional volatility...",
            "Checking dividend history...",
            "Pricing attachment style...",
            "Consulting the love index...",
            "Calibrating mystery premium...",
            "Running IPO risk assessment...",
            "Finalizing your valuation..."
        ],

        init() {
            this.initTelegramSDK();
            this.checkInit();
        },

        initTelegramSDK() {
            const tg = window.Telegram?.WebApp;
            if (!tg) return;

            tg.ready();
            tg.expand();
            this.state.telegramUser = tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
            if (typeof tg.setHeaderColor === "function") tg.setHeaderColor("#0a0813");
            if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor("#0e0b14");
        },

        getTelegramInitData() {
            return window.Telegram?.WebApp?.initData || "";
        },

        async apiCall(path, options = {}, retryCount = 1) {
            const headers = {
                "X-Telegram-Init-Data": this.getTelegramInitData(),
                ...(options.headers || {})
            };

            try {
                const response = await fetch(this.config.API_BASE_URL + path, {
                    ...options,
                    headers
                });

                let payload = null;
                try {
                    payload = await response.json();
                } catch (e) {
                    payload = {
                        success: false,
                        error: "INVALID_RESPONSE",
                        message: "Server returned invalid response"
                    };
                }

                if (!response.ok) {
                    const err = new Error(payload.message || "Request failed");
                    err.status = response.status;
                    err.payload = payload;
                    throw err;
                }

                return payload;
            } catch (error) {
                const isNetworkError = error instanceof TypeError || error.message === "Failed to fetch";
                if (isNetworkError && retryCount > 0) {
                    return this.apiCall(path, options, retryCount - 1);
                }
                throw error;
            }
        },

        async checkInit() {
            // 本地浏览器无 Telegram 对象时，直接进入欢迎页，避免报错
            if (!window.Telegram?.WebApp) {
                this.navigateTo("welcome");
                return;
            }

            try {
                const json = await this.apiCall("/api/init", { method: "GET" });
                if (!json.success) {
                    this.showError("Authentication failed");
                    return;
                }

                this.state.telegramUser = {
                    id: json.data.user_id,
                    username: json.data.username,
                    first_name: json.data.first_name
                };

                if (json.data.has_result && json.data.result) {
                    this.state.historyResult = json.data.result;
                    this.navigateTo("result");
                    return;
                }

                this.navigateTo("welcome");
            } catch (error) {
                if (error.status === 401) {
                    this.showError("Authentication failed. Please open in Telegram.");
                    return;
                }
                this.showError("Failed to connect to server");
            }
        },

        navigateTo(page) {
            const container = document.getElementById("ls-page");
            if (!container) return;

            switch (page) {
                case "welcome":
                    container.innerHTML = this.renderWelcomePage();
                    break;
                case "quiz":
                    container.innerHTML = this.renderQuizPage();
                    this.renderQuestion();
                    break;
                case "loading":
                    container.innerHTML = this.renderLoadingPage();
                    break;
                case "result":
                    container.innerHTML = this.renderResultPage();
                    this.bindResultEvents();
                    break;
                default:
                    this.showError("Unknown page state");
                    return;
            }

            this.bindEvents();
        },

        bindEvents() {
            const startBtn = document.getElementById("ls-startbtn");
            if (startBtn) {
                startBtn.onclick = () => this.startQuiz();
            }

            const optionsWrap = document.getElementById("ls-opts");
            if (optionsWrap) {
                optionsWrap.onclick = (event) => {
                    const btn = event.target.closest(".ls-opt");
                    if (!btn) return;
                    const idx = Number(btn.dataset.index);
                    this.handleAnswer(idx);
                };
            }
        },

        bindResultEvents() {
            const retryBtn = document.getElementById("ls-retry-btn");
            if (retryBtn) {
                retryBtn.onclick = () => {
                    this.startQuiz();
                };
            }
        },

        startQuiz() {
            this.state.currentQuestion = 0;
            this.state.answers = [];
            this.state.isLocked = false;
            this.navigateTo("quiz");
        },

        renderQuestion() {
            const q = this.questions[this.state.currentQuestion];
            if (!q) return;

            const pct = Math.round(((this.state.currentQuestion + 1) / this.questions.length) * 100);
            const plbl = document.getElementById("ls-plbl");
            const pfill = document.getElementById("ls-pfill");
            const ppct = document.getElementById("ls-ppct");
            const cticker = document.getElementById("ls-cticker");
            const cq = document.getElementById("ls-cq");
            const cb = document.getElementById("ls-cb");
            const cc = document.getElementById("ls-cc");
            const opts = document.getElementById("ls-opts");

            if (plbl) plbl.textContent = "Q " + (this.state.currentQuestion + 1) + " / 8";
            if (pfill) pfill.style.width = pct + "%";
            if (ppct) ppct.textContent = pct + "%";
            if (cticker) cticker.textContent = "LOVESTOCK - Q" + (this.state.currentQuestion + 1);
            if (cq) cq.textContent = q.q;
            if (cb) cb.style.display = this.state.currentQuestion >= this.questions.length - 1 ? "none" : "";
            if (cc) cc.style.display = this.state.currentQuestion >= this.questions.length - 2 ? "none" : "";

            if (opts) {
                opts.innerHTML = q.opts.map((text, i) => (
                    '<button class="ls-opt" data-index="' + i + '">' +
                    '<span class="ls-ltr">' + ["A", "B", "C", "D"][i] + "</span>" +
                    text +
                    "</button>"
                )).join("");
            }
        },

        handleAnswer(answerIndex) {
            if (this.state.isLocked) return;

            this.state.isLocked = true;
            this.state.answers.push(["A", "B", "C", "D"][answerIndex]);

            const buttons = document.querySelectorAll(".ls-opt");
            if (buttons[answerIndex]) {
                buttons[answerIndex].classList.add("ls-picked");
            }
            buttons.forEach((btn, index) => {
                if (index !== answerIndex) btn.classList.add("ls-dimmed");
            });

            setTimeout(() => {
                if (this.state.currentQuestion < this.questions.length - 1) {
                    const cardA = document.getElementById("ls-ca");
                    if (cardA) cardA.classList.add("fly-left");
                    setTimeout(() => {
                        if (cardA) cardA.classList.remove("fly-left");
                        this.state.currentQuestion += 1;
                        this.state.isLocked = false;
                        this.renderQuestion();
                    }, 380);
                } else {
                    this.submitAnswers();
                }
            }, 500);
        },

        async submitAnswers() {
            this.navigateTo("loading");
            try {
                const [json] = await Promise.all([
                    this.callValuationAPI(),
                    this.simulateLoading()
                ]);

                if (!json.success) {
                    this.showError("Failed to calculate valuation");
                    return;
                }

                this.state.historyResult = json.data;
                this.navigateTo("result");
            } catch (error) {
                if (error.status === 401) {
                    this.showError("Authentication failed. Please reopen from Telegram.");
                    return;
                }
                if (error.status === 400) {
                    this.showError("Invalid answers. Please try again.");
                    return;
                }
                this.showError("Network error. Please try again.");
            }
        },

        async callValuationAPI() {
            return this.apiCall("/api/valuation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ answers: this.state.answers })
            });
        },

        simulateLoading() {
            return new Promise((resolve) => {
                let progress = 0;
                const timer = setInterval(() => {
                    progress += 1.4;
                    const bar = document.getElementById("ls-lbar");
                    const msg = document.getElementById("ls-lmsg");
                    if (bar) bar.style.width = Math.min(progress, 100) + "%";
                    if (msg) {
                        const idx = Math.min(
                            Math.floor((progress / 100) * this.loadingMessages.length),
                            this.loadingMessages.length - 1
                        );
                        msg.textContent = this.loadingMessages[idx];
                    }

                    if (progress >= 100) {
                        clearInterval(timer);
                        setTimeout(resolve, 400);
                    }
                }, 35);
            });
        },

        renderChart(data) {
            const chartData = Array.isArray(data) && data.length ? data : [40, 30, 35, 20, 10, 8, 12, 7];
            const step = 400 / (chartData.length - 1);
            const linePoints = chartData.map((y, i) => (i * step) + "," + y).join(" ");
            const polygonPoints = linePoints + " 400,52 0,52";

            return (
                '<svg width="100%" height="52" viewBox="0 0 400 52" preserveAspectRatio="none">' +
                "<defs>" +
                '<linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0%" stop-color="#c8ff00" stop-opacity="0.15"/>' +
                '<stop offset="100%" stop-color="#c8ff00" stop-opacity="0"/>' +
                "</linearGradient>" +
                "</defs>" +
                '<polygon points="' + polygonPoints + '" fill="url(#cg)"/>' +
                '<polyline points="' + linePoints + '" fill="none" stroke="#c8ff00" stroke-width="1.5" stroke-linejoin="round"/>' +
                "</svg>"
            );
        },

        showError(message) {
            const container = document.getElementById("ls-page");
            if (!container) return;
            container.innerHTML = (
                '<div class="ls-error">' +
                '<div class="ls-error-title">Something went wrong</div>' +
                '<div class="ls-error-msg">' + message + "</div>" +
                '<button class="ls-btn" id="ls-reload-btn">Try Again</button>' +
                "</div>"
            );
            const reloadBtn = document.getElementById("ls-reload-btn");
            if (reloadBtn) reloadBtn.onclick = () => window.location.reload();
        },

        renderWelcomePage() {
            return (
                '<div class="ls-welcome">' +
                '<div class="ls-logo-icon">' +
                '<svg width="38" height="38" viewBox="0 0 38 38" fill="none">' +
                '<polyline points="3,27 11,17 17,22 25,9 35,13" stroke="#c8ff00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
                '<polyline points="27,9 35,9 35,17" stroke="#c8ff00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
                '<circle cx="11" cy="17" r="2.5" fill="#a855f7"/>' +
                '<circle cx="17" cy="22" r="2.5" fill="#a855f7"/>' +
                '<circle cx="25" cy="9" r="2.5" fill="#a855f7"/>' +
                "</svg>" +
                "</div>" +
                '<div class="ls-logo-title">LOVESTOCK</div>' +
                '<div class="ls-logo-sub">EXCHANGE - EST. 2025</div>' +
                '<div class="ls-tagline">Find out your <em>real market value</em> in the dating economy.<br><br>8 questions. Ruthlessly scientific. Slightly unhinged.</div>' +
                '<div class="ls-stats-row">' +
                '<div class="ls-stat"><div class="ls-stat-num">847K</div><div class="ls-stat-lbl">LISTED</div></div>' +
                '<div class="ls-stat-div"></div>' +
                '<div class="ls-stat"><div class="ls-stat-num">$4,721</div><div class="ls-stat-lbl">AVG PRICE</div></div>' +
                '<div class="ls-stat-div"></div>' +
                '<div class="ls-stat"><div class="ls-stat-num">94%</div><div class="ls-stat-lbl">BULLISH</div></div>' +
                "</div>" +
                '<button class="ls-btn" id="ls-startbtn">GET MY VALUATION -&gt;</button>' +
                '<div class="ls-disclaimer">Past heartbreak not indicative of future performance.</div>' +
                "</div>"
            );
        },

        renderQuizPage() {
            return (
                '<div class="ls-quiz">' +
                '<div class="ls-prog-row">' +
                '<span class="ls-prog-lbl" id="ls-plbl">Q 1 / 8</span>' +
                '<div class="ls-prog-bar"><div class="ls-prog-fill" id="ls-pfill" style="width:12.5%"></div></div>' +
                '<span class="ls-prog-lbl" id="ls-ppct">12%</span>' +
                "</div>" +
                '<div class="ls-stack">' +
                '<div class="ls-card ls-card-c" id="ls-cc"></div>' +
                '<div class="ls-card ls-card-b" id="ls-cb"></div>' +
                '<div class="ls-card ls-card-a" id="ls-ca">' +
                '<div class="ls-ticker" id="ls-cticker">LOVESTOCK - Q1</div>' +
                '<div class="ls-q" id="ls-cq"></div>' +
                "</div>" +
                "</div>" +
                '<div class="ls-opts" id="ls-opts"></div>' +
                "</div>"
            );
        },

        renderLoadingPage() {
            return (
                '<div class="ls-loading">' +
                '<div class="ls-load-title">CALCULATING</div>' +
                '<div class="ls-load-sub">YOUR MARKET VALUATION</div>' +
                '<div class="ls-load-bar"><div class="ls-load-fill" id="ls-lbar"></div></div>' +
                '<div class="ls-load-msg" id="ls-lmsg">Initializing exchange systems...</div>' +
                "</div>"
            );
        },

        renderResultPage() {
            const result = this.state.historyResult || {};
            const price = typeof result.final_price === "number" ? result.final_price.toFixed(2) : "0.00";
            const changeRaw = typeof result.change_percent === "number" ? result.change_percent : 0;
            const change = Math.abs(changeRaw).toFixed(1);
            const isUp = changeRaw >= 0;
            const tags = result.special_tag ? ('<span class="ls-tag ls-tag-a">' + result.special_tag + "</span>") : "";
            const displayUsername =
                result.username
                    ? (String(result.username).startsWith("@") ? result.username : ("@" + result.username))
                    : "@investor_puro";

            return (
                '<div class="ls-result">' +
                '<div class="ls-board">' +
                '<div class="ls-board-glow"></div>' +
                '<div class="ls-exhdr">' +
                '<span class="ls-exname">LOVESTOCK EXCHANGE - NYSE</span>' +
                '<span class="ls-live">- LIVE</span>' +
                "</div>" +
                '<div class="ls-main-ticker">' + (result.ticker || "$USER") + "</div>" +
                '<div class="ls-co-name">' + displayUsername + " - " + (result.stock_type || "Growth Stock") + "</div>" +
                '<div class="ls-price-row">' +
                '<span class="ls-price">$' + price + "</span>" +
                '<span class="ls-chg">' + (isUp ? "▲ +" : "▼ -") + change + "%</span>" +
                "</div>" +
                '<hr class="ls-div">' +
                '<div class="ls-sgrid">' +
                '<div class="ls-sbox"><div class="ls-slbl">ASSET TYPE</div><div class="ls-sval purple">' + (result.stock_type || "Growth Stock") + "</div></div>" +
                '<div class="ls-sbox"><div class="ls-slbl">GRADE</div><div class="ls-sval acid">' + (result.grade || "C-") + "</div></div>" +
                '<div class="ls-sbox"><div class="ls-slbl">RISK LEVEL</div><div class="ls-sval red">MEDIUM</div></div>' +
                "</div>" +
                '<div class="ls-chart"><div class="ls-chart-lbl">30-DAY PRICE HISTORY</div>' + this.renderChart(result.chart_data) + "</div>" +
                '<div class="ls-tags">' + tags + "</div>" +
                '<div class="ls-verdict">"' + (result.ai_comment || "Market trajectory remains uncertain but long-term fundamentals show promise") + '"</div>' +
                '<button class="ls-cta" id="ls-retry-btn">RE-CALCULATE VALUATION</button>' +
                "</div>" +
                "</div>"
            );
        }
    };

    window.LoveStock = LoveStock;

    document.addEventListener("DOMContentLoaded", function () {
        LoveStock.init();
    });
})();
