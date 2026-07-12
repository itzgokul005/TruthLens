/**
 * TruthLens — main client-side controller.
 *
 * This single file replaces every React component's useState/useEffect
 * logic with plain DOM state + event delegation, reproducing the exact
 * same single-page tab-switching behavior, form validation, API calls,
 * and dynamic result rendering as the original src/*.tsx files. One
 * delegated click handler on `document` drives almost all interactivity
 * so newly-injected markup (results panels, ledger rows, dropdowns)
 * never needs individual listeners re-bound after each re-render.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // CSRF-aware fetch helper — every mutating request (anything but GET)
  // carries the Flask-WTF CSRF token from the <meta> tag in base.html.
  // ---------------------------------------------------------------------
  const CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]').getAttribute("content");

  async function apiFetch(url, options) {
    const opts = Object.assign({}, options || {});
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (opts.method && opts.method.toUpperCase() !== "GET") {
      opts.headers["X-CSRFToken"] = CSRF_TOKEN;
    }
    opts.credentials = "same-origin";
    return fetch(url, opts);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------------------------------------------------------------------
  // Global state — mirrors App.tsx's useState hooks
  // ---------------------------------------------------------------------
  const bootstrap = window.__TRUTHLENS_BOOTSTRAP__ || { history: [], user: null };
  const state = {
    currentTab: "overview",
    darkMode: true,
    user: bootstrap.user,
    history: bootstrap.history || [],
    textAnalysisLoading: false,
    imageAnalysisLoading: false,
  };

  const NAV_ITEMS = [
    { id: "overview", label: "TruthLens Explorer" },
    { id: "text-mode", label: "Article Analysis" },
    { id: "image-mode", label: "Image Verification" },
    { id: "dashboard", label: "AI Dashboard" },
    { id: "history", label: "Audit Ledger" },
  ];
  const TAB_IDS = NAV_ITEMS.map(function (i) { return i.id; });

  const TEXT_SAMPLES = [
    {
      title: "HEALTH: Miracle Compound Z Suppresses Absolute Human Aging, Leaked Records Claim",
      url: "https://conspiracyhealthexposed.org/miracle-z-secret",
      text: "Breaking research leak! Leading pharmaceutical entities have merged to suppress Miracle Compound Z, a botanical element grown deep inside Siberian geysers. Unnamed insiders have leaked files indicating that patients completing 30 days of Miracle Z experienced absolute cellular rejuvenation. The discovery has been buried because it would entirely destroy the standard global medical care framework today.",
    },
    {
      title: "SPACE: JWST Captures Chemical Signs of Complex Organics in Exoplanet K2-18b Atmosphere",
      url: "https://natureastrospectra.com/jwst-k2-18b-organics",
      text: "The James Webb Space Telescope has captured detailed infrared transmission spectroscopy of K2-18b, a Hycean exoplanet orbiting a cool dwarf star. Scientific analysis suggests the planetary atmosphere contains trace amounts of dimethyl sulfide (DMS), a gas principally produced by ocean lifeforms on Earth, alongside rich levels of carbon dioxide and methane. Researchers from Cambridge are currently executing subsequent calibration studies to confirm the molecule detections and rule out geological stellar anomalies.",
    },
    {
      title: "SATIRE: Congress Replaces All Human Legislation Committees with 'Magic 8-Ball' To Save Taxes",
      url: "https://thebabylononionparody.co/congress-magic-8-ball",
      text: "With national budgets climbing, Congress passed a bipartisan resolution to immediately replace all human legislative subcommittees with a giant standard Magic 8-Ball. 'It's a huge victory for fiscal discipline,' the speaker remarked. 'Instead of spending months debating agricultural regulations, we simply shake the ball. Standard answers like \"Outlook Not Good\" or \"Reply Hazy Try Again\" carry identical statistical parity to bills drafted by our previous human representatives.'",
    },
  ];

  const IMAGE_SAMPLES = [
    {
      name: "AI-Generated Profile Portrait",
      url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Manipulated Spacecraft Photo",
      url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
    },
    {
      name: "Genuine High-Detail Landscape",
      url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80",
    },
  ];

  const TEXT_VERDICT_UI = {
    REAL: { bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", text: "text-emerald-700 dark:text-emerald-300", icon: "check-circle", iconColor: "text-emerald-500" },
    FAKE: { bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20", text: "text-red-700 dark:text-red-350", icon: "alert-octagon", iconColor: "text-red-500" },
    MISLEADING: { bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20", text: "text-amber-700 dark:text-amber-300", icon: "alert-triangle", iconColor: "text-amber-500" },
    SATIRE: { bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20", text: "text-purple-700 dark:text-purple-350", icon: "help-circle", iconColor: "text-purple-500" },
    DEFAULT: { bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700", text: "text-slate-700 dark:text-slate-350", icon: "info", iconColor: "text-slate-500" },
  };

  const IMAGE_VERDICT_UI = {
    AUTHENTIC: { bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20", text: "text-emerald-700 dark:text-emerald-300", icon: "shield-check", iconColor: "text-emerald-500" },
    MANIPULATED: { bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20", text: "text-amber-700 dark:text-amber-300", icon: "alert-triangle", iconColor: "text-amber-500" },
    DEEPFAKE: { bg: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20", text: "text-red-700 dark:text-red-350", icon: "alert-octagon", iconColor: "text-red-500" },
    AI_GENERATED: { bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20", text: "text-purple-700 dark:text-purple-350", icon: "cpu", iconColor: "text-purple-500" },
    DEFAULT: { bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700", text: "text-slate-700 dark:text-slate-350", icon: "help-circle", iconColor: "text-slate-500" },
  };

  function verdictBadgeHtml(rating) {
    // Port of getVerdictMiniBadge() in HistorySection.tsx
    const map = {
      REAL: ["bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400", "check-circle", "Credible"],
      AUTHENTIC: ["bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400", "check-circle", "Credible"],
      FAKE: ["bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400", "alert-octagon", "False"],
      DEEPFAKE: ["bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400", "alert-octagon", "False"],
      MISLEADING: ["bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400", "alert-triangle", "Misleading"],
      MANIPULATED: ["bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400", "alert-triangle", "Misleading"],
      SATIRE: ["bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400", "help-circle", "Satire"],
    };
    const entry = map[rating];
    if (!entry) {
      return '<span class="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-350 font-bold">Unknown</span>';
    }
    return '<span class="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full ' + entry[0] + ' font-bold"><i data-lucide="' + entry[1] + '" style="width:10px;height:10px"></i> ' + entry[2] + "</span>";
  }

  // ---------------------------------------------------------------------
  // Tab switching
  // ---------------------------------------------------------------------
  function showTab(tabId) {
    state.currentTab = tabId;
    TAB_IDS.forEach(function (id) {
      const el = document.getElementById("tab-" + id);
      if (el) el.classList.toggle("hidden", id !== tabId);
    });
    document.getElementById("mobile-navigation-panel").classList.add("hidden");
    renderMobileMenuIcon(false);
    renderNavbar();
    if (tabId === "dashboard") renderDashboard();
    if (tabId === "history") {
      // The original HistorySection is a fresh component mount every time
      // its tab becomes active, so local filter/selection state resets.
      historyState.searchQuery = "";
      historyState.typeFilter = "all";
      historyState.ratingFilter = "all";
      historyState.selectedItemId = null;
      renderHistoryTab();
    }
    window.scrollTo(0, 0);
    window.refreshIcons();
  }

  // ---------------------------------------------------------------------
  // Navbar / auth slot rendering
  // ---------------------------------------------------------------------
  let profileDropdownOpen = false;

  function renderNavbar() {
    const desktopEl = document.getElementById("desktop-nav-items");
    const mobileEl = document.getElementById("mobile-nav-items");

    desktopEl.innerHTML = NAV_ITEMS.map(function (item) {
      const active = state.currentTab === item.id;
      const cls = active
        ? "text-blue-600 dark:text-blue-400 bg-black/5 dark:bg-white/5 border border-zinc-200 dark:border-white/10"
        : "text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white";
      return '<button id="nav-' + item.id + '" data-tab-trigger="' + item.id + '" class="px-3.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all duration-150 relative ' + cls + '">' + escapeHtml(item.label) + "</button>";
    }).join("");

    mobileEl.innerHTML = NAV_ITEMS.map(function (item) {
      const active = state.currentTab === item.id;
      const cls = active
        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800";
      return '<button id="mobile-nav-' + item.id + '" data-tab-trigger="' + item.id + '" class="w-full text-left px-3 py-2.5 rounded-lg transition-colors ' + cls + '">' + escapeHtml(item.label) + "</button>";
    }).join("");

    renderAuthSlot();
    window.refreshIcons();
  }

  function renderAuthSlot() {
    const slot = document.getElementById("auth-slot");
    if (state.user) {
      const avatar = state.user.photoURL
        ? '<img src="' + escapeHtml(state.user.photoURL) + '" alt="' + escapeHtml(state.user.displayName) + '" referrerpolicy="no-referrer" class="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-blue-500" />'
        : '<div class="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">' + escapeHtml(state.user.displayName.charAt(0).toUpperCase()) + "</div>";

      slot.innerHTML =
        '<div class="relative">' +
        '<button id="user-profile-toggle" class="flex items-center gap-1.5 py-1 px-1.5 sm:px-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 transition text-xs font-medium text-slate-700 dark:text-slate-200">' +
        avatar +
        '<span class="max-w-[70px] sm:max-w-[100px] truncate hidden md:inline">' + escapeHtml(state.user.displayName) + "</span>" +
        "</button>" +
        (profileDropdownOpen
          ? '<div id="user-profile-dropdown" class="absolute right-0 mt-2 w-48 sm:w-56 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">' +
            '<div class="px-3 sm:px-4 py-2 border-b border-slate-100 dark:border-slate-800">' +
            '<p class="text-xs font-semibold text-slate-900 dark:text-white truncate">' + escapeHtml(state.user.displayName) + "</p>" +
            '<p class="text-[10px] text-slate-400 dark:text-slate-400 truncate mt-0.5">' + escapeHtml(state.user.email) + "</p>" +
            "</div>" +
            '<button id="dropdown-goto-history" class="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2"><i data-lucide="trending-up" style="width:14px;height:14px"></i><span>Analysis Ledger</span></button>' +
            '<button id="dropdown-logout" class="w-full text-left px-4 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center gap-2"><i data-lucide="log-out" style="width:14px;height:14px"></i><span>Sign Out</span></button>' +
            "</div>"
          : "") +
        "</div>";
    } else {
      slot.innerHTML =
        '<button id="login-trigger-btn" class="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition rounded-lg shadow-sm">' +
        '<i data-lucide="log-in" style="width:13px;height:13px"></i><span>Access Portal</span>' +
        "</button>";
    }
    window.refreshIcons();
  }

  function renderMobileMenuIcon(open) {
    const btn = document.getElementById("mobile-menu-toggle-btn");
    btn.innerHTML = open ? '<i data-lucide="x" style="width:18px;height:18px"></i>' : '<i data-lucide="menu" style="width:18px;height:18px"></i>';
    window.refreshIcons();
  }

  // ---------------------------------------------------------------------
  // Auth modal
  // ---------------------------------------------------------------------
  const authState = { tab: "login", loading: false };

  function openAuthModal() {
    authState.tab = "login";
    authState.loading = false;
    clearAuthMessages();
    document.getElementById("auth-input-name").value = "";
    document.getElementById("auth-input-email").value = "";
    document.getElementById("auth-input-password").value = "";
    applyAuthTabUi();
    const modal = document.getElementById("auth-modal-screen");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  function closeAuthModal() {
    const modal = document.getElementById("auth-modal-screen");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  function clearAuthMessages() {
    document.getElementById("auth-error-banner").classList.add("hidden");
    document.getElementById("auth-error-banner").classList.remove("flex");
    document.getElementById("auth-success-banner").classList.add("hidden");
    document.getElementById("auth-success-banner").classList.remove("flex");
  }

  function showAuthError(message) {
    document.getElementById("auth-success-banner").classList.add("hidden");
    const banner = document.getElementById("auth-error-banner");
    banner.classList.remove("hidden");
    banner.classList.add("flex");
    document.getElementById("auth-error-text").textContent = message;
  }

  function showAuthSuccess(message) {
    document.getElementById("auth-error-banner").classList.add("hidden");
    const banner = document.getElementById("auth-success-banner");
    banner.classList.remove("hidden");
    banner.classList.add("flex");
    document.getElementById("auth-success-text").textContent = message;
  }

  function setAuthTab(tab) {
    authState.tab = tab;
    clearAuthMessages();
    applyAuthTabUi();
  }

  function applyAuthTabUi() {
    const titleEl = document.getElementById("auth-modal-title");
    const subtitleEl = document.getElementById("auth-modal-subtitle");
    const toggleTabs = document.getElementById("auth-toggle-tabs");
    const nameField = document.getElementById("auth-name-field");
    const passwordField = document.getElementById("auth-password-field");
    const socialBlock = document.getElementById("auth-social-block");
    const backBtn = document.getElementById("auth-back-to-login");
    const submitLabel = document.getElementById("auth-submit-label");
    const loginTabBtn = document.getElementById("auth-login-tab");
    const signupTabBtn = document.getElementById("auth-signup-tab");

    const titles = { login: "Welcome to TruthLens", signup: "Create Fact-Check Portal", forgot: "Synchronize Password" };
    const subtitles = {
      login: "Access your personal analytical logs and report suites.",
      signup: "Sign up to register and unlock high-throughput processing.",
      forgot: "Recover credential signatures safely via system email.",
    };
    const submitLabels = { login: "Sign In Securely", signup: "Establish Fact-Check Vault", forgot: "Push Recovery Email" };

    titleEl.textContent = titles[authState.tab];
    subtitleEl.textContent = subtitles[authState.tab];
    submitLabel.textContent = submitLabels[authState.tab];

    toggleTabs.classList.toggle("hidden", authState.tab === "forgot");
    nameField.classList.toggle("hidden", authState.tab !== "signup");
    passwordField.classList.toggle("hidden", authState.tab === "forgot");
    socialBlock.classList.toggle("hidden", authState.tab === "forgot");
    backBtn.classList.toggle("hidden", authState.tab !== "forgot");

    const activeCls = ["bg-white", "dark:bg-slate-700", "shadow-sm", "text-blue-600", "dark:text-white"];
    const inactiveCls = ["text-slate-500", "dark:text-slate-400"];
    [loginTabBtn, signupTabBtn].forEach(function (btn) {
      activeCls.concat(inactiveCls).forEach(function (c) { btn.classList.remove(c); });
    });
    const activeBtn = authState.tab === "signup" ? signupTabBtn : loginTabBtn;
    const inactiveBtn = authState.tab === "signup" ? loginTabBtn : signupTabBtn;
    activeCls.forEach(function (c) { activeBtn.classList.add(c); });
    inactiveCls.forEach(function (c) { inactiveBtn.classList.add(c); });
  }

  function setAuthLoading(loading) {
    authState.loading = loading;
    document.getElementById("auth-submit-spinner").classList.toggle("hidden", !loading);
    document.getElementById("auth-submit-label").classList.toggle("hidden", loading);
    document.getElementById("auth-submit-btn").disabled = loading;
    document.getElementById("google-sigin-btn").disabled = loading;
  }

  async function submitAuthForm() {
    if (authState.loading) return;
    clearAuthMessages();
    const name = document.getElementById("auth-input-name").value.trim();
    const email = document.getElementById("auth-input-email").value.trim();
    const password = document.getElementById("auth-input-password").value;

    setAuthLoading(true);
    try {
      if (authState.tab === "login") {
        const res = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email: email, password: password }) });
        const data = await res.json();
        if (!res.ok) { showAuthError(data.error || "Authentication failed."); return; }
        state.user = data.user;
        renderNavbar();
        showAuthSuccess(data.message);
        setTimeout(function () { closeAuthModal(); }, 1000);
      } else if (authState.tab === "signup") {
        const res = await apiFetch("/auth/signup", { method: "POST", body: JSON.stringify({ name: name, email: email, password: password }) });
        const data = await res.json();
        if (!res.ok) { showAuthError(data.error || "Signup failed."); return; }
        state.user = data.user;
        renderNavbar();
        showAuthSuccess(data.message);
        setTimeout(function () { closeAuthModal(); }, 1000);
      } else {
        const res = await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email }) });
        const data = await res.json();
        if (!res.ok) { showAuthError(data.error || "Request failed."); return; }
        showAuthSuccess(data.message);
        setTimeout(function () { setAuthTab("login"); }, 3000);
      }
    } catch (err) {
      console.error("Auth request failed:", err);
      showAuthError("Network challenge encountered. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function submitGoogleSignIn() {
    if (authState.loading) return;
    clearAuthMessages();
    setAuthLoading(true);
    try {
      const res = await apiFetch("/auth/google", { method: "POST", body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { showAuthError(data.error || "Google sign-in failed."); return; }
      state.user = data.user;
      renderNavbar();
      showAuthSuccess(data.message);
      setTimeout(function () { closeAuthModal(); }, 1000);
    } catch (err) {
      console.error("Google sign-in failed:", err);
      showAuthError("Network challenge encountered. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout request failed:", err);
    }
    state.user = null;
    profileDropdownOpen = false;
    renderNavbar();
  }

  // ---------------------------------------------------------------------
  // FAQ accordion (LandingPage.tsx)
  // ---------------------------------------------------------------------
  let activeFaq = null;

  function toggleFaq(idx) {
    activeFaq = activeFaq === idx ? null : idx;
    for (let i = 0; i < 4; i++) {
      const panel = document.getElementById("faq-panel-" + i);
      const chevron = document.getElementById("faq-btn-" + i).querySelector("[data-faq-chevron]");
      if (!panel) continue;
      const isOpen = activeFaq === i;
      panel.classList.toggle("hidden", !isOpen);
      if (chevron) {
        chevron.classList.toggle("rotate-180", isOpen);
        chevron.classList.toggle("text-blue-500", isOpen);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Article Analysis (ArticleAnalysis.tsx)
  // ---------------------------------------------------------------------
  const textPanel = { result: null, selectedHighlight: null, fileName: "" };

  function updateArticleFormControls() {
    const title = document.getElementById("article-title-input").value;
    const url = document.getElementById("article-url-input").value;
    const text = document.getElementById("article-text-textarea").value;
    document.getElementById("article-text-charcount").textContent = String(text.length);
    document.getElementById("analyse-submit-btn").disabled = state.textAnalysisLoading || !text.trim();
    document.getElementById("reset-analysis-btn").classList.toggle("hidden", !(text || title || url));
  }

  function applyTextSample(idx) {
    const sample = TEXT_SAMPLES[idx];
    document.getElementById("article-title-input").value = sample.title;
    document.getElementById("article-url-input").value = sample.url;
    document.getElementById("article-text-textarea").value = sample.text;
    document.getElementById("doc-upload-label").textContent = "Upload document (.txt)";
    textPanel.fileName = "";
    textPanel.result = null;
    textPanel.selectedHighlight = null;
    showTextEmptyState();
    updateArticleFormControls();
  }

  function handleTextFileSelected(file) {
    if (!file) return;
    textPanel.fileName = file.name;
    document.getElementById("doc-upload-label").textContent = "Loaded: " + file.name;
    const reader = new FileReader();
    reader.onload = function (event) {
      if (typeof event.target.result === "string") {
        document.getElementById("article-text-textarea").value = event.target.result;
        const titleInput = document.getElementById("article-title-input");
        if (!titleInput.value) {
          titleInput.value = file.name.replace(/\.[^/.]+$/, "");
        }
        updateArticleFormControls();
      }
    };
    reader.readAsText(file);
  }

  function showTextLoadingState() {
    document.getElementById("text-loading-state").classList.remove("hidden");
    document.getElementById("text-loading-state").classList.add("flex");
    document.getElementById("text-empty-state").classList.add("hidden");
    document.getElementById("text-results-container").classList.add("hidden");
  }

  function showTextEmptyState() {
    document.getElementById("text-loading-state").classList.add("hidden");
    document.getElementById("text-loading-state").classList.remove("flex");
    document.getElementById("text-empty-state").classList.remove("hidden");
    document.getElementById("text-results-container").classList.add("hidden");
  }

  function showTextResultsState() {
    document.getElementById("text-loading-state").classList.add("hidden");
    document.getElementById("text-loading-state").classList.remove("flex");
    document.getElementById("text-empty-state").classList.add("hidden");
    document.getElementById("text-results-container").classList.remove("hidden");
  }

  function renderTextResults() {
    const result = textPanel.result;
    if (!result) return;
    const view = TEXT_VERDICT_UI[result.rating] || TEXT_VERDICT_UI.DEFAULT;
    const circumference = 2 * Math.PI * 20;
    const offset = circumference * (1 - result.confidence / 100);

    const noticeHtml = result._notice
      ? '<div class="p-2 mb-4 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5"><i data-lucide="sparkles" style="width:10px;height:10px"></i> Local Fact Sandbox (Gemini Secret Key Is Unconfigured)</div>'
      : "";

    const verdictCard =
      '<div class="rounded-2xl border shadow-lg p-5 sm:p-6 transition-all ' + view.bg + '">' +
      noticeHtml +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
      '<div class="flex items-center gap-3">' +
      '<i data-lucide="' + view.icon + '" class="' + view.iconColor + ' shrink-0" style="width:28px;height:28px"></i>' +
      "<div>" +
      '<p class="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-extrabold">Inferred Credibility Verdict</p>' +
      '<h2 class="font-display text-4xl sm:text-6xl font-black mt-1 tracking-tighter uppercase italic leading-none">' + escapeHtml(result.rating) + "</h2>" +
      "</div>" +
      "</div>" +
      '<div class="flex items-center gap-3 self-start sm:self-center">' +
      '<div class="text-right">' +
      '<p class="text-[9px] font-mono uppercase text-slate-400 font-extrabold">Confidence Scale</p>' +
      '<p class="text-2xl font-black sm:text-3xl italic ' + view.text + '">' + result.confidence + "%</p>" +
      "</div>" +
      '<div class="relative w-12 h-12 flex items-center justify-center">' +
      '<svg class="w-full h-full transform -rotate-90">' +
      '<circle cx="24" cy="24" r="20" stroke="rgba(0,0,0,0.06)" stroke-width="4" fill="transparent" />' +
      '<circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="4" fill="transparent" class="' + view.text + '" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" />' +
      "</svg>" +
      '<span class="absolute text-[10px] font-bold font-mono">' + result.confidence + "%</span>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="mt-5 border-t border-slate-200/50 dark:border-white/5 pt-4">' +
      '<h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Why this result? Forensics Synopsis</h4>' +
      '<p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">' + escapeHtml(result.summaryReasoning) + "</p>" +
      "</div>" +
      "</div>";

    const indicatorsGrid =
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">' +
      '<div class="rounded-xl bg-white dark:bg-slate-850 border border-slate-200/50 dark:border-slate-800 p-4 shadow-sm text-center"><p class="text-[10px] font-mono text-slate-400 uppercase">Manipulations Profile</p><p class="font-display text-xl sm:text-2xl font-extrabold mt-1 text-purple-500">' + result.emotionalManipulationScore + '%</p><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-[150px] mx-auto">Emotional trigger densities</p></div>' +
      '<div class="rounded-xl bg-white dark:bg-slate-850 border border-slate-200/50 dark:border-slate-800 p-4 shadow-sm text-center"><p class="text-[10px] font-mono text-slate-400 uppercase">Clickbait Signature</p><p class="font-display text-xl sm:text-2xl font-extrabold mt-1 text-amber-500">' + result.clickbaitScore + '%</p><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-[150px] mx-auto">Headline suspense patterns</p></div>' +
      '<div class="rounded-xl bg-white dark:bg-slate-850 border border-slate-200/50 dark:border-slate-800 p-4 shadow-sm text-center"><p class="text-[10px] font-mono text-slate-400 uppercase">Synthesis Probability</p><p class="font-display text-xl sm:text-2xl font-extrabold mt-1 text-blue-500">' + result.aiContentProbability + '%</p><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1 max-w-[150px] mx-auto">Synthetic language score</p></div>' +
      "</div>";

    const sentencesHtml = (result.highlightedSentences || []).map(function (seg, idx) {
      const isSus = seg.rating === "suspicious";
      const cls = isSus
        ? "bg-red-500/10 text-red-650 dark:text-red-400 border-b-2 border-dashed border-red-500 cursor-pointer select-none hover:bg-red-500/20 py-0.5 px-1 rounded transition duration-150"
        : "text-slate-600 dark:text-slate-300";
      return '<span id="highlight-sentence-' + idx + '" data-highlight-idx="' + idx + '" class="' + cls + ' mr-1 inline-block"' + (isSus ? ' title="Click to view suspicous indicator reason"' : "") + ">" + escapeHtml(seg.text) + "</span>";
    }).join("");

    const tooltipHtml = textPanel.selectedHighlight
      ? '<div class="p-3.5 rounded-xl bg-red-50/50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/15 animate-in fade-in duration-200">' +
        '<div class="flex gap-2"><i data-lucide="alert-triangle" class="text-red-500 shrink-0 mt-0.5" style="width:15px;height:15px"></i>' +
        '<div class="overflow-hidden"><p class="text-[10px] font-bold text-red-700 dark:text-red-300">Questionable statement identified:</p>' +
        '<p class="text-xs text-slate-800 dark:text-slate-300 font-medium italic mt-1 font-mono">"' + escapeHtml(textPanel.selectedHighlight.text) + '"</p>' +
        '<p class="text-xs text-red-650 dark:text-red-400 mt-2 font-sans"><strong>Forensic Indicator:</strong> ' + escapeHtml(textPanel.selectedHighlight.reason || "Semantic loading anomalies detected in sentence syntax.") + "</p></div></div></div>"
      : "";

    const highlightBoard =
      '<div class="rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 sm:p-6 shadow-sm space-y-4">' +
      '<div><h3 class="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><i data-lucide="quote" class="text-blue-500" style="width:15px;height:15px"></i> Interactive Headline &amp; copy highlight</h3>' +
      '<p class="text-[10px] text-slate-400 mt-1">Click on highlighted sentences highlighted in <span class="text-red-500 font-bold">Red</span> to review specific bias triggers. All others are normal text sequences.</p></div>' +
      '<div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 max-h-[300px] overflow-y-auto leading-relaxed border border-slate-100 dark:border-slate-800/50"><div class="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-350">' + sentencesHtml + "</div></div>" +
      tooltipHtml +
      "</div>";

    const claimsHtml = (result.claimsList || []).map(function (c) {
      const statusCls = c.status === "confirmed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400" :
        c.status === "disproven" ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400" :
        c.status === "exaggerated" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400" :
        "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
      const sources = (c.sourcesNeeded || []).map(function (s) { return '<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">' + escapeHtml(s) + "</span>"; }).join("");
      return '<div class="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/45">' +
        '<div class="flex items-start justify-between gap-4"><p class="text-xs font-bold text-slate-900 dark:text-white">Claim: <span class="font-medium text-slate-600 dark:text-slate-300 font-mono">"' + escapeHtml(c.claim) + '"</span></p>' +
        '<span class="text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-semibold shrink-0 ' + statusCls + '">' + escapeHtml(c.status) + "</span></div>" +
        '<p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">' + escapeHtml(c.explanation) + "</p>" +
        (sources ? '<div class="mt-2.5 flex items-center gap-1.5 flex-wrap"><span class="text-[10px] text-slate-400 font-semibold font-mono">Verification References:</span>' + sources + "</div>" : "") +
        "</div>";
    }).join("");

    const claimsBlock =
      '<div class="rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 sm:p-6 shadow-sm space-y-4"><h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Factual Claims Verified</h3><div class="space-y-3">' + claimsHtml + "</div></div>";

    const refsHtml = (result.factCheckReferences || []).map(function (ref) {
      const dot = ref.type === "supporting" ? "bg-emerald-500" : ref.type === "contradicting" ? "bg-red-500" : "bg-slate-400";
      const link = ref.url ? '<a href="' + escapeHtml(ref.url) + '" target="_blank" rel="noreferrer" class="text-[9px] hover:underline text-slate-400 hover:text-blue-500 font-medium">View external record</a>' : "";
      return '<div class="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 flex gap-3"><div class="shrink-0"><span class="w-2 h-2 rounded-full block mt-2 ' + dot + '"></span></div>' +
        '<div class="overflow-hidden"><h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">' + escapeHtml(ref.title) + '</h4><div class="flex items-center gap-2 mt-1"><span class="text-[9px] font-mono text-blue-500 font-bold">' + escapeHtml(ref.publisher) + "</span>" + link + '</div><p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">' + escapeHtml(ref.summary) + "</p></div></div>";
    }).join("");

    const refsBlock =
      '<div class="rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 sm:p-6 shadow-sm space-y-4"><h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Independent Fact-Check References</h3>' +
      (refsHtml || '<p class="text-xs text-slate-400 italic">No direct claims matched Snopes or Reuters repositories index files.</p>') +
      "</div>";

    document.getElementById("text-results-container").innerHTML = verdictCard + indicatorsGrid + highlightBoard + claimsBlock + refsBlock;
    showTextResultsState();
    window.refreshIcons();
  }

  async function submitTextAnalysis() {
    const text = document.getElementById("article-text-textarea").value;
    if (!text.trim()) return;
    const titleInput = document.getElementById("article-title-input").value.trim();
    const url = document.getElementById("article-url-input").value;
    const titleToUse = titleInput || "Article Audit: " + text.substring(0, 40) + "...";

    state.textAnalysisLoading = true;
    document.getElementById("analyse-submit-btn").disabled = true;
    document.getElementById("analyse-submit-spinner").classList.remove("hidden");
    document.getElementById("analyse-submit-icon").classList.add("hidden");
    document.getElementById("analyse-submit-label").textContent = "Analyzing Claims...";
    showTextLoadingState();

    try {
      const res = await apiFetch("/api/analyze-text", { method: "POST", body: JSON.stringify({ text: text, title: titleToUse, url: url }) });
      if (!res.ok) throw new Error("Target textual analysis endpoint failed.");
      const result = await res.json();
      textPanel.result = result;
      const suspect = (result.highlightedSentences || []).find(function (s) { return s.rating === "suspicious"; });
      textPanel.selectedHighlight = suspect ? { text: suspect.text, reason: suspect.reason } : null;
      renderTextResults();

      const histRes = await apiFetch("/api/history");
      if (histRes.ok) state.history = await histRes.json();
    } catch (err) {
      console.error("Article check process timed out:", err);
      showTextEmptyState();
    } finally {
      state.textAnalysisLoading = false;
      document.getElementById("analyse-submit-spinner").classList.add("hidden");
      document.getElementById("analyse-submit-icon").classList.remove("hidden");
      document.getElementById("analyse-submit-label").textContent = "Verify News Article";
      updateArticleFormControls();
    }
  }

  function resetTextAnalysis() {
    document.getElementById("article-title-input").value = "";
    document.getElementById("article-url-input").value = "";
    document.getElementById("article-text-textarea").value = "";
    document.getElementById("doc-upload-label").textContent = "Upload document (.txt)";
    textPanel.fileName = "";
    textPanel.result = null;
    textPanel.selectedHighlight = null;
    showTextEmptyState();
    updateArticleFormControls();
  }

  // ---------------------------------------------------------------------
  // Image Verification (ImageVerification.tsx)
  // ---------------------------------------------------------------------
  const imagePanel = { preview: null, mimeType: "image/jpeg", result: null };

  function showImageWorkspace(show) {
    document.getElementById("image-dropzone-empty").classList.toggle("hidden", show);
    document.getElementById("image-workspace").classList.toggle("hidden", !show);
  }

  function showImageLoadingState() {
    document.getElementById("image-loading-state").classList.remove("hidden");
    document.getElementById("image-loading-state").classList.add("flex");
    document.getElementById("image-empty-state").classList.add("hidden");
    document.getElementById("image-results-container").classList.add("hidden");
  }

  function showImageEmptyState() {
    document.getElementById("image-loading-state").classList.add("hidden");
    document.getElementById("image-loading-state").classList.remove("flex");
    document.getElementById("image-empty-state").classList.remove("hidden");
    document.getElementById("image-results-container").classList.add("hidden");
  }

  function showImageResultsState() {
    document.getElementById("image-loading-state").classList.add("hidden");
    document.getElementById("image-loading-state").classList.remove("flex");
    document.getElementById("image-empty-state").classList.add("hidden");
    document.getElementById("image-results-container").classList.remove("hidden");
  }

  function setImagePreview(url, mimeType) {
    imagePanel.preview = url;
    imagePanel.mimeType = mimeType || "image/jpeg";
    imagePanel.result = null;
    document.getElementById("image-preview-el").src = url;
    document.getElementById("heatmap-pins-layer").innerHTML = "";
    document.getElementById("heatmap-tooltip").classList.add("hidden");
    showImageWorkspace(true);
    showImageEmptyState();
  }

  function processImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      if (typeof e.target.result === "string") setImagePreview(e.target.result, file.type);
    };
    reader.readAsDataURL(file);
  }

  function resetImageWorkspace() {
    imagePanel.preview = null;
    imagePanel.result = null;
    showImageWorkspace(false);
    showImageEmptyState();
  }

  function renderHeatmapPins(coords) {
    const layer = document.getElementById("heatmap-pins-layer");
    layer.innerHTML = "";
    (coords || []).forEach(function (coord, i) {
      const pin = document.createElement("div");
      pin.id = "heatmap-pin-" + i;
      pin.className = "absolute rounded-full border-2 border-red-500 cursor-pointer transition transform hover:scale-135 bg-red-500/20 pulse";
      pin.style.left = coord.x + "%";
      pin.style.top = coord.y + "%";
      pin.style.width = coord.radius * 2 + "px";
      pin.style.height = coord.radius * 2 + "px";
      pin.style.transform = "translate(-50%, -50%)";
      pin.innerHTML = '<span class="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-75"></span>';
      pin.addEventListener("mouseenter", function () {
        const tooltip = document.getElementById("heatmap-tooltip");
        document.getElementById("heatmap-tooltip-text").textContent = coord.description;
        tooltip.classList.remove("hidden");
      });
      pin.addEventListener("mouseleave", function () {
        document.getElementById("heatmap-tooltip").classList.add("hidden");
      });
      layer.appendChild(pin);
    });
  }

  function renderImageResults() {
    const result = imagePanel.result;
    if (!result) return;
    const verdict = IMAGE_VERDICT_UI[result.rating] || IMAGE_VERDICT_UI.DEFAULT;

    const noticeHtml = result._notice
      ? '<div class="p-2 mb-4 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5"><i data-lucide="sparkles" style="width:10px;height:10px"></i> Local Fact Sandbox (Gemini Secret Key Is Unconfigured)</div>'
      : "";

    const heatmapNotice = (result.heatmapCoordinates && result.heatmapCoordinates.length > 0)
      ? '<div class="mt-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-550 animate-ping block shrink-0"></span><p class="text-[10px] text-red-800 dark:text-red-400 font-medium"><strong>Forensic indicators loaded:</strong> Hover over the glowing red target zones on the photo preview to unmask manipulated regions.</p></div>'
      : "";

    const verdictCard =
      '<div class="rounded-2xl border p-5 sm:p-6 shadow-md ' + verdict.bg + '">' + noticeHtml +
      '<div class="flex items-start gap-3"><i data-lucide="' + verdict.icon + '" class="' + verdict.iconColor + ' shrink-0" style="width:28px;height:28px"></i>' +
      '<div><p class="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-extrabold">Forensic Image Rating</p>' +
      '<h2 class="font-display text-4xl sm:text-6xl font-black mt-1 tracking-tighter uppercase italic leading-none">' + escapeHtml(result.rating) + "</h2>" +
      '<p class="text-xs text-slate-500 dark:text-zinc-400 mt-3 leading-relaxed font-sans">' + escapeHtml(result.summaryReasoning) + "</p></div></div>" +
      heatmapNotice + "</div>";

    const probBars =
      '<div class="rounded-2xl border border-slate-200/55 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 sm:p-6 shadow-sm space-y-4"><h3 class="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">🔬 Mathematical Probability Metrics</h3><div class="space-y-3 pt-1">' +
      '<div><div class="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"><span>Pixel Composite / Editing Probability</span><span class="font-mono">' + result.manipulationProbability + '%</span></div><div class="w-full h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="bg-amber-500 h-full transition-all duration-500" style="width:' + result.manipulationProbability + '%"></div></div></div>' +
      '<div><div class="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"><span>Deepfake AI Swap Probability</span><span class="font-mono">' + result.deepfakeProbability + '%</span></div><div class="w-full h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="bg-red-500 h-full transition-all duration-500" style="width:' + result.deepfakeProbability + '%"></div></div></div>' +
      '<div><div class="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"><span>Generative Synthetic (Diffusion/GAN) Ratio</span><span class="font-mono">' + result.aiGenerativeProbability + '%</span></div><div class="w-full h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="bg-purple-500 h-full transition-all duration-500" style="width:' + result.aiGenerativeProbability + '%"></div></div></div>' +
      "</div></div>";

    const anomaliesHtml = (result.detectedAnomalies || []).map(function (anom) {
      const sevCls = anom.score > 70 ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400" : anom.score > 40 ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400" : "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400";
      return '<div class="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40"><div class="flex justify-between items-center text-xs font-semibold"><span class="text-slate-900 dark:text-white">' + escapeHtml(anom.name) + '</span><span class="px-1.5 py-0.5 rounded text-[10px] font-mono leading-none ' + sevCls + '">Severity ' + anom.score + '%</span></div><p class="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">' + escapeHtml(anom.details) + "</p></div>";
    }).join("");

    const anomaliesBlock =
      '<div class="rounded-2xl border border-slate-200/55 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 sm:p-6 shadow-sm space-y-4"><h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Detected Optical Anomalies</h3><div class="space-y-3">' +
      (anomaliesHtml || '<p class="text-xs text-slate-400 italic">No optical anomalies detected inside the visual canvas.</p>') + "</div></div>";

    const metadataBlock =
      '<div class="rounded-2xl border border-slate-200/55 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 shadow-sm space-y-3"><h3 class="font-display text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Digital Metadata &amp; Header Forensic Analysis</h3>' +
      '<div class="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] leading-relaxed select-all"><p class="text-slate-200 font-bold mb-1"># Forensic Console Header Output:</p><p>' + escapeHtml(result.metadataDissonance) + "</p></div></div>";

    document.getElementById("image-results-container").innerHTML = verdictCard + probBars + anomaliesBlock + metadataBlock;
    showImageResultsState();
    renderHeatmapPins(result.heatmapCoordinates);
    window.refreshIcons();
  }

  async function executeImageAnalysis() {
    if (!imagePanel.preview) return;
    state.imageAnalysisLoading = true;
    const btn = document.getElementById("verify-image-cmd-btn");
    btn.disabled = true;
    document.getElementById("verify-image-spinner").classList.remove("hidden");
    document.getElementById("verify-image-icon").classList.add("hidden");
    document.getElementById("verify-image-label").textContent = "Recalibrating Lens Metrics...";
    showImageLoadingState();

    try {
      const res = await apiFetch("/api/analyze-image", { method: "POST", body: JSON.stringify({ base64Image: imagePanel.preview, mimeType: imagePanel.mimeType }) });
      if (!res.ok) throw new Error("Target image verification endpoint failed.");
      const result = await res.json();
      imagePanel.result = result;
      renderImageResults();

      const histRes = await apiFetch("/api/history");
      if (histRes.ok) state.history = await histRes.json();
    } catch (err) {
      console.error("Visual forensics failed:", err);
      showImageEmptyState();
    } finally {
      state.imageAnalysisLoading = false;
      btn.disabled = false;
      document.getElementById("verify-image-spinner").classList.add("hidden");
      document.getElementById("verify-image-icon").classList.remove("hidden");
      document.getElementById("verify-image-label").textContent = "Perform Forest Audit";
    }
  }

  // ---------------------------------------------------------------------
  // AI Dashboard (AIDashboard.tsx) — fully recomputed from state.history
  // ---------------------------------------------------------------------
  function renderDashboard() {
    const history = state.history;
    let fakeCount = 0, misleadingCount = 0, textCount = 0, imageCount = 0, confidenceSum = 0;
    history.forEach(function (item) {
      if (item.rating === "FAKE") fakeCount++;
      if (item.rating === "MISLEADING") misleadingCount++;
      if (item.type === "text") {
        textCount++;
        confidenceSum += item.details.confidence || 0;
      } else {
        imageCount++;
        const score = item.details.authenticityScore !== undefined ? 100 - item.details.authenticityScore : 50;
        confidenceSum += score;
      }
    });
    const total = history.length;
    const averageConfidence = total > 0 ? Math.round(confidenceSum / total) : 98;
    const itemsFlagged = fakeCount + misleadingCount;

    let real = 0, fake = 0, mis = 0, sat = 0;
    history.forEach(function (item) {
      if (item.rating === "REAL" || item.rating === "AUTHENTIC") real++;
      else if (item.rating === "FAKE" || item.rating === "DEEPFAKE") fake++;
      else if (item.rating === "MISLEADING" || item.rating === "MANIPULATED") mis++;
      else sat++;
    });
    if (history.length === 0) { real = 45; fake = 32; mis = 18; sat = 9; }
    const totalCalculated = real + fake + mis + sat;
    const ratingBreakdown = [
      { name: "Credible (Real)", value: real, color: "#10b981", percentage: Math.round((real / totalCalculated) * 100) },
      { name: "Unsubstantiated (Fake)", value: fake, color: "#ef4444", percentage: Math.round((fake / totalCalculated) * 100) },
      { name: "Misleading Contexts", value: mis, color: "#f59e0b", percentage: Math.round((mis / totalCalculated) * 100) },
      { name: "Satiric / Parody", value: sat, color: "#7c3aed", percentage: Math.round((sat / totalCalculated) * 100) },
    ];

    const dailyTrends = [
      { day: "Mon", total: 45, flagged: 18 }, { day: "Tue", total: 60, flagged: 22 },
      { day: "Wed", total: 78, flagged: 35 }, { day: "Thu", total: 95, flagged: 42 },
      { day: "Fri", total: 110, flagged: 48 }, { day: "Sat", total: 85, flagged: 32 },
      { day: "Sun", total: 125, flagged: 55 },
    ];
    const svgWidth = 500, svgHeight = 180, padding = 30, maxVal = 140;
    const xStep = (svgWidth - padding * 2) / (dailyTrends.length - 1);
    const points = dailyTrends.map(function (t, idx) {
      const x = padding + idx * xStep;
      const yTotal = svgHeight - padding - (t.total / maxVal) * (svgHeight - padding * 2);
      const yFlagged = svgHeight - padding - (t.flagged / maxVal) * (svgHeight - padding * 2);
      return { x: x, yTotal: yTotal, yFlagged: yFlagged, day: t.day };
    });
    const totalLinePath = points.map(function (p) { return p.x + "," + p.yTotal; }).join(" L ");
    const totalAreaPath = points[0].x + "," + (svgHeight - padding) + " L " + totalLinePath + " L " + points[points.length - 1].x + "," + (svgHeight - padding) + " Z";
    const flaggedLinePath = points.map(function (p) { return p.x + "," + p.yFlagged; }).join(" L ");
    const flaggedAreaPath = points[0].x + "," + (svgHeight - padding) + " L " + flaggedLinePath + " L " + points[points.length - 1].x + "," + (svgHeight - padding) + " Z";

    const nodesSvg = points.map(function (p) {
      return '<g><circle cx="' + p.x + '" cy="' + p.yTotal + '" r="3.5" fill="#3b82f6" stroke="white" stroke-width="1" /><circle cx="' + p.x + '" cy="' + p.yFlagged + '" r="3" fill="#ef4444" stroke="white" stroke-width="1" />' +
        '<text x="' + p.x + '" y="' + (svgHeight - 10) + '" font-size="9" fill="#94a3b8" font-weight="500" text-anchor="middle">' + p.day + "</text></g>";
    }).join("");

    const areaChartSvg =
      '<svg class="w-full min-w-[400px]" viewBox="0 0 ' + svgWidth + " " + svgHeight + '" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<line x1="' + padding + '" y1="' + padding + '" x2="' + (svgWidth - padding) + '" y2="' + padding + '" stroke="rgba(0,0,0,0.04)" stroke-dasharray="3,3" />' +
      '<line x1="' + padding + '" y1="' + (svgHeight / 2) + '" x2="' + (svgWidth - padding) + '" y2="' + (svgHeight / 2) + '" stroke="rgba(0,0,0,0.04)" stroke-dasharray="3,3" />' +
      '<line x1="' + padding + '" y1="' + (svgHeight - padding) + '" x2="' + (svgWidth - padding) + '" y2="' + (svgHeight - padding) + '" stroke="rgba(0,0,0,0.08)" />' +
      '<defs><linearGradient id="total-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.15" /><stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" /></linearGradient>' +
      '<linearGradient id="flagged-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.12" /><stop offset="100%" stop-color="#ef4444" stop-opacity="0.0" /></linearGradient></defs>' +
      '<path d="' + totalAreaPath + '" fill="url(#total-grad)" />' +
      '<path d="M ' + totalLinePath + '" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />' +
      '<path d="' + flaggedAreaPath + '" fill="url(#flagged-grad)" />' +
      '<path d="M ' + flaggedLinePath + '" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />' +
      nodesSvg +
      '<text x="10" y="' + (padding + 4) + '" font-size="8" fill="#94a3b8">140</text>' +
      '<text x="10" y="' + (svgHeight / 2 + 3) + '" font-size="8" fill="#94a3b8">70</text>' +
      '<text x="10" y="' + (svgHeight - padding + 3) + '" font-size="8" fill="#94a3b8">0</text>' +
      "</svg>";

    // Donut chart. NOTE: mirrors the original's exact (quirky) math — each
    // arc's stroke-dasharray/offset are computed from `item.value` (a raw
    // count), not `item.percentage`, even though a `normalizedPercentage`
    // variable is separately computed in the source and never actually
    // used for the rendered circle. Preserved verbatim per the "don't fix
    // AI/UI behavior" migration requirement, even though it looks like a
    // leftover/bug in the original.
    let accumulatedOffset = 0;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const donutCircles = ratingBreakdown.map(function (item, idx) {
      const strokeDasharray = (item.value / 100) * circumference + " " + circumference;
      const strokeDashoffset = -accumulatedOffset;
      accumulatedOffset += (item.value / 100) * circumference;
      return '<circle data-donut-idx="' + idx + '" cx="72" cy="72" r="' + radius + '" stroke="' + item.color + '" stroke-width="15" fill="transparent" stroke-dasharray="' + strokeDasharray + '" stroke-dashoffset="' + strokeDashoffset + '" class="transition hover:opacity-80 duration-150 cursor-pointer" />';
    }).join("");

    const legendHtml = ratingBreakdown.map(function (item, idx) {
      return '<div data-donut-idx="' + idx + '" class="donut-legend-row flex items-center justify-between p-1 px-2 rounded-lg border border-transparent transition"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full" style="background-color:' + item.color + '"></span><span class="text-xs text-slate-600 dark:text-slate-350 font-medium">' + escapeHtml(item.name) + '</span></div><span class="text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200">' + item.percentage + "%</span></div>";
    }).join("");

    document.getElementById("ai-dashboard-root").innerHTML =
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10"><div><h1 class="font-display text-4xl sm:text-5xl font-black tracking-tighter uppercase leading-none text-slate-900 dark:text-white">Command <span class="text-blue-600">Cabin</span>.</h1><p class="text-zinc-500 font-medium mt-2 text-xs sm:text-sm">Operational dashboard • Local sandbox statistics, telemetry analysis, and database audit charts</p></div>' +
      '<div class="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-black/5 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 px-3.5 py-2 rounded-lg"><i data-lucide="clock" class="text-blue-500 animate-pulse" style="width:13px;height:13px"></i><span>Operational: 24h Telemetry Active</span></div></div>' +

      '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">' +
      '<div class="rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 shadow-sm relative overflow-hidden flex items-start justify-between min-h-[110px]"><div class="space-y-1"><span class="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider">Total Audits Executed</span><p class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-1 italic">' + total + '</p><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">' + textCount + " Articles • " + imageCount + ' Visuals</p></div><div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600"><i data-lucide="activity" style="width:18px;height:18px"></i></div></div>' +

      '<div class="rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 shadow-sm relative overflow-hidden flex items-start justify-between min-h-[110px]"><div class="space-y-1"><span class="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Misinformation Blocked</span><p class="text-2xl sm:text-3xl font-extrabold text-red-500 mt-1">' + itemsFlagged + '</p><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">' + fakeCount + " full fakes • " + misleadingCount + ' misleading items</p></div><div class="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500"><i data-lucide="shield-alert" style="width:18px;height:18px"></i></div></div>' +

      '<div class="rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 shadow-sm relative overflow-hidden flex items-start justify-between min-h-[110px]"><div class="space-y-1"><span class="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Detection Precision Rate</span><p class="text-2xl sm:text-3xl font-extrabold text-emerald-500 mt-1">' + averageConfidence + '%</p><p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Target rating confidence average</p></div><div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500"><i data-lucide="trending-up" style="width:18px;height:18px"></i></div></div>' +

      '<div class="rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 shrink-0 relative overflow-hidden flex flex-col justify-between text-white min-h-[110px] shadow-lg"><div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none"></div><div class="space-y-0.5"><h4 class="text-[10px] uppercase font-bold text-blue-200 tracking-wider">Verification Actions</h4><p class="text-xs sm:text-sm font-semibold max-w-[170px] mt-1 leading-tight">Need to analyze another graphic?</p></div><button data-tab-trigger="text-mode" class="flex items-center gap-1 mt-3 px-3 py-1.5 bg-white text-slate-900 rounded-lg text-[10px] sm:text-xs font-bold self-start shadow border hover:-translate-y-0.5 transition duration-150"><span>Scan Article</span><i data-lucide="arrow-up-right" style="width:12px;height:12px"></i></button></div>' +
      "</div>" +

      '<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">' +
      '<div class="lg:col-span-7 rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 sm:p-6 shadow-sm flex flex-col justify-between"><div class="flex items-center justify-between mb-4"><div><h3 class="font-display text-sm sm:text-base font-bold text-slate-950 dark:text-white flex items-center gap-1.5"><i data-lucide="bar-chart-3" class="text-blue-500" style="width:15px;height:15px"></i> Weekly Telemetry Volume</h3><p class="text-[10px] text-slate-400 mt-0.5">Statistical aggregate of articles scrutinized vs fabricated content.</p></div>' +
      '<div class="flex items-center gap-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400"><span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-500 block"></span> Total Checked</span><span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-red-500 block"></span> Flagged Fake/Misleading</span></div></div>' +
      '<div class="w-full overflow-x-auto select-none">' + areaChartSvg + "</div></div>" +

      '<div class="lg:col-span-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 sm:p-6 shadow-sm flex flex-col justify-between"><div><h3 class="font-display text-sm sm:text-base font-bold text-slate-950 dark:text-white flex items-center gap-1.5"><i data-lucide="pie-chart" class="text-purple-500" style="width:15px;height:15px"></i> Credibility Distribution</h3><p class="text-[10px] text-slate-400 mt-0.5">Visual breakdown of ratings attributed to checked databases.</p></div>' +
      '<div class="flex flex-col sm:flex-row items-center gap-6 py-6 sm:py-0"><div class="relative w-36 h-36 flex items-center justify-center select-none grow-0 shrink-0"><svg class="w-full h-full transform -rotate-90">' + donutCircles + '</svg><div class="absolute flex flex-col items-center"><span class="text-[9px] font-mono uppercase text-slate-400">Breakdown</span><span class="text-lg font-black text-slate-800 dark:text-white">Active</span></div></div>' +
      '<div class="flex-1 space-y-2.5 w-full">' + legendHtml + "</div></div></div>" +
      "</div>" +

      '<div class="rounded-2xl border border-slate-250/20 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 sm:p-6 shadow-sm"><h3 class="font-display text-sm font-bold text-slate-900 dark:text-white mb-2">Platform Accuracy Disclosing Protocols</h3><p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-4xl">At TruthLens, accuracy averages represent precision verification checks utilizing semantic structural tests. In fallback preview configurations, estimations utilize standard heuristic parsing rules. Once a dedicated <span class="text-blue-500 font-mono">GEMINI_API_KEY</span> is supplied inside the Secrets Panel, calculations are computed utilizing live multimodal deep generative reasoning which ensures high confidence benchmarks.</p></div>';

    // Donut hover linkage (circle <-> legend row), bound fresh each render.
    const dashboardRoot = document.getElementById("ai-dashboard-root");
    dashboardRoot.querySelectorAll("[data-donut-idx]").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        const idx = el.getAttribute("data-donut-idx");
        dashboardRoot.querySelectorAll('.donut-legend-row[data-donut-idx="' + idx + '"]').forEach(function (row) {
          row.classList.add("bg-slate-100", "dark:bg-slate-800");
        });
      });
      el.addEventListener("mouseleave", function () {
        const idx = el.getAttribute("data-donut-idx");
        dashboardRoot.querySelectorAll('.donut-legend-row[data-donut-idx="' + idx + '"]').forEach(function (row) {
          row.classList.remove("bg-slate-100", "dark:bg-slate-800");
        });
      });
    });

    window.refreshIcons();
  }

  // ---------------------------------------------------------------------
  // History / Audit Ledger (HistorySection.tsx)
  // ---------------------------------------------------------------------
  const historyState = { searchQuery: "", typeFilter: "all", ratingFilter: "all", selectedItemId: null };

  function filteredHistoryList() {
    const q = historyState.searchQuery.toLowerCase();
    return state.history.filter(function (item) {
      const matchSearch = item.summary.toLowerCase().includes(q) || item.rating.toLowerCase().includes(q) || (item.previewTextOrImage && item.previewTextOrImage.toLowerCase().includes(q));
      const matchType = historyState.typeFilter === "all" || item.type === historyState.typeFilter;
      let matchRating = true;
      if (historyState.ratingFilter !== "all") {
        if (historyState.ratingFilter === "REAL") matchRating = item.rating === "REAL" || item.rating === "AUTHENTIC";
        else if (historyState.ratingFilter === "FAKE") matchRating = item.rating === "FAKE" || item.rating === "DEEPFAKE";
        else if (historyState.ratingFilter === "MISLEADING") matchRating = item.rating === "MISLEADING" || item.rating === "MANIPULATED";
        else if (historyState.ratingFilter === "SATIRE") matchRating = item.rating === "SATIRE";
      }
      return matchSearch && matchType && matchRating;
    });
  }

  function renderHistoryTab() {
    renderLedgerList();
    renderCertificate();
    applyFilterButtonStyles();
  }

  function applyFilterButtonStyles() {
    ["all", "text", "image"].forEach(function (t) {
      const btn = document.getElementById("filter-type-" + t);
      const active = historyState.typeFilter === t;
      btn.className = "px-2.5 py-1 rounded text-[10px] font-bold uppercase transition " + (active ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-500 dark:text-slate-400");
    });
  }

  function renderLedgerList() {
    const container = document.getElementById("ledger-items-list");
    const list = filteredHistoryList();
    if (list.length === 0) {
      container.innerHTML = '<div class="rounded-2xl border border-slate-200/50 dark:border-slate-800 p-12 text-center bg-white dark:bg-slate-850"><p class="text-xs text-slate-400">No verification items correspond to active filter scopes.</p></div>';
      window.refreshIcons();
      return;
    }
    container.innerHTML = list.map(function (item) {
      const selected = historyState.selectedItemId === item.id;
      const cardCls = selected
        ? "bg-blue-50/40 dark:bg-blue-950/15 border-blue-400 dark:border-blue-800 shadow-md"
        : "bg-white dark:bg-slate-850 border-slate-150/65 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700";
      const typeBadgeCls = item.type === "text" ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600";
      const titleLine = item.type === "text" ? (item.details.titleAnalyzed || item.previewTextOrImage) : "Forensics Visual Image Audit File";
      return '<div id="ledger-item-' + item.id + '" data-ledger-item-id="' + item.id + '" class="p-4 rounded-2xl border transition-all cursor-pointer text-left relative overflow-hidden ' + cardCls + '">' +
        '<div class="flex items-start justify-between gap-4"><div class="flex items-center gap-2"><span class="px-2 py-0.5 rounded text-[9px] font-mono uppercase font-black tracking-wider ' + typeBadgeCls + '">' + escapeHtml(item.type) + '</span><span class="text-[10px] font-mono text-slate-400">' + new Date(item.timestamp).toLocaleDateString() + '</span></div>' +
        '<div class="flex items-center gap-1.5">' + verdictBadgeHtml(item.rating) + '<button data-delete-id="' + item.id + '" class="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Delete record"><i data-lucide="trash-2" style="width:13px;height:13px"></i></button></div></div>' +
        '<p class="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2 line-clamp-1">' + escapeHtml(titleLine) + '</p>' +
        '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">' + escapeHtml(item.summary) + '</p>' +
        '<div class="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[10px]"><span class="text-slate-400 font-mono">Precision: ' + item.confidenceOrScore + '%</span><span class="text-blue-500 font-semibold inline-flex items-center gap-0.5">Open Analysis Details <i data-lucide="arrow-up-right" style="width:10px;height:10px"></i></span></div>' +
        "</div>";
    }).join("");
    window.refreshIcons();
  }

  function renderCertificate() {
    const container = document.getElementById("full-certificate-display-column");
    const item = state.history.find(function (h) { return h.id === historyState.selectedItemId; });
    if (!item) {
      container.innerHTML = '<div class="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-8 text-center min-h-[350px] flex flex-col items-center justify-center text-slate-400"><i data-lucide="file-text" class="opacity-40 animate-pulse duration-[3000ms] mb-3" style="width:32px;height:32px"></i><h4 class="font-display text-sm font-semibold text-slate-700 dark:text-slate-350">Preview Audit Blueprint</h4><p class="text-[11px] max-w-xs mt-1">Select a compiled history report from the list on the left to unroll full facts, credentials, and export controls.</p></div>';
      window.refreshIcons();
      return;
    }
    const title = item.type === "text" ? (item.details.titleAnalyzed || "Plaintext Scanned Article") : "Forensic Photo Analysis Blueprint";
    container.innerHTML =
      '<div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-5 sm:p-6 shadow-lg space-y-6 animate-in fade-in zoom-in duration-200 text-left">' +
      '<div><div class="flex justify-between items-center mb-1"><span class="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-black">Fact Certificate</span><span class="text-[9px] font-mono text-slate-400">Ref: ' + escapeHtml(item.id) + '</span></div>' +
      '<h3 class="font-display text-sm sm:text-base font-bold text-slate-950 dark:text-white line-clamp-2">' + escapeHtml(title) + '</h3>' +
      '<p class="text-[10px] text-slate-400 mt-1 font-mono">' + new Date(item.timestamp).toUTCString() + "</p></div>" +
      '<div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between"><div><p class="text-[9px] font-mono uppercase text-slate-400">Verdict Inferred</p><p class="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">' + escapeHtml(item.rating) + '</p></div><div class="text-right"><p class="text-[9px] font-mono uppercase text-slate-400">Scale Precision</p><p class="text-base font-extrabold text-blue-500 mt-0.5">' + item.confidenceOrScore + "%</p></div></div>" +
      '<div><h4 class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Analytical Forensic Reasoning</h4><p class="text-xs leading-relaxed text-slate-600 dark:text-slate-350 mt-1.5">' + escapeHtml(item.summary) + "</p></div>" +
      '<div class="flex gap-2"><button data-rehydrate-id="' + item.id + '" class="flex-1 py-1 px-3 bg-blue-500/10 hover:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase tracking-wide rounded-lg transition duration-150 flex items-center justify-center gap-1"><i data-lucide="refresh-ccw" style="width:10px;height:10px"></i><span>Mount to analyzer</span></button></div>' +
      '<div class="border-t border-slate-150 dark:border-slate-800/80 pt-4 space-y-3"><h4 class="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Discharge Reports</h4><div class="grid grid-cols-2 gap-2.5">' +
      '<button data-export-txt-id="' + item.id + '" class="py-2 px-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-[10px] text-slate-700 dark:text-slate-200 font-bold transition flex items-center justify-center gap-1.5"><i data-lucide="download" style="width:11px;height:11px"></i><span>Forensic Report</span></button>' +
      '<button data-export-csv-id="' + item.id + '" class="py-2 px-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-[10px] text-slate-700 dark:text-slate-200 font-bold transition flex items-center justify-center gap-1.5"><i data-lucide="file-spreadsheet" style="width:11px;height:11px"></i><span>CSV Sheet</span></button>' +
      "</div></div></div>";
    window.refreshIcons();
  }

  async function deleteHistoryItem(id) {
    if (historyState.selectedItemId === id) historyState.selectedItemId = null;
    try {
      const res = await apiFetch("/api/history/delete", { method: "POST", body: JSON.stringify({ id: id }) });
      if (res.ok) {
        const data = await res.json();
        if (data.success) state.history = data.history;
      }
    } catch (err) {
      console.error("Delete record request failed:", err);
    }
    renderLedgerList();
    renderCertificate();
  }

  function exportCsv(item) {
    const headers = ["Attribute", "Value"];
    const rows = [
      ["Report ID", item.id],
      ["Content Type", item.type.toUpperCase()],
      ["Timestamp", item.timestamp],
      ["Verdict Rating", item.rating],
      ["Confidence/Authenticity Score", item.confidenceOrScore + "%"],
      ["Summary Analysis", item.summary.replace(/"/g, '""')],
    ];
    if (item.type === "text") {
      rows.push(["Emotional Bias score", item.details.emotionalManipulationScore + "%"]);
      rows.push(["Clickbait score", item.details.clickbaitScore + "%"]);
      rows.push(["AI Generation score", item.details.aiContentProbability + "%"]);
    } else {
      rows.push(["Deepfake Probability", item.details.deepfakeProbability + "%"]);
      rows.push(["Manipulation Probability", item.details.manipulationProbability + "%"]);
      rows.push(["AI Generative Probability", item.details.aiGenerativeProbability + "%"]);
    }
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ].concat(rows.map(function (r) { return r.map(function (cell) { return '"' + cell + '"'; }).join(","); })).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "truthlens_report_" + item.id + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportTextBulletin(item) {
    const border = "======================================================================";
    let detailsBlock;
    let claimsBlock;
    if (item.type === "text") {
      detailsBlock = "\nEmotional Manipulation : " + item.details.emotionalManipulationScore + "%\nClickbait Component    : " + item.details.clickbaitScore + "%\nSynthesized AI Score   : " + item.details.aiContentProbability + "%\n";
      claimsBlock = (item.details.claimsList || []).map(function (c, idx) {
        return "\nClaim #" + (idx + 1) + ': "' + c.claim + '"\nVerdict: ' + c.status.toUpperCase() + "\nReview Notes: " + c.explanation + "\n";
      }).join("");
    } else {
      detailsBlock = "\nDeepfake Swap Rate     : " + item.details.deepfakeProbability + "%\nPixel Edit Probability : " + item.details.manipulationProbability + "%\nAI Generative Material : " + item.details.aiGenerativeProbability + "%\nMetadata Header Notes  : " + (item.details.metadataDissonance || "N/A") + "\n";
      claimsBlock = (item.details.detectedAnomalies || []).map(function (a, idx) {
        return "\nAnomaly #" + (idx + 1) + ": " + a.name + " (Severity " + a.score + "%)\nForensics: " + a.details + "\n";
      }).join("");
    }
    const bulletText = "\n" + border + "\n                  TRUTHLENS FORENSIC VERIFICATION BULLETIN\n" + border +
      "\nReport Index Reference     : " + item.id +
      "\nVerification Timestamp    : " + new Date(item.timestamp).toUTCString() +
      "\nEvaluated Format          : " + item.type.toUpperCase() +
      "\nInferred Verdict Category : " + item.rating +
      "\nAccuracy Confidence Metric: " + item.confidenceOrScore + "%" +
      "\n\nSUMMARY FINDINGS:\n-----------------\n" + item.summary +
      "\n\nFORENSICS DETAILS:\n------------------" + detailsBlock +
      "\nAUDITED STATEMENTS OR KEY CLAIMS EVALUATED:\n-------------------------------------------" + claimsBlock +
      "\n\nCOMPREHENSIVE VERBATIM CITATIONS:\n----------------------------------\nThis assessment was formatted and processed utilizing leading-edge neural language and pixel Forensics calculations.\n\nReport archived by TruthLens Secure Gateway.\n" + border + "\n";

    const blob = new Blob([bulletText], { type: "text/plain" });
    const element = document.createElement("a");
    element.href = URL.createObjectURL(blob);
    element.download = "truthlens_forensic_bulletin_" + item.id + ".txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  // ---------------------------------------------------------------------
  // Master event delegation
  // ---------------------------------------------------------------------
  document.addEventListener("click", function (e) {
    // Tab navigation (navbar, hero CTAs, footer links, dashboard CTA, brand logo)
    const tabTrigger = e.target.closest("[data-tab-trigger]");
    if (tabTrigger) { showTab(tabTrigger.getAttribute("data-tab-trigger")); return; }

    // Theme toggle
    if (e.target.closest("#theme-toggle-btn")) {
      state.darkMode = !state.darkMode;
      document.documentElement.classList.toggle("dark", state.darkMode);
      document.getElementById("theme-toggle-btn").innerHTML = state.darkMode
        ? '<i data-lucide="sun" style="width:17px;height:17px"></i>'
        : '<i data-lucide="moon" style="width:17px;height:17px"></i>';
      window.refreshIcons();
      return;
    }

    // Mobile menu toggle
    if (e.target.closest("#mobile-menu-toggle-btn")) {
      const panel = document.getElementById("mobile-navigation-panel");
      const nowOpen = panel.classList.contains("hidden");
      panel.classList.toggle("hidden");
      renderMobileMenuIcon(nowOpen);
      return;
    }

    // Profile dropdown
    if (e.target.closest("#dropdown-logout")) { handleLogout(); return; }
    if (e.target.closest("#dropdown-goto-history")) { showTab("history"); return; }
    if (e.target.closest("#user-profile-toggle")) {
      profileDropdownOpen = !profileDropdownOpen;
      renderAuthSlot();
      return;
    }
    if (e.target.closest("#login-trigger-btn")) { openAuthModal(); return; }
    if (profileDropdownOpen && !e.target.closest("#user-profile-dropdown")) {
      profileDropdownOpen = false;
      renderAuthSlot();
    }

    // Auth modal controls
    if (e.target.closest("#close-auth-modal")) { closeAuthModal(); return; }
    if (e.target.closest("#auth-login-tab")) { setAuthTab("login"); return; }
    if (e.target.closest("#auth-signup-tab")) { setAuthTab("signup"); return; }
    if (e.target.closest("#auth-forgot-trigger")) { setAuthTab("forgot"); return; }
    if (e.target.closest("#auth-back-to-login")) { setAuthTab("login"); return; }
    if (e.target.closest("#google-sigin-btn")) { submitGoogleSignIn(); return; }

    // FAQ accordion
    const faqBtn = e.target.closest("[data-faq-btn]");
    if (faqBtn) { toggleFaq(parseInt(faqBtn.getAttribute("data-faq-btn"), 10)); return; }

    // Article Analysis: sample templates, upload dropzone, reset
    const sampleBtn = e.target.closest("[data-sample-idx]");
    if (sampleBtn) { applyTextSample(parseInt(sampleBtn.getAttribute("data-sample-idx"), 10)); return; }
    if (e.target.closest("#reset-analysis-btn")) { resetTextAnalysis(); return; }
    const highlightSeg = e.target.closest("[data-highlight-idx]");
    if (highlightSeg && textPanel.result) {
      const idx = parseInt(highlightSeg.getAttribute("data-highlight-idx"), 10);
      const seg = textPanel.result.highlightedSentences[idx];
      if (seg && seg.rating === "suspicious") {
        textPanel.selectedHighlight = { text: seg.text, reason: seg.reason };
        renderTextResults();
      }
      return;
    }

    // Image Verification: sample templates, dropzone-to-browse, verify, reset
    const imgSampleBtn = e.target.closest("[data-image-sample-idx]");
    if (imgSampleBtn) {
      const sample = IMAGE_SAMPLES[parseInt(imgSampleBtn.getAttribute("data-image-sample-idx"), 10)];
      setImagePreview(sample.url, "image/jpeg");
      return;
    }
    if (e.target.closest("#image-dropzone-empty")) { document.getElementById("image-file-input").click(); return; }
    if (e.target.closest("#verify-image-cmd-btn")) { executeImageAnalysis(); return; }
    if (e.target.closest("#reset-image-btn")) { resetImageWorkspace(); return; }

    // History: type filter buttons, item selection, delete, rehydrate, export
    const typeFilterBtn = e.target.closest("[data-type-filter]");
    if (typeFilterBtn) {
      historyState.typeFilter = typeFilterBtn.getAttribute("data-type-filter");
      applyFilterButtonStyles();
      renderLedgerList();
      return;
    }
    const deleteBtn = e.target.closest("[data-delete-id]");
    if (deleteBtn) { deleteHistoryItem(deleteBtn.getAttribute("data-delete-id")); return; }
    const rehydrateBtn = e.target.closest("[data-rehydrate-id]");
    if (rehydrateBtn) {
      const item = state.history.find(function (h) { return h.id === rehydrateBtn.getAttribute("data-rehydrate-id"); });
      if (item) showTab(item.type === "text" ? "text-mode" : "image-mode");
      return;
    }
    const exportTxtBtn = e.target.closest("[data-export-txt-id]");
    if (exportTxtBtn) {
      const item = state.history.find(function (h) { return h.id === exportTxtBtn.getAttribute("data-export-txt-id"); });
      if (item) exportTextBulletin(item);
      return;
    }
    const exportCsvBtn = e.target.closest("[data-export-csv-id]");
    if (exportCsvBtn) {
      const item = state.history.find(function (h) { return h.id === exportCsvBtn.getAttribute("data-export-csv-id"); });
      if (item) exportCsv(item);
      return;
    }
    const ledgerItem = e.target.closest("[data-ledger-item-id]");
    if (ledgerItem) {
      historyState.selectedItemId = ledgerItem.getAttribute("data-ledger-item-id");
      renderLedgerList();
      renderCertificate();
      return;
    }
  });

  document.addEventListener("submit", function (e) {
    if (e.target.id === "auth-form") { e.preventDefault(); submitAuthForm(); return; }
    if (e.target.id === "article-analysis-form") { e.preventDefault(); submitTextAnalysis(); return; }
  });

  document.addEventListener("input", function (e) {
    if (e.target.id === "article-title-input" || e.target.id === "article-url-input" || e.target.id === "article-text-textarea") {
      updateArticleFormControls();
    }
    if (e.target.id === "ledger-search-query-input") {
      historyState.searchQuery = e.target.value;
      renderLedgerList();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "doc-file-upload" && e.target.files && e.target.files[0]) {
      handleTextFileSelected(e.target.files[0]);
    }
    if (e.target.id === "image-file-input" && e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
    if (e.target.id === "ledger-rating-filter-select") {
      historyState.ratingFilter = e.target.value;
      renderLedgerList();
    }
  });

  document.addEventListener("dragover", function (e) {
    if (e.target.closest("#doc-drop-zone") || e.target.closest("#image-dropzone-empty")) {
      e.preventDefault();
    }
  });

  document.addEventListener("drop", function (e) {
    if (e.target.closest("#doc-drop-zone")) {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) handleTextFileSelected(files[0]);
    }
    if (e.target.closest("#image-dropzone-empty")) {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) processImageFile(files[0]);
    }
  });

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", function () {
    renderNavbar();
    updateArticleFormControls();
    window.refreshIcons();
  });
})();
