// Version: 1.0.1 - Mobile video quality and vector SVG optimizations
document.addEventListener("DOMContentLoaded", () => {
    initPreloader();
    initWelcomeScreen();
    initWifiCopy();
    initPillowCardAction();
    initFloatingPillowTab();
    initHeaderDropdowns();
    initRestaurantSlider();
    initRestaurantActions();
    initSpaActions();
    initLeisureActions();
    initLeisureAccordion();
    initUsefulInfoActions();
    initLanguageSelector();
    initBackgroundMusic();
    initMobileMenu();

    // Logo click = full reload back to the very start (owner request)
    const headerLogo = document.querySelector(".main-header .logo");
    if (headerLogo) {
        headerLogo.style.cursor = "pointer";
        headerLogo.addEventListener("click", () => window.location.reload());
    }

    // Posters exist only to cover the slow-network "black rectangle before
    // any video data" case at first load. Once a video has actually started
    // playing, drop the poster — otherwise browsers repaint it for a split
    // second on later currentTime jumps / layer swaps, which reads as a
    // random foreign frame flashing mid-swipe (reported on iPhone+Android).
    ["video-scrolling", "video-lobby-1"].forEach(id => {
        const v = document.getElementById(id);
        if (v) v.addEventListener("playing", () => v.removeAttribute("poster"), { once: true });
    });
});

let currentScreen = 1;
let screens = [];
window.__ribasMobileSwipedOnce = false;

function preloadFile(url, onProgress, attempt = 0) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';

        xhr.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = (event.loaded / event.total) * 100;
                onProgress(percent);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const blob = xhr.response;
                const blobUrl = URL.createObjectURL(blob);
                resolve(blobUrl);
            } else {
                reject(new Error(`Failed to load ${url} (Status: ${xhr.status})`));
            }
        };

        xhr.onerror = () => reject(new Error(`Network error loading ${url}`));
        xhr.send();
    }).catch(err => {
        // ponytail: 2 retries with linear backoff; no connection-quality
        // heuristics — the streaming <video> src remains the ultimate fallback
        if (attempt < 2) {
            return new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
                .then(() => preloadFile(url, onProgress, attempt + 1));
        }
        throw err;
    });
}

let forwardScrollPreloadStarted = false;
function startForwardScrollPreload() {
    if (forwardScrollPreloadStarted) return;
    forwardScrollPreloadStarted = true;

    const vScrolling = document.getElementById("video-scrolling");
    if (!vScrolling) return;

    const isMobile = window.matchMedia("(max-width: 1024px)").matches;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlowConnection = !!(conn && (conn.saveData || /(^|-)2g|3g$/.test(conn.effectiveType || "")));
    // New 60fps H.264 encodes (2026-07-17): hardware-decoded on every device.
    // Desktop gets the widescreen master, mobile the vertical cut, confirmed
    // slow connections the 480p low-bandwidth variant.
    const src = isMobile
        ? (isSlowConnection ? "video_optimized/mobile_scroll_low.mp4" : "video_optimized/mobile_scroll.mp4")
        : "video_optimized/desktop_scroll.mp4";

    console.log("Preloading forward scrolling video:", src);
    vScrolling.poster = isMobile ? "video_optimized/mobile_scroll_poster.jpg" : "video_optimized/desktop_scroll_poster.jpg";
    vScrolling.muted = true;
    vScrolling.preload = "auto";
    vScrolling.src = src;
    vScrolling.load();
    vScrolling.addEventListener("canplay", () => {
        vScrolling.muted = true;
        if (vScrolling.paused) vScrolling.play().then(() => vScrolling.pause()).catch(() => {});
    }, { once: true });

    // iOS has no navigator.connection, so a genuinely bad link can't be
    // detected up front there — instead, if the normal mobile file hasn't
    // buffered to playable within ~4s, swap down to the 480p variant.
    if (isMobile && !isSlowConnection) {
        setTimeout(() => {
            if (vScrolling.readyState < 3) {
                console.log("Scroll video slow to buffer (4s) — switching to low-bandwidth variant.");
                vScrolling.src = "video_optimized/mobile_scroll_low.mp4";
                vScrolling.load();
                window.__ribasScrollLowTier = true;
            }
        }, 4000);
    }
}

let reverseScrollPreloadStarted = false;
function startReverseScrollPreload() {
    if (reverseScrollPreloadStarted) return;
    reverseScrollPreloadStarted = true;

    const vScrollingRev = document.getElementById("video-scrolling-reverse");
    if (!vScrollingRev) return;

    const isMobile = window.matchMedia("(max-width: 1024px)").matches;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlowConnection = !!(conn && (conn.saveData || /(^|-)2g|3g$/.test(conn.effectiveType || "")));
    // Mirror of startForwardScrollPreload, incl. the 4s low-tier decision it
    // may have made (window.__ribasScrollLowTier)
    const useLow = isSlowConnection || window.__ribasScrollLowTier;
    const src = isMobile
        ? (useLow ? "video_optimized/mobile_scroll_low_reverse.mp4" : "video_optimized/mobile_scroll_reverse.mp4")
        : "video_optimized/desktop_scroll_reverse.mp4";

    console.log("Preloading reverse scrolling video:", src);
    vScrollingRev.muted = true;
    vScrollingRev.preload = "auto";
    vScrollingRev.src = src;
    vScrollingRev.load();
    vScrollingRev.addEventListener("canplay", () => {
        vScrollingRev.muted = true;
        if (vScrollingRev.paused) vScrollingRev.play().then(() => vScrollingRev.pause()).catch(() => {});
    }, { once: true });
}

let remainingAssetsLoaded = false;
function preloadRemainingAssets() {
    if (remainingAssetsLoaded) return;
    remainingAssetsLoaded = true;

    // ponytail: every other background preload in this file skips itself on
    // a confirmed slow connection (see startForwardScrollPreload etc.) — this
    // one didn't, and it's the biggest single payload (footer transition +
    // reverse, ~12MB combined). On weak mobile internet it fired 3s after
    // the preloader dismissed and ate bandwidth the in-progress scrolling
    // video needed to keep buffering, starving the exact transitions the
    // user was actively scrolling through. The footer's own .play() call in
    // transitionTo() still fetches it on demand when actually reached.
    const isMobile = window.matchMedia("(max-width: 1024px)").matches;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlowConnection = isMobile || (conn && (conn.saveData || /(^|-)2g|3g$/.test(conn.effectiveType || "")));
    if (isSlowConnection) {
        console.log("Slow connection detected: skipping eager footer/loop preload, will stream on demand instead.");
        return;
    }

    console.log("Lazy loading remaining screen loops, transitions, and footer videos...");
    screens.forEach(s => {
        if (s.transitionVideo && typeof s.transitionVideo.load === "function") {
            s.transitionVideo.preload = "auto";
            s.transitionVideo.load();
        }
        if (s.reverseVideo && typeof s.reverseVideo.load === "function") {
            s.reverseVideo.preload = "auto";
            s.reverseVideo.load();
        }
        if (s.loopVideo && !s.isDualLoop && typeof s.loopVideo.load === "function") {
            s.loopVideo.preload = "auto";
            s.loopVideo.load();
        }
    });
}


let introFadeTriggered = false;

function initPreloader() {
    const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;

    const preloader         = document.getElementById("preloader");
    const logoContainer     = document.querySelector(".preloader-logo-container");
    const logoFill          = document.querySelector(".preloader-logo.logo-fill");
    const preloaderVideo    = preloader ? preloader.querySelector("video") : null;
    const progressText      = preloader ? preloader.querySelector(".preloader-progress") : null;
    const progressContainer = preloader ? preloader.querySelector(".preloader-progress-container") : null;
    const progressBar       = preloader ? preloader.querySelector(".progress-bar") : null;
    const videoLobby1       = document.getElementById("video-lobby-1");
    const videoLobby2       = document.getElementById("video-lobby-2");
    let lobbyPreloadStarted = false;

    if (!preloader || !logoContainer || !logoFill || !preloaderVideo || !videoLobby1 || !videoLobby2) return;

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1 — BLACK PRELOADER
    //   Preloader = black overlay + logo silhouette + % counter.
    //   Intro video is buffered silently behind the overlay (opacity 0).
    //   Hero loop and scroll video also start buffering immediately.
    //   Overlay stays up until heroVideoReady + 3 s minimum → settles to 100%.
    //
    // PHASE 2 — CINEMATIC INTRO VIDEO
    //   Black overlay fades out → intro video (already buffered) is revealed.
    //   Logo fades in via plain opacity only (no clip-path fill animation).
    //   After intro ends → hero screen appears.
    // ─────────────────────────────────────────────────────────────────────────

    // ── DOM: move video OUT of preloader so they animate independently ────
    // #intro-video-container sits at z-index 49999, below #preloader (50000).
    const introContainer = document.createElement("div");
    introContainer.id = "intro-video-container";
    introContainer.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:49999;background:#000;opacity:0;pointer-events:none;";
    preloader.parentNode.insertBefore(introContainer, preloader);
    introContainer.appendChild(preloaderVideo);
    // Centered and fullscreen video coverage without shifting
    preloaderVideo.style.cssText = "position:absolute;top:50%;left:50%;width:100%;height:100%;object-fit:cover;transform:translate(-50%, -50%);";

    // ── State ─────────────────────────────────────────────────────────────
    let heroVideoReady      = false;
    let lobbyVideoBlobUrl   = null;

    // ── PHASE 1: Logo static on black screen ──────────────────────────────
    gsap.set(logoContainer, { opacity: 1, scale: 1.0 });

    // ── Logo slow pulsing animation during Phase 1 ────────────────────────
    const logoPulse = gsap.to(logoContainer, {
        scale: 1.03,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut"
    });

    // ── Safety timeout: 15 s absolute cap ────────────────────────────────
    const safetyTimeout = setTimeout(() => {
        heroVideoReady = true;
        startForwardScrollPreload();
        runDismiss();
    }, 15000);

    // ── Deterministic Loading Timeline: 0% -> 98% -> pause -> 100% ────────
    const progressObj = { val: 0 };
    const loadingTimeline = gsap.timeline({
        onComplete: runDismiss
    });

    // SVG Circumference for r=26 is 163.36
    const circumference = 163.36;

    const updateProgressBar = (val) => {
        if (progressText) progressText.textContent = `${val}%`;
        if (progressBar) {
            const offset = circumference - (val / 100) * circumference;
            progressBar.style.strokeDashoffset = offset;
        }
    };

    // 1. 0% -> 98% over 3.2 seconds
    loadingTimeline.to(progressObj, {
        val: 98,
        duration: 3.2,
        ease: "power1.out",
        onUpdate: () => {
            updateProgressBar(Math.round(progressObj.val));
        }
    });

    // 2. 98% -> 100% over 0.6 seconds, starting 1.2 seconds after the previous tween ends
    loadingTimeline.to(progressObj, {
        val: 100,
        duration: 0.6,
        ease: "power1.in",
        onUpdate: () => {
            updateProgressBar(Math.round(progressObj.val));
        }
    }, "+=1.2");

    // ── Buffer intro video immediately in background (preload only, do NOT play) ─
    preloaderVideo.src     = "preloader.mp4";
    preloaderVideo.preload = "auto";
    preloaderVideo.load();

    // ── Buffer hero loop video is deferred until runDismiss to save preloader bandwidth ──


    function runDismiss() {
        if (logoPulse) logoPulse.kill(); // Stop pulsing
        preloader.classList.add("dismissed");
        clearTimeout(safetyTimeout);

        if (window.__ribasMusic) window.__ribasMusic.start();
        
        // Start preloading the lobby/hero video now (while intro video is about to play)
        startLobbyPreload();
        
        // Delay reverse scroll and remaining assets preload to prioritize the lobby video
        setTimeout(startReverseScrollPreload, 2000);
        setTimeout(preloadRemainingAssets, 6000);

        // ① Immediately fade out progress container (so it doesn't show over intro video)
        if (progressContainer) {
            gsap.to(progressContainer, { opacity: 0, duration: 0.3 });
        }

        // ② Fade out only preloader black background (reveal intro video container behind it)
        // This keeps the logo in place and perfectly centered in preloader
        gsap.to(preloader, {
            backgroundColor: "rgba(5, 5, 5, 0)",
            duration: 1.0,
            ease: "power2.inOut"
        });

        // ③ Reveal intro video container (fades in from black)
        gsap.to(introContainer, { opacity: 1, duration: 0.8, ease: "power2.out" });

        // ④ Play intro video from the start (checking readyState and catching exceptions to prevent iOS crashes)
        if (preloaderVideo.readyState >= 1) {
            try {
                preloaderVideo.currentTime = 0;
            } catch (e) {
                console.warn("Failed to set preloaderVideo.currentTime:", e);
            }
        }
        preloaderVideo.play().then(() => {
            // Fade out logo, then fade it back in slowly over the clouds video
            gsap.to(logoContainer, {
                opacity: 0,
                duration: 0.4,
                onComplete: () => {
                    gsap.set(logoContainer, { scale: 1.0, filter: "none" });
                    gsap.to(logoContainer, { opacity: 1, duration: 2.6, ease: "power2.out" });
                    
                    // Gradually scale up the logo by 15% (to 1.15) over the course of the intro video (~3.6s remaining)
                    gsap.to(logoContainer, {
                        scale: 1.15,
                        duration: 3.6,
                        ease: "sine.out"
                    });
                }
            });

            // ⑤ Intro ends → fade out both preloader (with logo) and intro video
            let heroShown = false;
            function onIntroEnd() {
                if (heroShown) return;
                heroShown = true;
                gsap.to([preloader, introContainer], {
                    opacity: 0,
                    duration: 0.8,
                    ease: "power2.inOut",
                    onComplete: () => {
                        preloader.style.display = "none";
                        if (introContainer.parentNode) introContainer.remove();
                    }
                });
                showHeroScreen();
            }
            preloaderVideo.addEventListener("ended", onIntroEnd, { once: true });
            setTimeout(onIntroEnd, 35000); // generous safety net

        }).catch(() => {
            // Autoplay blocked (strict incognito) → skip intro, go straight to hero
            gsap.to(introContainer, { opacity: 0, duration: 0.4, onComplete: () => introContainer.remove() });
            showHeroScreen();
        });
    }

    function showHeroScreen() {
        gsap.set("#screen-1", { display: "block", opacity: 0 });

        // Ensure lobby background video plays immediately when hero screen is revealed
        const vLobby1 = document.getElementById("video-lobby-1");
        if (vLobby1) {
            vLobby1.muted = true;
            vLobby1.playbackRate = 1.0;
            if (vLobby1.paused) {
                vLobby1.play().catch(e => console.log("Lobby video autoplay blocked in showHeroScreen:", e));
            }
        }

        let siteActivated = false;
        const activateSite = () => {
            if (siteActivated) return;
            siteActivated = true;
            initTransitionTrigger();
            const pillowTab = document.getElementById("floating-pillow-tab");
            if (pillowTab) pillowTab.classList.add("is-visible");
        };
        gsap.to("#screen-1", { opacity: 1, duration: 1.2, delay: 0.1, ease: "power2.out", onComplete: activateSite });
        setTimeout(activateSite, 2000);
        animateWelcomeScreenEntrance();
    }

    // ── Hero loop preload ─────────────────────────────────────────────────
    function startLobbyPreload() {
        if (lobbyPreloadStarted) return;
        lobbyPreloadStarted = true;

        const conn             = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const isSlowConnection = !!(conn && (conn.saveData || /(^|-)2g|3g$/.test(conn.effectiveType || "")));

        // Direct streaming is much safer and completely standard, avoiding XHR race conditions
        // Mobile: the new dedicated vertical hero (2.2MB H.264 60fps) — small
        // enough to serve on any connection tier. Desktop keeps its webm.
        const heroSrc = isMobileOrTablet
            ? "video_optimized/mob_hero.mp4"
            : "1 screen.mp4";

        if (isMobileOrTablet) {
            videoLobby1.poster = "video_optimized/mob_hero_poster.jpg";
        }

        console.log("Preloading lobby video:", heroSrc);
        videoLobby1.muted = true;
        videoLobby2.muted = true;
        videoLobby1.src   = heroSrc;
        videoLobby2.src   = heroSrc;
        initLobbySeamlessLoop();

        const markHeroReady = () => {
            if (heroVideoReady) return;
            heroVideoReady = true;
            startForwardScrollPreload();
        };

        if (videoLobby1.readyState >= 4) {
            markHeroReady();
        } else {
            videoLobby1.addEventListener("canplaythrough", markHeroReady, { once: true });
        }

        // Safety timeout
        setTimeout(markHeroReady, 4000);
    }
}


