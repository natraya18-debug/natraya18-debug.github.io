/* ==========================================================================
   Collaborative Multi-Device Sync Manager (Round 03 Upgrade)
   Enables Owner & Partner to co-edit across separate devices/browsers via:
   1. Shared Workspace HTTP/HTTPS Sync Endpoint (with Revision & Conflict Guard
      + Cross-Device Shared Media Upload for MP4/WebM & Images)
   2. Portable Cross-Device Handoff Package (.handoff.json with embedded media)
   3. Instant Shareable URL Hash (#handoff=<base64url>) for Android Chrome review
   Zero paid services required.
   ========================================================================== */

(function () {
  "use strict";

  const COLLAB_META_KEY = "active_theory_collab_meta_v3";

  function toBase64UrlUtf8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64UrlUtf8(b64u) {
    const pad = b64u.replace(/-/g, "+").replace(/_/g, "/");
    const padded = pad + "===".slice((pad.length + 3) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  class CollaborativeSyncManager {
    constructor(persistentStore) {
      this.store = persistentStore;
      this.meta = this.loadLocalMeta();
      this.pendingConflict = null;
    }

    loadLocalMeta() {
      const fallback = {
        authorRole: "Owner",
        changeNote: "",
        revision: 1,
        lastSyncedBy: "Local",
        lastSyncedAt: "",
        endpointUrl: ""
      };
      try {
        const raw = localStorage.getItem(COLLAB_META_KEY);
        if (raw) return Object.assign(fallback, JSON.parse(raw));
      } catch (_e) {}
      return fallback;
    }

    saveLocalMeta() {
      try {
        localStorage.setItem(COLLAB_META_KEY, JSON.stringify(this.meta));
      } catch (_e) {}
    }

    /* Detect default same-origin sync API when hosted on collab_server or Pages Function */
    getEffectiveEndpoint(overrideUrl) {
      if (overrideUrl && overrideUrl.trim()) return overrideUrl.trim();
      if (this.meta.endpointUrl && this.meta.endpointUrl.trim()) return this.meta.endpointUrl.trim();
      const proto = window.location.protocol;
      if (proto === "http:" || proto === "https:") {
        return window.location.origin + "/api/shared-config.json";
      }
      return "";
    }

    getMediaUploadEndpoint(configEndpoint) {
      if (!configEndpoint) return "";
      if (configEndpoint.endsWith("/api/shared-config")) {
        return configEndpoint.replace(/\/api\/shared-config$/, "/api/shared-media");
      }
      return configEndpoint.replace(/\/+$/, "") + "/media";
    }

    getAuthHeaders() {
      const headers = { "Content-Type": "application/json" };
      try {
        const masterSt = (window.__INTRARAT_MASTER__ && typeof window.__INTRARAT_MASTER__.getState === "function")
          ? window.__INTRARAT_MASTER__.getState()
          : null;
        const tok =
          (masterSt && masterSt.adminToken) ||
          window.sessionStorage.getItem("intrarat_admin_token") ||
          window.sessionStorage.getItem("intrarat_crm_token") ||
          "";
        if (tok) {
          headers["Authorization"] = `Bearer ${tok}`;
        }
      } catch (_e) {}
      return headers;
    }

    /* Check if URL contains a `#handoff=...` cross-device share state */
    parseUrlHandoffHash() {
      try {
        const h = window.location.hash || "";
        if (!h.startsWith("#handoff=")) return null;
        const encoded = h.slice("#handoff=".length);
        if (!encoded) return null;
        const decoded = JSON.parse(fromBase64UrlUtf8(encoded));
        return decoded && typeof decoded === "object" ? decoded : null;
      } catch (_e) {
        return null;
      }
    }

    /* Create compact shareable link (strips multi-MB base64 blobs so URL stays clean) */
    buildShareableLink(cfg) {
      const lite = JSON.parse(JSON.stringify(cfg));
      const stripHeavy = (u) => (typeof u === "string" && (u.startsWith("data:") || u.startsWith("idb://"))) ? "" : u;
      if (lite.brand) lite.brand.logoImageUrl = stripHeavy(lite.brand.logoImageUrl);
      if (lite.intro) {
        lite.intro.logoImageUrl =
          stripHeavy(lite.intro.logoImageUrl) || "assets/INTRARAT_LOGO_SYMBOL_ONLY_TRANSPARENT.png";
      }
      if (lite.theme) lite.theme.backgroundImageUrl = stripHeavy(lite.theme.backgroundImageUrl);
      if (lite.showreel) {
        lite.showreel.videoUrl = stripHeavy(lite.showreel.videoUrl);
        lite.showreel.posterUrl = stripHeavy(lite.showreel.posterUrl);
      }
      if (Array.isArray(lite.projects)) {
        lite.projects.forEach((p) => {
          if (typeof p.videoUrl === "string" && (p.videoUrl.startsWith("data:") || p.videoUrl.startsWith("idb://"))) {
            delete p.videoUrl;
          }
          if (typeof p.posterUrl === "string" && (p.posterUrl.startsWith("data:") || p.posterUrl.startsWith("idb://"))) {
            delete p.posterUrl;
          }
        });
      }
      lite._collabMeta = {
        authorRole: this.meta.authorRole,
        revision: this.meta.revision,
        changeNote: this.meta.changeNote,
        sharedVia: "url-hash"
      };
      const base = window.location.href.split("#")[0];
      return `${base}#handoff=${toBase64UrlUtf8(JSON.stringify(lite))}`;
    }

    /* Upload local IndexedDB media (`idb://media/...`) to Shared Server so Partner devices stream it directly */
    async uploadMediaIfNeeded(ref, slotKey, mediaEndpoint) {
      if (!ref || !ref.startsWith("idb://media/") || !mediaEndpoint) return ref;
      const db = await this.store.openDB();
      if (!db) return ref;

      const record = await new Promise((resolve) => {
        try {
          const tx = db.transaction("media_store", "readonly");
          const req = tx.objectStore("media_store").get(ref);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (_e) {
          resolve(null);
        }
      });
      if (!record || !record.dataUrl) return ref;

      try {
        const res = await fetch(mediaEndpoint, {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            slotKey,
            name: record.name || slotKey,
            mimeType: record.mimeType || "video/mp4",
            dataUrl: record.dataUrl
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.url) {
            return data.url;
          }
        }
      } catch (_err) {
        // Fallback to inline DataURI if media endpoint is unavailable
      }
      return record.dataUrl;
    }

    /* Pull latest shared configuration from Collaborative Endpoint */
    async pullSharedWorkspace(customEndpoint) {
      const endpoint = this.getEffectiveEndpoint(customEndpoint);
      if (!endpoint) {
        return { ok: false, reason: "NO_ENDPOINT" };
      }
      try {
        const sep = endpoint.includes("?") ? "&" : "?";
        const targetUrl = `${endpoint}${sep}_t=${Date.now()}`;
        const res = await fetch(targetUrl, { method: "GET", cache: "no-store" });
        if (!res.ok) {
          return { ok: false, reason: `HTTP_${res.status}` };
        }
        const payload = await res.json();
        if (!payload || !payload.config) {
          return { ok: false, reason: "EMPTY_SHARED_STATE" };
        }
        this.meta.revision = payload.revision || 1;
        this.meta.lastSyncedBy = payload.authorRole || "Shared";
        this.meta.lastSyncedAt = payload.updatedAt || "";
        this.pendingConflict = null;
        this.saveLocalMeta();
        return {
          ok: true,
          config: payload.config,
          revision: this.meta.revision,
          authorRole: payload.authorRole || "Owner",
          changeNote: payload.changeNote || "",
          updatedAt: payload.updatedAt || ""
        };
      } catch (_err) {
        return { ok: false, reason: "OFFLINE_OR_STATIC_HOST" };
      }
    }

    /* Publish configuration + custom media to Shared Workspace for Owner & Partner */
    async publishSharedWorkspace(cfg, forceOverwrite, customEndpoint) {
      const isAuth = Boolean(
        window.__INTRARAT_MASTER__ &&
        typeof window.__INTRARAT_MASTER__.getState === "function" &&
        window.__INTRARAT_MASTER__.getState().adminSessionVerified
      );
      if (!isAuth) {
        return {
          ok: false,
          reason: "AUTH_REQUIRED",
          error: "Authentication required for CMS publishing. Please unlock the Visual Editor with your Owner or Collaborator passcode."
        };
      }
      const endpoint = this.getEffectiveEndpoint(customEndpoint);
      if (!endpoint) {
        return { ok: false, reason: "NO_ENDPOINT" };
      }

      const mediaEndpoint = this.getMediaUploadEndpoint(endpoint);
      const prepared = this.store.sanitizeConfig(cfg);

      if (prepared.brand && prepared.brand.logoImageUrl) {
        prepared.brand.logoImageUrl = await this.uploadMediaIfNeeded(prepared.brand.logoImageUrl, "brand-logo", mediaEndpoint);
      }
      if (prepared.intro && prepared.intro.logoImageUrl) {
        prepared.intro.logoImageUrl = await this.uploadMediaIfNeeded(prepared.intro.logoImageUrl, "intro-logo", mediaEndpoint);
      }
      if (prepared.theme && prepared.theme.backgroundImageUrl) {
        prepared.theme.backgroundImageUrl = await this.uploadMediaIfNeeded(prepared.theme.backgroundImageUrl, "bg-image", mediaEndpoint);
      }
      if (prepared.showreel && prepared.showreel.videoUrl) {
        prepared.showreel.videoUrl = await this.uploadMediaIfNeeded(prepared.showreel.videoUrl, "showreel-video", mediaEndpoint);
      }
      if (Array.isArray(prepared.projects)) {
        for (let i = 0; i < prepared.projects.length; i++) {
          const p = prepared.projects[i];
          p.videoUrl = await this.uploadMediaIfNeeded(p.videoUrl, `proj-0${i + 1}-video`, mediaEndpoint);
          p.posterUrl = await this.uploadMediaIfNeeded(p.posterUrl, `proj-0${i + 1}-poster`, mediaEndpoint);
        }
      }

      if (window.__INTRARAT_MASTER__ && typeof window.__INTRARAT_MASTER__.getState === "function") {
        const ms = window.__INTRARAT_MASTER__.getState();
        if (ms && ms.cms) {
          prepared.masterCms = JSON.parse(JSON.stringify(ms.cms));
        }
      }

      const bodyObj = {
        baseRevision: this.meta.revision || 0,
        force: Boolean(forceOverwrite),
        authorRole: this.meta.authorRole || "Owner",
        changeNote: this.meta.changeNote || "",
        config: prepared
      };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: this.getAuthHeaders(),
          body: JSON.stringify(bodyObj)
        });

        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            reason: "AUTH_REQUIRED"
          };
        }

        if (res.status === 409) {
          const conflictData = await res.json();
          this.pendingConflict = conflictData;
          return {
            ok: false,
            reason: "CONFLICT",
            serverRevision: conflictData.revision,
            serverAuthor: conflictData.authorRole,
            serverUpdatedAt: conflictData.updatedAt
          };
        }

        if (!res.ok) {
          return { ok: false, reason: `HTTP_${res.status}` };
        }

        const saved = await res.json();
        this.meta.revision = saved.revision || (this.meta.revision + 1);
        this.meta.lastSyncedBy = this.meta.authorRole;
        this.meta.lastSyncedAt = saved.updatedAt || new Date().toISOString();
        this.pendingConflict = null;
        this.saveLocalMeta();

        return {
          ok: true,
          revision: this.meta.revision,
          updatedAt: this.meta.lastSyncedAt,
          publishedConfig: prepared
        };
      } catch (_err) {
        return { ok: false, reason: "OFFLINE_OR_STATIC_HOST" };
      }
    }

    /* Hydrate an imported `.handoff.json` package onto a new device's IndexedDB */
    async importHandoffPackage(pkg) {
      const rawCfg = pkg.config ? pkg.config : pkg;
      const hydrated = JSON.parse(JSON.stringify(rawCfg));

      const persistInlineDataUrl = async (val, slotKey, labelFallback) => {
        if (typeof val !== "string" || !val.startsWith("data:")) return val;
        // Skip re-storing built-in default embedded media to keep DB lean
        if (
          val === window.EMBEDDED_MEDIA.videoCyan ||
          val === window.EMBEDDED_MEDIA.videoMagenta ||
          val === window.EMBEDDED_MEDIA.sampleEmeraldMp4 ||
          val === window.EMBEDDED_MEDIA.sampleVioletWebm ||
          window.EMBEDDED_MEDIA.posters.includes(val)
        ) {
          return val;
        }
        try {
          const comma = val.indexOf(",");
          const mime = val.slice(5, comma).split(";")[0] || "application/octet-stream";
          const bin = atob(val.slice(comma + 1));
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") ? "mp4" : "png";
          const fileObj = new File([bytes], labelFallback || `${slotKey}.${ext}`, { type: mime });
          const stored = await this.store.saveMediaAsset(slotKey, fileObj);
          return stored.ref;
        } catch (_e) {
          return val;
        }
      };

      if (hydrated.brand && hydrated.brand.logoImageUrl) {
        hydrated.brand.logoImageUrl = await persistInlineDataUrl(hydrated.brand.logoImageUrl, "brand-logo", "imported_logo.png");
      }
      if (hydrated.intro && hydrated.intro.logoImageUrl) {
        hydrated.intro.logoImageUrl = await persistInlineDataUrl(hydrated.intro.logoImageUrl, "intro-logo", "imported_intro_logo.png");
      }
      if (hydrated.theme && hydrated.theme.backgroundImageUrl) {
        hydrated.theme.backgroundImageUrl = await persistInlineDataUrl(hydrated.theme.backgroundImageUrl, "global-bg-image", "imported_bg.png");
      }
      if (Array.isArray(hydrated.projects)) {
        for (let i = 0; i < hydrated.projects.length; i++) {
          const p = hydrated.projects[i];
          p.videoUrl = await persistInlineDataUrl(p.videoUrl, `proj-0${i + 1}-video`, p.videoLabel || `imported_slot_${i + 1}.mp4`);
          p.posterUrl = await persistInlineDataUrl(p.posterUrl, `proj-0${i + 1}-poster`, `imported_poster_${i + 1}.png`);
        }
      }

      if (pkg._collabMeta) {
        this.meta.revision = pkg._collabMeta.revision || (this.meta.revision + 1);
        this.meta.lastSyncedBy = pkg._collabMeta.authorRole || "Imported";
        this.meta.lastSyncedAt = pkg._collabMeta.exportedAt || new Date().toISOString();
        this.saveLocalMeta();
      }

      return hydrated;
    }

    async buildHandoffPackage(cfg) {
      const portableConfig = await this.store.exportPortableConfig(cfg);
      return {
        _schema: "active-theory-template-handoff-v3",
        _collabMeta: {
          authorRole: this.meta.authorRole || "Owner",
          changeNote: this.meta.changeNote || "",
          revision: this.meta.revision || 1,
          exportedAt: new Date().toISOString()
        },
        config: portableConfig
      };
    }
  }

  window.CollaborativeSyncManager = CollaborativeSyncManager;
})();
