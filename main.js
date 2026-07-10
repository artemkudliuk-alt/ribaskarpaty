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
});

let currentScreen = 1;
let screens = [];

function preloadFile(url, onProgress) {
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
    });
}

function preloadScrollingVideos() {
    const vScrolling = document.getElementById("video-scrolling");
    const vScrollingRev = document.getElementById("video-scrolling-reverse");
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    // vScrolling is already preloaded as a blob URL during the preloader step.
    // If for some reason it didn't get loaded, we assign the streaming source.
    if (vScrolling && !vScrolling.src) {
        vScrolling.preload = "auto";
        vScrolling.src = isMobile ? "scrolling video mob.mp4" : "scrolling video.mp4";
        vScrolling.load();
        vScrolling.addEventListener("canplay", () => {
            if (vScrolling.paused) vScrolling.play().then(() => vScrolling.pause()).catch(() => {});
        }, { once: true });
    }

    if (vScrollingRev) {
        vScrollingRev.preload = "auto";
        vScrollingRev.src = isMobile ? "scrolling video mob_reverse.mp4" : "scrolling video_reverse.mp4";
        vScrollingRev.load();
        vScrollingRev.addEventListener("canplay", () => {
            if (vScrollingRev.paused) vScrollingRev.play().then(() => vScrollingRev.pause()).catch(() => {});
        }, { once: true });
    }
}