function initLobbySeamlessLoop() {
    const v1 = document.getElementById("video-lobby-1");
    const v2 = document.getElementById("video-lobby-2");
    if (!v1 || !v2) return;

    // Explicitly set muted true in JS to bypass chrome/safari autoplay policy
    v1.muted = true;
    v2.muted = true;
    v1.load();
    v2.load();
    v1.playbackRate = 1.0;
    v2.playbackRate = 1.0;

    // Try playing video 1 immediately
    const startPlay = () => {
        v1.muted = true;
        v1.playbackRate = 1.0;
        v1.play()
            .then(() => {
                console.log("Lobby Video 1 playing successfully.");
                removePlayFallbacks();
            })
            .catch(e => {
                console.log("Lobby Video 1 autoplay blocked, waiting for interaction:", e);
            });
    };

    const removePlayFallbacks = () => {
        document.removeEventListener("click", startPlay);
        document.removeEventListener("touchstart", startPlay);
        document.removeEventListener("wheel", startPlay);
    };

    // Add fallbacks for user interaction to bypass autoplay restrictions
    document.addEventListener("click", startPlay);
    document.addEventListener("touchstart", startPlay);
    document.addEventListener("wheel", startPlay);

    // Initial attempt
    startPlay();

    let activeVideo = v1;
    let inactiveVideo = v2;
    let isTransitioning = false;

    function checkTime() {
        if (!activeVideo.paused && activeVideo.duration) {
            const timeLeft = activeVideo.duration - activeVideo.currentTime;

            // Trigger crossfade 0.5 seconds before the video ends
            if (timeLeft <= 0.5 && !isTransitioning) {
                isTransitioning = true;

                // Prepare and play the inactive video from the beginning
                inactiveVideo.currentTime = 0;
                inactiveVideo.muted = true;
                inactiveVideo.playbackRate = 1.0;
                inactiveVideo.play().then(() => {
                    // Seamless crossfade opacities
                    gsap.to(inactiveVideo, { opacity: 1, duration: 0.4, ease: "none" });
                    gsap.to(activeVideo, {
                        opacity: 0,
                        duration: 0.4,
                        ease: "none",
                        onComplete: () => {
                            activeVideo.pause();
                            
                            // Swap active/inactive video references
                            const temp = activeVideo;
                            activeVideo = inactiveVideo;
                            inactiveVideo = temp;
                            
                            isTransitioning = false;
                        }
                    });
                }).catch(err => {
                    console.log("Failed to transition play seamlessly:", err);
                    isTransitioning = false;
                });
            }
        }
        requestAnimationFrame(checkTime);
    }

    requestAnimationFrame(checkTime);
}

