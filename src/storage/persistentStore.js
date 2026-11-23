/* ==========================================================================
   Persistent Configuration & Media Storage Engine (Round 02 Upgrade)
   Stores configuration AND binary MP4/WebM/Image/OBJ assets permanently in
   IndexedDB (with localStorage fallback for lightweight config fields).
   NEVER stores ephemeral session-only `blob:` URLs as permanent config data.
   ========================================================================== */

(function () {
  "use strict";

  const DB_NAME = "ActiveTheoryEditableTemplateDB";
  const DB_VERSION = 2;
  const STORE_CONFIG = "config_store";
  const STORE_MEDIA = "media_store";
  const CONFIG_KEY = "active_template_config_v5_intrarat_3d";
  const LS_FALLBACK_KEY = "active_theory_config_ls_v5_intrarat_3d";

  class PersistentTemplateStore {
    constructor() {
      this.dbPromise = null;
      this.runtimeUrlCache = new Map(); // idb:// key -> active runtime URL for <video>/<img>
    }

    openDB() {
      if (this.dbPromise) return this.dbPromise;
      this.dbPromise = new Promise((resolve) => {
        if (typeof indexedDB === "undefined") {
          resolve(null);
          return;
        }
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_CONFIG)) {
              db.createObjectStore(STORE_CONFIG);
            }
            if (!db.objectStoreNames.contains(STORE_MEDIA)) {
              db.createObjectStore(STORE_MEDIA);
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (_err) {
          resolve(null);
        }
      });
      return this.dbPromise;
    }

    fileToDataUrl(fileOrBlob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Read failed"));
        reader.readAsDataURL(fileOrBlob);
      });
    }

    dataUrlToBlobUrl(dataUrl) {
      try {
        const comma = dataUrl.indexOf(",");
        if (comma < 0) return dataUrl;
        const meta = dataUrl.slice(5, comma);
        const mime = meta.split(";")[0] || "application/octet-stream";
        const bin = atob(dataUrl.slice(comma + 1));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: mime }));
      } catch (_e) {
        return dataUrl;
      }
    }

    /* Save an uploaded MP4, WebM, Image, or asset permanently under `idb://media/<slotKey>` */
    async saveMediaAsset(slotKey, file) {
      const idbRef = `idb://media/${slotKey}`;
      const dataUrl = await this.fileToDataUrl(file);
      const record = {
        slotKey,
        name: file.name || slotKey,
        mimeType: file.type || "video/mp4",
        size: file.size || dataUrl.length,
        dataUrl,
        updatedAt: Date.now()
      };

      const db = await this.openDB();
      if (db) {
        await new Promise((resolve) => {
          try {
            const tx = db.transaction(STORE_MEDIA, "readwrite");
            tx.objectStore(STORE_MEDIA).put(record, idbRef);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } catch (_e) {
            resolve(false);
          }
        });
      }

      // Also keep compact fallback in localStorage if under 1.8 MB
      try {
        if (dataUrl.length < 1800000) {
          localStorage.setItem(`media_${idbRef}`, JSON.stringify(record));
        }
      } catch (_e) {}

      // Refresh runtime playback URL derived from persistent DataURL
      const prev = this.runtimeUrlCache.get(idbRef);
      if (prev && prev.startsWith("blob:")) {
        try { URL.revokeObjectURL(prev); } catch (_e) {}
      }
      const playable = (record.mimeType.startsWith("video/") && dataUrl.length > 20000000)
        ? this.dataUrlToBlobUrl(dataUrl)
        : dataUrl;
      this.runtimeUrlCache.set(idbRef, playable);

      return {
        ref: idbRef,
        name: record.name,
        mimeType: record.mimeType,
        playableUrl: playable
      };
    }

    /* Resolve any stored reference (`idb://media/...`, `data:...`, or `https://...`) */
    async resolveMediaUrl(ref) {
      if (!ref) return "";
      if (this.runtimeUrlCache.has(ref)) {
        return this.runtimeUrlCache.get(ref);
      }

      if (ref.startsWith("idb://media/")) {
        let record = null;
        const db = await this.openDB();
        if (db) {
          record = await new Promise((resolve) => {
            try {
              const tx = db.transaction(STORE_MEDIA, "readonly");
              const req = tx.objectStore(STORE_MEDIA).get(ref);
              req.onsuccess = () => resolve(req.result || null);
              req.onerror = () => resolve(null);
            } catch (_e) {
              resolve(null);
            }
          });
        }
        if (!record) {
          try {
            const raw = localStorage.getItem(`media_${ref}`);
            if (raw) record = JSON.parse(raw);
          } catch (_e) {}
        }
        if (record && record.dataUrl) {
          const playable = ((record.mimeType || "").startsWith("video/") && record.dataUrl.length > 20000000)
            ? this.dataUrlToBlobUrl(record.dataUrl)
            : record.dataUrl;
          this.runtimeUrlCache.set(ref, playable);
          return playable;
        }
        return "";
      }

      if (ref.startsWith("data:video/")) {
        const playable = ref.length > 20000000 ? this.dataUrlToBlobUrl(ref) : ref;
        this.runtimeUrlCache.set(ref, playable);
        return playable;
      }

      return ref;
    }

    /* Strip any accidental blob: URL before persisting config */
    sanitizeConfig(cfg) {
      const clean = JSON.parse(JSON.stringify(cfg));
      const guard = (val, fallback) =>
        typeof val === "string" && val.startsWith("blob:") ? (fallback || "") : val;

      if (clean.brand) {
        clean.brand.logoImageUrl = guard(clean.brand.logoImageUrl, "");
      }
      if (clean.intro) {
        clean.intro.logoImageUrl = guard(
          clean.intro.logoImageUrl,
          "assets/INTRARAT_LOGO_SYMBOL_ONLY_TRANSPARENT.png"
        );
      }
      if (clean.theme) {
        clean.theme.backgroundImageUrl = guard(clean.theme.backgroundImageUrl, "");
      }
      if (clean.showreel) {
        clean.showreel.videoUrl = guard(clean.showreel.videoUrl, window.EMBEDDED_MEDIA.videoCyan);
        clean.showreel.posterUrl = guard(clean.showreel.posterUrl, window.EMBEDDED_MEDIA.posters[0]);
      }
      if (Array.isArray(clean.projects)) {
        clean.projects.forEach((p, idx) => {
          p.videoUrl = guard(p.videoUrl, window.EMBEDDED_MEDIA.videoCyan);
          p.posterUrl = guard(p.posterUrl, window.EMBEDDED_MEDIA.posters[idx % window.EMBEDDED_MEDIA.posters.length]);
        });
      }
      return clean;
    }

    async saveConfig(cfg) {
      const sanitized = this.sanitizeConfig(cfg);
      sanitized._savedAt = new Date().toISOString();

      const db = await this.openDB();
      let savedIDB = false;
      if (db) {
        savedIDB = await new Promise((resolve) => {
          try {
            const tx = db.transaction(STORE_CONFIG, "readwrite");
            tx.objectStore(STORE_CONFIG).put(sanitized, CONFIG_KEY);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } catch (_e) {
            resolve(false);
          }
        });
      }

      let savedLS = false;
      try {
        const str = JSON.stringify(sanitized);
        if (str.length < 4200000) {
          localStorage.setItem(LS_FALLBACK_KEY, str);
          savedLS = true;
        }
      } catch (_e) {}

      return { savedIDB, savedLS, timestamp: sanitized._savedAt };
    }

    async loadConfig() {
      const db = await this.openDB();
      if (db) {
        const fromIDB = await new Promise((resolve) => {
          try {
            const tx = db.transaction(STORE_CONFIG, "readonly");
            const req = tx.objectStore(STORE_CONFIG).get(CONFIG_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          } catch (_e) {
            resolve(null);
          }
        });
        if (fromIDB) return fromIDB;
      }

      try {
        const raw = localStorage.getItem(LS_FALLBACK_KEY);
        if (raw) return JSON.parse(raw);
      } catch (_e) {}

      return null;
    }

    async clearAll() {
      const db = await this.openDB();
      if (db) {
        await new Promise((resolve) => {
          try {
            const tx = db.transaction([STORE_CONFIG, STORE_MEDIA], "readwrite");
            tx.objectStore(STORE_CONFIG).clear();
            tx.objectStore(STORE_MEDIA).clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } catch (_e) {
            resolve(false);
          }
        });
      }
      try {
        localStorage.removeItem(LS_FALLBACK_KEY);
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("media_idb://")) localStorage.removeItem(k);
        });
      } catch (_e) {}
      this.runtimeUrlCache.clear();
    }

    /* Export portable JSON with embedded DataURIs resolved from IndexedDB */
    async exportPortableConfig(cfg) {
      const copy = this.sanitizeConfig(cfg);
      const db = await this.openDB();

      const inlineRef = async (ref) => {
        if (!ref || !ref.startsWith("idb://media/") || !db) return ref;
        return new Promise((resolve) => {
          try {
            const tx = db.transaction(STORE_MEDIA, "readonly");
            const req = tx.objectStore(STORE_MEDIA).get(ref);
            req.onsuccess = () => resolve(req.result && req.result.dataUrl ? req.result.dataUrl : ref);
            req.onerror = () => resolve(ref);
          } catch (_e) {
            resolve(ref);
          }
        });
      };

      if (copy.brand) copy.brand.logoImageUrl = await inlineRef(copy.brand.logoImageUrl);
      if (copy.intro) copy.intro.logoImageUrl = await inlineRef(copy.intro.logoImageUrl);
      if (copy.theme) copy.theme.backgroundImageUrl = await inlineRef(copy.theme.backgroundImageUrl);
      if (copy.showreel) {
        copy.showreel.videoUrl = await inlineRef(copy.showreel.videoUrl);
        copy.showreel.posterUrl = await inlineRef(copy.showreel.posterUrl);
      }
      if (Array.isArray(copy.projects)) {
        for (const p of copy.projects) {
          p.videoUrl = await inlineRef(p.videoUrl);
          p.posterUrl = await inlineRef(p.posterUrl);
        }
      }
      return copy;
    }
  }

  window.PersistentTemplateStore = PersistentTemplateStore;
})();