function initPreloader() {
    const preloader = document.getElementById("preloader");
    const logoContainer = document.querySelector(".preloader-logo-container");
    const logoFill = document.querySelector(".preloader-logo.logo-fill");
    const preloaderVideo = preloader ? preloader.querySelector("video") : null;
    const progressText = preloader ? preloader.querySelector(".preloader-progress") : null;
    const videoLobby1 = document.getElementById("video-lobby-1");
    const videoLobby2 = document.getElementById("video-lobby-2");

    if (!preloader || !logoContainer || !logoFill || !preloaderVideo || !videoLobby1 || !videoLobby2) return;

    // Show logo silhouette immediately
    gsap.set(logoContainer, { opacity: 1, scale: 1 });

    let mainVideoReady = false;
    let preloaderVideoFinished = false;
    let waitingForMain = false;
    let lobbyVideoBlobUrl = null;

    // Safety timeout (15 seconds hard limit)
    const safetyTimeout = setTimeout(() => {
        console.log("Preloader safety timeout triggered. Forcing dismiss...");
        dismissPreloader();
    }, 15000);

    // Step 1: Preload preloader.mp4
    preloadFile("preloader.mp4", (percent) => {
        if (progressText) {
            progressText.textContent = `${Math.round(percent)}%`;
        }
        logoFill.style.clipPath = `inset(${100 - percent}% 0 0 0)`;
    })
    .then((preloaderBlobUrl) => {
        // Step 2: Play the preloader video
        preloaderVideo.src = preloaderBlobUrl;
        preloaderVideo.play().then(() => {
            preloaderVideo.addEventListener("timeupdate", checkPreloaderVideoProgress);
            preloaderVideo.addEventListener("ended", () => {
                preloaderVideoFinished = true;
                checkReadyState();
            });
        }).catch(err => {
            console.log("Preloader video autoplay blocked, bypass waiting.", err);
            preloaderVideoFinished = true;
            checkReadyState();
        });

        // Hide progress text once preloader starts playing
        gsap.to(progressText, { opacity: 0, duration: 0.3, delay: 0.2 });

        // Step 3: Start preloading both the main lobby video (1 screen.mp4) AND the active scrolling video in parallel
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        const scrollVideoSrc = isMobile ? "scrolling video mob.mp4" : "scrolling video.mp4";

        return Promise.all([
            preloadFile("1 screen.mp4", () => {}).catch(err => {
                console.warn("Lobby video preload failed, falling back to streaming:", err);
                return "1 screen.mp4";
            }),
            preloadFile(scrollVideoSrc, () => {}).catch(err => {
                console.warn("Scrolling video preload failed, falling back to streaming:", err);
                return scrollVideoSrc;
            })
        ]);
    })
    .then(([lobbyBlobUrl, scrollBlobUrl]) => {
        console.log("Lobby and scrolling videos preloaded!");
        lobbyVideoBlobUrl = lobbyBlobUrl;
        mainVideoReady = true;

        // Assign Blob URL to both lobby video layers
        videoLobby1.src = lobbyVideoBlobUrl;
        videoLobby2.src = lobbyVideoBlobUrl;

        // Initialize lobby loop now
        initLobbySeamlessLoop();

        // Assign Blob URL to scrolling video layer so it is ready immediately on first scroll
        const vScrolling = document.getElementById("video-scrolling");
        if (vScrolling) {
            vScrolling.preload = "auto";
            vScrolling.src = scrollBlobUrl;
            vScrolling.load();
            vScrolling.addEventListener("canplay", () => {
                if (vScrolling.paused) vScrolling.play().then(() => vScrolling.pause()).catch(() => {});
            }, { once: true });
        }

        if (waitingForMain) {
            waitingForMain = false;
            preloaderVideo.play().catch(() => {});
        }
        checkReadyState();
    })
    .catch((err) => {
        console.error("Preload engine error, running fallback...", err);
        preloaderVideo.src = "preloader.mp4";
        videoLobby1.src = "1 screen.mp4";
        videoLobby2.src = "1 screen.mp4";
        
        preloaderVideo.play().catch(() => {});
        initLobbySeamlessLoop();
        
        mainVideoReady = true;
        checkReadyState();
    });

    function checkPreloaderVideoProgress() {
        const duration = preloaderVideo.duration;
        const currentTime = preloaderVideo.currentTime;

        if (duration) {
            if (currentTime >= duration - 0.25 && !mainVideoReady) {
                preloaderVideo.pause();
                preloaderVideo.currentTime = duration - 0.25;
                waitingForMain = true;
                console.log("Main video not loaded yet. Pausing preloader video at 98%...");
            }

            if (currentTime >= duration - 0.05) {
                preloaderVideoFinished = true;
                checkReadyState();
            }
        }
    }

    function checkReadyState() {
        if (preloaderVideoFinished && mainVideoReady) {
            dismissPreloader();
        }
    }

    function dismissPreloader() {
        if (preloader.classList.contains("dismissed")) return;
        preloader.classList.add("dismissed");
        clearTimeout(safetyTimeout);

        console.log("Dismissing preloader...");

        // Lounge soundtrack fades in together with the first screen
        if (window.__ribasMusic) window.__ribasMusic.start();

        gsap.to(logoContainer, {
            opacity: 0,
            filter: "blur(18px)",
            scale: 1.05,
            duration: 1.0,
            ease: "power3.in"
        });

        if (progressText) {
            gsap.to(progressText, { opacity: 0, duration: 0.5, ease: "power2.in" });
        }

        gsap.to(preloaderVideo, {
            opacity: 0,
            duration: 1.2,
            ease: "power2.inOut",
            onComplete: () => {
                preloaderVideo.pause();
            }
        });

        gsap.to(preloader, {
            opacity: 0,
            duration: 1.5,
            delay: 0.5,
            ease: "power2.out",
            onComplete: () => {
                preloader.style.display = "none";
                preloadScrollingVideos();
            }
        });

        gsap.set("#screen-1", { display: "block", opacity: 0 });
        gsap.to("#screen-1", {
            opacity: 1,
            duration: 1.2,
            delay: 0.1,
            ease: "power2.out",
            onComplete: () => {
                console.log("Welcome screen active.");
                initTransitionTrigger();

                const pillowTab = document.getElementById("floating-pillow-tab");
                if (pillowTab) {
                    pillowTab.classList.add("is-visible");
                }
            }
        });

        animateWelcomeScreenEntrance();
    }
}