function initTransitionTrigger() {
    currentScreen = 1; // 1 = Lobby, 2 = Restaurant, 3 = SPA, 4 = Leisure, 5 = Info, 6 = Footer
    let isTransitioning = false;
    let touchTriggered = false;
    let touchIsScrollingContent = false;

    const safeSeek = (video, time) => {
        if (!video) return;
        if (Math.abs(video.currentTime - time) > 0.05) {
            video.currentTime = time;
        }
    };

    // Elements mapping
    screens = [
        {
            id: 1,
            el: document.getElementById("screen-1"),
            loopVideo: [document.getElementById("video-lobby-1"), document.getElementById("video-lobby-2")],
            isDualLoop: true
        },
        {
            id: 2,
            el: document.getElementById("screen-2"),
            loopVideo: null
        },
        {
            id: 3,
            el: document.getElementById("screen-3"),
            loopVideo: null
        },
        {
            id: 4,
            el: document.getElementById("screen-4"),
            loopVideo: null
        },
        {
            id: 5,
            el: document.getElementById("screen-5"),
            loopVideo: null
        },
        {
            id: 6,
            el: document.getElementById("screen-footer"),
            transitionVideo: document.getElementById("video-transition-footer"),
            loopVideo: document.getElementById("video-footer-loop"),
            slideTransition: true
        }
    ];

    const flashOverlay = document.querySelector(".transition-flash-overlay");
    const v1 = document.getElementById("video-lobby-1");
    const v2 = document.getElementById("video-lobby-2");

    const scrollingVideo = document.getElementById("video-scrolling");
    const scrollingVideoReverse = document.getElementById("video-scrolling-reverse");
    const sharedVideoBg = document.getElementById("shared-video-bg");

    // New 60fps scroll video (2026-07-17), duration 7.918s. Pause points per
    // the owner's edit timeline (identical for desktop & mobile — same edit,
    // different framing). The last pause sits 0.45s before the physical end
    // (static hold frame), so no end-of-clip black-frame margin is needed.
    const SCROLL_VIDEO_DURATION = 7.918;
    const screenTimestamps = {
        1: 0.0,
        2: 2.05,
        3: 3.4667,
        4: 5.20,
        5: 7.4667
    };

    // Reverse clip mirrors the forward one: rev = DURATION - fwd.
    // rev[1] would be 7.918 = the exact physical end, which tips <video>
    // into "ended" and paints black on some decoders — and browsers report
    // the container duration as low as 7.883, so 7.80 keeps a real margin.
    const screenTimestampsReverse = {
        1: 7.80,
        2: SCROLL_VIDEO_DURATION - screenTimestamps[2], // 5.868
        3: SCROLL_VIDEO_DURATION - screenTimestamps[3], // 4.4513
        4: SCROLL_VIDEO_DURATION - screenTimestamps[4], // 2.718
        5: SCROLL_VIDEO_DURATION - screenTimestamps[5]  // 0.4513
    };

    if (!flashOverlay) return;

    // Screens loops and transitions are preloaded lazily via preloadRemainingAssets() 3 seconds after dismissPreloader.



    // Scroll listeners
    window.addEventListener("wheel", handleScroll, { passive: false });
    window.addEventListener("touchmove", handleScroll, { passive: false });

    // Expose add/remove helpers so the mobile menu can pause scroll capture
    // while it is open — this is the ONLY reliable way to unblock iOS Safari
    // native scrolling inside a fixed overlay (passive:false on window freezes
    // all child element scrolling regardless of stopPropagation).
    window.__ribasEnableTouchScroll  = () => {
        window.removeEventListener("touchmove", handleScroll);
        window.removeEventListener("touchmove", handleScroll, { passive: false });
        window.removeEventListener("touchmove", handleScroll, true);
        window.removeEventListener("touchmove", handleScroll, false);
        window.addEventListener("touchmove", handleScroll, { passive: false });
    };
    window.__ribasDisableTouchScroll = () => {
        window.removeEventListener("touchmove", handleScroll);
        window.removeEventListener("touchmove", handleScroll, { passive: false });
        window.removeEventListener("touchmove", handleScroll, true);
        window.removeEventListener("touchmove", handleScroll, false);
    };

    // Vertical Navigation Ribbon Controls
    const ribbonItems = document.querySelectorAll(".ribbon-item");
    const ribbonProgress = document.querySelector(".ribbon-line-progress");
    
    ribbonItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetScreen = parseInt(item.getAttribute("data-screen"));
            if (targetScreen !== currentScreen && !isTransitioning) {
                transitionTo(targetScreen);
            }
        });
    });

    function updateRibbonState(screenIndex) {
        ribbonItems.forEach(item => {
            const s = parseInt(item.getAttribute("data-screen"));
            if (s === screenIndex) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
        if (ribbonProgress) {
            // Screen 1 is 16.6%, Screen 6 is 100%
            const pct = (screenIndex / 6) * 100;
            ribbonProgress.style.height = `${pct}%`;
        }
        if (backTopBtn) backTopBtn.classList.toggle("is-visible", screenIndex > 1);
    }

    // ── Back-to-top: instant teleport to the hero, no scroll-through ──
    const backTopBtn = document.getElementById("back-to-top-btn");

    // Bumped on every teleport; an in-flight transition captures its value
    // at start and its finalize step aborts if a teleport happened meanwhile
    // (otherwise the stale finalize would overwrite currentScreen and
    // re-enable pointer events on a screen the teleport just hid).
    let transitionEpoch = 0;

    function teleportHome() {
        // Deliberately NOT gated on isTransitioning: if a transition stalls
        // on a slow phone, this button is exactly the escape hatch — it
        // force-resets the whole stack to the hero.
        if (currentScreen === 1 && !isTransitioning) return;
        transitionEpoch++;
        isTransitioning = true;

        // Kill any in-flight video-seek watchdog loops
        if (scrollingVideo._seekAnimationFrame) cancelAnimationFrame(scrollingVideo._seekAnimationFrame);
        if (scrollingVideoReverse._seekAnimationFrame) cancelAnimationFrame(scrollingVideoReverse._seekAnimationFrame);
        scrollingVideo._seekAnimationFrame = null;
        scrollingVideoReverse._seekAnimationFrame = null;

        // Instantly drop every non-hero screen out of the stack
        screens.forEach(s => {
            if (s.id === 1) return;
            gsap.set(s.el, { opacity: 0, display: "none", y: 0 });
            s.el.style.pointerEvents = "none";
            s.el.style.zIndex = "";
        });

        // Park the shared scrolling video back at frame 0, hidden
        scrollingVideo.pause();
        scrollingVideoReverse.pause();
        scrollingVideo.currentTime = 0;
        scrollingVideoReverse.currentTime = screenTimestampsReverse[1];
        sharedVideoBg.style.display = "none";
        sharedVideoBg.style.opacity = "0";

        // Footer has its own opaque videos — make sure they stop
        const footerScreen = screens[5];
        if (footerScreen.transitionVideo) footerScreen.transitionVideo.pause();
        if (footerScreen.loopVideo) footerScreen.loopVideo.pause();

        // Show the hero and restart its loop
        const hero = screens[0];
        gsap.set(hero.el, { display: "block", opacity: 1 });
        hero.el.style.pointerEvents = "auto";
        hero.el.style.zIndex = "";
        gsap.set(v1, { opacity: 1 });
        gsap.set(v2, { opacity: 0 });
        v2.pause();
        v1.currentTime = 0;
        v1.playbackRate = 1.0;
        v1.play().catch(() => {});

        currentScreen = 1;
        updateRibbonState(1);
        animateScreenEntrance(hero.el);
        document.body.style.overflow = "auto";
        isTransitioning = false;
    }

    if (backTopBtn) backTopBtn.addEventListener("click", teleportHome);
    window.__ribasTeleport = teleportHome;

    // Safety net: on some real mobile devices/browsers the inner content
    // scroll (below) never actually advances scrollTop for reasons we can't
    // reproduce or diagnose remotely (momentum scroll skipping touchmove,
    // dynamic viewport-height changes as the address bar collapses, etc.) —
    // when that happens the "wait for internal scroll" gate never opens and
    // the user is stuck on that screen forever. After a couple of full swipe
    // gestures that got blocked without ever completing, stop trusting the
    // scroll-position heuristic and just let the screen transition through.
    let blockedSwipeStreak = 0;
    let gestureWasBlocked = false;

    function handleScroll(e) {
        // Prevent background transitions/scrolling when the mobile menu is open
        const mobileMenu = document.getElementById("mobile-menu-overlay");
        if (mobileMenu && mobileMenu.classList.contains("is-open")) {
            return;
        }

        if (isTransitioning) return;

        const isTouchEvent = e.touches && e.touches.length > 0;
        const activeContent = screens[currentScreen - 1] ? screens[currentScreen - 1].el.querySelector(".screen-content") : null;

        // ── MOBILE TOUCH GESTURE PATH ──
        if (isTouchEvent) {
            if (touchTriggered) return;

            const touchDeltaY = window.touchStartY - e.touches[0].clientY; // Positive = swiping up = scrolling down
            const touchDeltaX = window.touchStartX - e.touches[0].clientX;

            // Ignore horizontal swipes
            if (Math.abs(touchDeltaX) > Math.abs(touchDeltaY)) {
                return;
            }

            const touchDelta = window.lastTouchY - e.touches[0].clientY; // Incremental Y displacement
            window.lastTouchY = e.touches[0].clientY; // update Y coordinate for next frame increment

            const isSwipeUp = touchDeltaY > 0; // finger moved up = scroll down / next screen intent
            const isSwipeDown = touchDeltaY < 0; // finger moved down = scroll up / prev screen intent

            if (activeContent && activeContent.scrollHeight > activeContent.clientHeight + 10 && blockedSwipeStreak < 2) {
                const atTop = activeContent.scrollTop <= 3;
                const atBottom = activeContent.scrollTop + activeContent.clientHeight >= activeContent.scrollHeight - 3;

                // Drive internal content scrolling manually (crucial for iOS WebKit fixed viewport layout)
                if (isSwipeUp && !atBottom) {
                    e.preventDefault();
                    activeContent.scrollTop += touchDelta;
                    touchIsScrollingContent = true;
                    return;
                }
                if (isSwipeDown && !atTop) {
                    e.preventDefault();
                    activeContent.scrollTop += touchDelta;
                    touchIsScrollingContent = true;
                    return;
                }

                // Block transition if they scrolled content in this gesture
                if (touchIsScrollingContent) {
                    e.preventDefault();
                    gestureWasBlocked = true;
                    return;
                }
            }

            // We are at a boundary (or the card is not scrollable) and transition is allowed.
            const swipeThreshold = 55; // minimum swipe distance of 55px to trigger transition

            if (isSwipeUp && currentScreen < 6) {
                if (Math.abs(touchDeltaY) < swipeThreshold) {
                    e.preventDefault();
                    gestureWasBlocked = true;
                    return;
                }
                e.preventDefault();
                touchTriggered = true;
                blockedSwipeStreak = 0;
                transitionTo(currentScreen + 1);
            } else if (isSwipeDown && currentScreen > 1) {
                if (Math.abs(touchDeltaY) < swipeThreshold) {
                    e.preventDefault();
                    gestureWasBlocked = true;
                    return;
                }
                e.preventDefault();
                touchTriggered = true;
                blockedSwipeStreak = 0;
                transitionTo(currentScreen - 1);
            }
            return;
        }

        // ── DESKTOP MOUSE WHEEL PATH ──
        const deltaY = e.deltaY;
        const isScrollDown = deltaY > 0;
        const isScrollUp = deltaY < 0;

        if (activeContent && activeContent.scrollHeight > activeContent.clientHeight + 40 && blockedSwipeStreak < 2) {
            const atTop = activeContent.scrollTop <= 5;
            const atBottom = activeContent.scrollTop + activeContent.clientHeight >= activeContent.scrollHeight - 5;

            if ((isScrollDown && !atBottom) || (isScrollUp && !atTop)) {
                e.preventDefault();
                gestureWasBlocked = true;

                // Premium smooth scrolling for mouse wheel on desktop
                if (activeContent._targetScrollTop === undefined || Math.abs(activeContent._targetScrollTop - activeContent.scrollTop) > 5) {
                    activeContent._targetScrollTop = activeContent.scrollTop;
                }
                let targetVal = activeContent._targetScrollTop + deltaY;
                const maxScroll = activeContent.scrollHeight - activeContent.clientHeight;
                targetVal = Math.max(0, Math.min(maxScroll, targetVal));
                activeContent._targetScrollTop = targetVal;

                gsap.to(activeContent, {
                    scrollTop: targetVal,
                    duration: 0.5,
                    ease: "power2.out",
                    overwrite: "auto"
                });
                return;
            }
        }

        if (isScrollDown && currentScreen < 6) {
            e.preventDefault();
            blockedSwipeStreak = 0;
            transitionTo(currentScreen + 1);
        } else if (isScrollUp && currentScreen > 1) {
            e.preventDefault();
            blockedSwipeStreak = 0;
            transitionTo(currentScreen - 1);
        }
    }

    window.addEventListener("touchstart", (e) => {
        // Prevent background tracking if mobile menu is open
        const mobileMenu = document.getElementById("mobile-menu-overlay");
        if (mobileMenu && mobileMenu.classList.contains("is-open")) return;

        const activeContent = screens[currentScreen - 1] ? screens[currentScreen - 1].el.querySelector(".screen-content") : null;

        // A gesture that ends (next touchstart fires) without ever completing
        // a transition counts toward the streak that eventually forces one through.
        // We only increment the blocked streak if the gesture was blocked AND
        // the user did not actually scroll the content (i.e. they are trying to transition but stuck).
        if (gestureWasBlocked) {
            const scrolledDistance = (activeContent && window.touchStartScrollTop !== undefined)
                ? Math.abs(activeContent.scrollTop - window.touchStartScrollTop)
                : 0;
            if (scrolledDistance < 5) {
                blockedSwipeStreak++;
            } else {
                blockedSwipeStreak = 0;
            }
        } else {
            blockedSwipeStreak = 0;
        }
        gestureWasBlocked = false;

        window.lastTouchY = e.touches[0].clientY;
        window.touchStartY = e.touches[0].clientY; // Save start position to calculate swipe distance
        window.touchStartX = e.touches[0].clientX; // Save start X position to check swipe direction
        if (activeContent) {
            window.touchStartScrollTop = activeContent.scrollTop;
        } else {
            window.touchStartScrollTop = 0;
        }
        touchTriggered = false;
        touchIsScrollingContent = false;
    }, { passive: true });

    // (kept for reference; actual timing math uses SCROLL_VIDEO_DURATION above)
    const videoDuration = SCROLL_VIDEO_DURATION;

    function animateVideoTime(nextScreenIndex, onComplete) {
        const targetTime = screenTimestamps[nextScreenIndex];
        const targetTimeReverse = screenTimestampsReverse[nextScreenIndex];
        const currentForwardTime = scrollingVideo.currentTime;
        const isForward = targetTime > currentForwardTime;
        const timeDiff = Math.abs(targetTime - currentForwardTime);

        if (timeDiff < 0.02) {
            scrollingVideo.pause();
            scrollingVideoReverse.pause();
            scrollingVideo.currentTime = targetTime;
            scrollingVideoReverse.currentTime = targetTimeReverse;
            scrollingVideo.style.opacity = "1";
            scrollingVideoReverse.style.opacity = "0";
            if (onComplete) onComplete();
            return;
        }

        // Cancel any pending checkTime loops
        if (scrollingVideo._seekAnimationFrame) cancelAnimationFrame(scrollingVideo._seekAnimationFrame);
        if (scrollingVideoReverse._seekAnimationFrame) cancelAnimationFrame(scrollingVideoReverse._seekAnimationFrame);
        scrollingVideo._seekAnimationFrame = null;
        scrollingVideoReverse._seekAnimationFrame = null;

        const swapLayers = (showEl, hideEl, then) => {
            requestAnimationFrame(() => {
                showEl.style.opacity = "1";
                hideEl.style.opacity = "0";
                hideEl.pause();
                if (then) then();
            });
        };

        // ponytail: one watchdog for both directions instead of two duplicated
        // rAF loops. On a slow/roaming mobile connection the browser can stall
        // mid-buffer without ever rejecting play() — currentTime just stops
        // advancing and the old per-branch loops spun forever with
        // isTransitioning stuck true (the reported freeze/black-screen on
        // first swipe). STALL_MS of no progress force-completes the seek.
        //
        // On a genuinely slow/roaming connection, buffering the next chunk of
        // video can legitimately take several seconds — a fixed 1200ms budget
        // gave up on real (still-progressing) buffering, forced an instant
        // seek to an unbuffered timestamp, and revealed a frozen/black frame
        // right as the entrance animation was already bringing the new
        // screen's content in on top of it (content advancing over dead
        // video). Give slow connections a much longer real chance to finish
        // buffering before falling back.
        const isMobile = window.matchMedia("(max-width: 1024px)").matches;
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const isSlowConnection = isMobile || (conn && (conn.saveData || /(^|-)2g|3g$/.test(conn.effectiveType || "")));
        const STALL_MS = isSlowConnection ? 6000 : 1200;

        // play() itself can sit pending forever on some mobile browsers when
        // buffering never starts (bad roaming handoff) — race it against the
        // same stall budget so the .catch() fallback below always fires.
        const playSafely = (video) => Promise.race([
            video.play(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("play() timed out")), STALL_MS))
        ]);

        const seekToTarget = (video, target, done) => {
            let lastTime = video.currentTime;
            let lastProgressAt = performance.now();
            const tick = () => {
                const now = performance.now();
                if (video.currentTime > lastTime) {
                    lastTime = video.currentTime;
                    lastProgressAt = now;
                }
                const arrived = video.currentTime >= target - 0.02;
                const stalled = now - lastProgressAt > STALL_MS;
                if (arrived || stalled) {
                    video.pause();
                    video.currentTime = target;
                    video._seekAnimationFrame = null;
                    done();
                } else {
                    video._seekAnimationFrame = requestAnimationFrame(tick);
                }
            };
            video._seekAnimationFrame = requestAnimationFrame(tick);
        };

        if (isForward) {
            const targetTimeForward = targetTime;

            // Pre-seek reverse video in the background while forward plays
            scrollingVideoReverse.currentTime = targetTimeReverse;

            scrollingVideo.playbackRate = 1.0;
            playSafely(scrollingVideo).then(() => {
                swapLayers(scrollingVideo, scrollingVideoReverse);
                seekToTarget(scrollingVideo, targetTimeForward, () => onComplete && onComplete());
            }).catch(err => {
                console.log("Native forward play failed, seeking instantly:", err);
                swapLayers(scrollingVideo, scrollingVideoReverse);
                scrollingVideo.currentTime = targetTimeForward;
                if (onComplete) onComplete();
            });
        } else {
            scrollingVideoReverse.playbackRate = 1.0;
            playSafely(scrollingVideoReverse).then(() => {
                swapLayers(scrollingVideoReverse, scrollingVideo);
                seekToTarget(scrollingVideoReverse, targetTimeReverse, () => {
                    // Start seeking the forward video to the corresponding frame.
                    // Keep the reverse video visible (opacity 1) during the seek.
                    scrollingVideo.currentTime = targetTime;
                    
                    const completeSwap = () => {
                        scrollingVideo.style.opacity = "1";
                        scrollingVideoReverse.style.opacity = "0";
                        if (onComplete) onComplete();
                    };

                    if (scrollingVideo.seeking) {
                        let hasSwapped = false;
                        const onSeeked = () => {
                            if (hasSwapped) return;
                            hasSwapped = true;
                            scrollingVideo.removeEventListener("seeked", onSeeked);
                            completeSwap();
                        };
                        scrollingVideo.addEventListener("seeked", onSeeked);
                        setTimeout(onSeeked, 300); // safety fallback timeout
                    } else {
                        completeSwap();
                    }
                });
            }).catch(err => {
                console.log("Native reverse play failed, seeking instantly:", err);
                scrollingVideo.currentTime = targetTime;
                scrollingVideoReverse.currentTime = targetTimeReverse;
                scrollingVideo.style.opacity = "1";
                scrollingVideoReverse.style.opacity = "0";
                scrollingVideoReverse.pause();
                if (onComplete) onComplete();
            });
        }
    }

    function transitionTo(nextScreenIndex) {
        if (nextScreenIndex === currentScreen || isTransitioning) return;
        isTransitioning = true;
        
        let skipEntranceInFinalize = false;
        
        // Sync vertical navigation ribbon state instantly
        updateRibbonState(nextScreenIndex);

        const fromScreen = screens[currentScreen - 1];
        const toScreen = screens[nextScreenIndex - 1];

        console.log(`Transitioning: Screen ${currentScreen} -> Screen ${nextScreenIndex}`);
        document.body.style.overflow = "hidden";

        // If a teleport-home fires mid-transition, this finalize is stale —
        // it must not overwrite the state the teleport just set
        const myEpoch = transitionEpoch;

        const finalizeTransition = () => {
            if (myEpoch !== transitionEpoch) return;
            // Hide the old screen container if it's not the current active screen
            if (fromScreen.id !== nextScreenIndex) {
                gsap.set(fromScreen.el, { opacity: 0, display: "none" });
                fromScreen.el.style.pointerEvents = "none";
                fromScreen.el.style.zIndex = ""; // restore its normal z-index for next time
            }

            if (!skipEntranceInFinalize) {
                animateScreenEntrance(toScreen.el);
            }
            isTransitioning = false;
            currentScreen = nextScreenIndex;
            document.body.style.overflow = "auto";
            toScreen.el.style.pointerEvents = "auto";
        };

        // ── SLIDE TRANSITION (Footer sliding up or down) ──
        if (toScreen.slideTransition) {
            // ── SLIDE FOOTER UP ──
            const toContent = toScreen.el.querySelector(".screen-content");
            const toHeader = toScreen.el.querySelector(".main-header");
            if (toContent) gsap.set(toContent, { opacity: 0 });
            if (toHeader) gsap.set(toHeader, { opacity: 0 });

            toScreen.el.style.display = "block";
            gsap.set(toScreen.el, { y: "100vh", opacity: 1 });

            animateScreenExit(fromScreen.el);

            if (toScreen.loopVideo) {
                gsap.set(toScreen.loopVideo, { opacity: 0 });
            }
            if (toScreen.transitionVideo) {
                toScreen.transitionVideo.currentTime = 0;
                toScreen.transitionVideo.playbackRate = 1.0;
                toScreen.transitionVideo.play().catch(() => {});
            }

            gsap.to(toScreen.el, {
                y: 0,
                duration: 1.0,
                ease: "power3.inOut",
                onComplete: () => {
                    gsap.set(fromScreen.el, { display: "none", opacity: 0 });
                    const destLoop = toScreen.loopVideo;
                    if (destLoop && toScreen.transitionVideo) {
                        destLoop.currentTime = 0;
                        destLoop.playbackRate = 1.0;
                        destLoop.play().then(() => {
                            gsap.set(destLoop, { opacity: 1 });
                            gsap.set(toScreen.transitionVideo, { opacity: 0 });
                            toScreen.transitionVideo.pause();
                        }).catch(err => console.log("Footer loop play failed:", err));
                    }
                    finalizeTransition();
                }
            });
            return;
        }

        if (fromScreen.slideTransition) {
            // ── SLIDE FOOTER DOWN (returning to Screen 5) ──
            animateScreenExit(fromScreen.el);

            // Hide incoming screen content at start BEFORE setting container display
            const toContent = toScreen.el.querySelector(".screen-content");
            const toHeader = toScreen.el.querySelector(".main-header");
            const overlay = toScreen.el.querySelector(".screen-overlay");
            if (toContent) gsap.set(toContent, { opacity: 0 });
            if (toHeader) gsap.set(toHeader, { opacity: 0 });
            if (overlay) {
                const isHeroOrFooter = toScreen.el.id === "screen-1" || toScreen.el.id === "screen-footer";
                if (isHeroOrFooter) {
                    gsap.set(overlay, { opacity: 1 });
                } else {
                    gsap.set(overlay, { opacity: 0 });
                }
            }

            gsap.set(toScreen.el, { display: "block", opacity: 1 });
            gsap.set(sharedVideoBg, { display: "block", opacity: 1 });

            scrollingVideo.pause();
            scrollingVideoReverse.pause();
            safeSeek(scrollingVideo, screenTimestamps[5]);
            safeSeek(scrollingVideoReverse, screenTimestampsReverse[5]);
            // Make sure the forward layer (holding the screen-5 frame) is the
            // visible one — the reverse copy may still sit on top after an
            // earlier upward transition
            scrollingVideo.style.opacity = "1";
            scrollingVideoReverse.style.opacity = "0";

            // Let finalizeTransition trigger the entrance on complete
            skipEntranceInFinalize = false;

            gsap.to(fromScreen.el, {
                y: "100vh",
                duration: 1.0,
                ease: "power3.inOut",
                onComplete: () => {
                    fromScreen.el.style.display = "none";
                    gsap.set(fromScreen.el, { y: "100vh" });
                    if (fromScreen.transitionVideo) gsap.set(fromScreen.transitionVideo, { opacity: 1 });
                    if (fromScreen.loopVideo) gsap.set(fromScreen.loopVideo, { opacity: 0 });
                    finalizeTransition();
                }
            });
            return;
        }

        // ── SCROLLING VIDEO TRANSITIONS (Screens 1 to 5) ──
        const targetTime = screenTimestamps[nextScreenIndex];

        // Screens 2-5 are transparent windows onto the single shared video
        // (z-index 5, sits behind every .screen). Screen 1 and the footer
        // carry their own opaque video instead. Both fromScreen and toScreen
        // stay display:block for the whole transition, and with everyone at
        // the same z-index the browser only falls back to DOM order — so
        // whichever opaque screen was left behind could paint through toScreen's
        // still-transparent overlay/content, read as "the dark hero blinking
        // through" or "another screen flashing" mid-scroll. Pinning fromScreen
        // under the shared video for the duration removes it from the stack
        // entirely instead of relying on timing; finalizeTransition restores it.
        // Screen 1 (hero) is the only OPAQUE screen this branch ever sees on
        // either side (2-5 are all transparent to the same shared video, so
        // stacking never matters between them). Two symmetric cases:
        //  - hero is fromScreen (e.g. 1→2): it must sink below the shared
        //    video immediately, or its permanently-dark overlay paints
        //    through toScreen's still-transparent gaps.
        //  - hero is toScreen (e.g. 2→1, scrolling back up): resetting it to
        //    the same default z-index as fromScreen isn't enough — with
        //    fromScreen kept on top for its 0.5s exit fade (below) and later
        //    in DOM order, fromScreen would win the tie and sit OVER the
        //    already-dark hero for that whole window, read as "a flash of
        //    the other screen" right as the reverse scroll starts. Hero must
        //    explicitly outrank fromScreen from frame one when it's arriving.
        if (toScreen.el.id === "screen-1") {
            toScreen.el.style.zIndex = "11";
        } else {
            toScreen.el.style.zIndex = "";
        }

        if (fromScreen.el.id === "screen-1") {
            fromScreen.el.style.zIndex = "1";
        } else {
            // Keep the outgoing screen on top during its exit fade-out (0.5s), then push it down
            setTimeout(() => {
                if (isTransitioning) {
                    fromScreen.el.style.zIndex = "1";
                }
            }, 500);
        }

        // Hide incoming content at start BEFORE setting container display
        const toContent = toScreen.el.querySelector(".screen-content");
        const toHeader = toScreen.el.querySelector(".main-header");
        const overlay = toScreen.el.querySelector(".screen-overlay");
        if (toContent) gsap.set(toContent, { opacity: 0 });
        if (toHeader) gsap.set(toHeader, { opacity: 0 });
        if (overlay) {
            const isHeroOrFooter = toScreen.el.id === "screen-1" || toScreen.el.id === "screen-footer";
            if (isHeroOrFooter) {
                gsap.set(overlay, { opacity: 1 });
            } else {
                gsap.set(overlay, { opacity: 0 });
            }
        }

        // Hide incoming content at start; entrance animation runs in finalizeTransition when video pauses.
        skipEntranceInFinalize = false;
        gsap.set(toScreen.el, { display: "block", opacity: 1 });

        animateScreenExit(fromScreen.el);

        // Departure sequencing (owner spec): text fades out (0.3s), then the
        // overlay (0.25s, overlapping) — the video may only start moving once
        // both are gone. EXIT_HOLD_MS delays every scrub start accordingly.
        // setTimeout (not gsap.delayedCall) so a starved rAF ticker can't
        // freeze the transition; the epoch check makes the delayed start a
        // no-op if a teleport-home fired during the hold.
        const EXIT_HOLD_MS = 500;

        if (nextScreenIndex === 1) {
            // Transitioning back to screen 1 (Lobby)
            scrollingVideo.pause();
            scrollingVideoReverse.pause();
            setTimeout(() => { if (myEpoch !== transitionEpoch) return;
            animateVideoTime(1, () => {
                const lobbyVideo = v1;
                gsap.set(v2, { opacity: 0 });
                v2.pause();

                lobbyVideo.currentTime = 0;
                lobbyVideo.playbackRate = 1.0;

                const doCrossfade = () => {
                    gsap.to(sharedVideoBg, {
                        opacity: 0,
                        duration: 0.4,
                        ease: "power1.inOut",
                        onComplete: () => {
                            sharedVideoBg.style.display = "none";
                        }
                    });
                    gsap.to(lobbyVideo, { 
                        opacity: 1, 
                        duration: 0.4, 
                        ease: "power1.inOut" 
                    });
                    finalizeTransition();
                };

                lobbyVideo.play().then(() => {
                    doCrossfade();
                }).catch(() => {
                    gsap.set(lobbyVideo, { opacity: 1 });
                    doCrossfade();
                });
            });
            }, EXIT_HOLD_MS);
        } else if (currentScreen === 1) {
            // Transitioning from screen 1 to screen 2+
            window.__ribasMobileSwipedOnce = true;
            gsap.to(".scroll-indicator-mobile", { opacity: 0, duration: 0.35, ease: "power2.inOut" });
            const lobbyVideo = v2.style.opacity === "1" ? v2 : v1;

            // Make sure the scrolling video is parked at frame 0
            scrollingVideo.pause();
            scrollingVideoReverse.pause();
            safeSeek(scrollingVideo, 0.0);
            safeSeek(scrollingVideoReverse, screenTimestampsReverse[1]);

            // Hide the scrolling video layers themselves before the shared
            // container is revealed — their own opacity can be left over from
            // an earlier visit, and revealing an opaque container around an
            // already-visible layer flashes its static frame 0 for an instant.
            // animateVideoTime's swapLayers fades the right layer back in once
            // playback has actually started.
            scrollingVideo.style.opacity = "0";
            scrollingVideoReverse.style.opacity = "0";

            // Hero text exits first (EXIT_HOLD_MS), then the ~0.4s video
            // crossfade: shared bg revealed under the still-playing lobby
            // video, which fades out on top while the scroll video starts.
            setTimeout(() => {
                if (myEpoch !== transitionEpoch) return;

                sharedVideoBg.style.transition = "";
                sharedVideoBg.style.display = "block";
                sharedVideoBg.offsetHeight;
                sharedVideoBg.style.opacity = "1";

                gsap.to(lobbyVideo, {
                    opacity: 0,
                    duration: 0.5,
                    ease: "power1.inOut",
                    onComplete: () => {
                        lobbyVideo.pause();
                    }
                });

                animateVideoTime(nextScreenIndex, () => {
                    finalizeTransition();
                });
            }, EXIT_HOLD_MS);
        } else {
            // Transitioning between screens 2, 3, 4, 5
            setTimeout(() => {
                if (myEpoch !== transitionEpoch) return;
                sharedVideoBg.style.display = "block";
                sharedVideoBg.style.opacity = "1";
                scrollingVideo.pause();
                scrollingVideoReverse.pause();

                animateVideoTime(nextScreenIndex, () => {
                    finalizeTransition();
                });
            }, EXIT_HOLD_MS);
        }
    }
}

