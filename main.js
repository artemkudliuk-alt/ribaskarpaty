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
});

let currentScreen = 1;
let screens = [];

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
    const isSlowConnection = isMobile || (conn && (conn.saveData || /(^|-)2g|3g$/.test(conn.effectiveType || "")));
    // Always load widescreen on desktop; weak/mobile vertical videos are only for actual mobile browsers
    const src = isMobile
        ? (isSlowConnection ? "scrolling video_weak.webm" : "scrolling video mob.webm")
        : "scrolling video.webm";

    console.log("Preloading forward scrolling video:", src);
    vScrolling.muted = true;
    vScrolling.preload = "auto";
    vScrolling.src = src;
    vScrolling.load();
    vScrolling.addEventListener("canplay", () => {
        vScrolling.muted = true;
        if (vScrolling.paused) vScrolling.play().then(() => vScrolling.pause()).catch(() => {});
    }, { once: true });
}

let reverseScrollPreloadStarted = false;
function startReverseScrollPreload() {
    if (reverseScrollPreloadStarted) return;
    reverseScrollPreloadStarted = true;

    const vScrollingRev = document.getElementById("video-scrolling-reverse");
    if (!vScrollingRev) return;

    const isMobile = window.matchMedia("(max-width: 1024px)").matches;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlowConnection = isMobile || (conn && (conn.saveData || /(^|-)2g|3g$/.test(conn.effectiveType || "")));
    const src = isMobile
        ? (isSlowConnection ? "scrolling video_weak_reverse.webm" : "scrolling video mob_reverse.webm")
        : "scrolling video_reverse.webm";

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
    preloaderVideo.src     = "preloader.webm";
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
            vLobby1.playbackRate = 0.35;
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
        const isSlowConnection = isMobileOrTablet || (conn && (conn.saveData || /(^|-)2g|3g$/.test(conn.effectiveType || "")));

        // Direct streaming is much safer and completely standard, avoiding XHR race conditions
        const heroSrc = (isMobileOrTablet && isSlowConnection) ? "1 screen_weak.webm" : "1 screen.webm";

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
    v1.playbackRate = 0.35;
    v2.playbackRate = 0.35;

    // Try playing video 1 immediately
    const startPlay = () => {
        v1.muted = true;
        v1.playbackRate = 0.35;
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
                inactiveVideo.playbackRate = 0.35;
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

    const screenTimestamps = {
        1: 0.0,
        2: 1.5333,
        3: 3.2667,
        4: 5.7667,
        // 75ms before the physical end of the clip: seeking to the exact end
        // puts the <video> into the "ended" state and paints a black frame
        5: 7.58
    };

    const screenTimestampsReverse = {
        // Same margin-from-the-end fix as screenTimestamps[5] above: the reverse
        // clip's real duration is 7.633-7.634s, so 7.5999 left only ~33ms —
        // on some devices/decoders that's close enough to tip the <video>
        // into the "ended" state and paint black. 7.55 keeps a safe margin.
        1: 7.55,
        2: 6.2000,
        3: 4.3332,
        4: 1.8332,
        5: 0.0000
    };

    if (!flashOverlay) return;

    // Screens loops and transitions are preloaded lazily via preloadRemainingAssets() 3 seconds after dismissPreloader.

    // Wire restaurant click in header menu to go directly to screen 2
    const viewMenuBtn = document.getElementById("view-menu-btn");
    if (viewMenuBtn) {
        viewMenuBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (!isTransitioning && currentScreen === 1) {
                transitionTo(2);
            }
        });
    }

    // Scroll listeners
    window.addEventListener("wheel", handleScroll, { passive: false });
    window.addEventListener("touchmove", handleScroll, { passive: false });

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
    }

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
        if (isTouchEvent && touchTriggered) return;

        const deltaY = e.deltaY;
        // Positive = finger moved up = scroll-down intent (also the raw pixel
        // amount to apply to scrollTop directly, see below).
        const touchDelta = isTouchEvent ? (window.lastTouchY - e.touches[0].clientY) : 0;
        const isTouchScrollDown = isTouchEvent && touchDelta > 0;
        const isTouchScrollUp = isTouchEvent && touchDelta < 0;

        const isScrollDown = deltaY > 0 || isTouchScrollDown;
        const isScrollUp = deltaY < 0 || isTouchScrollUp;

        // When the screen content is taller than the viewport (stacked layouts
        // on tablet/mobile), scroll it to its edge first and only then switch
        // screens on a subsequent swipe.
        const activeContent = screens[currentScreen - 1].el.querySelector(".screen-content");
        if (activeContent && activeContent.scrollHeight > activeContent.clientHeight + 40 && blockedSwipeStreak < 2) {
            const atTop = activeContent.scrollTop <= 5;
            const atBottom = activeContent.scrollTop + activeContent.clientHeight >= activeContent.scrollHeight - 5;

            // Bypass internal content scroll blocking if the touch gesture started directly at the corresponding edge
            const bypassContentScroll = (isScrollDown && window.touchStartedAtBottom) || (isScrollUp && window.touchStartedAtTop);

            if (!bypassContentScroll) {
                if ((isScrollDown && !atBottom) || (isScrollUp && !atTop)) {
                    // Drive scrollTop ourselves instead of returning and hoping
                    // the browser's own native touch-scroll picks it up — on
                    // some real phones it silently never does (the address bar
                    // collapsing mid-gesture, momentum scroll swallowing
                    // touchmove, etc.), which just ate every swipe without the
                    // content ever actually scrolling into view.
                    e.preventDefault();
                    gestureWasBlocked = true;
                    if (isTouchEvent) {
                        activeContent.scrollTop += touchDelta;
                        window.lastTouchY = e.touches[0].clientY;
                        touchIsScrollingContent = true; // Mark that we did content scroll in this swipe
                    } else {
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
                    }
                    return;
                }

                // If we already scrolled content inside this specific touch gesture,
                // block transitioning until they release and swipe again (prevents slipping)
                if (isTouchEvent && touchIsScrollingContent) {
                    gestureWasBlocked = true;
                    window.lastTouchY = e.touches[0].clientY;
                    return;
                }
            }
        }

        const totalTouchDeltaY = isTouchEvent ? (window.touchStartY - e.touches[0].clientY) : 0;
        const swipeThreshold = 55; // minimum swipe distance of 55px to trigger a screen transition

        if (isScrollDown && currentScreen < 6) {
            if (isTouchEvent && Math.abs(totalTouchDeltaY) < swipeThreshold) {
                // Ignore small wiggles at the boundary; keep preventing default browser scroll
                e.preventDefault();
                gestureWasBlocked = true;
                return;
            }
            e.preventDefault();
            if (isTouchEvent) touchTriggered = true;
            blockedSwipeStreak = 0;
            transitionTo(currentScreen + 1);
        } else if (isScrollUp && currentScreen > 1) {
            if (isTouchEvent && Math.abs(totalTouchDeltaY) < swipeThreshold) {
                // Ignore small wiggles at the boundary; keep preventing default browser scroll
                e.preventDefault();
                gestureWasBlocked = true;
                return;
            }
            e.preventDefault();
            if (isTouchEvent) touchTriggered = true;
            blockedSwipeStreak = 0;
            transitionTo(currentScreen - 1);
        }
    }

    window.addEventListener("touchstart", (e) => {
        // Prevent background tracking if mobile menu is open
        const mobileMenu = document.getElementById("mobile-menu-overlay");
        if (mobileMenu && mobileMenu.classList.contains("is-open")) return;

        // A gesture that ends (next touchstart fires) without ever completing
        // a transition counts toward the streak that eventually forces one through.
        blockedSwipeStreak = gestureWasBlocked ? blockedSwipeStreak + 1 : 0;
        gestureWasBlocked = false;

        window.lastTouchY = e.touches[0].clientY;
        window.touchStartY = e.touches[0].clientY; // Save start position to calculate swipe distance
        touchTriggered = false;
        touchIsScrollingContent = false;

        const activeContent = screens[currentScreen - 1] ? screens[currentScreen - 1].el.querySelector(".screen-content") : null;
        if (activeContent) {
            // Check if the scroll container is parked at either boundary (using 15px safe margin)
            window.touchStartedAtBottom = activeContent.scrollTop + activeContent.clientHeight >= activeContent.scrollHeight - 15;
            window.touchStartedAtTop = activeContent.scrollTop <= 15;
        } else {
            window.touchStartedAtBottom = true;
            window.touchStartedAtTop = true;
        }
    }, { passive: true });

    const videoDuration = 7.6333;

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
                // Pre-seek the forward layer to its target only AFTER it's
                // actually hidden (inside swapLayers' own rAF, right after the
                // opacity flip lands) — doing this hard, instant jump while
                // scrollingVideo was still the visible layer flashed the
                // destination's exact paused frame for a moment before the
                // reverse scrub became visible (only ever noticeable on the
                // backward direction, since the forward branch's equivalent
                // pre-seek always targets the already-hidden reverse layer).
                swapLayers(scrollingVideoReverse, scrollingVideo, () => {
                    scrollingVideo.currentTime = targetTime;
                });
                seekToTarget(scrollingVideoReverse, targetTimeReverse, () => {
                    // Swap back to make forward video visible now that seek is complete
                    scrollingVideo.style.opacity = "1";
                    scrollingVideoReverse.style.opacity = "0";
                    if (onComplete) onComplete();
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

        const finalizeTransition = () => {
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

        if (nextScreenIndex === 1) {
            // Transitioning back to screen 1 (Lobby)
            scrollingVideo.pause();
            scrollingVideoReverse.pause();
            animateVideoTime(1, () => {
                const lobbyVideo = v1;
                gsap.set(v2, { opacity: 0 });
                v2.pause();

                lobbyVideo.currentTime = 0;
                lobbyVideo.playbackRate = 0.35;

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
        } else if (currentScreen === 1) {
            // Transitioning from screen 1 to screen 2+
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

            // Directly reveal the shared background and fade out the lobby video
            sharedVideoBg.style.transition = "";
            sharedVideoBg.style.display = "block";
            sharedVideoBg.offsetHeight;
            sharedVideoBg.style.opacity = "1";

            gsap.to(lobbyVideo, {
                opacity: 0,
                duration: 0.4,
                onComplete: () => {
                    lobbyVideo.pause();
                }
            });

            animateVideoTime(nextScreenIndex, () => {
                finalizeTransition();
            });
        } else {
            // Transitioning between screens 2, 3, 4, 5
            sharedVideoBg.style.display = "block";
            sharedVideoBg.style.opacity = "1";
            scrollingVideo.pause();
            scrollingVideoReverse.pause();
            
            animateVideoTime(nextScreenIndex, () => {
                finalizeTransition();
            });
        }
    }
}

/* ── Screen Exit Animation ───────────────────────────────────────────────────
   Content of the previous screen glides up and fades out quickly (0.35s),
   clearing the stage for the incoming scene.
   ────────────────────────────────────────────────────────────────────────── */
function animateScreenExit(screenEl) {
    const content = screenEl.querySelector(".screen-content");
    if (content) gsap.to(content, { opacity: 0, duration: 0.3, ease: "power2.in", overwrite: "auto" });

    const overlay = screenEl.querySelector(".screen-overlay");
    if (overlay) {
        const isHeroOrFooter = screenEl.id === "screen-1" || screenEl.id === "screen-footer";
        if (isHeroOrFooter) {
            gsap.set(overlay, { opacity: 1 });
        } else {
            gsap.to(overlay, {
                opacity: 0,
                duration: 0.5,
                delay: 0.05,
                ease: "power2.inOut",
                overwrite: "auto"
            });
        }
    }

    const movers = screenEl.querySelectorAll(".welcome-text-side, .leisure-bento-grid, .welcome-pillow-card");
    if (movers.length) gsap.to(movers, { y: -20, duration: 0.3, ease: "power2.in", overwrite: "auto" });
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
    if (toHeader) gsap.set(toHeader, { y: -30, opacity: 0 });
    if (labelTag) gsap.set(labelTag, { y: 24, opacity: 0 });
    if (title) gsap.set(title, { y: 30, opacity: 0 });
    if (subtitle) gsap.set(subtitle, { y: 30, opacity: 0 });
    if (divider) gsap.set(divider, { scaleX: 0, transformOrigin: "left" });
    if (infoItems.length) gsap.set(infoItems, { y: 26, opacity: 0 });
    if (tiles.length) gsap.set(tiles, { y: 26, opacity: 0 });
    if (card) gsap.set(card, { scale: 0.97, y: 30, opacity: 0 });
    if (scrollMouse) gsap.set(scrollMouse, { y: 10, opacity: 0 });

    if (overlay) {
        const isHeroOrFooter = screenEl.id === "screen-1" || screenEl.id === "screen-footer";
        if (isHeroOrFooter) {
            gsap.set(overlay, { opacity: 1 });
        } else {
            gsap.to(overlay, {
                opacity: 1,
                duration: 0.6,
                ease: "power2.out",
                overwrite: "auto"
            });
        }
    }

    // Info blocks settle in ~0.5s after the scene stops (owner request)
    const tl = gsap.timeline({ delay: 0.5, defaults: { ease: "power3.out" } });

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
    gsap.set(".scroll-indicator-mouse", { y: 15, opacity: 0 });
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

    // 7. Mouse scroll indicator at the bottom fades in
    entranceTl.to(".scroll-indicator-mouse", {
        y: 0,
        opacity: 0.85,
        duration: 0.8,
        ease: "power2.out"
    }, 1.15);

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
    const backdrop  = document.getElementById("pdf-modal-backdrop");
    const downloadBtn = document.getElementById("pdf-download-btn");

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
        
        modal.classList.add("is-open");
        document.body.style.overflow = "hidden";
    }

    function closePdf() {
        modal.classList.remove("is-open");
        document.body.style.overflow = "";
        // Short delay before clearing src to avoid flash
        setTimeout(() => { iframe.src = ""; }, 350);
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
            src = isMobile ? "/files/MemoGames mob.pdf" : "/files/MemoGames декстоп.pdf";
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

document.addEventListener("DOMContentLoaded", initPdfModal);

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

    // Close menu when a link inside it is clicked (except language switch buttons)
    menuLinks.forEach(link => {
        if (link.classList.contains("lang-btn")) return;
        link.addEventListener("click", () => {
            closeMenu();
        });
    });

    function openMenu() {
        toggle.classList.add("is-active");
        overlay.classList.add("is-open");
        
        // Disable scroll on main body to prevent background scrolling
        document.body.style.overflow = "hidden";

        // Premium fade-in slide animation using GSAP
        gsap.fromTo(".mobile-menu-section", 
            { opacity: 0, y: 15 }, 
            { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" }
        );
    }

    function closeMenu() {
        toggle.classList.remove("is-active");
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
    }
}