function initLobbySeamlessLoop() {
    const v1 = document.getElementById("video-lobby-1");
    const v2 = document.getElementById("video-lobby-2");
    if (!v1 || !v2) return;

    // Load both videos
    v1.load();
    v2.load();
    v1.playbackRate = 0.35;
    v2.playbackRate = 0.35;

    // Try playing video 1 immediately
    const startPlay = () => {
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

    if (!flashOverlay) return;

    // Preload per-screen loop/transition videos (scroll videos are handled
    // by preloadScrollingVideos with the blob engine)
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

    function handleScroll(e) {
        if (isTransitioning) return;

        const isTouchEvent = e.touches && e.touches.length > 0;
        if (isTouchEvent && touchTriggered) return;

        const deltaY = e.deltaY;
        const isTouchScrollDown = isTouchEvent && e.touches[0].clientY < window.lastTouchY;
        const isTouchScrollUp = isTouchEvent && e.touches[0].clientY > window.lastTouchY;

        const isScrollDown = deltaY > 0 || isTouchScrollDown;
        const isScrollUp = deltaY < 0 || isTouchScrollUp;

        if (isScrollDown && currentScreen < 6) {
            e.preventDefault();
            if (isTouchEvent) touchTriggered = true;
            transitionTo(currentScreen + 1);
        } else if (isScrollUp && currentScreen > 1) {
            e.preventDefault();
            if (isTouchEvent) touchTriggered = true;
            transitionTo(currentScreen - 1);
        }
    }

    window.addEventListener("touchstart", (e) => {
        window.lastTouchY = e.touches[0].clientY;
        touchTriggered = false;
    }, { passive: true });

    const videoDuration = 7.6333;

    function animateVideoTime(nextScreenIndex, onComplete) {
        const targetTime = screenTimestamps[nextScreenIndex];
        const currentForwardTime = scrollingVideo.currentTime;
        const isForward = targetTime > currentForwardTime;
        const timeDiff = Math.abs(targetTime - currentForwardTime);

        if (timeDiff < 0.02) {
            scrollingVideo.pause();
            scrollingVideoReverse.pause();
            scrollingVideo.currentTime = targetTime;
            scrollingVideoReverse.currentTime = videoDuration - targetTime;
            if (onComplete) onComplete();
            return;
        }

        // Cancel any pending checkTime loops
        if (scrollingVideo._seekAnimationFrame) cancelAnimationFrame(scrollingVideo._seekAnimationFrame);
        if (scrollingVideoReverse._seekAnimationFrame) cancelAnimationFrame(scrollingVideoReverse._seekAnimationFrame);
        scrollingVideo._seekAnimationFrame = null;
        scrollingVideoReverse._seekAnimationFrame = null;

        if (isForward) {
            // FADE IN FORWARD VIDEO, FADE OUT REVERSE VIDEO INSTANTLY
            scrollingVideo.style.opacity = "1";
            scrollingVideoReverse.style.opacity = "0";
            scrollingVideoReverse.pause();

            const targetTimeForward = targetTime;
            
            scrollingVideo.playbackRate = 1.0;
            scrollingVideo.play().then(() => {
                const checkTime = () => {
                    if (scrollingVideo.currentTime >= targetTimeForward - 0.02) {
                        scrollingVideo.pause();
                        scrollingVideo.currentTime = targetTimeForward;
                        scrollingVideoReverse.currentTime = videoDuration - targetTimeForward;
                        scrollingVideo._seekAnimationFrame = null;
                        if (onComplete) onComplete();
                    } else {
                        scrollingVideo._seekAnimationFrame = requestAnimationFrame(checkTime);
                    }
                };
                scrollingVideo._seekAnimationFrame = requestAnimationFrame(checkTime);
            }).catch(err => {
                console.log("Native forward play failed, seeking instantly:", err);
                scrollingVideo.currentTime = targetTimeForward;
                scrollingVideoReverse.currentTime = videoDuration - targetTimeForward;
                if (onComplete) onComplete();
            });
        } else {
            // FADE IN REVERSE VIDEO, FADE OUT FORWARD VIDEO INSTANTLY
            scrollingVideoReverse.style.opacity = "1";
            scrollingVideo.style.opacity = "0";
            scrollingVideo.pause();

            const targetTimeReverse = videoDuration - targetTime;
            
            scrollingVideoReverse.playbackRate = 1.0;
            scrollingVideoReverse.play().then(() => {
                const checkTime = () => {
                    if (scrollingVideoReverse.currentTime >= targetTimeReverse - 0.02) {
                        scrollingVideoReverse.pause();
                        scrollingVideoReverse.currentTime = targetTimeReverse;
                        scrollingVideo.currentTime = targetTime;
                        scrollingVideoReverse._seekAnimationFrame = null;
                        if (onComplete) onComplete();
                    } else {
                        scrollingVideoReverse._seekAnimationFrame = requestAnimationFrame(checkTime);
                    }
                };
                scrollingVideoReverse._seekAnimationFrame = requestAnimationFrame(checkTime);
            }).catch(err => {
                console.log("Native reverse play failed, seeking instantly:", err);
                scrollingVideoReverse.currentTime = targetTimeReverse;
                scrollingVideo.currentTime = targetTime;
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
            toScreen.el.style.display = "block";
            gsap.set(toScreen.el, { y: "100vh", opacity: 1 });

            const toContent = toScreen.el.querySelector(".screen-content");
            const toHeader = toScreen.el.querySelector(".main-header");
            if (toContent) gsap.set(toContent, { opacity: 0 });
            if (toHeader) gsap.set(toHeader, { opacity: 0 });

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

            gsap.set(toScreen.el, { display: "block", opacity: 1 });
            gsap.set(sharedVideoBg, { display: "block", opacity: 1 });
            
            // Hide incoming screen content at start
            const toContent = toScreen.el.querySelector(".screen-content");
            const toHeader = toScreen.el.querySelector(".main-header");
            const overlay = toScreen.el.querySelector(".screen-overlay");
            if (toContent) gsap.set(toContent, { opacity: 0 });
            if (toHeader) gsap.set(toHeader, { opacity: 0 });
            if (overlay) gsap.set(overlay, { opacity: 0 });

            scrollingVideo.pause();
            scrollingVideoReverse.pause();
            scrollingVideo.currentTime = screenTimestamps[5];
            scrollingVideoReverse.currentTime = videoDuration - screenTimestamps[5];
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

        // Hide incoming content at start; entrance animation runs in finalizeTransition when video pauses.
        skipEntranceInFinalize = false;
        gsap.set(toScreen.el, { display: "block", opacity: 1 });
        
        const toContent = toScreen.el.querySelector(".screen-content");
        const toHeader = toScreen.el.querySelector(".main-header");
        const overlay = toScreen.el.querySelector(".screen-overlay");
        if (toContent) gsap.set(toContent, { opacity: 0 });
        if (toHeader) gsap.set(toHeader, { opacity: 0 });
        if (overlay) gsap.set(overlay, { opacity: 0 });

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
                    sharedVideoBg.style.opacity = "0";
                    gsap.to(lobbyVideo, { opacity: 1, duration: 0.4 });
                    setTimeout(() => {
                        sharedVideoBg.style.display = "none";
                    }, 400);
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
            scrollingVideo.currentTime = 0.0;
            scrollingVideoReverse.currentTime = videoDuration;

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
    if (content) gsap.to(content, { opacity: 0, duration: 0.35, ease: "power2.in" });

    const overlay = screenEl.querySelector(".screen-overlay");
    if (overlay) gsap.to(overlay, { opacity: 0, duration: 0.35, ease: "power2.in" });

    const movers = screenEl.querySelectorAll(".welcome-text-side, .leisure-bento-grid, .welcome-pillow-card");
    if (movers.length) gsap.to(movers, { y: -20, duration: 0.35, ease: "power2.in", overwrite: "auto" });
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
    if (toContent) toContent.scrollTop = 0;

    // Reset any leftover exit offsets from a previous departure
    const movers = screenEl.querySelectorAll(".welcome-text-side, .leisure-bento-grid, .welcome-pillow-card");
    if (movers.length) gsap.set(movers, { y: 0, opacity: 1 });

    // Initialize all to starting state: everything rises softly into place
    gsap.set([toContent, toHeader], { opacity: 1 });
    if (overlay) gsap.set(overlay, { opacity: 0 });
    if (toHeader) gsap.set(toHeader, { y: -30, opacity: 0 });
    if (labelTag) gsap.set(labelTag, { y: 24, opacity: 0 });
    if (title) gsap.set(title, { y: 30, opacity: 0 });
    if (subtitle) gsap.set(subtitle, { y: 30, opacity: 0 });
    if (divider) gsap.set(divider, { scaleX: 0, transformOrigin: "left" });
    if (infoItems.length) gsap.set(infoItems, { y: 26, opacity: 0 });
    if (tiles.length) gsap.set(tiles, { y: 26, opacity: 0 });
    if (card) gsap.set(card, { scale: 0.97, y: 30, opacity: 0 });
    if (scrollMouse) gsap.set(scrollMouse, { y: 10, opacity: 0 });

    // Info blocks settle in ~0.5s after the scene stops (owner request)
    const tl = gsap.timeline({ delay: 0.5, defaults: { ease: "power3.out" } });

    // 0. Dark Overlay fades in
    if (overlay) {
        tl.to(overlay, { opacity: 1, duration: 0.4 }, 0.05);
    }
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
    gsap.set("#screen-1 .screen-label-tag", { y: 15, opacity: 0 });
    gsap.set("#screen-1 .welcome-title", { y: 25, opacity: 0 });
    gsap.set("#screen-1 .welcome-divider", { scaleX: 0, transformOrigin: "left" });
    gsap.set("#screen-1 .welcome-subtitle", { y: 15, opacity: 0 });
    gsap.set(".scroll-indicator-mouse", { y: 15, opacity: 0 });
}

function animateWelcomeScreenEntrance() {
    console.log("Starting Screen 1 Staggered Entrance Animation...");
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
                gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
                gsap.fromTo(".mobile-modal-content", 
                    { scale: 0.92, y: 24 }, 
                    { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
                );
            }
        });
    });

    const closeModal = () => {
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
            gsap.fromTo(youtubeModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(youtubeModal.querySelector(".mobile-modal-content"), 
                { scale: 0.92, y: 24 }, 
                { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
            );
        };

        const closeVideo = () => {
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
    }

    if (viewBooksBtn && booksModal && closeBooksBtn) {
        const openBooks = () => {
            booksModal.style.display = "flex";
            gsap.fromTo(booksModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(booksModal.querySelector(".mobile-modal-content"), 
                { scale: 0.92, y: 24 }, 
                { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
            );
        };

        const closeBooks = () => {
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
            gsap.fromTo(safeModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(safeModal.querySelector(".mobile-modal-content"), 
                { scale: 0.92, y: 24 }, 
                { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
            );
        };

        const closeSafe = () => {
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
    }

    if (baggageBtn && baggageModal && closeBaggageBtn) {
        const openBaggage = () => {
            baggageModal.style.display = "flex";
            gsap.fromTo(baggageModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            gsap.fromTo(baggageModal.querySelector(".mobile-modal-content"), 
                { scale: 0.92, y: 24 }, 
                { scale: 1, y: 0, duration: 0.4, ease: "power3.out" }
            );
        };

        const closeBaggage = () => {
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

            // Update active state
            langButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            currentLanguage = selectedLang;
            localStorage.setItem("ribas_lang", currentLanguage);

            // Animate page content out, apply translation, animate in
            const activeScreenEl = screens[currentScreen - 1].el;
            const content = activeScreenEl.querySelector(".screen-content");
            const overlay = activeScreenEl.querySelector(".screen-overlay");
            
            const tl = gsap.timeline();
            if (content) tl.to(content, { opacity: 0, duration: 0.2, ease: "power2.in" });
            if (overlay) tl.to(overlay, { opacity: 0, duration: 0.2, ease: "power2.in" }, 0);
            
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
    const TARGET_VOL = 0.3;
    const FADE_IN = 2.5;
    const CROSSFADE = 1.6;

    const trackA = new Audio("music.mp3");
    const trackB = new Audio("music.mp3");
    trackA.preload = "auto";
    trackB.preload = "auto";

    let active = trackA;
    let standby = trackB;
    let crossfading = false;
    let muted = false;
    let preloaderDismissed = false;
    let audioUnlocked = false;

    try { muted = localStorage.getItem("ribasMuted") === "1"; } catch (e) {}

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

        active.volume = preloaderDismissed ? TARGET_VOL : 0;
        
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

    // Try to play immediately on load (if allowed) and register gesture listeners immediately
    tryPlay();
    addGestureFallbacks();

    window.__ribasMusic = {
        start() {
            preloaderDismissed = true;
            if (audioUnlocked && active && !active.paused && !muted) {
                gsap.to(active, { volume: TARGET_VOL, duration: FADE_IN, ease: "power1.out" });
                return Promise.resolve();
            } else {
                return tryPlay();
            }
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