/* ── Screen Exit Animation ───────────────────────────────────────────────────
   Content of the previous screen glides up and fades out quickly (0.35s),
   clearing the stage for the incoming scene.
   ────────────────────────────────────────────────────────────────────────── */
function animateScreenExit(screenEl) {
    // Departure order (owner spec): text out first (0.3s), THEN the dark
    // overlay (0.25s, starting as the text finishes) — the video scrub is
    // held for EXIT_HOLD_MS in transitionTo so it never moves under
    // still-visible text.
    const content = screenEl.querySelector(".screen-content");
    if (content) gsap.to(content, { opacity: 0, duration: 0.3, ease: "power2.inOut", overwrite: "auto" });

    const overlay = screenEl.querySelector(".screen-overlay");
    if (overlay) {
        const isHeroOrFooter = screenEl.id === "screen-1" || screenEl.id === "screen-footer";
        if (isHeroOrFooter) {
            gsap.set(overlay, { opacity: 1 });
        } else {
            gsap.to(overlay, {
                opacity: 0,
                duration: 0.25,
                delay: 0.25,
                ease: "power2.inOut",
                overwrite: "auto"
            });
        }
    }

    const movers = screenEl.querySelectorAll(".welcome-text-side, .leisure-bento-grid, .welcome-pillow-card");
    if (movers.length) gsap.to(movers, { y: -14, duration: 0.3, ease: "power2.inOut", overwrite: "auto" });
}

