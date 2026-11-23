/* ==========================================================================
   Main Interactive Experience Controller & Persistent Visual Editor (Round 02)
   Upgrades:
   - Async IndexedDB + LocalStorage hydration on startup (survives reloads!)
   - Permanent MP4 & WebM replacement (`idb://media/...` & DataURI, ZERO ephemeral blob persistence)
   - Full Text, Image, Video, Color & Layout live editing + explicit Save button
   - Zero-overlap Mobile Helical Card clamping above bottom filter dock
   ========================================================================== */

(function () {
  "use strict";

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeConfig(defaults, saved) {
    if (!saved || typeof saved !== "object") return deepClone(defaults);
    const out = deepClone(defaults);
    const isLegacyDraft = !saved.page02Version || saved.page02Version < 2;
    for (const key of Object.keys(saved)) {
      if (key === "projects" && Array.isArray(saved.projects)) {
        if (isLegacyDraft) {
          out.projects = deepClone(defaults.projects);
        } else {
          out.projects = saved.projects.map((sp, i) => Object.assign({}, defaults.projects[i] || defaults.projects[0], sp));
        }
      } else if (key === "brand" && isLegacyDraft) {
        out.brand = deepClone(defaults.brand);
      } else if (saved[key] && typeof saved[key] === "object" && !Array.isArray(saved[key]) && out[key]) {
        out[key] = Object.assign({}, out[key], saved[key]);
      } else {
        out[key] = saved[key];
      }
    }
    if (out.brand && (out.brand.name === "YOUR BRAND" || out.brand.labLabel === "// YOUR LAB ->")) {
      out.brand.name = "";
      out.brand.labLabel = defaults.brand.labLabel;
    }
    if (out.contact && (out.contact.headline === "YOUR CONTACT HEADLINE" || out.contact.email === "hello@yourbrand.placeholder")) {
      out.contact = deepClone(defaults.contact);
    }
    if (out.showreel && out.showreel.title === "YOUR BRAND · MASTER SHOWREEL") {
      out.showreel = deepClone(defaults.showreel);
    }
    out.page02Version = 2;
    return out;
  }

  /* ---------- Synthesized Web Audio Micro-Soundscape ---------- */
  class AmbientSoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = false;
      this.droneGain = null;
    }

    toggle() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        this.droneGain = this.ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.value = 110;
        osc2.type = "triangle";
        osc2.frequency.value = 164.81;
        filter.type = "lowpass";
        filter.frequency.value = 360;
        this.droneGain.gain.value = 0.0;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(this.droneGain);
        this.droneGain.connect(this.ctx.destination);
        osc1.start();
        osc2.start();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.enabled = !this.enabled;
      this.droneGain.gain.setTargetAtTime(this.enabled ? 0.03 : 0.0, this.ctx.currentTime, 0.25);
      return this.enabled;
    }

    ping(freq) {
      if (!this.enabled || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq || 520, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime((freq || 520) * 1.35, this.ctx.currentTime + 0.09);
        g.gain.setValueAtTime(0.032, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.14);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
      } catch (_e) {}
    }
  }

  /* ---------- Main Application ---------- */
  async function initTemplateApp() {
    const params = new URLSearchParams(window.__INIT_QUERY || window.location.search);
    const earlyPreloader = document.getElementById("preloader");
    if (earlyPreloader && params.get("skipIntro") === "1" && params.get("preloader") === null) {
      earlyPreloader.style.transition = "none";
      earlyPreloader.classList.add("is-hidden");
    }
    const store = new window.PersistentTemplateStore();
    const collab = new window.CollaborativeSyncManager(store);
    const persistedCfg = await store.loadConfig();
    const urlHashCfg = collab.parseUrlHandoffHash();

    let initialCfg = mergeConfig(window.DEFAULT_TEMPLATE_CONFIG, persistedCfg);
    let bootSource = persistedCfg ? "LOCAL_DB" : "DEFAULT";

    // Priority 1: URL #handoff=... link shared across devices
    if (urlHashCfg) {
      const cleanHashCfg = await collab.importHandoffPackage(urlHashCfg);
      initialCfg = mergeConfig(window.DEFAULT_TEMPLATE_CONFIG, cleanHashCfg);
      await store.saveConfig(initialCfg);
      bootSource = "URL_HANDOFF";
    } else if (params.get("disableAutoPull") !== "1") {
      // Priority 2: Auto-pull latest Shared Workspace if server has newer or published state
      const sharedPull = await collab.pullSharedWorkspace(params.get("syncUrl") || "");
      if (sharedPull.ok && sharedPull.config) {
        initialCfg = mergeConfig(window.DEFAULT_TEMPLATE_CONFIG, sharedPull.config);
        await store.saveConfig(initialCfg);
        bootSource = `SHARED_REV_${sharedPull.revision}_${sharedPull.authorRole}`;
      }
    }

    if (initialCfg && initialCfg.masterCms && typeof initialCfg.masterCms === "object") {
      window.__HYDRATED_MASTER_CMS = initialCfg.masterCms;
      if (window.__INTRARAT_MASTER__ && typeof window.__INTRARAT_MASTER__.applyExternalCms === "function") {
        window.__INTRARAT_MASTER__.applyExternalCms(initialCfg.masterCms);
      }
    }

    const mqlReduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const pinnedIntroTime = params.get("introTime") !== null ? parseFloat(params.get("introTime")) : null;
    const pinnedTiltX = params.get("tiltX") !== null ? parseFloat(params.get("tiltX")) : null;
    const pinnedTiltY = params.get("tiltY") !== null ? parseFloat(params.get("tiltY")) : null;
    const pinnedHover = params.get("hover") === "1";

    const state = {
      config: initialCfg,
      targetScroll: 0,
      scrollProgress: 0,
      scrollVelocity: 0,
      targetMouseX: pinnedTiltX !== null && !Number.isNaN(pinnedTiltX) ? pinnedTiltX : 0,
      targetMouseY: pinnedTiltY !== null && !Number.isNaN(pinnedTiltY) ? pinnedTiltY : 0,
      mouseX: pinnedTiltX !== null && !Number.isNaN(pinnedTiltX) ? pinnedTiltX : 0,
      mouseY: pinnedTiltY !== null && !Number.isNaN(pinnedTiltY) ? pinnedTiltY : 0,
      targetFollowX: pinnedTiltX !== null && !Number.isNaN(pinnedTiltX) ? pinnedTiltX : 0,
      targetFollowY: pinnedTiltY !== null && !Number.isNaN(pinnedTiltY) ? pinnedTiltY : 0,
      followX: pinnedTiltX !== null && !Number.isNaN(pinnedTiltX) ? pinnedTiltX : 0,
      followY: pinnedTiltY !== null && !Number.isNaN(pinnedTiltY) ? pinnedTiltY : 0,
      followVelX: 0,
      followVelY: 0,
      rotVelX: 0,
      rotVelY: 0,
      pointerInside: pinnedHover,
      isLogoHovered: pinnedHover,
      hoverExplosion: pinnedHover ? 1.0 : 0.0,
      hoverVel: 0,
      hoverCycleCount: pinnedHover ? 1 : 0,
      lastClientX: -100,
      lastClientY: -100,
      time: 0,
      introElapsed: pinnedIntroTime !== null && !Number.isNaN(pinnedIntroTime)
        ? pinnedIntroTime
        : (params.get("skipIntro") === "1" ? 3.2 : 0),
      introTimePinned: pinnedIntroTime !== null && !Number.isNaN(pinnedIntroTime),
      reducedMotion: Boolean(mqlReduced && mqlReduced.matches),
      activeFilter: "all",
      searchQuery: "",
      selectedProjectIndex: 0
    };

    if (mqlReduced && mqlReduced.addEventListener) {
      mqlReduced.addEventListener("change", (ev) => {
        state.reducedMotion = Boolean(ev.matches);
      });
    }

    // Expose inspection handle for automated persistence tests
    window.__TEMPLATE_APP_STATE = state;
    window.__TEMPLATE_STORE = store;
    window.__TEMPLATE_COLLAB = collab;
    window.__BOOT_SOURCE = bootSource;

    const canvas = document.getElementById("webgl-stage");
    const engine = new window.ActiveTheoryWebGLEngine(canvas);
    const videoMgr = new window.ReusableVideoManager(store);
    const sound = new AmbientSoundEngine();

    // DOM Elements
    const preloaderEl = document.getElementById("preloader");
    const preloaderDome = document.getElementById("preloader-dome");
    const introLogoImg = document.getElementById("intro-logo-img");
    const heroSymbolImg = document.getElementById("hero-symbol-img");
    const introAmbientGlow = document.getElementById("intro-ambient-glow");
    const customBgLayer = document.getElementById("custom-bg-layer");
    const brandNameText = document.getElementById("brand-name-text");
    const brandLogoImg = document.getElementById("brand-logo-img");
    const brandHomeBtn = document.getElementById("brand-home-btn");
    const labLinkBtn = document.getElementById("lab-link-btn");
    const navPillbox = document.getElementById("nav-pillbox");
    const navWorkBtn = document.getElementById("nav-work-btn");
    const navContactBtn = document.getElementById("nav-contact-btn");
    const audioToggleBtn = document.getElementById("audio-toggle-btn");
    const srHeadline = document.getElementById("sr-hero-headline");
    const heroOverlay = document.getElementById("hero-overlay");
    const heroManifesto = document.getElementById("hero-manifesto");
    const scrollCueBtn = document.getElementById("scroll-cue-btn");
    const scrollCueText = document.getElementById("scroll-cue-text");
    const workStage = document.getElementById("work-stage");
    const workCardsRoot = document.getElementById("work-cards-root");
    const discoveryPanel = document.getElementById("discovery-panel");
    const discoveryHeading = document.getElementById("discovery-heading");
    const discoveryList = document.getElementById("discovery-list");
    const discoveryInput = document.getElementById("discovery-input");
    const contactStage = document.getElementById("contact-stage");
    const contactEyebrow = document.getElementById("contact-eyebrow");
    const contactHeadline = document.getElementById("contact-headline");
    const contactSubcopy = document.getElementById("contact-subcopy");
    const contactPrimaryBtn = document.getElementById("contact-primary-btn");
    const contactReelBtn = document.getElementById("contact-reel-btn");
    const contactLocation = document.getElementById("contact-location");
    const contactSocial1 = document.getElementById("contact-social-1");
    const contactSocial2 = document.getElementById("contact-social-2");
    const railFill = document.getElementById("rail-fill");
    const railDots = document.querySelectorAll(".rail-dot");
    const editorFab = document.getElementById("editor-fab");
    const editorDrawer = document.getElementById("visual-editor-drawer");
    const editorCloseBtn = document.getElementById("editor-close-btn");
    const persistBadge = document.getElementById("persist-status-badge");
    const toastEl = document.getElementById("status-toast");

    let toastTimer = null;
    function showToast(msg) {
      if (!toastEl) return;
      toastEl.textContent = msg;
      toastEl.classList.add("is-visible");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2400);
    }

    let saveDebounce = null;
    function isCmsSessionAuthenticated() {
      return Boolean(
        window.__INTRARAT_MASTER__ &&
        typeof window.__INTRARAT_MASTER__.getState === "function" &&
        window.__INTRARAT_MASTER__.getState().adminSessionVerified
      );
    }

    async function saveConfigNow(announce) {
      const isAuth = isCmsSessionAuthenticated();
      if (announce && !isAuth) {
        if (persistBadge) persistBadge.textContent = "AUTH REQUIRED (401)";
        showToast("AUTHENTICATION REQUIRED — UNLOCK VISUAL EDITOR ABOVE");
        const passInp = document.getElementById("cms-editor-passcode-input");
        if (passInp) passInp.focus();
        return { savedIDB: false, savedLS: false, blockedByAuth: true };
      }
      if (window.__INTRARAT_MASTER__ && typeof window.__INTRARAT_MASTER__.getState === "function") {
        const ms = window.__INTRARAT_MASTER__.getState();
        if (ms && ms.cms) {
          state.config.masterCms = JSON.parse(JSON.stringify(ms.cms));
        }
      }
      const res = await store.saveConfig(state.config);
      if (persistBadge) {
        const mode = res.savedIDB ? "INDEXEDDB" : (res.savedLS ? "LOCALSTORAGE" : "MEMORY");
        const hhmmss = new Date().toTimeString().slice(0, 8);
        persistBadge.textContent = `SAVED (${mode}) · ${hhmmss}`;
      }
      if (announce) {
        if (isAuth) {
          try {
            const pubRes = await collab.publishSharedWorkspace(state.config, true, "");
            if (pubRes && pubRes.ok) {
              if (persistBadge) persistBadge.textContent = `SAVED & PUBLISHED REV #${pubRes.revision}`;
              showToast(`SAVED & PUBLISHED SHARED REV #${pubRes.revision}`);
              return res;
            }
          } catch (_e) {}
        }
        showToast("SAVED TO PERSISTENT STORAGE");
      }
      return res;
    }

    function scheduleAutoSave() {
      if (!isCmsSessionAuthenticated()) {
        if (persistBadge) persistBadge.textContent = "LOCKED (READ-ONLY)";
        return;
      }
      if (persistBadge) persistBadge.textContent = "SAVING CHANGES...";
      if (saveDebounce) clearTimeout(saveDebounce);
      saveDebounce = setTimeout(() => {
        saveConfigNow(false);
      }, 180);
    }

    if (persistedCfg && persistBadge) {
      persistBadge.textContent = "RESTORED SAVED STATE";
    }

    /* ---------- 1. True 3D 20-Sphere Intrarat Assembly & Non-WebGL PNG Fallback ---------- */
    const DEFAULT_INTRARAT_INTRO_LOGO = "assets/INTRARAT_LOGO_SYMBOL_ONLY_TRANSPARENT.png";
    const forceFallbackPng = params.get("fallbackPng") === "1" || !engine.gl;
    let introExitTimer = null;

    async function syncIntroLogoDOM() {
      if (!state.config.intro) {
        state.config.intro = {
          logoImageUrl: DEFAULT_INTRARAT_INTRO_LOGO,
          logoLabel: "INTRARAT_LOGO_SYMBOL_ONLY_TRANSPARENT.png",
          backgroundColor: "#f8fbf8",
          ambientGlowOpacity: 1.0,
          durationMs: 3000,
          maxTiltDeg: 15,
          parallaxDamping: 0.08,
          floatIntensity: 1.0,
          returnDelayMs: 1100
        };
      }
      const rawRef = state.config.intro.logoImageUrl || DEFAULT_INTRARAT_INTRO_LOGO;
      const resolvedUrl = await store.resolveMediaUrl(rawRef);
      if (introLogoImg) {
        introLogoImg.src = resolvedUrl || DEFAULT_INTRARAT_INTRO_LOGO;
      }
      if (heroSymbolImg) {
        heroSymbolImg.src = resolvedUrl || DEFAULT_INTRARAT_INTRO_LOGO;
      }
    }

    function runIntroSequence() {
      state.targetScroll = 0;
      state.introTimePinned = false;
      state.introElapsed = 0;

      if (forceFallbackPng && preloaderEl) {
        if (introExitTimer) clearTimeout(introExitTimer);
        preloaderEl.classList.remove("is-hidden", "is-exiting", "is-frozen");
        const dur = (state.config.intro && state.config.intro.durationMs) || 3000;
        introExitTimer = setTimeout(() => {
          preloaderEl.classList.add("is-hidden");
        }, dur);
      } else if (preloaderEl) {
        preloaderEl.classList.add("is-hidden");
      }
    }

    await syncIntroLogoDOM();

    if (forceFallbackPng) {
      preloaderEl.classList.remove("is-hidden");
    } else {
      preloaderEl.classList.add("is-hidden");
    }

    /* ---------- 2. Sync DOM & Media From Config ---------- */
    let cardElements = [];

    function formatDurationMMSS(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return "";
      const totalSec = Math.round(seconds);
      const mm = Math.floor(totalSec / 60);
      const ss = totalSec % 60;
      return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    }

    function rebuildCardsDOM() {
      workCardsRoot.innerHTML = "";
      const activeProjects = (state.config.projects || []).slice(0, 2);
      cardElements = activeProjects.map((proj, idx) => {
        const isComingSoon = Boolean(proj.comingSoon || !proj.videoUrl);

        const slot = document.createElement("div");
        slot.className = `page02-card-slot slot-${idx} ${idx === 0 ? "slot-dominant-left" : "slot-secondary-right"}`;
        slot.dataset.index = String(idx);

        // 3D Extruded Emerald Glass Bevel Edge (Left on Card 01, Right on Card 02)
        const bevelEdge = document.createElement("div");
        bevelEdge.className = `card-3d-bevel-edge ${idx === 0 ? "edge-left" : "edge-right"}`;
        bevelEdge.setAttribute("aria-hidden", "true");
        slot.appendChild(bevelEdge);

        const card = document.createElement("article");
        card.className = "showcase-card" + (isComingSoon ? " is-coming-soon" : "");
        card.id = `page02-video-card-${idx + 1}`;
        card.dataset.index = String(idx);
        card.dataset.category = proj.category || "websites";
        card.dataset.comingSoon = String(isComingSoon);

        const mediaWrap = document.createElement("div");
        mediaWrap.className = "card-media-wrap";

        const posterImg = document.createElement("img");
        posterImg.className = "card-poster-fallback";
        posterImg.alt = `${proj.title || "Intrarat Hospital"} Thumbnail`;

        const videoEl = document.createElement("video");
        videoEl.className = "card-video";
        videoEl.preload = "metadata";
        videoEl.muted = true;
        videoEl.playsInline = true;
        // Keep real video frame thumbnail visible on card surface until modal playback
        videoEl.style.opacity = "0";

        const legibilityGrad = document.createElement("div");
        legibilityGrad.className = "card-legibility-gradient";

        const emeraldRim = document.createElement("div");
        emeraldRim.className = "card-emerald-rim";

        mediaWrap.appendChild(posterImg);
        mediaWrap.appendChild(videoEl);
        mediaWrap.appendChild(legibilityGrad);
        mediaWrap.appendChild(emeraldRim);

        // Center Action: Real Play Button for Card 01 vs Non-Playable COMING SOON Lockup for Card 02
        const centerWrap = document.createElement("div");
        centerWrap.className = "card-center-action-wrap";
        if (isComingSoon) {
          const mutedIcon = document.createElement("div");
          mutedIcon.className = "card-center-coming-soon-icon";
          mutedIcon.setAttribute("aria-hidden", "true");
          mutedIcon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`;

          const soonCenter = document.createElement("div");
          soonCenter.className = "card-center-coming-soon-badge";
          soonCenter.id = `card-${idx + 1}-center-coming-soon`;
          soonCenter.setAttribute("aria-disabled", "true");
          soonCenter.textContent = "COMING SOON";

          centerWrap.appendChild(mutedIcon);
          centerWrap.appendChild(soonCenter);
        } else {
          const playBtn = document.createElement("button");
          playBtn.type = "button";
          playBtn.className = "card-center-play-btn";
          playBtn.id = `card-${idx + 1}-play-btn`;
          playBtn.setAttribute("aria-label", `Play ${(proj.title || "Video").replace(/\n/g, " ")}`);
          playBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>`;
          centerWrap.appendChild(playBtn);
        }

        const content = document.createElement("div");
        content.className = "card-content";

        const badge = document.createElement("div");
        badge.className = "card-video-badge";
        badge.textContent = proj.eyebrow || `VIDEO 0${idx + 1}`;

        const title = document.createElement("h3");
        title.className = "card-title";
        title.textContent = (proj.title || "").replace(/\n/g, " ");

        const subtitle = document.createElement("p");
        subtitle.className = "card-subtitle";
        subtitle.textContent = proj.subtitle || "";

        content.appendChild(badge);
        content.appendChild(title);
        content.appendChild(subtitle);

        // Bottom-Right Pill: Real Metadata Duration (Card 01) or COMING SOON (Card 02)
        const durationPill = document.createElement("div");
        durationPill.className = "card-duration-pill" + (isComingSoon ? " is-coming-soon-pill" : "");
        durationPill.id = `card-${idx + 1}-duration-pill`;

        card.appendChild(mediaWrap);
        card.appendChild(centerWrap);
        card.appendChild(content);
        card.appendChild(durationPill);
        slot.appendChild(card);

        // Subtle Floor Contact Highlight Line
        const contactGlow = document.createElement("div");
        contactGlow.className = "card-floor-contact-glow";
        contactGlow.setAttribute("aria-hidden", "true");
        slot.appendChild(contactGlow);

        // Realistic Studio Floor Reflection beneath card (mirrors photo + bottom vignette + title/subtitle/duration)
        const reflection = document.createElement("div");
        reflection.className = "card-floor-reflection";
        reflection.setAttribute("aria-hidden", "true");

        const reflectionInner = document.createElement("div");
        reflectionInner.className = "card-floor-reflection-inner";

        const reflectImg = document.createElement("img");
        reflectImg.className = "card-reflection-img";
        reflectImg.alt = "";

        const reflectGrad = document.createElement("div");
        reflectGrad.className = "card-legibility-gradient";

        const reflectContent = document.createElement("div");
        reflectContent.className = "card-content";
        const reflectTitle = document.createElement("div");
        reflectTitle.className = "card-title";
        reflectTitle.textContent = (proj.title || "").replace(/\n/g, " ");
        const reflectSubtitle = document.createElement("div");
        reflectSubtitle.className = "card-subtitle";
        reflectSubtitle.textContent = proj.subtitle || "";
        reflectContent.appendChild(reflectTitle);
        reflectContent.appendChild(reflectSubtitle);

        const reflectDuration = document.createElement("div");
        reflectDuration.className = "card-duration-pill" + (isComingSoon ? " is-coming-soon-pill" : "");

        if (isComingSoon) {
          durationPill.textContent = "COMING SOON";
          reflectDuration.textContent = "COMING SOON";
        } else {
          const initialDur = proj.durationLabel || "03:01";
          durationPill.textContent = initialDur;
          reflectDuration.textContent = initialDur;
          videoEl.addEventListener("loadedmetadata", () => {
            const formatted = formatDurationMMSS(videoEl.duration);
            if (formatted) {
              durationPill.textContent = formatted;
              durationPill.dataset.metadataDurationSec = String(Math.round(videoEl.duration));
              reflectDuration.textContent = formatted;
            }
          });
        }

        reflectionInner.appendChild(reflectImg);
        reflectionInner.appendChild(reflectGrad);
        reflectionInner.appendChild(reflectContent);
        reflectionInner.appendChild(reflectDuration);
        reflection.appendChild(reflectionInner);
        slot.appendChild(reflection);

        // Resolve poster & video source (only load metadata for real video, do not auto-loop heavy 216MB file in background)
        store.resolveMediaUrl(proj.posterUrl).then((resolvedPoster) => {
          const pUrl = resolvedPoster || proj.posterUrl || "";
          posterImg.src = pUrl;
          reflectImg.src = pUrl;
        });

        if (!isComingSoon && proj.videoUrl) {
          store.resolveMediaUrl(proj.videoUrl).then((resolvedVid) => {
            if (resolvedVid) {
              videoEl.src = resolvedVid;
              videoEl.load();
            }
          });
        }

        // Per-card interactive 3D pointer tilt & smooth hover elevation
        let hoverRotX = 0;
        let hoverRotY = 0;
        slot.addEventListener("mousemove", (ev) => {
          if (state.reducedMotion || window.innerWidth <= 640) return;
          const rect = slot.getBoundingClientRect();
          const nx = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
          const ny = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
          hoverRotY = nx * 3.2;
          hoverRotX = -ny * 2.4;
          slot.dataset.hoverRotX = String(hoverRotX);
          slot.dataset.hoverRotY = String(hoverRotY);
          slot.dataset.isHovered = "1";
        });
        slot.addEventListener("mouseleave", () => {
          hoverRotX = 0;
          hoverRotY = 0;
          slot.dataset.hoverRotX = "0";
          slot.dataset.hoverRotY = "0";
          slot.dataset.isHovered = "0";
        });

        card.addEventListener("mouseenter", () => sound.ping(580));
        card.addEventListener("click", (ev) => {
          if (isComingSoon) {
            ev.preventDefault();
            showToast("THE INTRARAT EXPERIENCE — VIDEO COMING SOON");
            return;
          }
          sound.ping(740);
          videoMgr.openModal(
            `${proj.eyebrow || "VIDEO 01"} — ${(proj.title || "").replace(/\n/g, " ")}`,
            proj.videoUrl,
            proj.posterUrl
          );
        });

        workCardsRoot.appendChild(slot);
        return { slot, card, videoEl, posterImg, durationPill };
      });
    }

    function rebuildDiscoveryDOM() {
      discoveryHeading.textContent = state.config.discovery.heading;
      discoveryInput.placeholder = state.config.discovery.promptPlaceholder;
      discoveryList.innerHTML = "";

      state.config.discovery.categories.forEach((cat) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "discovery-filter-btn" + (state.activeFilter === cat.id ? " active" : "");
        btn.innerHTML = `<span class="arrow-glyph">-&gt;</span><span>${cat.label}</span>`;
        btn.addEventListener("click", () => {
          sound.ping(640);
          state.activeFilter = cat.id;
          state.searchQuery = "";
          discoveryInput.value = "";
          document.querySelectorAll(".discovery-filter-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          focusFirstMatchingCard();
        });
        li.appendChild(btn);
        discoveryList.appendChild(li);
      });
    }

    function focusFirstMatchingCard() {
      const q = state.searchQuery.trim().toLowerCase();
      let firstMatch = -1;
      state.config.projects.forEach((proj, idx) => {
        const catOk = state.activeFilter === "all" || proj.category === state.activeFilter;
        const textBlob = `${proj.eyebrow} ${proj.title} ${proj.categoryLabel}`.toLowerCase();
        const matched = catOk && (!q || textBlob.includes(q));
        if (cardElements[idx]) {
          cardElements[idx].card.classList.toggle("is-filtered-out", !matched);
        }
        if (matched && firstMatch === -1) firstMatch = idx;
      });

      if (firstMatch >= 0 && (state.activeFilter !== "all" || q)) {
        const count = Math.max(1, state.config.projects.length - 1);
        state.targetScroll = 0.36 + (firstMatch / count) * 0.40;
      }
    }

    async function applyConfigToDOM(skipCardsRebuild) {
      const cfg = state.config;
      const rootStyle = document.documentElement.style;

      rootStyle.setProperty("--void-bg", cfg.theme.voidBg);
      rootStyle.setProperty("--glow-primary", cfg.theme.volumetricGlow);
      rootStyle.setProperty("--accent-cyan", cfg.theme.accentCyan);
      rootStyle.setProperty("--accent-magenta", cfg.theme.accentMagenta);
      rootStyle.setProperty("--text-primary", cfg.theme.textPrimary || "#ffffff");
      rootStyle.setProperty("--hero-offset-x", `${cfg.hero.horizontalOffsetPx || 0}px`);
      rootStyle.setProperty("--hero-offset-y", `${cfg.hero.verticalOffsetPx || 0}px`);
      rootStyle.setProperty("--card-width", `${(cfg.layout && cfg.layout.cardWidthPx) || 500}px`);
      rootStyle.setProperty("--card-height", `${(cfg.layout && cfg.layout.cardHeightPx) || 312}px`);
      rootStyle.setProperty("--manifesto-width", `${(cfg.layout && cfg.layout.manifestoWidthPx) || 345}px`);
      rootStyle.setProperty("--card-glass-alpha", String((cfg.layout && cfg.layout.cardGlassOpacity) ?? 0.82));

      if (cfg.theme.backgroundImageUrl) {
        const bgResolved = await store.resolveMediaUrl(cfg.theme.backgroundImageUrl);
        if (bgResolved) {
          customBgLayer.style.backgroundImage = `url("${bgResolved}")`;
          customBgLayer.style.opacity = String(cfg.theme.backgroundImageOpacity ?? 0.22);
        }
      } else {
        customBgLayer.style.backgroundImage = "none";
        customBgLayer.style.opacity = "0";
      }

      brandNameText.textContent = cfg.brand.name;
      await syncIntroLogoDOM();
      if (cfg.brand.showLogoImage && cfg.brand.logoImageUrl) {
        const logoResolved = await store.resolveMediaUrl(cfg.brand.logoImageUrl);
        if (logoResolved) {
          brandLogoImg.src = logoResolved;
          brandLogoImg.style.display = "block";
        } else {
          brandLogoImg.style.display = "none";
        }
      } else {
        brandLogoImg.style.display = "none";
      }
      labLinkBtn.textContent = cfg.brand.labLabel;

      if (cfg.navigation.items[0]) navWorkBtn.textContent = cfg.navigation.items[0].label;
      if (cfg.navigation.items[1]) navContactBtn.textContent = cfg.navigation.items[1].label;

      const isThLang = document.documentElement.lang === "th" || window.__SERVER_INIT_LANG === "th" || window.location.pathname.startsWith("/th");
      srHeadline.textContent = isThLang
        ? "โรงพยาบาลอินทรารัตน์ · กรุงเทพมหานคร"
        : (`${cfg.hero.headlineLine1} ${cfg.hero.headlineLine2} ${cfg.hero.headlineLine3}`.trim() || "INTRARAT INTERNATIONAL HOSPITAL · BANGKOK");
      if (!cfg.page02) {
        cfg.page02 = {
          smallHeading: "INTRARAT HOSPITAL",
          headlineDark: "DISCOVER",
          headlineGreen: "OUR EXPERIENCE",
          subtitle: "World-Class Care with Thai Hospitality",
          cardTiltDeg: 13.5
        };
      }
      const p2SmallEl = document.getElementById("page02-small-heading");
      const p2DarkEl = document.getElementById("page02-headline-dark");
      const p2GreenEl = document.getElementById("page02-headline-green");
      const p2SubEl = document.getElementById("page02-subtitle");
      if (p2SmallEl) p2SmallEl.textContent = isThLang ? "โรงพยาบาลอินทรารัตน์" : (cfg.page02.smallHeading || "INTRARAT HOSPITAL");
      if (p2DarkEl) p2DarkEl.textContent = isThLang ? "สัมผัส" : (cfg.page02.headlineDark || "DISCOVER");
      if (p2GreenEl) p2GreenEl.textContent = isThLang ? "ประสบการณ์การดูแลของเรา" : (cfg.page02.headlineGreen || "OUR EXPERIENCE");
      if (p2SubEl) p2SubEl.textContent = isThLang ? "การดูแลทางการแพทย์มาตรฐานสากล พร้อมการบริบาลแบบไทย" : (cfg.page02.subtitle || "World-Class Care with Thai Hospitality");
      heroManifesto.innerHTML = "";
      cfg.hero.manifesto.forEach((m) => {
        if (!m || !m.text || !m.text.trim()) return;
        const p = document.createElement("p");
        p.className = "manifesto-item" + (m.bullet ? " has-bullet" : "");
        p.textContent = m.text;
        heroManifesto.appendChild(p);
      });
      scrollCueText.textContent = isThLang ? "เลื่อนเพื่อสำรวจ" : cfg.hero.scrollCueLabel;

      contactEyebrow.textContent = cfg.contact.eyebrow;
      contactHeadline.textContent = cfg.contact.headline;
      contactSubcopy.textContent = cfg.contact.subcopy;
      contactPrimaryBtn.textContent = cfg.contact.primaryCtaLabel;
      contactPrimaryBtn.href = `mailto:${cfg.contact.email}`;
      contactReelBtn.textContent = cfg.contact.secondaryCtaLabel;
      contactLocation.textContent = cfg.contact.locationLabel;
      contactSocial1.textContent = cfg.contact.socialLabel1;
      contactSocial2.textContent = cfg.contact.socialLabel2;

      if (cfg.model3D.customObjData && cfg.model3D.preset === "custom-obj") {
        engine.loadCustomOBJ(cfg.model3D.customObjData);
      }

      rebuildDiscoveryDOM();
      if (!skipCardsRebuild) {
        rebuildCardsDOM();
      }
      focusFirstMatchingCard();
      if (typeof window.__UPDATE_BILINGUAL_P1_P2 === "function") {
        window.__UPDATE_BILINGUAL_P1_P2();
      }
    }

    /* ---------- 3. Navigation, Scroll, Touch & Keyboard ---------- */
    function jumpToScene(target) {
      sound.ping(660);
      if (target === "hero") state.targetScroll = 0.0;
      else if (target === "work") state.targetScroll = 0.36;
      else if (target === "contact") state.targetScroll = 0.95;
    }

    brandHomeBtn.addEventListener("click", () => jumpToScene("hero"));
    labLinkBtn.addEventListener("click", () => {
      if ((state.config.brand.labLabel || "").toUpperCase().includes("REPLAY")) {
        const urlSceneParam = (new URLSearchParams(window.location.search).get("scene") || "").toLowerCase();
      const urlPageParam = Number(new URLSearchParams(window.location.search).get("page") || "0");
      if (urlSceneParam === "work" || urlPageParam === 2) {
        state.scrollProgress = 0.36;
        state.targetScroll = 0.36;
      } else {
        runIntroSequence();
      }
        showToast("REPLAYING 3D 20-SPHERE LOGO ASSEMBLY");
      } else {
        jumpToScene(state.config.brand.labTargetScene || "work");
      }
    });
    navWorkBtn.addEventListener("click", () => jumpToScene(state.config.navigation.items[0]?.target || "work"));
    navContactBtn.addEventListener("click", () => jumpToScene(state.config.navigation.items[1]?.target || "contact"));
    scrollCueBtn.addEventListener("click", () => jumpToScene("work"));

    contactReelBtn.addEventListener("click", () => {
      sound.ping(720);
      videoMgr.openModal(
        state.config.showreel.title,
        state.config.showreel.videoUrl,
        state.config.showreel.posterUrl
      );
    });

    railDots.forEach((dot) => {
      dot.addEventListener("click", () => jumpToScene(dot.dataset.scene || "hero"));
    });

    audioToggleBtn.addEventListener("click", () => {
      const on = sound.toggle();
      audioToggleBtn.classList.toggle("audio-on", on);
      audioToggleBtn.setAttribute("aria-pressed", String(on));
      showToast(on ? "SYNTH AUDIO ENABLED" : "AUDIO MUTED");
    });

    discoveryInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value || "";
      if (state.targetScroll < 0.30 || state.targetScroll > 0.80) {
        state.targetScroll = 0.36;
      }
      focusFirstMatchingCard();
    });

    window.addEventListener("wheel", (e) => {
      if (editorDrawer.contains(e.target) || document.getElementById("video-modal").classList.contains("is-open")) return;
      const sens = (state.config.animation.scrollSensitivity || 1.0) * 0.00055;
      state.targetScroll = Math.max(0, Math.min(1, state.targetScroll + e.deltaY * sens));
    }, { passive: true });

    let touchStartY = 0;
    let lastPointerMoveAt = performance.now();
    const cursorIndicator = document.getElementById("interactive-cursor-indicator");
    let trailCanvas = document.getElementById("cursor-trail-canvas");
    if (!trailCanvas) {
      trailCanvas = document.createElement("canvas");
      trailCanvas.id = "cursor-trail-canvas";
      trailCanvas.className = "cursor-trail-canvas";
      trailCanvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(trailCanvas);
    }
    trailCanvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:45;display:block;";
    const trailCtx = trailCanvas.getContext("2d");

    /* ---------- 3B. Elegant Medical-Luxury Green Silk Cursor Trail (Auto-Sleep RAF + Touch/Reduced-Motion Guard) ---------- */
    const silkTrail = {
      points: [],
      headX: -100,
      headY: -100,
      targetX: -100,
      targetY: -100,
      initialized: false,
      loopRunning: false,
      rafId: 0,
      lastMoveAt: 0,
      isTouchDevice: false,
      currentArcLengthPx: 0,
      dpr: 1,
      width: 1,
      height: 1
    };

    function resizeTrailCanvas() {
      if (!trailCanvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      silkTrail.dpr = dpr;
      silkTrail.width = w;
      silkTrail.height = h;
      if (trailCanvas.width !== Math.round(w * dpr) || trailCanvas.height !== Math.round(h * dpr)) {
        trailCanvas.width = Math.round(w * dpr);
        trailCanvas.height = Math.round(h * dpr);
      }
    }
    resizeTrailCanvas();
    window.addEventListener("resize", resizeTrailCanvas);

    function parseHexToRgb255(hexStr) {
      const clean = String(hexStr || "#439e29").replace("#", "").trim();
      if (clean.length === 6) {
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
          return { r, g, b };
        }
      }
      return { r: 67, g: 158, b: 41 };
    }

    function isTrailSuppressed() {
      const introCfg = (state.config && state.config.intro) || {};
      const enabled = introCfg.trailEnabled !== false;
      const coarsePointer = Boolean(
        silkTrail.isTouchDevice ||
        (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches)
      );
      const reducedMotion = Boolean(
        state.reducedMotion ||
        (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      );
      return !enabled || coarsePointer || reducedMotion;
    }

    function clearAndStopSilkTrail() {
      if (silkTrail.rafId) {
        cancelAnimationFrame(silkTrail.rafId);
        silkTrail.rafId = 0;
      }
      silkTrail.loopRunning = false;
      silkTrail.points.length = 0;
      silkTrail.initialized = false;
      silkTrail.currentArcLengthPx = 0;
      if (trailCtx && trailCanvas) {
        trailCtx.setTransform(1, 0, 0, 1, 0, 0);
        trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      }
    }

    function pushTrailPoint(x, y, now) {
      const pts = silkTrail.points;
      if (pts.length === 0) {
        pts.push({ x, y, t: now });
        return;
      }
      const last = pts[pts.length - 1];
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1.4) {
        last.t = now;
        return;
      }
      // Subdivide large jumps with smooth intermediate steps so fast motion stays curved
      const stepPx = 4.5;
      if (dist > stepPx * 1.4 && pts.length >= 2) {
        const prev = pts[pts.length - 2];
        const tanX = (last.x - prev.x) * 0.35;
        const tanY = (last.y - prev.y) * 0.35;
        const steps = Math.min(18, Math.ceil(dist / stepPx));
        for (let s = 1; s <= steps; s++) {
          const u = s / steps;
          const h1 = 2 * u * u * u - 3 * u * u + 1;
          const h2 = -2 * u * u * u + 3 * u * u;
          const h3 = u * u * u - 2 * u * u + u;
          const ix = h1 * last.x + h2 * x + h3 * tanX;
          const iy = h1 * last.y + h2 * y + h3 * tanY;
          pts.push({ x: ix, y: iy, t: now });
        }
      } else {
        pts.push({ x, y, t: now });
      }
    }

    function trimTrailByTimeAndLength(now, maxLenPx, fadeMs) {
      const pts = silkTrail.points;
      // 1. Prune expired points older than fadeMs (0.54s)
      while (pts.length > 0 && (now - pts[0].t) > fadeMs) {
        pts.shift();
      }
      if (pts.length < 2) {
        silkTrail.currentArcLengthPx = 0;
        return;
      }
      // 2. Smoothly contract maximum arc-length when mouse pauses so tail glides into cursor tip
      const idleElapsed = Math.max(0, now - silkTrail.lastMoveAt);
      const idleContract = Math.max(0, 1 - idleElapsed / fadeMs);
      const effectiveMaxLen = maxLenPx * Math.pow(idleContract, 0.78);
      if (effectiveMaxLen < 1.5) {
        pts.length = 0;
        silkTrail.currentArcLengthPx = 0;
        return;
      }

      let accLen = 0;
      for (let i = pts.length - 1; i > 0; i--) {
        const p1 = pts[i];
        const p0 = pts[i - 1];
        const seg = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        if (accLen + seg > effectiveMaxLen) {
          const remain = Math.max(0, effectiveMaxLen - accLen);
          const ratio = seg > 0.0001 ? (remain / seg) : 0;
          p0.x = p1.x + (p0.x - p1.x) * ratio;
          p0.y = p1.y + (p0.y - p1.y) * ratio;
          if (i - 1 > 0) {
            pts.splice(0, i - 1);
          }
          accLen = effectiveMaxLen;
          break;
        }
        accLen += seg;
      }
      silkTrail.currentArcLengthPx = +accLen.toFixed(1);
    }

    function sampleSmoothSilkSpline(rawPts, numSamples) {
      if (rawPts.length < 2) return [];
      // Quadratic B-spline Chaikin corner-cutting for ultra-smooth curved silk trajectory
      let work = rawPts.map(p => ({ x: p.x, y: p.y, t: p.t }));
      for (let pass = 0; pass < 2; pass++) {
        if (work.length < 3) break;
        const next = [work[0]];
        for (let i = 0; i < work.length - 1; i++) {
          const a = work[i];
          const b = work[i + 1];
          next.push({
            x: 0.75 * a.x + 0.25 * b.x,
            y: 0.75 * a.y + 0.25 * b.y,
            t: 0.75 * a.t + 0.25 * b.t
          });
          next.push({
            x: 0.25 * a.x + 0.75 * b.x,
            y: 0.25 * a.y + 0.75 * b.y,
            t: 0.25 * a.t + 0.75 * b.t
          });
        }
        next.push(work[work.length - 1]);
        work = next;
      }

      // Compute cumulative arc length along smoothed curve
      const cum = [0];
      let total = 0;
      for (let i = 1; i < work.length; i++) {
        total += Math.hypot(work[i].x - work[i - 1].x, work[i].y - work[i - 1].y);
        cum.push(total);
      }
      if (total < 1.5) return [];

      const out = [];
      let segIdx = 0;
      for (let k = 0; k < numSamples; k++) {
        const u = k / (numSamples - 1);
        const targetDist = u * total;
        while (segIdx < cum.length - 2 && cum[segIdx + 1] < targetDist) {
          segIdx++;
        }
        const d0 = cum[segIdx];
        const d1 = cum[segIdx + 1];
        const localT = (d1 - d0) > 0.0001 ? ((targetDist - d0) / (d1 - d0)) : 0;
        const p0 = work[segIdx];
        const p1 = work[segIdx + 1];
        out.push({
          x: p0.x + (p1.x - p0.x) * localT,
          y: p0.y + (p1.y - p0.y) * localT,
          u
        });
      }

      // Compute smooth unit normals + subtle silk wave undulation
      for (let k = 0; k < out.length; k++) {
        const prev = out[Math.max(0, k - 1)];
        const next = out[Math.min(out.length - 1, k + 1)];
        let tx = next.x - prev.x;
        let ty = next.y - prev.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        out[k].nx = -ty;
        out[k].ny = tx;
      }
      return out;
    }

    function traceSmoothRibbonPath(ctx, samples, widthMultiplier, wavePhase) {
      const n = samples.length;
      if (n < 3) return;
      const leftPts = [];
      const rightPts = [];
      for (let i = 0; i < n; i++) {
        const s = samples[i];
        const u = s.u;
        // Flowing silk ribbon profile: soft rounded head, graceful silk belly, and delicate tapered tail
        const taper = Math.pow(u, 0.85) * Math.sin(Math.pow(u, 0.62) * Math.PI * 0.88);
        const hw = widthMultiplier * taper;
        // Organic S-curve silk undulation so even straight mouse moves flow like a curved silk ribbon
        const tailFactor = Math.pow(1 - u, 0.72) * Math.pow(u, 0.35);
        const silkWave = (
          Math.sin((1 - u) * 4.8 - wavePhase) * 4.6 +
          Math.cos((1 - u) * 2.4 - wavePhase * 0.7) * 2.1
        ) * tailFactor;
        const cx = s.x + s.nx * silkWave;
        const cy = s.y + s.ny * silkWave;
        leftPts.push({ x: cx + s.nx * hw, y: cy + s.ny * hw });
        rightPts.push({ x: cx - s.nx * hw, y: cy - s.ny * hw });
      }

      ctx.beginPath();
      ctx.moveTo(leftPts[0].x, leftPts[0].y);
      for (let i = 1; i < n - 1; i++) {
        const mx = 0.5 * (leftPts[i].x + leftPts[i + 1].x);
        const my = 0.5 * (leftPts[i].y + leftPts[i + 1].y);
        ctx.quadraticCurveTo(leftPts[i].x, leftPts[i].y, mx, my);
      }
      const headL = leftPts[n - 1];
      const headR = rightPts[n - 1];
      const headCenter = samples[n - 1];
      ctx.quadraticCurveTo(headL.x, headL.y, headCenter.x, headCenter.y);
      ctx.quadraticCurveTo(headR.x, headR.y, 0.5 * (headR.x + rightPts[n - 2].x), 0.5 * (headR.y + rightPts[n - 2].y));

      for (let i = n - 2; i >= 1; i--) {
        const mx = 0.5 * (rightPts[i].x + rightPts[i - 1].x);
        const my = 0.5 * (rightPts[i].y + rightPts[i - 1].y);
        ctx.quadraticCurveTo(rightPts[i].x, rightPts[i].y, mx, my);
      }
      ctx.lineTo(rightPts[0].x, rightPts[0].y);
      ctx.closePath();
    }

    function renderSilkTrailFrame(now) {
      if (!trailCtx || !trailCanvas) {
        silkTrail.loopRunning = false;
        return;
      }
      if (isTrailSuppressed()) {
        clearAndStopSilkTrail();
        return;
      }

      const introCfg = (state.config && state.config.intro) || {};
      const maxLenPx = Math.max(40, Math.min(220, Number(introCfg.trailLengthPx) || 115));
      const baseWidthPx = Math.max(1.5, Math.min(20, Number(introCfg.trailWidthPx) || 7.5));
      const intensity = Math.max(0.05, Math.min(1.8, Number(introCfg.trailIntensity) ?? 0.88));
      const fadeMs = Math.max(350, Math.min(750, Number(introCfg.trailFadeMs) || 540));

      // Advance spring-smoothed silk head toward target pointer
      if (silkTrail.initialized) {
        silkTrail.headX += (silkTrail.targetX - silkTrail.headX) * 0.56;
        silkTrail.headY += (silkTrail.targetY - silkTrail.headY) * 0.56;
        if (Math.hypot(silkTrail.targetX - silkTrail.headX, silkTrail.targetY - silkTrail.headY) > 0.6) {
          pushTrailPoint(silkTrail.headX, silkTrail.headY, now);
        }
      }

      trimTrailByTimeAndLength(now, maxLenPx, fadeMs);

      const idleElapsed = Math.max(0, now - silkTrail.lastMoveAt);
      const timeFade = Math.max(0, 1 - idleElapsed / fadeMs);
      const fadeAlpha = Math.pow(timeFade, 1.15) * intensity;

      trailCtx.setTransform(1, 0, 0, 1, 0, 0);
      trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);

      if (silkTrail.points.length < 2 || fadeAlpha <= 0.008 || silkTrail.currentArcLengthPx < 2.0) {
        if (idleElapsed >= fadeMs) {
          clearAndStopSilkTrail();
          return;
        }
        silkTrail.rafId = requestAnimationFrame(renderSilkTrailFrame);
        return;
      }

      const samples = sampleSmoothSilkSpline(silkTrail.points, 28);
      if (samples.length < 3) {
        if (idleElapsed >= fadeMs) {
          clearAndStopSilkTrail();
          return;
        }
        silkTrail.rafId = requestAnimationFrame(renderSilkTrailFrame);
        return;
      }

      trailCtx.save();
      trailCtx.scale(silkTrail.dpr, silkTrail.dpr);

      const rgb = parseHexToRgb255(introCfg.trailColor || "#439e29");
      const darkR = Math.max(0, Math.round(rgb.r * 0.38));
      const darkG = Math.max(0, Math.round(rgb.g * 0.80));
      const darkB = Math.max(0, Math.round(rgb.b * 0.68));
      const mintR = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * 0.52));
      const mintG = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * 0.72));
      const mintB = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * 0.56));

      const tailPt = samples[0];
      const headPt = samples[samples.length - 1];
      const wavePhase = now * 0.009;

      // 1. Outer Soft Volumetric Emerald Silk Aura
      const auraGrad = trailCtx.createLinearGradient(tailPt.x, tailPt.y, headPt.x, headPt.y);
      auraGrad.addColorStop(0.00, `rgba(${darkR}, ${darkG}, ${darkB}, 0)`);
      auraGrad.addColorStop(0.32, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(0.14 * fadeAlpha).toFixed(3)})`);
      auraGrad.addColorStop(0.74, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(0.28 * fadeAlpha).toFixed(3)})`);
      auraGrad.addColorStop(1.00, `rgba(${mintR}, ${mintG}, ${mintB}, ${(0.36 * fadeAlpha).toFixed(3)})`);
      traceSmoothRibbonPath(trailCtx, samples, baseWidthPx * 1.65, wavePhase);
      trailCtx.fillStyle = auraGrad;
      trailCtx.fill();

      // 2. Primary Intrarat Green Silk Ribbon Body
      const bodyGrad = trailCtx.createLinearGradient(tailPt.x, tailPt.y, headPt.x, headPt.y);
      bodyGrad.addColorStop(0.00, `rgba(${darkR}, ${darkG}, ${darkB}, 0)`);
      bodyGrad.addColorStop(0.24, `rgba(${darkR}, ${darkG}, ${darkB}, ${(0.32 * fadeAlpha).toFixed(3)})`);
      bodyGrad.addColorStop(0.64, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(0.68 * fadeAlpha).toFixed(3)})`);
      bodyGrad.addColorStop(1.00, `rgba(${mintR}, ${mintG}, ${mintB}, ${(0.88 * fadeAlpha).toFixed(3)})`);
      traceSmoothRibbonPath(trailCtx, samples, baseWidthPx * 0.82, wavePhase);
      trailCtx.fillStyle = bodyGrad;
      trailCtx.fill();

      // 3. Delicate Luminous Silk Core Filament
      const coreGrad = trailCtx.createLinearGradient(tailPt.x, tailPt.y, headPt.x, headPt.y);
      coreGrad.addColorStop(0.00, "rgba(230, 255, 236, 0)");
      coreGrad.addColorStop(0.40, `rgba(${mintR}, ${mintG}, ${mintB}, ${(0.38 * fadeAlpha).toFixed(3)})`);
      coreGrad.addColorStop(0.82, `rgba(232, 255, 238, ${(0.76 * fadeAlpha).toFixed(3)})`);
      coreGrad.addColorStop(1.00, `rgba(245, 255, 248, ${(0.90 * fadeAlpha).toFixed(3)})`);
      traceSmoothRibbonPath(trailCtx, samples, baseWidthPx * 0.30, wavePhase);
      trailCtx.fillStyle = coreGrad;
      trailCtx.fill();

      // 4. Subtle Silk Tip Glow at Cursor Head
      const tipRad = Math.max(6, baseWidthPx * 1.45);
      const tipGrad = trailCtx.createRadialGradient(headPt.x, headPt.y, 0.5, headPt.x, headPt.y, tipRad);
      tipGrad.addColorStop(0.0, `rgba(240, 255, 244, ${(0.58 * fadeAlpha).toFixed(3)})`);
      tipGrad.addColorStop(0.45, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(0.26 * fadeAlpha).toFixed(3)})`);
      tipGrad.addColorStop(1.0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      trailCtx.beginPath();
      trailCtx.arc(headPt.x, headPt.y, tipRad, 0, Math.PI * 2);
      trailCtx.fillStyle = tipGrad;
      trailCtx.fill();

      trailCtx.restore();

      silkTrail.rafId = requestAnimationFrame(renderSilkTrailFrame);
    }

    function notifySilkTrailPointerMove(clientX, clientY, isTouch) {
      if (isTouch) {
        silkTrail.isTouchDevice = true;
        clearAndStopSilkTrail();
        return;
      }
      if (isTrailSuppressed()) {
        clearAndStopSilkTrail();
        return;
      }
      const now = performance.now();
      silkTrail.lastMoveAt = now;
      silkTrail.targetX = clientX;
      silkTrail.targetY = clientY;
      if (!silkTrail.initialized) {
        silkTrail.initialized = true;
        silkTrail.headX = clientX;
        silkTrail.headY = clientY;
        silkTrail.points.length = 0;
        pushTrailPoint(clientX, clientY, now);
      } else {
        silkTrail.headX += (clientX - silkTrail.headX) * 0.62;
        silkTrail.headY += (clientY - silkTrail.headY) * 0.62;
        pushTrailPoint(silkTrail.headX, silkTrail.headY, now);
      }
      if (!silkTrail.loopRunning) {
        silkTrail.loopRunning = true;
        silkTrail.rafId = requestAnimationFrame(renderSilkTrailFrame);
      }
    }

    function updatePointerStateFromClientXY(clientX, clientY, isTouch) {
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const nx = Math.max(-1, Math.min(1, (clientX / vw) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, -((clientY / vh) * 2 - 1)));

      state.lastClientX = clientX;
      state.lastClientY = clientY;
      state.pointerInside = true;
      state.targetMouseX = nx;
      state.targetMouseY = ny;
      state.targetFollowX = nx;
      state.targetFollowY = ny;
      lastPointerMoveAt = performance.now();

      // Hysteresis hit-test against the logo's center footprint so hover never flickers as spheres separate
      const logoNormX = state.followX * 0.20;
      const logoNormY = state.followY * 0.20;
      const aspect = vw / vh;
      const dx = (nx - logoNormX) * Math.min(1.35, Math.max(0.75, aspect * 0.72));
      const dy = ny - logoNormY;
      const distToLogo = Math.hypot(dx, dy);

      const enterThreshold = isTouch ? 0.44 : 0.36;
      const exitThreshold = isTouch ? 0.58 : 0.52;

      if (!state.isLogoHovered && distToLogo < enterThreshold) {
        state.isLogoHovered = true;
        state.hoverCycleCount = (state.hoverCycleCount || 0) + 1;
      } else if (state.isLogoHovered && distToLogo > exitThreshold) {
        state.isLogoHovered = false;
      }

      if (cursorIndicator) {
        cursorIndicator.style.transform = `translate3d(${clientX.toFixed(1)}px, ${clientY.toFixed(1)}px, 0)`;
        cursorIndicator.classList.add("is-active");
        cursorIndicator.classList.toggle("is-hovering-logo", Boolean(state.isLogoHovered));
      }

      notifySilkTrailPointerMove(clientX, clientY, Boolean(isTouch));
      engine.recordPointer(nx, ny);
    }

    function clearPointerHoverAndReturn() {
      state.pointerInside = false;
      state.isLogoHovered = false;
      state.targetMouseX = 0;
      state.targetMouseY = 0;
      state.targetFollowX = 0;
      state.targetFollowY = 0;
      if (cursorIndicator) {
        cursorIndicator.classList.remove("is-hovering-logo");
      }
    }

    window.addEventListener("touchstart", (e) => {
      if (editorDrawer.contains(e.target)) return;
      if (e.touches.length > 0) {
        const t = e.touches[0];
        touchStartY = t.clientY;
        updatePointerStateFromClientXY(t.clientX, t.clientY, true);
      }
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
      if (editorDrawer.contains(e.target)) return;
      if (e.touches.length > 0) {
        const t = e.touches[0];
        touchStartY = t.clientY;
        updatePointerStateFromClientXY(t.clientX, t.clientY, true);
      }
    }, { passive: true });

    window.addEventListener("touchend", () => {
      clearPointerHoverAndReturn();
    }, { passive: true });

    window.addEventListener("mousemove", (e) => {
      if (editorDrawer.classList.contains("is-open") && editorDrawer.contains(e.target)) {
        notifySilkTrailPointerMove(e.clientX, e.clientY, false);
        return;
      }
      updatePointerStateFromClientXY(e.clientX, e.clientY, false);
    });

    canvas.addEventListener("mouseleave", () => {
      clearPointerHoverAndReturn();
    });

    document.addEventListener("mouseleave", () => {
      clearPointerHoverAndReturn();
    });

    window.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget && !e.toElement) {
        clearPointerHoverAndReturn();
      }
    });

    window.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.code === "Space") {
        e.preventDefault();
        const variant = engine.toggleEnvironmentEasterEgg();
        const names = ["DEFAULT CYAN-MAGENTA VOID", "EMERALD-COBALT SPECTRUM", "SOLAR-CRIMSON SPECTRUM"];
        showToast(`ENVIRONMENT MODE: ${names[variant]}`);
      } else if (e.key === "e" || e.key === "E") {
        editorDrawer.classList.toggle("is-open");
      } else if (e.key === "Escape") {
        videoMgr.closeModal();
        editorDrawer.classList.remove("is-open");
      }
    });

    /* ---------- 4. Helical 3D Showcase Card Choreography (Zero Mobile Overlap) ---------- */
    function updateSceneDOM() {
      const s = state.scrollProgress;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isMobile = w <= 900;

      const heroVis = Math.max(0, Math.min(1, 1 - (s - 0.05) / 0.17));
      heroOverlay.style.opacity = String(heroVis);
      heroOverlay.style.transform = `translate3d(0, ${-s * 120}px, 0)`;
      scrollCueBtn.style.opacity = String(Math.max(0, 1 - s * 7.5));
      scrollCueBtn.style.pointerEvents = s < 0.13 ? "auto" : "none";

      const velMag = Math.min(1, Math.abs(state.scrollVelocity) * 14 * (state.config.navigation.velocityStretch || 1));
      navPillbox.style.transform = `scale3d(${(1 + velMag * 0.11).toFixed(3)}, ${(1 - velMag * 0.05).toFixed(3)}, 1)`;

      const inWork = s >= 0.22 && s < 0.82;
      const inContact = s >= 0.82;
      navWorkBtn.classList.toggle("active", inWork);
      navContactBtn.classList.toggle("active", inContact);

      railFill.style.height = `${(s * 100).toFixed(1)}%`;
      railDots.forEach((dot) => {
        const sc = dot.dataset.scene;
        dot.classList.toggle("active", (sc === "hero" && s < 0.22) || (sc === "work" && inWork) || (sc === "contact" && inContact));
      });

      const workActive = s > 0.17 && s < 0.86;
      document.body.classList.toggle("is-page02-active", workActive);
      workStage.classList.toggle("is-active", workActive);
      discoveryPanel.classList.remove("is-visible");

      const nCards = cardElements.length;
      if (nCards > 0) {
        const baseTilt = (state.config.page02 && typeof state.config.page02.cardTiltDeg === "number")
          ? state.config.page02.cardTiltDeg
          : 13.5;
        const motionScale = state.reducedMotion ? 0 : 1;
        const isPhoneViewport = w <= 640;
        const isCompactTablet = w > 640 && w < 1100;

        for (let i = 0; i < nCards; i++) {
          const item = cardElements[i];
          const slotEl = item.slot || item.card;
          if (!workActive) {
            slotEl.style.opacity = "0";
            slotEl.style.pointerEvents = "none";
            continue;
          }
          slotEl.style.opacity = "1";
          slotEl.style.pointerEvents = "auto";

          if (isPhoneViewport) {
            slotEl.style.transform = "none";
          } else {
            const isHovered = slotEl.dataset.isHovered === "1";
            const hRotX = parseFloat(slotEl.dataset.hoverRotX || "0") * motionScale;
            const hRotY = parseFloat(slotEl.dataset.hoverRotY || "0") * motionScale;
            const ambientX = (-state.mouseY * 1.3) * motionScale;
            const ambientY = (state.mouseX * 1.8) * motionScale;

            // Asymmetric 3D posture matching approved visual reference:
            // Card 01 (i === 0): Dominant left foreground card, angled right (+13.8 deg), elevated slightly (-14px), forward in Z (+28px)
            // Card 02 (i === 1): Smaller right card tucked slightly behind Card 01 (-26px in Z), angled left (-14.8 deg), lower (+22px)
            const tiltScale = isCompactTablet ? 0.78 : 1.0;
            const rotY = (i === 0 ? (baseTilt * tiltScale) : -(baseTilt * 1.08 * tiltScale)) + ambientY + hRotY;
            const rotX = (i === 0 ? 1.15 : 0.95) + ambientX + hRotX;
            const rotZ = (i === 0 ? -0.55 : 0.50) * tiltScale;

            const baseTx = i === 0 ? 2 : -2;
            const baseTy = i === 0 ? (isCompactTablet ? -10 : -16) : (isCompactTablet ? 14 : 24);
            const baseTz = i === 0 ? (isCompactTablet ? 14 : 20) : (isCompactTablet ? -14 : -20);
            const hoverLiftY = isHovered ? -5 : 0;
            const hoverScale = isHovered ? 1.014 : 1.0;

            const tx = baseTx + (state.mouseX * 4.5 * motionScale);
            const ty = baseTy + hoverLiftY + (-state.mouseY * 3.5 * motionScale);
            const tz = baseTz;

            slotEl.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, ${tz.toFixed(1)}px) rotateY(${rotY.toFixed(2)}deg) rotateX(${rotX.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg) scale3d(${hoverScale}, ${hoverScale}, 1)`;
          }
        }
      }

      contactStage.classList.toggle("is-active", s >= 0.83);
    }

    /* ---------- 5. 6-Tab Live Visual Editor (TEXT / MEDIA / COLOR / LAYOUT / 3D / SAVE) ---------- */
    function bindVisualConfigurator() {
      editorFab.addEventListener("click", () => editorDrawer.classList.toggle("is-open"));
      editorCloseBtn.addEventListener("click", () => editorDrawer.classList.remove("is-open"));

      const tabBtns = document.querySelectorAll(".editor-tab-btn");
      const panes = document.querySelectorAll(".editor-pane");
      tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.dataset.tab;
          tabBtns.forEach(b => b.classList.toggle("active", b === btn));
          panes.forEach(p => p.classList.toggle("active", p.dataset.pane === tab));
        });
      });

      function syncAllControlInputs() {
        const setVal = (id, v) => {
          const el = document.getElementById(id);
          if (!el) return;
          if (el.type === "checkbox") el.checked = Boolean(v);
          else el.value = v ?? "";
          const badge = document.getElementById(id + "-val");
          if (badge && typeof v === "number") {
            badge.textContent = Number.isInteger(v) ? String(v) : v.toFixed(2);
          }
        };

        setVal("cfg-brand-name", state.config.brand.name);
        setVal("cfg-lab-label", state.config.brand.labLabel);
        setVal("cfg-nav-1", state.config.navigation.items[0].label);
        setVal("cfg-nav-2", state.config.navigation.items[1].label);
        setVal("cfg-show-logo", state.config.brand.showLogoImage);
        setVal("cfg-h-line1", state.config.hero.headlineLine1);
        setVal("cfg-h-line2", state.config.hero.headlineLine2);
        setVal("cfg-h-line3", state.config.hero.headlineLine3);
        setVal("cfg-font-style", state.config.hero.fontStyle);
        setVal("cfg-m-1", state.config.hero.manifesto[0].text);
        setVal("cfg-m-2", state.config.hero.manifesto[1].text);
        setVal("cfg-m-3", state.config.hero.manifesto[2].text);
        const p2Cfg = state.config.page02 || {};
        setVal("cfg-p2-small-heading", p2Cfg.smallHeading || "INTRARAT HOSPITAL");
        setVal("cfg-p2-headline-dark", p2Cfg.headlineDark || "DISCOVER");
        setVal("cfg-p2-headline-green", p2Cfg.headlineGreen || "OUR EXPERIENCE");
        setVal("cfg-p2-subtitle", p2Cfg.subtitle || "World-Class Care with Thai Hospitality");
        setVal("cfg-disc-heading", state.config.discovery.heading);
        setVal("cfg-contact-h", state.config.contact.headline);
        setVal("cfg-contact-sub", state.config.contact.subcopy);
        setVal("cfg-contact-email", state.config.contact.email);

        const introCfg = state.config.intro || {};
        setVal("cfg-sphere-color", introCfg.sphereSurfaceColor || "#439e29");
        setVal("cfg-sphere-blend", introCfg.sphereColorBlend ?? 0.0);
        setVal("cfg-sphere-brightness", introCfg.sphereBrightness ?? 1.0);
        setVal("cfg-reflection-color", introCfg.reflectionColor || "#f5fff7");
        setVal("cfg-reflection-intensity", introCfg.reflectionIntensity ?? 1.0);
        setVal("cfg-shadow-color", introCfg.shadowColor || "#0f381c");
        setVal("cfg-shadow-intensity", introCfg.shadowIntensity ?? 1.0);
        setVal("cfg-intro-bg-center", introCfg.backgroundColor || "#fcfefc");
        setVal("cfg-intro-bg-edge", introCfg.backgroundEdgeColor || "#e9f4ec");
        setVal("cfg-intro-glow-color", introCfg.ambientGlowColor || "#d5f0dc");
        setVal("cfg-intro-glow-opacity", introCfg.ambientGlowOpacity ?? 1.0);
        setVal("cfg-trail-enabled", introCfg.trailEnabled !== false);
        setVal("cfg-trail-color", introCfg.trailColor || "#439e29");
        setVal("cfg-trail-length", introCfg.trailLengthPx ?? 115);
        setVal("cfg-trail-width", introCfg.trailWidthPx ?? 7.5);
        setVal("cfg-trail-intensity", introCfg.trailIntensity ?? 0.88);

        setVal("cfg-col-void", state.config.theme.voidBg);
        setVal("cfg-col-glow", state.config.theme.volumetricGlow);
        setVal("cfg-col-cyan", state.config.theme.accentCyan);
        setVal("cfg-col-mag", state.config.theme.accentMagenta);
        setVal("cfg-col-text", state.config.theme.textPrimary || "#ffffff");
        setVal("cfg-card-alpha", state.config.layout.cardGlassOpacity);

        setVal("cfg-hero-scale", state.config.hero.headlineScale);
        setVal("cfg-hero-offset", state.config.hero.horizontalOffsetPx);
        setVal("cfg-hero-offset-y", state.config.hero.verticalOffsetPx);
        setVal("cfg-ring-offset-x", state.config.layout.ringOffsetX);
        setVal("cfg-card-w", state.config.layout.cardWidthPx);
        setVal("cfg-card-h", state.config.layout.cardHeightPx);
        setVal("cfg-manifesto-w", state.config.layout.manifestoWidthPx);

        setVal("cfg-3d-preset", state.config.model3D.preset);
        setVal("cfg-intro-max-tilt", (state.config.intro && state.config.intro.maxTiltDeg) ?? 15);
        setVal("cfg-intro-float", (state.config.intro && state.config.intro.floatIntensity) ?? 1.0);
        setVal("cfg-3d-scale", state.config.model3D.modelScale);
        setVal("cfg-3d-rot", state.config.model3D.rotationSpeed);
        setVal("cfg-3d-irid", state.config.model3D.iridescenceIntensity);
        setVal("cfg-3d-refr", state.config.model3D.refractionStrength);
        setVal("cfg-3d-spine", state.config.model3D.spineTwist);
        setVal("cfg-3d-particles", state.config.model3D.particleDensity);
        setVal("cfg-3d-tubes", state.config.model3D.cursorTubes);
        setVal("cfg-cam-lerp", state.config.animation.cameraLerp);
        setVal("cfg-scroll-sens", state.config.animation.scrollSensitivity);
        setVal("cfg-preloader-on", state.config.animation.enablePreloader);
      }

      function bindInput(id, setter, skipCards) {
        const el = document.getElementById(id);
        if (!el) return;
        const evtName = (el.type === "checkbox" || el.tagName === "SELECT") ? "change" : "input";
        el.addEventListener(evtName, () => {
          if (!isCmsSessionAuthenticated()) {
            if (persistBadge) persistBadge.textContent = "AUTH REQUIRED (401)";
            showToast("AUTHENTICATION REQUIRED — UNLOCK VISUAL EDITOR ABOVE");
            const passInp = document.getElementById("cms-editor-passcode-input");
            if (passInp) passInp.focus();
            syncAllControlInputs();
            return;
          }
          const next = el.type === "checkbox"
            ? el.checked
            : (el.type === "range" || el.type === "number") ? parseFloat(el.value) : el.value;
          setter(next);
          const badge = document.getElementById(id + "-val");
          if (badge && typeof next === "number") {
            badge.textContent = Number.isInteger(next) ? String(next) : next.toFixed(2);
          }
          applyConfigToDOM(Boolean(skipCards));
          scheduleAutoSave();
        });
      }

      // TEXT Tab
      bindInput("cfg-brand-name", v => { state.config.brand.name = v; }, true);
      bindInput("cfg-lab-label", v => { state.config.brand.labLabel = v; }, true);
      bindInput("cfg-nav-1", v => { state.config.navigation.items[0].label = v; }, true);
      bindInput("cfg-nav-2", v => { state.config.navigation.items[1].label = v; }, true);
      bindInput("cfg-h-line1", v => { state.config.hero.headlineLine1 = v; }, true);
      bindInput("cfg-h-line2", v => { state.config.hero.headlineLine2 = v; }, true);
      bindInput("cfg-h-line3", v => { state.config.hero.headlineLine3 = v; }, true);
      bindInput("cfg-font-style", v => { state.config.hero.fontStyle = v; }, true);
      bindInput("cfg-m-1", v => { state.config.hero.manifesto[0].text = v; }, true);
      bindInput("cfg-m-2", v => { state.config.hero.manifesto[1].text = v; }, true);
      bindInput("cfg-m-3", v => { state.config.hero.manifesto[2].text = v; }, true);
      const ensureP2Obj = () => {
        if (!state.config.page02) state.config.page02 = {};
        return state.config.page02;
      };
      bindInput("cfg-p2-small-heading", v => { ensureP2Obj().smallHeading = v; }, true);
      bindInput("cfg-p2-headline-dark", v => { ensureP2Obj().headlineDark = v; }, true);
      bindInput("cfg-p2-headline-green", v => { ensureP2Obj().headlineGreen = v; }, true);
      bindInput("cfg-p2-subtitle", v => { ensureP2Obj().subtitle = v; }, true);
      bindInput("cfg-disc-heading", v => { state.config.discovery.heading = v; }, true);
      bindInput("cfg-contact-h", v => { state.config.contact.headline = v; }, true);
      bindInput("cfg-contact-sub", v => { state.config.contact.subcopy = v; }, true);
      bindInput("cfg-contact-email", v => { state.config.contact.email = v; }, true);

      // COLOR Tab (3D Sphere Surface, Reflection, Shadow & Intro Studio Background + Global Palette)
      const ensureIntroObj = () => {
        if (!state.config.intro) state.config.intro = {};
        return state.config.intro;
      };
      bindInput("cfg-sphere-color", v => { ensureIntroObj().sphereSurfaceColor = v; }, true);
      bindInput("cfg-sphere-blend", v => { ensureIntroObj().sphereColorBlend = v; }, true);
      bindInput("cfg-sphere-brightness", v => { ensureIntroObj().sphereBrightness = v; }, true);
      bindInput("cfg-reflection-color", v => { ensureIntroObj().reflectionColor = v; }, true);
      bindInput("cfg-reflection-intensity", v => { ensureIntroObj().reflectionIntensity = v; }, true);
      bindInput("cfg-shadow-color", v => { ensureIntroObj().shadowColor = v; }, true);
      bindInput("cfg-shadow-intensity", v => { ensureIntroObj().shadowIntensity = v; }, true);
      bindInput("cfg-intro-bg-center", v => {
        ensureIntroObj().backgroundColor = v;
        state.config.theme.voidBg = v;
      }, true);
      bindInput("cfg-intro-bg-edge", v => { ensureIntroObj().backgroundEdgeColor = v; }, true);
      bindInput("cfg-intro-glow-color", v => {
        ensureIntroObj().ambientGlowColor = v;
        state.config.theme.volumetricGlow = v;
      }, true);
      bindInput("cfg-intro-glow-opacity", v => { ensureIntroObj().ambientGlowOpacity = v; }, true);
      bindInput("cfg-trail-enabled", v => {
        ensureIntroObj().trailEnabled = Boolean(v);
        if (!v) clearAndStopSilkTrail();
      }, true);
      bindInput("cfg-trail-color", v => { ensureIntroObj().trailColor = v; }, true);
      bindInput("cfg-trail-length", v => { ensureIntroObj().trailLengthPx = v; }, true);
      bindInput("cfg-trail-width", v => { ensureIntroObj().trailWidthPx = v; }, true);
      bindInput("cfg-trail-intensity", v => { ensureIntroObj().trailIntensity = v; }, true);

      const resetV6ColorsBtn = document.getElementById("cfg-reset-v6-colors-btn");
      if (resetV6ColorsBtn) {
        resetV6ColorsBtn.addEventListener("click", () => {
          const ic = ensureIntroObj();
          ic.backgroundColor = "#fcfefc";
          ic.backgroundEdgeColor = "#e9f4ec";
          ic.ambientGlowColor = "#d5f0dc";
          ic.ambientGlowOpacity = 1.0;
          ic.sphereSurfaceColor = "#439e29";
          ic.sphereColorBlend = 0.0;
          ic.sphereBrightness = 1.0;
          ic.reflectionColor = "#f5fff7";
          ic.reflectionIntensity = 1.0;
          ic.shadowColor = "#0f381c";
          ic.shadowIntensity = 1.0;
          state.config.theme.voidBg = "#f7fbf8";
          state.config.theme.volumetricGlow = "#d9efe0";
          syncAllControlInputs();
          applyConfigToDOM(true);
          scheduleAutoSave();
          showToast("RESTORED V6 BASELINE 3D COLORS");
        });
      }

      bindInput("cfg-col-void", v => {
        state.config.theme.voidBg = v;
        ensureIntroObj().backgroundColor = v;
      }, true);
      bindInput("cfg-col-glow", v => {
        state.config.theme.volumetricGlow = v;
        ensureIntroObj().ambientGlowColor = v;
      }, true);
      bindInput("cfg-col-cyan", v => { state.config.theme.accentCyan = v; }, true);
      bindInput("cfg-col-mag", v => { state.config.theme.accentMagenta = v; }, true);
      bindInput("cfg-col-text", v => { state.config.theme.textPrimary = v; }, true);
      bindInput("cfg-card-alpha", v => { state.config.layout.cardGlassOpacity = v; }, true);

      // LAYOUT Tab
      bindInput("cfg-hero-scale", v => { state.config.hero.headlineScale = v; }, true);
      bindInput("cfg-hero-offset", v => { state.config.hero.horizontalOffsetPx = v; }, true);
      bindInput("cfg-hero-offset-y", v => { state.config.hero.verticalOffsetPx = v; }, true);
      bindInput("cfg-ring-offset-x", v => { state.config.layout.ringOffsetX = v; }, true);
      bindInput("cfg-card-w", v => { state.config.layout.cardWidthPx = v; }, true);
      bindInput("cfg-card-h", v => { state.config.layout.cardHeightPx = v; }, true);
      bindInput("cfg-manifesto-w", v => { state.config.layout.manifestoWidthPx = v; }, true);

      const pureToggle = document.getElementById("cfg-pure-mode");
      if (pureToggle) {
        pureToggle.addEventListener("change", () => {
          document.body.classList.toggle("pure-reference-mode", pureToggle.checked);
          if (pureToggle.checked) showToast("PURE VIEW ON (PRESS E FOR EDITOR)");
        });
      }

      // 3D FX Tab
      bindInput("cfg-3d-preset", v => { state.config.model3D.preset = v; }, true);
      bindInput("cfg-intro-max-tilt", v => {
        if (!state.config.intro) state.config.intro = {};
        state.config.intro.maxTiltDeg = v;
      }, true);
      bindInput("cfg-intro-float", v => {
        if (!state.config.intro) state.config.intro = {};
        state.config.intro.floatIntensity = v;
      }, true);
      const replay3dBtn = document.getElementById("cfg-replay-3d-btn");
      if (replay3dBtn) {
        replay3dBtn.addEventListener("click", () => {
          runIntroSequence();
          showToast("REPLAYING 3D 20-SPHERE ASSEMBLY (3.0S)");
        });
      }
      bindInput("cfg-3d-scale", v => { state.config.model3D.modelScale = v; }, true);
      bindInput("cfg-3d-rot", v => { state.config.model3D.rotationSpeed = v; }, true);
      bindInput("cfg-3d-irid", v => { state.config.model3D.iridescenceIntensity = v; }, true);
      bindInput("cfg-3d-refr", v => { state.config.model3D.refractionStrength = v; }, true);
      bindInput("cfg-3d-spine", v => { state.config.model3D.spineTwist = v; }, true);
      bindInput("cfg-3d-particles", v => { state.config.model3D.particleDensity = v; }, true);
      bindInput("cfg-3d-tubes", v => { state.config.model3D.cursorTubes = v; }, true);
      bindInput("cfg-cam-lerp", v => { state.config.animation.cameraLerp = v; }, true);
      bindInput("cfg-scroll-sens", v => { state.config.animation.scrollSensitivity = v; }, true);
      bindInput("cfg-preloader-on", v => { state.config.animation.enablePreloader = v; }, true);

      // MEDIA Tab (Persistent IndexedDB MP4 / WebM & Image Uploads — NO ephemeral blob config!)
      const projSelect = document.getElementById("cfg-proj-select");
      const projEyebrow = document.getElementById("cfg-proj-eyebrow");
      const projTitle = document.getElementById("cfg-proj-title");
      const projCat = document.getElementById("cfg-proj-cat");
      const projVidPreset = document.getElementById("cfg-proj-vid-preset");
      const projVidUrl = document.getElementById("cfg-proj-vid-url");
      const projVidStatus = document.getElementById("cfg-proj-vid-status");
      const projPosterUrl = document.getElementById("cfg-proj-poster-url");
      const projVidFile = document.getElementById("cfg-proj-vid-file");
      const projPosterFile = document.getElementById("cfg-proj-poster-file");

      function describeSource(url, label) {
        if (label) return `PERSISTENT SOURCE: ${label} (${url.startsWith("idb://") ? url : "DataURI/HTTPS"})`;
        if (!url) return "SOURCE: NONE";
        if (url.startsWith("idb://")) return `PERSISTENT IDB: ${url}`;
        if (url.startsWith("data:video/webm")) return "EMBEDDED WEBM DATA-URI (PERSISTENT)";
        if (url.startsWith("data:video/mp4")) return "EMBEDDED MP4 DATA-URI (PERSISTENT)";
        return `URL: ${url.slice(0, 48)}`;
      }

      function syncSelectedProjectFields() {
        const p = state.config.projects[state.selectedProjectIndex];
        if (!p) return;
        projEyebrow.value = p.eyebrow || "";
        projTitle.value = p.title || "";
        projCat.value = p.category || "websites";
        projVidUrl.value = (p.videoUrl.startsWith("data:") || p.videoUrl.startsWith("idb://")) ? "" : p.videoUrl;
        projPosterUrl.value = (p.posterUrl.startsWith("data:") || p.posterUrl.startsWith("idb://")) ? "" : p.posterUrl;
        if (projVidStatus) projVidStatus.textContent = describeSource(p.videoUrl, p.videoLabel);
      }

      function populateProjectSelector() {
        if (!projSelect) return;
        projSelect.innerHTML = "";
        state.config.projects.forEach((p, idx) => {
          const opt = document.createElement("option");
          opt.value = String(idx);
          opt.textContent = `Slot 0${idx + 1}: ${(p.title || "").replace(/\n/g, " / ")}`;
          projSelect.appendChild(opt);
        });
        projSelect.value = String(state.selectedProjectIndex);
      }

      populateProjectSelector();
      syncSelectedProjectFields();

      projSelect.addEventListener("change", () => {
        state.selectedProjectIndex = parseInt(projSelect.value, 10) || 0;
        syncSelectedProjectFields();
      });

      [projEyebrow, projTitle, projCat].forEach((el) => {
        if (!el) return;
        el.addEventListener("input", () => {
          const p = state.config.projects[state.selectedProjectIndex];
          p.eyebrow = projEyebrow.value;
          p.title = projTitle.value;
          p.category = projCat.value;
          p.categoryLabel = projCat.options[projCat.selectedIndex]?.text || projCat.value.toUpperCase();
          populateProjectSelector();
          applyConfigToDOM(false);
          scheduleAutoSave();
        });
      });

      if (projVidPreset) {
        projVidPreset.addEventListener("change", async () => {
          const v = projVidPreset.value;
          if (!v) return;
          const p = state.config.projects[state.selectedProjectIndex];
          if (v === "emerald-mp4") {
            p.videoUrl = window.EMBEDDED_MEDIA.sampleEmeraldMp4;
            p.videoLabel = "Sample Emerald MP4";
          } else if (v === "violet-webm") {
            p.videoUrl = window.EMBEDDED_MEDIA.sampleVioletWebm;
            p.videoLabel = "Sample Violet WebM";
          } else if (v === "cyan-mp4") {
            p.videoUrl = window.EMBEDDED_MEDIA.videoCyan;
            p.videoLabel = "Default Cyan MP4";
          } else if (v === "magenta-mp4") {
            p.videoUrl = window.EMBEDDED_MEDIA.videoMagenta;
            p.videoLabel = "Default Magenta MP4";
          }
          syncSelectedProjectFields();
          await applyConfigToDOM(false);
          await saveConfigNow(true);
        });
      }

      projVidUrl.addEventListener("change", async () => {
        const val = projVidUrl.value.trim();
        if (val && !val.startsWith("blob:")) {
          const p = state.config.projects[state.selectedProjectIndex];
          p.videoUrl = val;
          p.videoLabel = "External HTTPS Stream";
          syncSelectedProjectFields();
          await applyConfigToDOM(false);
          await saveConfigNow(true);
        } else if (val.startsWith("blob:")) {
          showToast("REJECTED EPHEMERAL BLOB URL — UPLOAD FILE INSTEAD");
        }
      });

      projVidFile.addEventListener("change", async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const idx = state.selectedProjectIndex;
        const stored = await store.saveMediaAsset(`proj-0${idx + 1}-video`, f);
        state.config.projects[idx].videoUrl = stored.ref;
        state.config.projects[idx].videoLabel = `${stored.name} (${stored.mimeType})`;
        syncSelectedProjectFields();
        await applyConfigToDOM(false);
        await saveConfigNow(false);
        showToast(`PERSISTED VIDEO: ${stored.name}`);
      });

      projPosterUrl.addEventListener("change", async () => {
        const val = projPosterUrl.value.trim();
        if (val && !val.startsWith("blob:")) {
          state.config.projects[state.selectedProjectIndex].posterUrl = val;
          await applyConfigToDOM(false);
          await saveConfigNow(true);
        }
      });

      projPosterFile.addEventListener("change", async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const idx = state.selectedProjectIndex;
        const stored = await store.saveMediaAsset(`proj-0${idx + 1}-poster`, f);
        state.config.projects[idx].posterUrl = stored.ref;
        await applyConfigToDOM(false);
        await saveConfigNow(false);
        showToast(`PERSISTED POSTER: ${stored.name}`);
      });

      // Opening Intro Logo Controls (Visual Editor Replacement + Live Replay)
      const introLogoUpload = document.getElementById("cfg-intro-logo-upload");
      const introLogoUrlInput = document.getElementById("cfg-intro-logo-url");
      const introLogoStatus = document.getElementById("cfg-intro-logo-status");
      const replayIntroBtn = document.getElementById("cfg-replay-intro-btn");
      const resetIntroLogoBtn = document.getElementById("cfg-reset-intro-logo-btn");

      function syncIntroLogoEditorFields() {
        const introCfg = state.config.intro || {};
        const url = introCfg.logoImageUrl || DEFAULT_INTRARAT_INTRO_LOGO;
        const label = introCfg.logoLabel || "INTRARAT_LOGO_SYMBOL_ONLY_TRANSPARENT.png";
        if (introLogoUrlInput) {
          introLogoUrlInput.value = (url.startsWith("data:") || url.startsWith("idb://")) ? "" : url;
        }
        if (introLogoStatus) {
          if (url.startsWith("idb://")) {
            introLogoStatus.textContent = `INTRO LOGO: ${label} (${url})`;
          } else {
            introLogoStatus.textContent = `INTRO LOGO: ${label}`;
          }
        }
      }

      syncIntroLogoEditorFields();

      if (introLogoUpload) {
        introLogoUpload.addEventListener("change", async (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          const stored = await store.saveMediaAsset("intro-logo", f);
          if (!state.config.intro) state.config.intro = {};
          state.config.intro.logoImageUrl = stored.ref;
          state.config.intro.logoLabel = `${stored.name} (${stored.mimeType})`;
          syncIntroLogoEditorFields();
          await applyConfigToDOM(true);
          await saveConfigNow(false);
          showToast(`PERSISTED INTRO LOGO: ${stored.name}`);
        });
      }

      if (introLogoUrlInput) {
        introLogoUrlInput.addEventListener("change", async () => {
          const val = introLogoUrlInput.value.trim();
          if (val && !val.startsWith("blob:")) {
            if (!state.config.intro) state.config.intro = {};
            state.config.intro.logoImageUrl = val;
            state.config.intro.logoLabel = val.split("/").pop() || "Custom Intro Logo URL";
            syncIntroLogoEditorFields();
            await applyConfigToDOM(true);
            await saveConfigNow(true);
            showToast("UPDATED INTRO LOGO URL");
          } else if (val.startsWith("blob:")) {
            showToast("REJECTED EPHEMERAL BLOB URL — UPLOAD FILE INSTEAD");
          }
        });
      }

      if (replayIntroBtn) {
        replayIntroBtn.addEventListener("click", async () => {
          await syncIntroLogoDOM();
          runIntroSequence();
          showToast("REPLAYING OPENING LOGO INTRO (2.5S)");
        });
      }

      if (resetIntroLogoBtn) {
        resetIntroLogoBtn.addEventListener("click", async () => {
          if (!state.config.intro) state.config.intro = {};
          state.config.intro.logoImageUrl = DEFAULT_INTRARAT_INTRO_LOGO;
          state.config.intro.logoLabel = "INTRARAT_LOGO_SYMBOL_ONLY_TRANSPARENT.png";
          syncIntroLogoEditorFields();
          await applyConfigToDOM(true);
          await saveConfigNow(true);
          showToast("RESTORED INTRARAT 20-CIRCLE SYMBOL INTRO");
        });
      }

      bindInput("cfg-show-logo", v => { state.config.brand.showLogoImage = v; }, true);
      const logoFile = document.getElementById("cfg-logo-upload");
      if (logoFile) {
        logoFile.addEventListener("change", async (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          const stored = await store.saveMediaAsset("brand-logo", f);
          state.config.brand.logoImageUrl = stored.ref;
          state.config.brand.showLogoImage = true;
          const chk = document.getElementById("cfg-show-logo");
          if (chk) chk.checked = true;
          await applyConfigToDOM(true);
          await saveConfigNow(false);
          showToast(`PERSISTED LOGO: ${stored.name}`);
        });
      }

      const bgFile = document.getElementById("cfg-bg-image-file");
      if (bgFile) {
        bgFile.addEventListener("change", async (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          const stored = await store.saveMediaAsset("global-bg-image", f);
          state.config.theme.backgroundImageUrl = stored.ref;
          await applyConfigToDOM(true);
          await saveConfigNow(false);
          showToast(`PERSISTED BG IMAGE: ${stored.name}`);
        });
      }

      const objFile = document.getElementById("cfg-obj-upload");
      if (objFile) {
        objFile.addEventListener("change", (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = async () => {
            const text = String(reader.result || "");
            if (engine.loadCustomOBJ(text)) {
              state.config.model3D.customObjData = text;
              state.config.model3D.customObjName = f.name;
              state.config.model3D.preset = "custom-obj";
              const sel = document.getElementById("cfg-3d-preset");
              if (sel) sel.value = "custom-obj";
              await saveConfigNow(false);
              showToast(`PERSISTED 3D MODEL: ${f.name}`);
            } else {
              showToast("INVALID .OBJ GEOMETRY");
            }
          };
          reader.readAsText(f);
        });
      }

      // COLLABORATIVE MULTI-DEVICE SYNC + SAVE / EXPORT / IMPORT / SHARE LINK
      const collabBanner = document.getElementById("collab-sync-banner");
      const conflictBox = document.getElementById("collab-conflict-box");
      const conflictMsg = document.getElementById("collab-conflict-msg");
      const conflictPullBtn = document.getElementById("cfg-conflict-pull-btn");
      const conflictForceBtn = document.getElementById("cfg-conflict-force-btn");
      const roleSelect = document.getElementById("cfg-collab-role");
      const noteInput = document.getElementById("cfg-collab-note");
      const endpointInput = document.getElementById("cfg-sync-endpoint");
      const publishBtn = document.getElementById("cfg-publish-shared-btn");
      const pullBtn = document.getElementById("cfg-pull-shared-btn");
      const shareLinkBtn = document.getElementById("cfg-share-link-btn");

      const saveFooterBtn = document.getElementById("cfg-save-btn");
      const saveTabBtn = document.getElementById("cfg-save-tab-btn");
      const exportBtn = document.getElementById("cfg-export-btn");
      const copyBtn = document.getElementById("cfg-copy-btn");
      const importInput = document.getElementById("cfg-import-file");
      const resetBtn = document.getElementById("cfg-reset-btn");

      function updateCollabBanner(extraMsg) {
        if (!collabBanner) return;
        const m = collab.meta;
        collabBanner.textContent = extraMsg || `ROLE: ${m.authorRole.toUpperCase()} · REV #${m.revision} · LAST SYNC: ${m.lastSyncedBy.toUpperCase()}`;
      }

      if (roleSelect) {
        roleSelect.value = collab.meta.authorRole || "Owner";
        roleSelect.addEventListener("change", () => {
          collab.meta.authorRole = roleSelect.value;
          collab.saveLocalMeta();
          updateCollabBanner();
        });
      }
      if (noteInput) {
        noteInput.value = collab.meta.changeNote || "";
        noteInput.addEventListener("input", () => {
          collab.meta.changeNote = noteInput.value;
          collab.saveLocalMeta();
        });
      }
      if (endpointInput) {
        endpointInput.value = collab.meta.endpointUrl || "";
        endpointInput.addEventListener("change", () => {
          collab.meta.endpointUrl = endpointInput.value.trim();
          collab.saveLocalMeta();
        });
      }

      if (bootSource.startsWith("SHARED_REV_")) {
        updateCollabBanner(`SYNCED ${bootSource.replace(/_/g, " ")}`);
        if (persistBadge) persistBadge.textContent = `SHARED REV #${collab.meta.revision}`;
      } else if (bootSource === "URL_HANDOFF") {
        updateCollabBanner("LOADED FROM SHARED #HANDOFF LINK");
      } else {
        updateCollabBanner();
      }

      async function doPublishShared(forceOverwrite) {
        updateCollabBanner("PUBLISHING TO SHARED WORKSPACE...");
        const res = await collab.publishSharedWorkspace(state.config, forceOverwrite, endpointInput ? endpointInput.value : "");
        if (res.ok) {
          if (conflictBox) conflictBox.classList.remove("is-active");
          if (res.publishedConfig) {
            state.config = mergeConfig(window.DEFAULT_TEMPLATE_CONFIG, res.publishedConfig);
            await saveConfigNow(false);
            await applyConfigToDOM(false);
            syncSelectedProjectFields();
          }
          updateCollabBanner(`PUBLISHED REV #${res.revision} BY ${collab.meta.authorRole.toUpperCase()}`);
          if (persistBadge) persistBadge.textContent = `SHARED REV #${res.revision}`;
          showToast(`PUBLISHED SHARED REV #${res.revision}`);
        } else if (res.reason === "AUTH_REQUIRED") {
          updateCollabBanner("AUTHENTICATION REQUIRED — UNLOCK VISUAL EDITOR ABOVE");
          if (persistBadge) persistBadge.textContent = "AUTH REQUIRED (401)";
          showToast("UNLOCK VISUAL EDITOR WITH OWNER PASSCODE FIRST");
          const passInp = document.getElementById("cms-editor-passcode-input");
          if (passInp) passInp.focus();
        } else if (res.reason === "CONFLICT") {
          if (conflictBox && conflictMsg) {
            conflictMsg.textContent = `CONFLICT: ${res.serverAuthor || "Partner"} saved Rev #${res.serverRevision}. Pull their changes or Force Overwrite.`;
            conflictBox.classList.add("is-active");
          }
          updateCollabBanner(`CONFLICT AT REV #${res.serverRevision}`);
          showToast("REVISION CONFLICT — CHECK SYNC TAB");
        } else {
          updateCollabBanner("STATIC HOST MODE: USE EXPORT .JSON OR #HANDOFF LINK");
          showToast("NO LIVE SERVER — EXPORT .JSON PACKAGE INSTEAD");
        }
      }

      async function doPullShared() {
        const res = await collab.pullSharedWorkspace(endpointInput ? endpointInput.value : "");
        if (res.ok && res.config) {
          if (conflictBox) conflictBox.classList.remove("is-active");
          state.config = mergeConfig(window.DEFAULT_TEMPLATE_CONFIG, res.config);
          if (state.config.masterCms && window.__INTRARAT_MASTER__ && typeof window.__INTRARAT_MASTER__.applyExternalCms === "function") {
            window.__INTRARAT_MASTER__.applyExternalCms(state.config.masterCms);
          }
          syncAllControlInputs();
          syncIntroLogoEditorFields();
          populateProjectSelector();
          syncSelectedProjectFields();
          await applyConfigToDOM(false);
          await saveConfigNow(false);
          updateCollabBanner(`PULLED REV #${res.revision} FROM ${(res.authorRole || "SHARED").toUpperCase()}`);
          if (persistBadge) persistBadge.textContent = `SHARED REV #${res.revision}`;
          showToast(`PULLED SHARED REV #${res.revision}`);
        } else {
          updateCollabBanner("NO SHARED STATE ON ENDPOINT YET");
          showToast("NO REMOTE STATE — USE IMPORT .JSON");
        }
      }

      if (publishBtn) publishBtn.addEventListener("click", () => doPublishShared(false));
      if (pullBtn) pullBtn.addEventListener("click", () => doPullShared());
      if (conflictPullBtn) conflictPullBtn.addEventListener("click", () => doPullShared());
      if (conflictForceBtn) conflictForceBtn.addEventListener("click", () => doPublishShared(true));

      if (shareLinkBtn) {
        shareLinkBtn.addEventListener("click", () => {
          const shareUrl = collab.buildShareableLink(state.config);
          window.__LAST_SHARE_LINK = shareUrl;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => showToast("COPIED #HANDOFF SHARE LINK")).catch(() => {});
          } else {
            const ta = document.createElement("textarea");
            ta.value = shareUrl;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
            showToast("COPIED #HANDOFF SHARE LINK");
          }
          updateCollabBanner("COPIED SHAREABLE #HANDOFF URL");
        });
      }

      [saveFooterBtn, saveTabBtn].forEach((b) => {
        if (b) b.addEventListener("click", () => saveConfigNow(true));
      });

      if (exportBtn) {
        exportBtn.addEventListener("click", async () => {
          const pkg = await collab.buildHandoffPackage(state.config);
          window.__LAST_EXPORTED_PACKAGE = pkg;
          const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `template-handoff-rev${pkg._collabMeta.revision}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          updateCollabBanner(`EXPORTED HANDOFF REV #${pkg._collabMeta.revision}`);
          showToast("EXPORTED HANDOFF PACKAGE (.JSON)");
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          const pkg = await collab.buildHandoffPackage(state.config);
          const jsonText = JSON.stringify(pkg, null, 2);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonText).then(() => showToast("HANDOFF JSON COPIED")).catch(() => {});
          } else {
            const ta = document.createElement("textarea");
            ta.value = jsonText;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
            showToast("HANDOFF JSON COPIED");
          }
        });
      }

      if (importInput) {
        importInput.addEventListener("change", (e) => {
          const f = e.target.files && e.target.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const parsed = JSON.parse(String(reader.result));
              const hydrated = await collab.importHandoffPackage(parsed);
              state.config = mergeConfig(window.DEFAULT_TEMPLATE_CONFIG, hydrated);
              syncAllControlInputs();
              syncIntroLogoEditorFields();
              populateProjectSelector();
              syncSelectedProjectFields();
              await applyConfigToDOM(false);
              await saveConfigNow(false);
              updateCollabBanner(`IMPORTED REV #${collab.meta.revision} FROM ${collab.meta.lastSyncedBy.toUpperCase()}`);
              showToast("IMPORTED CROSS-DEVICE PACKAGE");
            } catch (_err) {
              showToast("INVALID HANDOFF JSON FILE");
            }
          };
          reader.readAsText(f);
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener("click", async () => {
          await store.clearAll();
          state.config = deepClone(window.DEFAULT_TEMPLATE_CONFIG);
          if (window.__INTRARAT_MASTER__ && typeof window.__INTRARAT_MASTER__.resetMasterCms === "function") {
            window.__INTRARAT_MASTER__.resetMasterCms();
          }
          syncAllControlInputs();
          syncIntroLogoEditorFields();
          populateProjectSelector();
          syncSelectedProjectFields();
          await applyConfigToDOM(false);
          if (persistBadge) persistBadge.textContent = "DEFAULTS RESTORED";
          showToast("RESTORED REFERENCE DEFAULTS");
        });
      }

      syncAllControlInputs();
    }

    /* ---------- 6. Initialize & Start Animation Loop ---------- */
    await applyConfigToDOM(false);
    bindVisualConfigurator();

    const sceneParam = params.get("scene") || (params.get("page") === "2" ? "work" : "");
    if (sceneParam === "hero") { state.targetScroll = 0.0; state.scrollProgress = 0.0; }
    else if (sceneParam === "transition") { state.targetScroll = 0.22; state.scrollProgress = 0.22; }
    else if (sceneParam === "work" || sceneParam === "page02") { state.targetScroll = 0.36; state.scrollProgress = 0.36; }
    else if (sceneParam === "contact") { state.targetScroll = 0.95; state.scrollProgress = 0.95; }

    if (params.get("navHover") === "1") {
      navPillbox.classList.add("is-hovered");
      for (let k = 0; k < 14; k++) {
        engine.recordPointer(0.35 + k * 0.035, 0.72 + Math.sin(k * 0.4) * 0.08);
      }
    }
    if (params.get("editor") === "1") editorDrawer.classList.add("is-open");
    if (params.get("pure") === "1") document.body.classList.add("pure-reference-mode");

    // Optional Real Browser Session Video Recorder (?recordQa=1&recordMs=14000)
    const qaVideoStatusEl = document.getElementById("qa-video-status");
    let qaRecCanvas = null;
    let qaRecCtx = null;
    let qaRecorder = null;
    let qaChunks = [];

    if (params.get("recordQa") === "1" && typeof MediaRecorder !== "undefined") {
      try {
        qaRecCanvas = document.createElement("canvas");
        qaRecCanvas.width = 1440;
        qaRecCanvas.height = 900;
        qaRecCtx = qaRecCanvas.getContext("2d");
        const stream = qaRecCanvas.captureStream(30);
        const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : (MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "");
        qaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4500000 }) : new MediaRecorder(stream);
        qaRecorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) qaChunks.push(ev.data);
        };
        qaRecorder.onstop = async () => {
          try {
            const blob = new Blob(qaChunks, { type: "video/webm" });
            const dataUrl = await store.fileToDataUrl(blob);
            const res = await fetch("/api/shared-media", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                slotKey: (params.get("qaSlot") || "round04_green_silk_cursor_trail_qa"),
                name: (params.get("qaSlot") || "round04_green_silk_cursor_trail_qa") + ".webm",
                mimeType: "video/webm",
                dataUrl
              })
            });
            const info = await res.json();
            if (qaVideoStatusEl) {
              qaVideoStatusEl.style.display = "block";
              qaVideoStatusEl.textContent = `QA_VIDEO_SAVED: ${info.url} (${info.size} bytes, cycles=${state.hoverCycleCount})`;
            }
          } catch (_err) {
            if (qaVideoStatusEl) {
              qaVideoStatusEl.style.display = "block";
              qaVideoStatusEl.textContent = "QA_VIDEO_ERROR";
            }
          }
        };
        qaRecorder.start(250);
        if (qaVideoStatusEl) {
          qaVideoStatusEl.style.display = "block";
          qaVideoStatusEl.textContent = "QA_VIDEO_RECORDING";
        }
        const recDuration = Math.max(4000, parseInt(params.get("recordMs") || "14500", 10));
        setTimeout(() => {
          if (qaRecorder && qaRecorder.state === "recording") {
            qaRecorder.stop();
          }
        }, recDuration);
      } catch (_e) {}
    }

    function drawQaCompositeFrame() {
      if (!qaRecCtx || !qaRecorder || qaRecorder.state !== "recording") return;
      const rw = qaRecCanvas.width;
      const rh = qaRecCanvas.height;
      qaRecCtx.drawImage(canvas, 0, 0, rw, rh);
      if (trailCanvas) {
        qaRecCtx.drawImage(trailCanvas, 0, 0, rw, rh);
      }

      // Draw visible cursor arrow & halo onto recorded video frame
      if (state.lastClientX >= 0 && state.lastClientY >= 0) {
        const sx = (state.lastClientX / Math.max(1, window.innerWidth)) * rw;
        const sy = (state.lastClientY / Math.max(1, window.innerHeight)) * rh;
        qaRecCtx.save();
        qaRecCtx.beginPath();
        qaRecCtx.arc(sx, sy, state.isLogoHovered ? 24 : 16, 0, Math.PI * 2);
        qaRecCtx.fillStyle = state.isLogoHovered ? "rgba(67, 158, 41, 0.26)" : "rgba(67, 158, 41, 0.14)";
        qaRecCtx.fill();
        qaRecCtx.lineWidth = 2;
        qaRecCtx.strokeStyle = state.isLogoHovered ? "rgba(32, 128, 48, 0.85)" : "rgba(32, 128, 48, 0.45)";
        qaRecCtx.stroke();

        // Cursor arrow polygon
        qaRecCtx.translate(sx, sy);
        qaRecCtx.beginPath();
        qaRecCtx.moveTo(0, 0);
        qaRecCtx.lineTo(18, 11);
        qaRecCtx.lineTo(10, 13.5);
        qaRecCtx.lineTo(14.5, 21.5);
        qaRecCtx.lineTo(11, 23);
        qaRecCtx.lineTo(6.5, 15);
        qaRecCtx.lineTo(0, 20);
        qaRecCtx.closePath();
        qaRecCtx.fillStyle = "#0f3d20";
        qaRecCtx.fill();
        qaRecCtx.lineWidth = 2;
        qaRecCtx.strokeStyle = "#ffffff";
        qaRecCtx.stroke();
        qaRecCtx.restore();
      }
    }

    let lastTime = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      state.time += dt;
      if (!state.introTimePinned) {
        state.introElapsed += dt;
      }

      const lerpBase = Math.max(0.02, Math.min(0.35, state.config.animation.cameraLerp || 0.08));
      const factor = 1 - Math.pow(1 - lerpBase, dt * 60);

      const prevScroll = state.scrollProgress;
      state.scrollProgress += (state.targetScroll - state.scrollProgress) * factor;
      state.scrollVelocity = (state.scrollProgress - prevScroll) / dt;

      // 1. Second-order spring damping for smooth 3D rotation & positional mouse follow
      const springK = 105;
      const springDamp = 14.5;

      state.rotVelX += (state.targetMouseX - state.mouseX) * springK * dt;
      state.rotVelY += (state.targetMouseY - state.mouseY) * springK * dt;
      const rotDecay = Math.exp(-springDamp * dt);
      state.rotVelX *= rotDecay;
      state.rotVelY *= rotDecay;
      state.mouseX += state.rotVelX * dt;
      state.mouseY += state.rotVelY * dt;

      state.followVelX += (state.targetFollowX - state.followX) * 92 * dt;
      state.followVelY += (state.targetFollowY - state.followY) * 92 * dt;
      const followDecay = Math.exp(-13.5 * dt);
      state.followVelX *= followDecay;
      state.followVelY *= followDecay;
      state.followX += state.followVelX * dt;
      state.followY += state.followVelY * dt;

      // 2. Second-order spring damping for 3D Hover Exploded Separation & Leave Reassembly
      const targetExp = (pinnedHover || state.isLogoHovered) ? 1.0 : 0.0;
      state.hoverVel += (targetExp - state.hoverExplosion) * 96 * dt;
      state.hoverVel *= Math.exp(-13.2 * dt);
      state.hoverExplosion = Math.max(0, Math.min(1.18, state.hoverExplosion + state.hoverVel * dt));
      if (!targetExp && state.hoverExplosion < 0.001 && Math.abs(state.hoverVel) < 0.005) {
        state.hoverExplosion = 0;
        state.hoverVel = 0;
      }

      engine.render(state, dt);
      updateSceneDOM();
      drawQaCompositeFrame();

      if (qaVideoStatusEl) {
        const tState = window.__INTRARAT_3D_INTRO_STATE || {};
        qaVideoStatusEl.setAttribute("data-telemetry", JSON.stringify({
          sphereCount: tState.sphereCount,
          phase: tState.phase,
          introElapsedSec: tState.introElapsedSec,
          assembledProgress: tState.assembledProgress,
          isLogoHovered: tState.isLogoHovered,
          hoverExplosion: tState.hoverExplosion,
          hoverCycleCount: tState.hoverCycleCount,
          followX: tState.followX,
          followY: tState.followY,
          tiltDegX: tState.tiltDegX,
          tiltDegY: tState.tiltDegY,
          materialConfig: tState.materialConfig,
          cursorTrail: {
            enabled: ((state.config && state.config.intro && state.config.intro.trailEnabled) !== false),
            suppressed: isTrailSuppressed(),
            loopRunning: silkTrail.loopRunning,
            pointCount: silkTrail.points.length,
            arcLengthPx: silkTrail.currentArcLengthPx,
            color: (state.config && state.config.intro && state.config.intro.trailColor) || "#439e29",
            maxLengthPx: (state.config && state.config.intro && state.config.intro.trailLengthPx) || 115,
            widthPx: (state.config && state.config.intro && state.config.intro.trailWidthPx) || 7.5,
            intensity: (state.config && state.config.intro && state.config.intro.trailIntensity) ?? 0.88,
            fadeMs: (state.config && state.config.intro && state.config.intro.trailFadeMs) || 540,
            pointerEvents: trailCanvas ? getComputedStyle(trailCanvas).pointerEvents : "none"
          },
          page02: {
            isActive: document.body.classList.contains("is-page02-active"),
            officialLogoSrc: brandLogoImg ? brandLogoImg.getAttribute("src") : "",
            smallHeading: (document.getElementById("page02-small-heading") || {}).textContent || "",
            headlineDark: (document.getElementById("page02-headline-dark") || {}).textContent || "",
            headlineGreen: (document.getElementById("page02-headline-green") || {}).textContent || "",
            subtitle: (document.getElementById("page02-subtitle") || {}).textContent || "",
            card01Duration: (document.getElementById("card-1-duration-pill") || {}).textContent || "",
            card02Duration: (document.getElementById("card-2-duration-pill") || {}).textContent || "",
            card02ComingSoon: Boolean(document.getElementById("card-2-center-coming-soon")),
            modalOpen: document.getElementById("video-modal").classList.contains("is-open")
          },
          sampleSpheres: (tState.spheres || []).slice(0, 4)
        }));
      }

      requestAnimationFrame(tick);
    }

    engine.render(state, 0.016);
    updateSceneDOM();
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTemplateApp);
  } else {
    initTemplateApp();
  }
})();
