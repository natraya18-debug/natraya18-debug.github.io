/* ==========================================================================
   Reusable Video System — Round 02 Persistent Media Upgrade
   Resolves persistent `idb://media/...`, embedded DataURIs, and HTTPS MP4/WebM
   streams via PersistentTemplateStore without storing ephemeral `blob:` URLs.
   ========================================================================== */

(function () {
  "use strict";

  class ReusableVideoManager {
    constructor(store) {
      this.store = store;
      this.modalEl = document.getElementById("video-modal");
      this.modalVideo = document.getElementById("modal-video-player");
      this.modalTitle = document.getElementById("modal-video-title");
      this.closeBtn = document.getElementById("close-video-btn");

      if (this.closeBtn) {
        this.closeBtn.addEventListener("click", () => this.closeModal());
      }
      if (this.modalEl) {
        this.modalEl.addEventListener("click", (e) => {
          if (e.target === this.modalEl) this.closeModal();
        });
      }
    }

    async bindCardVideo(videoEl, fallbackImgEl, videoRef, posterRef) {
      if (!videoEl) return;

      const resolvedPoster = this.store ? await this.store.resolveMediaUrl(posterRef) : (posterRef || "");
      const resolvedVideo = this.store ? await this.store.resolveMediaUrl(videoRef) : (videoRef || "");

      if (fallbackImgEl) {
        if (resolvedPoster) {
          fallbackImgEl.src = resolvedPoster;
          fallbackImgEl.style.display = "block";
        } else {
          fallbackImgEl.style.display = "none";
        }
      }

      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.preload = "none";
      videoEl.setAttribute("muted", "");
      videoEl.setAttribute("playsinline", "");
      videoEl.setAttribute("webkit-playsinline", "");
      videoEl.setAttribute("loop", "");
      videoEl.setAttribute("preload", "none");
      videoEl.dataset.persistentRef = videoRef || "";

      if (resolvedPoster) {
        videoEl.poster = resolvedPoster;
      }

      if (!resolvedVideo || resolvedPoster) {
        videoEl.removeAttribute("src");
        videoEl.style.opacity = "0";
        return;
      }

      if (videoEl.dataset.boundSrc !== resolvedVideo) {
        videoEl.dataset.boundSrc = resolvedVideo;
        videoEl.src = resolvedVideo;
        videoEl.load();
      }

      const showFallbackOnly = () => {
        videoEl.style.opacity = "0";
        if (fallbackImgEl && resolvedPoster) {
          fallbackImgEl.style.opacity = "0.68";
        }
      };

      videoEl.onerror = showFallbackOnly;
      videoEl.onloadeddata = () => {
        videoEl.style.opacity = "";
      };

      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          showFallbackOnly();
        });
      }
    }

    async openModal(title, videoRef, posterRef) {
      if (!this.modalEl || !this.modalVideo) return;
      if (this.modalTitle) {
        this.modalTitle.textContent = title || "YOUR VIDEO REEL";
      }
      const resolvedPoster = this.store ? await this.store.resolveMediaUrl(posterRef) : (posterRef || "");
      const resolvedVideo = this.store ? await this.store.resolveMediaUrl(videoRef) : (videoRef || "");

      if (resolvedPoster) this.modalVideo.poster = resolvedPoster;
      if (resolvedVideo) {
        this.modalVideo.src = resolvedVideo;
        this.modalVideo.muted = true;
        this.modalVideo.loop = true;
        this.modalVideo.playsInline = true;
        const p = this.modalVideo.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
      this.modalEl.classList.add("is-open");
    }

    closeModal() {
      if (!this.modalEl || !this.modalVideo) return;
      this.modalEl.classList.remove("is-open");
      try {
        this.modalVideo.pause();
      } catch (_e) {}
    }
  }

  window.ReusableVideoManager = ReusableVideoManager;
})();