/* ── Generic Staggered Screen Entrance Animation ─────────────────────────────
   Used to animate text, headings, and info elements sequentially on stopping.
   ────────────────────────────────────────────────────────────────────────── */
function animateScreenEntrance(screenEl) {
    const toContent = screenEl.querySelector(".screen-content");
    const toHeader = screenEl.querySelector(".main-header");
    const overlay = screenEl.querySelector(".screen-overlay");

    // Select elements inside this screen for staggered animation
    const labelTag = screenEl.querySelector(".screen-label-tag");
    const title = screenEl.querySelector(".welcome-title");
    const subtitle = screenEl.querySelector(".welcome-subtitle");
    const divider = screenEl.querySelector(".welcome-divider");
    const infoItems = screenEl.querySelectorAll(".info-item");
    const tiles = screenEl.querySelectorAll(".bento-tile, .footer-social-links, .video-promo-btn, .grid-btn");
    const card = screenEl.querySelector(".welcome-pillow-card");
    const scrollMouse = screenEl.querySelector(".scroll-indicator-mouse");
    const scrollMobile = screenEl.querySelector(".scroll-indicator-mobile");
    const pillowBtn = screenEl.querySelector("#pillow-welcome-btn");

    // Fresh screens always start scrolled to the top (matters on stacked layouts)
    if (toContent) {
        toContent.scrollTop = 0;
        toContent._targetScrollTop = 0;
    }

    // Reset any leftover exit offsets from a previous departure
    const movers = screenEl.querySelectorAll(".welcome-text-side, .leisure-bento-grid, .welcome-pillow-card");
    if (movers.length) gsap.set(movers, { y: 0, opacity: 1 });

    // Initialize all to starting state: everything rises softly into place
    gsap.set([toContent, toHeader], { opacity: 1 });
    if (overlay) {
        const isHeroOrFooter = screenEl.id === "screen-1" || screenEl.id === "screen-footer";
        if (isHeroOrFooter) {
            gsap.set(overlay, { opacity: 1 });
        } else {
            gsap.set(overlay, { opacity: 0 });
        }
    }
    if (toHeader) gsap.set(toHeader, { y: -20, opacity: 0 });
    if (labelTag) gsap.set(labelTag, { y: 14, opacity: 0 });
    if (title) gsap.set(title, { y: 16, opacity: 0 });
    if (subtitle) gsap.set(subtitle, { y: 16, opacity: 0 });
    if (pillowBtn) gsap.set(pillowBtn, { y: 16, opacity: 0 });
    if (divider) gsap.set(divider, { scaleX: 0, transformOrigin: "left" });
    if (infoItems.length) gsap.set(infoItems, { y: 14, opacity: 0 });
    if (tiles.length) gsap.set(tiles, { y: 14, opacity: 0 });
    if (card) gsap.set(card, { scale: 0.97, y: 16, opacity: 0 });
    if (scrollMouse) gsap.set(scrollMouse, { y: 10, opacity: 0 });
    if (scrollMobile) gsap.set(scrollMobile, { y: 10, opacity: 0 });

    if (overlay) {
        const isHeroOrFooter = screenEl.id === "screen-1" || screenEl.id === "screen-footer";
        if (isHeroOrFooter) {
            gsap.set(overlay, { opacity: 1 });
        } else {
            // Arrival: dark overlay first (~0.3s), text follows ~0.15s in
            gsap.to(overlay, {
                opacity: 1,
                duration: 0.3,
                ease: "power2.out",
                overwrite: "auto"
            });
        }
    }

    // Text/info starts ~0.15s after the overlay begins (owner spec)
    const tl = gsap.timeline({ delay: 0.15, defaults: { ease: "power3.out" } });

    // 1. Header
    if (toHeader) {
        tl.to(toHeader, { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" }, 0.05);
    }
    // 2. Label tag
    if (labelTag) {
        tl.to(labelTag, { y: 0, opacity: 1, duration: 0.4 }, 0.1);
    }
    // 3. Title rises into place
    if (title) {
        tl.to(title, { y: 0, opacity: 1, duration: 0.45 }, 0.12);
    }
    // 4. Subtitle follows
    if (subtitle) {
        tl.to(subtitle, { y: 0, opacity: 1, duration: 0.45 }, 0.18);
    }
    // 4.1 Pillows button (mobile only)
    if (pillowBtn) {
        tl.to(pillowBtn, { y: 0, opacity: 1, duration: 0.45 }, 0.22);
    }
    // 5. Divider draws itself
    if (divider) {
        tl.to(divider, { scaleX: 1, duration: 0.4, ease: "power2.out" }, 0.2);
    }
    // 6. Info items cascade upward
    if (infoItems.length) {
        tl.to(infoItems, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05 }, 0.22);
    }
    // 7. Bento tiles / footer links rise up
    if (tiles.length) {
        tl.to(tiles, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05 }, 0.25);
    }
    // 8. Side card settles last
    if (card) {
        tl.to(card, { scale: 1, y: 0, opacity: 1, duration: 0.45 }, 0.28);
    }
    // 9. Scroll Mouse
    if (scrollMouse) {
        tl.to(scrollMouse, { y: 0, opacity: 0.85, duration: 0.4, ease: "power2.out" }, 0.35);
    }
    // 9.1 Scroll Mobile
    if (scrollMobile && !window.__ribasMobileSwipedOnce) {
        tl.to(scrollMobile, { y: 0, opacity: 0.85, duration: 0.4, ease: "power2.out" }, 0.35);
    }
}

/* =========================================================================
   SCREEN 1 ENTRANCE & INTERACTION LOGIC
   ========================================================================= */

function initWelcomeScreen() {
    // Hide Screen 1 content elements initially for a staggered GSAP entrance
    gsap.set(".main-header", { y: -50, opacity: 0 });
    // Hero overlay stays dark at all times (owner requirement) — no light-in fade
    gsap.set("#screen-1 .screen-overlay", { opacity: 1 });
    gsap.set("#screen-1 .screen-label-tag", { y: 15, opacity: 0 });
    gsap.set("#screen-1 .welcome-title", { y: 25, opacity: 0 });
    gsap.set("#screen-1 .welcome-divider", { scaleX: 0, transformOrigin: "left" });
    gsap.set("#screen-1 .welcome-subtitle", { y: 15, opacity: 0 });
    gsap.set("#pillow-welcome-btn", { y: 15, opacity: 0 });
    gsap.set(".scroll-indicator-mouse", { y: 15, opacity: 0 });
    gsap.set(".scroll-indicator-mobile", { y: 15, opacity: 0 });
}

function animateWelcomeScreenEntrance() {
    console.log("Starting Screen 1 Staggered Entrance Animation...");
    // Overlay is already dark from initWelcomeScreen and stays that way — nothing to animate here.

    const entranceTl = gsap.timeline();

    // 1. Header (Logo, Menu, Languages) fades and slides down
    entranceTl.to(".main-header", {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out"
    }, 0.1);

    // 2. Screen Tag
    entranceTl.to("#screen-1 .screen-label-tag", {
        y: 0,
        opacity: 1,
        duration: 0.6,
        ease: "power2.out"
    }, 0.3);

    // 3. Title
    entranceTl.to("#screen-1 .welcome-title", {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out"
    }, 0.4);

    // 4. Divider
    entranceTl.to("#screen-1 .welcome-divider", {
        scaleX: 1,
        duration: 0.6,
        ease: "power2.out"
    }, 0.55);

    // 5. Subtitle
    entranceTl.to("#screen-1 .welcome-subtitle", {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out"
    }, 0.6);

    // 6. Mobile Pillows Button
    const pillowBtn = document.getElementById("pillow-welcome-btn");
    if (pillowBtn) {
        entranceTl.to(pillowBtn, {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out"
        }, 0.75);
    }

    // 7. Mouse scroll indicator at the bottom fades in
    entranceTl.to(".scroll-indicator-mouse", {
        y: 0,
        opacity: 0.85,
        duration: 0.8,
        ease: "power2.out"
    }, 1.15);

    // 7.1 Mobile scroll indicator
    if (!window.__ribasMobileSwipedOnce) {
        entranceTl.to(".scroll-indicator-mobile", {
            y: 0,
            opacity: 0.85,
            duration: 0.8,
            ease: "power2.out"
        }, 1.15);
    }

    // Initialize mobile action handlers
    initMobileActions();
}

function bindCopyLogic(copyBtn, wifiPassword) {
    if (!copyBtn || !wifiPassword) return;

    copyBtn.addEventListener("click", () => {
        const textToCopy = wifiPassword.textContent || "bukovel2026";
        
        const showSuccessState = () => {
            copyBtn.classList.add("copied");
            const btnText = copyBtn.querySelector(".btn-text");
            if (btnText) {
                btnText.textContent = "✓ Скопійовано!";
            }

            // GSAP click feedback animation
            gsap.fromTo(copyBtn, 
                { scale: 0.95 }, 
                { scale: 1.0, duration: 0.3, ease: "elastic.out(1.2, 0.5)" }
            );

            // Restore button state after 2.5 seconds
            setTimeout(() => {
                copyBtn.classList.remove("copied");
                if (btnText) {
                    btnText.textContent = "Скопіювати пароль";
                }
            }, 2500);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy)
                .then(showSuccessState)
                .catch(err => {
                    console.warn("Modern clipboard writeText failed, trying fallback...", err);
                    executeFallbackCopy(textToCopy, showSuccessState);
                });
        } else {
            executeFallbackCopy(textToCopy, showSuccessState);
        }
    });
}

function executeFallbackCopy(text, onSuccess) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand("copy");
        if (successful) {
            onSuccess();
        } else {
            console.error("Fallback copy unsuccessful.");
        }
    } catch (err) {
        console.error("Fallback copy execution error:", err);
    }
    
    document.body.removeChild(textArea);
}

function initWifiCopy() {
    const copyBtn = document.getElementById("copy-wifi-btn");
    const wifiPassword = document.getElementById("wifi-password");
    if (copyBtn && wifiPassword) {
        bindCopyLogic(copyBtn, wifiPassword);
    }

    const copyDirectBtn = document.getElementById("copy-wifi-direct-btn");
    const wifiPassVal = document.getElementById("wifi-pass-val");
    if (copyDirectBtn && wifiPassVal) {
        bindCopyLogic(copyDirectBtn, wifiPassVal);
    }

    const mobileCopyBtn = document.getElementById("mobile-copy-wifi-btn");
    const mobileWifiPassword = document.getElementById("mobile-wifi-password");
    if (mobileCopyBtn && mobileWifiPassword) {
        bindCopyLogic(mobileCopyBtn, mobileWifiPassword);
    }
}

function initMobileActions() {
    const pills = document.querySelectorAll(".mobile-action-pill");
    const modal = document.getElementById("mobile-action-modal");
    const modalBody = document.getElementById("mobile-modal-body");
    const closeBtn = document.getElementById("close-mobile-modal");

    if (!pills.length || !modal || !modalBody || !closeBtn) return;

    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            const target = pill.getAttribute("data-target");
            let dropdownClass = "";

            if (target === "wifi") dropdownClass = ".wifi-dropdown";
            else if (target === "reception") dropdownClass = ".reception-dropdown";
            else if (target === "chat") dropdownClass = ".chat-dropdown";
            else if (target === "pillow") dropdownClass = ".pillow-dropdown";

            const sourceDropdown = document.querySelector(dropdownClass);
            if (sourceDropdown) {
                // Clear previous contents
                modalBody.innerHTML = "";

                // Clone dropdown menu elements
                const clone = sourceDropdown.cloneNode(true);
                modalBody.appendChild(clone);

                // Re-bind click event to copy password button inside modal
                const cloneCopyBtn = clone.querySelector("#copy-wifi-btn");
                const cloneWifiPass = clone.querySelector("#wifi-password");
                if (cloneCopyBtn && cloneWifiPass) {
                    bindCopyLogic(cloneCopyBtn, cloneWifiPass);
                }

                // Show modal overlay with GSAP transition
                modal.style.display = "flex";
                document.body.style.overflow = "hidden";
                gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
                gsap.fromTo(".mobile-modal-content", 
                    { scale: 0.92, y: 24 }, 
                    { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
                );
            }
        });
    });

    const closeModal = () => {
        document.body.style.overflow = "";
        gsap.to(modal, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => {
                modal.style.display = "none";
                modalBody.innerHTML = "";
            }
        });
    };

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.style.display === "flex") {
            closeModal();
        }
    });
}

function initPillowCardAction() {
    // PDF menu opening is now handled universally by the [data-pdf] listener
}

function initFloatingPillowTab() {
    const pillowTab = document.getElementById("floating-pillow-tab");
    if (!pillowTab) return;

    // Toggle expanded on click (for mobile/touch devices or alternative click control)
    const header = pillowTab.querySelector(".tab-header");
    if (header) {
        header.addEventListener("click", (e) => {
            e.stopPropagation();
            pillowTab.classList.toggle("is-expanded");
        });
    }

    // Close when clicking anywhere else on the screen
    document.addEventListener("click", (e) => {
        if (!pillowTab.contains(e.target)) {
            pillowTab.classList.remove("is-expanded");
        }
    });

    // Also close on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            pillowTab.classList.remove("is-expanded");
        }
    });
}

function initHeaderDropdowns() {
    const dropdowns = document.querySelectorAll(".nav-item-dropdown");
    let activeDropdown = null;
    let activeLink = null;
    let activeMenu = null;

    dropdowns.forEach(dropdown => {
        const link = dropdown.querySelector(".nav-link");
        const menu = dropdown.querySelector(".dropdown-menu");
        if (!link || !menu) return;

        dropdown.addEventListener("mouseenter", () => {
            if (activeDropdown && activeDropdown !== dropdown) {
                closeDropdown(activeMenu);
            }
            
            activeDropdown = dropdown;
            activeLink = link;
            activeMenu = menu;
            
            openDropdown(menu);
        });
    });

    function openDropdown(menu) {
        menu.classList.add("is-visible");
        gsap.killTweensOf(menu);
        gsap.set(menu, { display: "block", pointerEvents: "auto" });
        gsap.to(menu, {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: "power3.out"
        });
    }

    function closeDropdown(menu) {
        if (!menu) return;
        menu.classList.remove("is-visible");
        gsap.killTweensOf(menu);
        gsap.to(menu, {
            opacity: 0,
            y: 15,
            duration: 0.25,
            ease: "power2.in",
            onComplete: () => {
                gsap.set(menu, { display: "none", pointerEvents: "none" });
            }
        });
    }

    function getDistanceToRect(x, y, rect) {
        const dx = Math.max(rect.left - x, 0, x - rect.right);
        const dy = Math.max(rect.top - y, 0, y - rect.bottom);
        return Math.sqrt(dx * dx + dy * dy);
    }

    document.addEventListener("mousemove", (e) => {
        if (!activeDropdown || !activeLink || !activeMenu) return;

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const linkRect = activeLink.getBoundingClientRect();
        const menuRect = activeMenu.getBoundingClientRect();

        const distLink = getDistanceToRect(mouseX, mouseY, linkRect);
        const distMenu = getDistanceToRect(mouseX, mouseY, menuRect);
        const minDist = Math.min(distLink, distMenu);

        // If mouse wanders more than 25 pixels away from link and menu, close it
        if (minDist > 25) {
            closeDropdown(activeMenu);
            activeDropdown = null;
            activeLink = null;
            activeMenu = null;
        }
    });
}

/* =========================================================================
   RESTAURANT GALLERY SLIDER
   ========================================================================= */

function initRestaurantSlider() {
    const slides = document.querySelectorAll(".food-slide");
    const dots = document.querySelectorAll(".slider-dots .dot");
    if (!slides.length || !dots.length) return;

    let currentIndex = 0;
    let timer = setInterval(nextSlide, 3500);

    function nextSlide() {
        goToSlide((currentIndex + 1) % slides.length);
    }

    function goToSlide(index) {
        slides[currentIndex].classList.remove("active");
        dots[currentIndex].classList.remove("active");

        currentIndex = index;

        slides[currentIndex].classList.add("active");
        dots[currentIndex].classList.add("active");
    }

    dots.forEach(dot => {
        dot.addEventListener("click", () => {
            clearInterval(timer);
            const index = parseInt(dot.getAttribute("data-index"));
            goToSlide(index);
            timer = setInterval(nextSlide, 3500);
        });
    });
}

/* =========================================================================
   RESTAURANT & BOOKING ACTIONS
   ========================================================================= */

function initRestaurantActions() {
    const orderBtn = document.getElementById("order-room-btn");
    const bookBtn = document.getElementById("book-table-btn");

    if (orderBtn) {
        orderBtn.addEventListener("click", () => {
            openBookingModal("order_food");
        });
    }

    if (bookBtn) {
        bookBtn.addEventListener("click", () => {
            openBookingModal("book_table");
        });
    }

    initBookingForm();
}

function openBookingModal(key) {
    const modal = document.getElementById("booking-modal");
    const titleEl = document.getElementById("booking-modal-title");
    const textarea = document.getElementById("booking-details");

    if (!modal || !titleEl || !textarea) return;

    const t = dynamicTranslations[currentLanguage];
    titleEl.textContent = t[key + "_title"];
    textarea.placeholder = t[key + "_placeholder"];

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(modal.querySelector(".mobile-modal-content"), 
        { scale: 0.92, y: 24 }, 
        { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
    );
}

function initBookingForm() {
    const form = document.getElementById("booking-form");
    const modal = document.getElementById("booking-modal");
    const closeBtn = document.getElementById("close-booking-modal");
    const submitBtn = document.getElementById("submit-booking-btn");

    if (!form || !modal || !closeBtn || !submitBtn) return;

    const closeModal = () => {
        document.body.style.overflow = "";
        gsap.to(modal, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => {
                modal.style.display = "none";
                form.reset();
                submitBtn.classList.remove("copied");
                submitBtn.querySelector(".btn-text").textContent = dynamicTranslations[currentLanguage].send_request;
            }
        });
    };

    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.style.display === "flex") {
            closeModal();
        }
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        submitBtn.classList.add("copied");
        submitBtn.querySelector(".btn-text").textContent = dynamicTranslations[currentLanguage].request_sent;

        gsap.fromTo(submitBtn, 
            { scale: 0.95 }, 
            { scale: 1.0, duration: 0.3, ease: "elastic.out(1.2, 0.5)" }
        );

        setTimeout(closeModal, 2000);
    });
}

/* =========================================================================
   SPA ACTIONS
   ========================================================================= */

function initSpaActions() {
    const bookSpaBtn = document.getElementById("book-spa-btn");

    if (bookSpaBtn) {
        bookSpaBtn.addEventListener("click", () => {
            openBookingModal("book_spa");
        });
    }
}

/* =========================================================================
   LEISURE & ACTIVITES ACTIONS (YOUTUBE & BOOKS)
   ========================================================================= */

function initLeisureActions() {
    const playVideoBtn = document.getElementById("play-video-promo-btn");
    const viewBooksBtn = document.getElementById("view-books-btn");

    // Excursion / transfer request goes through the shared booking modal
    const transferBtn = document.getElementById("order-transfer-btn");
    if (transferBtn) {
        transferBtn.addEventListener("click", () => {
            openBookingModal("book_transfer");
        });
    }

    const youtubeModal = document.getElementById("youtube-modal");
    const closeYoutubeBtn = document.getElementById("close-youtube-modal");
    const playerContainer = document.getElementById("youtube-player-container");

    const booksModal = document.getElementById("books-modal");
    const closeBooksBtn = document.getElementById("close-books-modal");

    if (playVideoBtn && youtubeModal && closeYoutubeBtn && playerContainer) {
        const openVideo = () => {
            // Inject YouTube iframe
            playerContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/ODR5b6kcyis?autoplay=1" title="Ribas Karpaty Promo Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="border: none;"></iframe>`;
            
            youtubeModal.style.display = "flex";
            document.body.style.overflow = "hidden";
            gsap.fromTo(youtubeModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(youtubeModal.querySelector(".mobile-modal-content"), 
                { scale: 0.92, y: 24 }, 
                { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
            );
        };

        const closeVideo = () => {
            document.body.style.overflow = "";
            gsap.to(youtubeModal, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    youtubeModal.style.display = "none";
                    playerContainer.innerHTML = ""; // Clear iframe so sound stops
                }
            });
        };

        playVideoBtn.addEventListener("click", openVideo);
        closeYoutubeBtn.addEventListener("click", closeVideo);
        youtubeModal.addEventListener("click", (e) => {
            if (e.target === youtubeModal) closeVideo();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && youtubeModal.style.display === "flex") {
                closeVideo();
            }
        });
    }

    if (viewBooksBtn && booksModal && closeBooksBtn) {
        const openBooks = () => {
            booksModal.style.display = "flex";
            document.body.style.overflow = "hidden";
            gsap.fromTo(booksModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(booksModal.querySelector(".mobile-modal-content"), 
                { scale: 0.92, y: 24 }, 
                { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
            );
        };

        const closeBooks = () => {
            document.body.style.overflow = "";
            gsap.to(booksModal, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    booksModal.style.display = "none";
                }
            });
        };

        viewBooksBtn.addEventListener("click", openBooks);
        closeBooksBtn.addEventListener("click", closeBooks);
        booksModal.addEventListener("click", (e) => {
            if (e.target === booksModal) closeBooks();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && booksModal.style.display === "flex") {
                closeBooks();
            }
        });
    }
}

/* =========================================================================
   USEFUL INFO ACTIONS
   ========================================================================= */

function initUsefulInfoActions() {
    const safeBtn = document.getElementById("safe-instr-btn");
    const baggageBtn = document.getElementById("baggage-novaposhta-btn");

    const safeModal = document.getElementById("safe-modal");
    const closeSafeBtn = document.getElementById("close-safe-modal");

    const baggageModal = document.getElementById("baggage-modal");
    const closeBaggageBtn = document.getElementById("close-baggage-modal");

    if (safeBtn && safeModal && closeSafeBtn) {
        const openSafe = () => {
            safeModal.style.display = "flex";
            document.body.style.overflow = "hidden";
            gsap.fromTo(safeModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(safeModal.querySelector(".mobile-modal-content"), 
                { scale: 0.92, y: 24 }, 
                { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
            );
        };

        const closeSafe = () => {
            document.body.style.overflow = "";
            gsap.to(safeModal, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    safeModal.style.display = "none";
                }
            });
        };

        safeBtn.addEventListener("click", openSafe);
        closeSafeBtn.addEventListener("click", closeSafe);
        safeModal.addEventListener("click", (e) => {
            if (e.target === safeModal) closeSafe();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && safeModal.style.display === "flex") {
                closeSafe();
            }
        });
    }

    if (baggageBtn && baggageModal && closeBaggageBtn) {
        const openBaggage = () => {
            baggageModal.style.display = "flex";
            document.body.style.overflow = "hidden";
            gsap.fromTo(baggageModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(baggageModal.querySelector(".mobile-modal-content"), 
                { scale: 0.92, y: 24 }, 
                { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
            );
        };

        const closeBaggage = () => {
            document.body.style.overflow = "";
            gsap.to(baggageModal, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    baggageModal.style.display = "none";
                }
            });
        };

        baggageBtn.addEventListener("click", openBaggage);
        closeBaggageBtn.addEventListener("click", closeBaggage);
        baggageModal.addEventListener("click", (e) => {
            if (e.target === baggageModal) closeBaggage();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && baggageModal.style.display === "flex") {
                closeBaggage();
            }
        });
    }
}


// ============================================================
// PDF POPUP MODAL — universal handler for [data-pdf] elements
// ============================================================
function initPdfModal() {
    const modal     = document.getElementById("pdf-modal");
    const iframe    = document.getElementById("pdf-modal-iframe");
    const title     = document.getElementById("pdf-modal-title");
    const closeBtn  = document.getElementById("pdf-modal-close");
    const expandBtn = document.getElementById("pdf-modal-expand");
    const backdrop  = document.getElementById("pdf-modal-backdrop");
    const downloadBtn = document.getElementById("pdf-download-btn");
    const container = modal ? modal.querySelector(".pdf-modal-container") : null;

    if (!modal || !iframe) return;

    function openPdf(src, label) {
        iframe.src = src;
        title.textContent = label || "Документ";
        
        // Hide download button for web pages (e.g. bukovel map)
        if (src.startsWith("http://") || src.startsWith("https://") || !src.toLowerCase().endsWith(".pdf")) {
            downloadBtn.style.display = "none";
        } else {
            downloadBtn.style.display = "flex";
            downloadBtn.href = src;
            downloadBtn.download = src.split("/").pop();
        }
        
        // --- Dynamic Pillow Menu additions ---
        const isPillowMenu = src.includes("Меню подушок.pdf") || src.includes("pillow");
        const descEl = document.getElementById("pdf-modal-description");
        const footerEl = document.getElementById("pdf-modal-footer");
        
        if (isPillowMenu) {
            descEl.style.display = "block";
            footerEl.style.display = "flex";
            
            const descTexts = {
                ua: "Міцний сон — важлива частина відпочинку. Ви можете обрати подушку зі спеціального меню: ортопедичну, з ефектом памʼяті або лавандову для релаксу. <br><br>Просто повідомте адміністратора на рецепції або оформіть заявку нижче — і ми доставимо її у ваш номер.",
                en: "A sound sleep is key to relaxation. You can select a pillow from our special menu: orthopedic, memory-foam, or lavender for deep relaxation. <br><br>Just let the receptionist know or place an order below, and we will deliver it to your room.",
                ru: "Крепкий сон — важная часть отдыха. Вы можете выбрать подушку из специального меню: ортопедическую, с эффектом памяти или лавандовую для релакса. <br><br>Просто сообщите администратору на рецепции или оформите заявку ниже — и мы доставим ее в ваш номер."
            };
            descEl.innerHTML = descTexts[currentLanguage || "ua"];
            
            const btnTexts = {
                ua: "Замовити подушку",
                en: "Order a Pillow",
                ru: "Заказать подушку"
            };
            const orderBtn = document.getElementById("pillow-order-trigger-btn");
            if (orderBtn) {
                orderBtn.querySelector("span").textContent = btnTexts[currentLanguage || "ua"];
            }
        } else {
            descEl.style.display = "none";
            footerEl.style.display = "none";
        }
        
        // On mobile, default to fullscreen for better readability (GDPR popups/nested scrolling)
        if (window.innerWidth <= 1024 && container) {
            container.classList.add("is-fullscreen");
        } else if (container) {
            container.classList.remove("is-fullscreen");
        }
        
        modal.classList.add("is-open");
        document.body.style.overflow = "hidden";
    }

    function closePdf() {
        modal.classList.remove("is-open");
        document.body.style.overflow = "";
        // Short delay before clearing src to avoid flash
        setTimeout(() => { 
            iframe.src = ""; 
            if (container) container.classList.remove("is-fullscreen");
            document.getElementById("pdf-modal-description").style.display = "none";
            document.getElementById("pdf-modal-footer").style.display = "none";
        }, 350);
    }

    // Expand toggle click listener
    if (expandBtn && container) {
        expandBtn.addEventListener("click", () => {
            container.classList.toggle("is-fullscreen");
        });
    }

    // Close controls
    closeBtn.addEventListener("click", closePdf);
    backdrop.addEventListener("click", closePdf);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("is-open")) closePdf();
    });

    // Intercept ALL [data-pdf] clicks on the page (delegated)
    document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-pdf]");
        if (!trigger) return;
        e.preventDefault();
        e.stopPropagation();

        let src = trigger.dataset.pdf;

        // Dynamic localized swap for Bukovel Resort Map URL
        if (src.includes("summer-map")) {
            src = currentLanguage === "en" 
                ? "https://bukovel.com/en/summer-map" 
                : "https://bukovel.com/uk/summer-map";
        }

        // Dynamic responsive swap for Memo Games PDF
        if (src === "/files/memo-games.pdf" || src.includes("MemoGames") || src.includes("memo-games")) {
            const isMobile = window.innerWidth <= 768;
            src = isMobile ? "/files/MemoGames mob.pdf" : "/files/memo-games.pdf";
        }

        // Dynamic translated title extraction (falls back to data-pdf-title)
        let label = "";
        const textSpan = trigger.querySelector(".btn-text, span");
        if (textSpan) {
            label = textSpan.textContent.trim();
        } else if (trigger.textContent.trim()) {
            label = trigger.textContent.trim();
        }
        if (!label || label === "") {
            label = trigger.dataset.pdfTitle || "";
        }

        openPdf(src, label);
    });
}

function initPillowOrderForm() {
    const triggerBtn = document.getElementById("pillow-order-trigger-btn");
    const orderModal = document.getElementById("pillow-order-modal");
    const orderBackdrop = document.getElementById("pillow-order-backdrop");
    const orderClose = document.getElementById("pillow-order-close");
    const orderForm = document.getElementById("pillow-order-form");
    const orderSuccess = document.getElementById("pillow-order-success");
    const pillowSelect = document.getElementById("pillow-select");
    const qtyInput = document.getElementById("pillow-quantity");
    const qtyMinus = document.querySelector(".quantity-selector .qty-btn.minus");
    const qtyPlus = document.querySelector(".quantity-selector .qty-btn.plus");

    if (!orderModal || !orderForm || !pillowSelect) return;

    // Pillow lists per language
    const pillowOptions = {
        ua: [
            "«Як в хмарі» — пухова подушка",
            "«Теплий затишок» — подушка на овчині",
            "«Розумна підтримка» — Memory-подушка",
            "«Турбота для майбутньої мами» — П-подібна подушка",
            "«Релакс і спокій» — фіто-подушка",
            "«Коли втомилась шия» — подушка-валик",
            "«Маленький сон» — дитяча подушка",
            "«Щоб не було самотньо» — подушка для обіймів (120×40)"
        ],
        en: [
            "“Sleeping on a Cloud” — Down Pillow",
            "“Warm Comfort” — Sheepskin Pillow",
            "“Smart Support” — Memory Foam Pillow",
            "“Caring Support for Expectant Mothers” — U-Shaped Pillow",
            "“Relax & Calm” — Herbal Pillow",
            "“Neck Relief” — Neck Roll Pillow",
            "“Little Dream” — Children’s Pillow",
            "“For Cozy Hugs” — Hugging Pillow (120×40)"
        ],
        ru: [
            "«Как в облаке» — пуховая подушка",
            "«Теплый уют» — подушка на овчине",
            "«Умная поддержка» — Memory-подушка",
            "«Забота для будущей мамы» — П-образная подушка",
            "«Релакс и покой» — фито-подушка",
            "«Когда устала шея» — подушка-валик",
            "«Маленький сон» — детская подушка",
            "«Чтобы не было одиноко» — подушка для объятий (120×40)"
        ]
    };

    const formLabels = {
        ua: {
            title: "Замовлення подушки",
            room: "Номер кімнати",
            select: "Оберіть подушку",
            quantity: "Кількість",
            comment: "Коментар (необов'язково)",
            comment_placeholder: "Наприклад: доставити о 21:00",
            submit: "Надіслати замовлення",
            success_title: "Дякуємо!",
            success_msg: "Вашу заявку прийнято. Подушку буде доставлено найближчим часом.",
            close: "Закрити"
        },
        en: {
            title: "Pillow Request",
            room: "Room number",
            select: "Select pillow type",
            quantity: "Quantity",
            comment: "Special requests (optional)",
            comment_placeholder: "e.g. deliver at 9:00 PM",
            submit: "Submit Request",
            success_title: "Thank you!",
            success_msg: "Your request has been received. The pillow will be delivered shortly.",
            close: "Close"
        },
        ru: {
            title: "Заказ подушки",
            room: "Номер комнаты",
            select: "Выберите подушку",
            quantity: "Количество",
            comment: "Комментарий (необязательно)",
            comment_placeholder: "Например: доставить в 21:00",
            submit: "Отправить заказ",
            success_title: "Спасибо!",
            success_msg: "Ваша заявка принята. Подушка будет доставлена в ближайшее время.",
            close: "Закрыть"
        }
    };

    function populatePillowSelect() {
        const lang = currentLanguage || "ua";
        const options = pillowOptions[lang] || pillowOptions.ua;
        pillowSelect.innerHTML = "";
        
        // Add default empty option
        const defOpt = document.createElement("option");
        defOpt.value = "";
        defOpt.disabled = true;
        defOpt.selected = true;
        defOpt.textContent = lang === "en" ? "Select a pillow..." : (lang === "ru" ? "Выберите подушку..." : "Оберіть подушку...");
        pillowSelect.appendChild(defOpt);

        options.forEach(opt => {
            const el = document.createElement("option");
            el.value = opt;
            el.textContent = opt;
            pillowSelect.appendChild(el);
        });
    }

    function translateForm() {
        const lang = currentLanguage || "ua";
        const labels = formLabels[lang] || formLabels.ua;
        
        document.getElementById("pillow-order-title").textContent = labels.title;
        document.getElementById("label-pillow-room").textContent = labels.room;
        document.getElementById("label-pillow-select").textContent = labels.select;
        document.getElementById("label-pillow-quantity").textContent = labels.quantity;
        document.getElementById("label-pillow-comment").textContent = labels.comment;
        document.getElementById("pillow-comment").placeholder = labels.comment_placeholder;
        document.getElementById("pillow-order-submit").querySelector("span").textContent = labels.submit;
        document.getElementById("pillow-success-title").textContent = labels.success_title;
        document.getElementById("pillow-success-msg").textContent = labels.success_msg;
        document.getElementById("pillow-success-close-text").textContent = labels.close;
    }

    function openOrderModal() {
        populatePillowSelect();
        translateForm();
        
        // Reset form state
        orderForm.reset();
        qtyInput.value = "1";
        orderForm.style.display = "block";
        orderSuccess.style.display = "none";
        
        orderModal.classList.add("is-open");
    }

    function closeOrderModal() {
        orderModal.classList.remove("is-open");
    }

    // Trigger open from the main PDF modal button
    triggerBtn.addEventListener("click", () => {
        openOrderModal();
    });

    // Close controls
    orderClose.addEventListener("click", closeOrderModal);
    orderBackdrop.addEventListener("click", closeOrderModal);
    document.getElementById("pillow-order-success-close").addEventListener("click", closeOrderModal);

    // Quantity selectors logic
    qtyMinus.addEventListener("click", () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val > 1) qtyInput.value = (val - 1).toString();
    });

    qtyPlus.addEventListener("click", () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val < 5) qtyInput.value = (val + 1).toString();
    });

    // Form submission
    orderForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        // Animate out the form, show success checkmark
        gsap.to(orderForm, {
            opacity: 0,
            duration: 0.25,
            onComplete: () => {
                orderForm.style.display = "none";
                orderForm.style.opacity = 1;
                
                orderSuccess.style.display = "block";
                orderSuccess.style.opacity = 0;
                gsap.to(orderSuccess, { opacity: 1, duration: 0.3 });
                
                // Trigger checkmark redraw animation
                const path = document.querySelector(".success-checkmark-svg .checkmark-path");
                if (path) {
                    path.style.animation = "none";
                    path.offsetHeight; // trigger reflow
                    path.style.animation = null;
                }
            }
        });
    });

    // Expose language change binding
    window.__ribasUpdatePillowFormLanguage = () => {
        populatePillowSelect();
        translateForm();
    };
}

document.addEventListener("DOMContentLoaded", () => {
    initPdfModal();
    initPillowOrderForm();
});

/* =========================================================================
   LOCALIZATION / TRANSLATIONS (UA, EN, RU)
   ========================================================================= */

const dynamicTranslations = window.dynamicTranslations;
const translations = window.translations;

let currentLanguage = "ua";

function initLanguageSelector() {
    const langButtons = document.querySelectorAll(".lang-selector .lang-btn");
    
    // Load saved language from localStorage if exists
    const savedLang = localStorage.getItem("ribas_lang");
    if (savedLang && translations[savedLang]) {
        currentLanguage = savedLang;
        // Update active class on buttons
        langButtons.forEach(btn => {
            if (btn.textContent.trim().toLowerCase() === currentLanguage) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
        applyTranslations(currentLanguage);
        if (window.__ribasUpdatePillowFormLanguage) {
            window.__ribasUpdatePillowFormLanguage();
        }
    }

    langButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const selectedLang = btn.textContent.trim().toLowerCase();
            if (selectedLang === currentLanguage) return;

            // Update active state on ALL matching language buttons
            langButtons.forEach(b => {
                if (b.textContent.trim().toLowerCase() === selectedLang) {
                    b.classList.add("active");
                } else {
                    b.classList.remove("active");
                }
            });

            currentLanguage = selectedLang;
            localStorage.setItem("ribas_lang", currentLanguage);

            // Animate page content out, apply translation, animate in
            const activeScreenEl = screens[currentScreen - 1].el;
            const content = activeScreenEl.querySelector(".screen-content");
            const overlay = activeScreenEl.querySelector(".screen-overlay");
            
            const isHeroOrFooter = activeScreenEl.id === "screen-1" || activeScreenEl.id === "screen-footer";

            const tl = gsap.timeline();
            if (content) tl.to(content, { opacity: 0, duration: 0.2, ease: "power2.in" });
            if (overlay && !isHeroOrFooter) tl.to(overlay, { opacity: 0, duration: 0.2, ease: "power2.in" }, 0);
            
            tl.call(() => {
                applyTranslations(currentLanguage);
                if (window.__ribasUpdatePillowFormLanguage) {
                    window.__ribasUpdatePillowFormLanguage();
                }
            });

            tl.call(() => {
                animateScreenEntrance(activeScreenEl);
            });
        });
    });
}

function applyTranslations(lang) {
    document.documentElement.lang = lang === "ua" ? "uk" : lang;
    const data = translations[lang];
    if (!data) return;

    for (const [selector, value] of Object.entries(data)) {
        const el = document.querySelector(selector);
        if (!el) continue;

        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
            el.placeholder = value;
        } else {
            el.innerHTML = value;
        }
    }
}

window.initTransitionTrigger = initTransitionTrigger;
window.currentScreen = currentScreen;





/* =========================================================================
   BACKGROUND MUSIC — lounge jazz, seamless loop via two overlapping tracks
   ========================================================================= */

function initBackgroundMusic() {
    const toggleBtn = document.getElementById("sound-toggle");
    const TARGET_VOL = 0.55;
    const FADE_IN = 5;
    const CROSSFADE = 1.6;

    // preload:"none" — the site doesn't need this fetched until the user
    // actually unmutes/interacts; "auto" was pulling two full copies of
    // music.mp3 over the network from page load, competing for the same
    // limited bandwidth as the preloader/hero video on a slow connection.
    const trackA = new Audio("music.mp3");
    const trackB = new Audio("music.mp3");
    trackA.preload = "none";
    trackB.preload = "none";

    let active = trackA;
    let standby = trackB;
    let crossfading = false;
    // Off by default for every visitor, every device — only an explicit tap
    // on the sound toggle turns it on. A returning visitor's own choice
    // (stored below) still overrides this.
    let muted = true;
    let preloaderDismissed = !!window.preloaderBypassed;
    let audioUnlocked = false;

    updateButton();

    // Seamless loop: shortly before the active track ends, the standby copy
    // starts from zero and both are crossfaded (overlap looping).
    const watchLoop = () => {
        if (active && !active.paused && !muted && !crossfading && active.duration &&
            active.duration - active.currentTime <= CROSSFADE) {
            crossfading = true;
            standby.currentTime = 0;
            standby.volume = 0;
            
            let playPromise;
            try {
                playPromise = standby.play();
            } catch (e) {
                crossfading = false;
                return;
            }

            if (playPromise !== undefined && typeof playPromise.then === 'function') {
                playPromise.then(() => {
                    gsap.to(standby, { volume: TARGET_VOL, duration: CROSSFADE, ease: "none" });
                    gsap.to(active, {
                        volume: 0,
                        duration: CROSSFADE,
                        ease: "none",
                        onComplete: () => {
                            active.pause();
                            const t = active; active = standby; standby = t;
                            crossfading = false;
                        }
                    });
                }).catch(() => { crossfading = false; });
            } else {
                gsap.to(standby, { volume: TARGET_VOL, duration: CROSSFADE, ease: "none" });
                gsap.to(active, {
                    volume: 0,
                    duration: CROSSFADE,
                    ease: "none",
                    onComplete: () => {
                        active.pause();
                        const t = active; active = standby; standby = t;
                        crossfading = false;
                    }
                });
            }
        }
        requestAnimationFrame(watchLoop);
    };
    requestAnimationFrame(watchLoop);

    const tryPlay = () => {
        if (muted) return Promise.resolve();
        if (audioUnlocked && active && !active.paused) return Promise.resolve();

        // Always start silent — the fade below (or __ribasMusic.start after the
        // preloader) ramps to TARGET_VOL over FADE_IN seconds
        active.volume = 0;
        
        let playPromise;
        try {
            playPromise = active.play();
        } catch (e) {
            return Promise.reject(e);
        }

        if (playPromise !== undefined && typeof playPromise.then === 'function') {
            return playPromise.then(() => {
                audioUnlocked = true;
                removeGestureFallbacks();
                if (preloaderDismissed) {
                    gsap.to(active, { volume: TARGET_VOL, duration: FADE_IN, ease: "power1.out" });
                }
            }).catch((err) => {
                throw err;
            });
        } else {
            audioUnlocked = true;
            removeGestureFallbacks();
            if (preloaderDismissed) {
                gsap.to(active, { volume: TARGET_VOL, duration: FADE_IN, ease: "power1.out" });
            }
            return Promise.resolve();
        }
    };

    const gestureEvents = ["pointerdown", "mousedown", "click", "touchstart", "keydown"];
    const onGesture = () => tryPlay();
    const addGestureFallbacks = () => {
        gestureEvents.forEach(ev => {
            window.addEventListener(ev, onGesture, { capture: true, passive: true });
        });
    };
    const removeGestureFallbacks = () => {
        gestureEvents.forEach(ev => {
            window.removeEventListener(ev, onGesture, { capture: true });
        });
    };

    function updateButton() {
        if (!toggleBtn) return;
        toggleBtn.classList.toggle("is-muted", muted);
    }

    if (toggleBtn) {
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            muted = !muted;
            try { localStorage.setItem("ribasMuted", muted ? "1" : "0"); } catch (err) {}
            updateButton();
            gsap.killTweensOf([trackA, trackB]); // no dueling fade tweens on rapid toggling
            if (muted) {
                gsap.to([trackA, trackB], {
                    volume: 0,
                    duration: 0.6,
                    ease: "power1.out",
                    onComplete: () => { trackA.pause(); trackB.pause(); }
                });
                crossfading = false;
            } else {
                tryPlay();
            }
        });
    }

    // Music never attempts to autoplay — only an explicit tap/click/keydown
    // (via the gesture listeners below) is allowed to start it, on desktop
    // or mobile alike.
    addGestureFallbacks();

    window.__ribasMusic = {
        start() {
            preloaderDismissed = true;
            // Only resumes the fade-in if a gesture already started playback
            // earlier (e.g. a tap during the preloader) — never starts it here.
            if (audioUnlocked && active && !active.paused && !muted) {
                gsap.to(active, { volume: TARGET_VOL, duration: FADE_IN, ease: "power1.out" });
            }
            return Promise.resolve();
        },
        _trackA: trackA,
        _trackB: trackB,
        getStarted() { return audioUnlocked && active && !active.paused; },
        getMuted() { return muted; },
        getPreloaderDismissed() { return preloaderDismissed; },
        getActive() { return active; }
    };
}

/* =========================================================================
   LEISURE TILES — mobile accordion (compact headers, tap to expand)
   ========================================================================= */

function initLeisureAccordion() {
    const tiles = document.querySelectorAll("#screen-4 .bento-tile");
    if (!tiles.length) return;

    const isMobile = window.matchMedia("(max-width: 768px)");

    tiles.forEach(tile => {
        const header = tile.querySelector(".tile-header");
        if (!header) return;
        header.addEventListener("click", () => {
            if (!isMobile.matches) return;
            const wasOpen = tile.classList.contains("acc-open");
            tiles.forEach(t => t.classList.remove("acc-open"));
            if (!wasOpen) tile.classList.add("acc-open");
        });
    });

    // Leaving mobile: make sure every tile is fully expanded again
    isMobile.addEventListener("change", (e) => {
        if (!e.matches) tiles.forEach(t => t.classList.remove("acc-open"));
    });
}

/* =========================================================================
   MOBILE MENU TOGGLE & OVERLAY INTERACTIVITY
   ========================================================================= */

function initMobileMenu() {
    const toggle = document.getElementById("mobile-menu-toggle");
    const overlay = document.getElementById("mobile-menu-overlay");
    const menuLinks = overlay ? overlay.querySelectorAll("a, button") : [];

    if (!toggle || !overlay) return;

    toggle.addEventListener("click", () => {
        const isOpen = overlay.classList.contains("is-open");
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Close menu when a link inside it is clicked — except language switch
    // buttons and the Wi-Fi copy button (it shows a green "copied" state
    // for 2.5s; instantly closing the menu meant nobody ever saw it)
    menuLinks.forEach(link => {
        if (link.classList.contains("lang-btn") || link.id === "mobile-copy-wifi-btn") return;
        link.addEventListener("click", () => {
            closeMenu();
        });
    });

    function openMenu() {
        toggle.classList.add("is-active");
        overlay.classList.add("is-open");

        // ── iOS Safari fix ──
        // Removing the passive:false window touchmove listener is the ONLY
        // reliable way to unblock native scrolling inside a fixed overlay on
        // iOS Safari. Any capture-phase / stopPropagation workaround is
        // insufficient because WebKit blocks the gesture at registration time.
        if (window.__ribasDisableTouchScroll) window.__ribasDisableTouchScroll();

        // Premium fade-in slide animation using GSAP
        gsap.fromTo(".mobile-menu-section",
            { opacity: 0, y: 15 },
            { 
                opacity: 1, 
                y: 0, 
                duration: 0.35, 
                stagger: 0.06, 
                ease: "power2.out",
                clearProps: "transform,opacity"
            }
        );
    }

    function closeMenu() {
        toggle.classList.remove("is-active");
        overlay.classList.remove("is-open");

        // Re-attach the window touchmove listener now that the menu is closed
        if (window.__ribasEnableTouchScroll) window.__ribasEnableTouchScroll();
    }
}


