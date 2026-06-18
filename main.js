/* ==========================================================================
   RIBAS KARPATY — PREMIUM CINEMATIC WEBSITE SCRIPT
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------------
    // 1. SCREEN CONFIGURATIONS (7 SCREENS)
    // ----------------------------------------------------------------------
    const screenConfigs = [
        {
            id: "screen-1",
            videoTime: 0.0,
            gradOpacity: 0.75,
            contactsOpacity: 1,
            indicatorOpacity: 1.0,
            hasButton: true,
            flightDuration: 1.0
        },
        {
            id: "screen-2",
            videoTime: 2.0, // Adjusted to 2.0s
            gradOpacity: 0.65,
            contactsOpacity: 0,
            indicatorOpacity: 0.75,
            hasButton: false,
            flightDuration: 2.0
        },
        {
            id: "screen-3",
            videoTime: 4.0,
            gradOpacity: 0.55,
            contactsOpacity: 0,
            indicatorOpacity: 0.75,
            hasButton: false,
            flightDuration: 2.0
        },
        {
            id: "screen-4",
            videoTime: 8.0,
            gradOpacity: 0.75,
            contactsOpacity: 0,
            indicatorOpacity: 0.75,
            hasButton: true,
            flightDuration: 4.0
        },
        {
            id: "screen-5",
            videoTime: 9.5, // Adjusted to 9.5s
            gradOpacity: 0.85,
            contactsOpacity: 0,
            indicatorOpacity: 0.75,
            hasButton: true,
            flightDuration: 1.5
        },
        {
            id: "screen-6",
            videoTime: 11.5, // Adjusted to 11.5s
            gradOpacity: 0.65,
            contactsOpacity: 0,
            indicatorOpacity: 0.75,
            hasButton: true,
            flightDuration: 2.0
        },
        {
            id: "screen-7",
            videoTime: 15.0,
            gradOpacity: 0.85,
            contactsOpacity: 1,
            indicatorOpacity: 0.0,
            hasButton: true,
            flightDuration: 3.5
        }
    ];

    // ----------------------------------------------------------------------
    // 2. DOM ELEMENTS & STATE MANAGEMENT
    // ----------------------------------------------------------------------
    const heroVideo = document.getElementById("hero-video");
    const scrollVideo = document.getElementById("scroll-video");
    const gradOverlay = document.querySelector(".gradient-overlay");
    const contactsOverlay = document.getElementById("contacts-overlay");
    const scrollIndicator = document.getElementById("scroll-indicator");
    const timelineDots = document.querySelectorAll(".timeline-dot");

    let currentScreenIndex = 0;
    let isAnimating = false;
    let lastSeekedTime = -1;

    // Seek queue states to prevent decoder choke
    let isSeeking = false;
    let pendingSeekTime = null;
    let checkTargetReached = false;
    let activeTargetConfig = null;
    let activeTargetScreen = null;
    let triggerFadeInFn = null;
    let isNativePlaying = false;

    // Dynamically set video source based on screen width (768px threshold)
    const isMobileDevice = window.innerWidth <= 768;
    const selectedVideoSource = isMobileDevice ? "Scrool_video_mobile.mp4" : "Scrool_video_desktop.mp4";
    
    const videoSourceElement = document.createElement("source");
    videoSourceElement.src = selectedVideoSource;
    videoSourceElement.type = "video/mp4";
    scrollVideo.appendChild(videoSourceElement);

    // Force load scroll video immediately to fetch metadata
    scrollVideo.load();

    // Proxy object for GSAP timeline animations
    const videoProxyState = { time: 0 };

    // ----------------------------------------------------------------------
    // 3. HIGH PERFORMANCE SEEK LOOP (rAF + seeked queue)
    // ----------------------------------------------------------------------
    function updateVideoFrame() {
        if (isNativePlaying) {
            // Native playback drives the time proxy
            videoProxyState.time = scrollVideo.currentTime;
        } else if (scrollVideo && scrollVideo.readyState >= 1) {
            const roundedTarget = Math.round(videoProxyState.time * 100) / 100;
            if (roundedTarget !== lastSeekedTime) {
                lastSeekedTime = roundedTarget;
                
                if (!isSeeking) {
                    isSeeking = true;
                    scrollVideo.currentTime = roundedTarget;
                } else {
                    pendingSeekTime = roundedTarget;
                }
            }
        }
        requestAnimationFrame(updateVideoFrame);
    }

    // Queue seek completion handler
    scrollVideo.addEventListener("seeked", () => {
        isSeeking = false;
        
        if (checkTargetReached && activeTargetConfig && Math.abs(scrollVideo.currentTime - activeTargetConfig.videoTime) < 0.25) {
            checkTargetReached = false;
            if (triggerFadeInFn) {
                triggerFadeInFn();
                triggerFadeInFn = null;
            }
        } else if (pendingSeekTime !== null) {
            const nextTarget = pendingSeekTime;
            pendingSeekTime = null;
            
            if (scrollVideo && scrollVideo.readyState >= 1) {
                isSeeking = true;
                scrollVideo.currentTime = nextTarget;
            }
        }
    });

    // Force load metadata & render first frame
    scrollVideo.addEventListener("loadedmetadata", () => {
        scrollVideo.currentTime = 0;
    });
    if (scrollVideo.readyState >= 1) {
        scrollVideo.currentTime = 0;
    }

    // Start render loop
    requestAnimationFrame(updateVideoFrame);

    // ----------------------------------------------------------------------
    // 4. LUXURY PRELOADER MANAGER
    // ----------------------------------------------------------------------
    const preloader = document.getElementById("preloader");
    const loaderPercent = document.getElementById("loader-percent");
    const loaderBar = document.querySelector(".preloader-bar");
    let loadValue = 0;

    const preloaderInterval = setInterval(() => {
        // Increment percentage quickly to 35%, then slower, then wait for video readyState
        if (loadValue < 35) {
            loadValue += Math.floor(Math.random() * 5) + 3;
        } else if (loadValue < 85) {
            loadValue += Math.floor(Math.random() * 2) + 1;
        } else if (loadValue < 99 && scrollVideo.readyState >= 1) {
            loadValue += 1;
        } else if (scrollVideo.readyState >= 1) {
            loadValue = 100;
            clearInterval(preloaderInterval);
            
            // Pulse fade out of preloader
            gsap.to(preloader, {
                opacity: 0,
                duration: 0.8,
                ease: "power2.out",
                onComplete: () => {
                    preloader.style.visibility = "hidden";
                    triggerIntroAnimation(); // Run initial text slide-in
                }
            });
        }

        loaderPercent.textContent = `${loadValue}%`;
        loaderBar.style.width = `${loadValue}%`;
    }, 45);

    // ----------------------------------------------------------------------
    // 5. INITIAL TEXT STATE CONFIG
    // ----------------------------------------------------------------------
    screenConfigs.forEach((config, index) => {
        const screen = document.getElementById(config.id);
        const heading = screen.querySelector("h1, h2");
        const subtitle = screen.querySelector(".subtitle");
        const button = screen.querySelector(".luxury-btn");

        // Hide all texts initially
        gsap.set(heading, { opacity: 0, y: 45 });
        if (subtitle) gsap.set(subtitle, { opacity: 0, y: 35 });
        if (button) gsap.set(button, { opacity: 0, y: 30 });

        // Hide SPA advantages if present on this screen
        const rightCol = screen.querySelector(".spa-right-col");
        const rightItems = screen.querySelectorAll(".spa-advantage-item");
        if (rightCol) {
            gsap.set(rightCol, { opacity: 0, y: 20 });
            rightItems.forEach(item => {
                gsap.set(item, { opacity: 0, x: 15 });
                const icon = item.querySelector(".spa-advantage-icon");
                if (icon) {
                    gsap.set(icon, { scale: 0, rotate: -30, opacity: 0 });
                    const shapes = icon.querySelectorAll("svg *");
                    shapes.forEach(shape => {
                        if (typeof shape.getTotalLength === "function") {
                            const len = shape.getTotalLength();
                            gsap.set(shape, { strokeDasharray: len, strokeDashoffset: len });
                        }
                    });
                }
            });
        }

        screen.classList.remove("active");
    });

    // Set initial overlay states
    gsap.set(gradOverlay, { opacity: screenConfigs[0].gradOpacity });
    gsap.set(contactsOverlay, { opacity: 0, y: 20 }); // Wait for loader intro
    gsap.set(scrollIndicator, { opacity: 0 });

    // Intro animation triggered when Preloader finishes
    function triggerIntroAnimation() {
        const screen1 = document.getElementById("screen-1");
        const heading = screen1.querySelector("h1");
        const subtitle = screen1.querySelector(".subtitle");
        const button = screen1.querySelector(".luxury-btn");

        screen1.classList.add("active");
        heroVideo.play().catch(e => console.log(e));

        const introTl = gsap.timeline();
        introTl.to(heading, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" })
               .to(subtitle, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0.2)
               .to(button, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0.4)
               .to(contactsOverlay, { opacity: screenConfigs[0].contactsOpacity, y: 0, duration: 0.8 }, 0.2)
               .to(scrollIndicator, { opacity: screenConfigs[0].indicatorOpacity, duration: 0.8 }, 0.4);
    }

    // ----------------------------------------------------------------------
    // 6. MASTER SLIDE TRANSITION FUNCTION (GO TO SCREEN)
    // ----------------------------------------------------------------------
    function goToScreen(targetIndex) {
        if (isAnimating || targetIndex === currentScreenIndex) return;
        if (targetIndex < 0 || targetIndex >= screenConfigs.length) return;

        isAnimating = true;

        const currentConfig = screenConfigs[currentScreenIndex];
        const targetConfig = screenConfigs[targetIndex];

        activeTargetConfig = targetConfig;
        activeTargetScreen = document.getElementById(targetConfig.id);
        checkTargetReached = false;

        const currentScreen = document.getElementById(currentConfig.id);
        const targetScreen = activeTargetScreen;

        const currentHeading = currentScreen.querySelector("h1, h2");
        const currentSubtitle = currentScreen.querySelector(".subtitle");
        const currentBtn = currentScreen.querySelector(".luxury-btn");

        const targetHeading = targetScreen.querySelector("h1, h2");
        const targetSubtitle = targetScreen.querySelector(".subtitle");
        const targetBtn = targetScreen.querySelector(".luxury-btn");

        // Calculate dynamic flight duration based on seek span
        const flightDuration = Math.abs(targetConfig.videoTime - currentConfig.videoTime) > 0
            ? targetConfig.flightDuration
            : 0.5;

        // Transition Master Timeline
        const tl = gsap.timeline();

        // A. FADE OUT CURRENT TEXT (0.4s duration)
        tl.to(currentHeading, { opacity: 0, y: -45, duration: 0.4, ease: "power2.in" }, 0);
        if (currentSubtitle) {
            tl.to(currentSubtitle, { opacity: 0, y: -35, duration: 0.4, ease: "power2.in" }, 0.05);
        }

        if (currentConfig.hasButton && currentBtn) {
            tl.to(currentBtn, { opacity: 0, y: -30, duration: 0.4, ease: "power2.in" }, 0);
        }

        const currentRightCol = currentScreen.querySelector(".spa-right-col");
        if (currentRightCol) {
            tl.to(currentRightCol, { opacity: 0, y: 20, duration: 0.35, ease: "power2.in" }, 0);
        }

        // Deactivate old screen visibility
        tl.call(() => {
            currentScreen.classList.remove("active");
        }, null, 0.4);

        // B. VIDEO LAYERS SWITCHING (Hero <-> Scroll Video)
        if (currentScreenIndex === 0 && targetIndex > 0) {
            tl.to("#hero-video", {
                opacity: 0,
                duration: 0.5,
                ease: "power2.out",
                onComplete: () => {
                    heroVideo.pause();
                }
            }, 0.1);
        } else if (currentScreenIndex > 0 && targetIndex === 0) {
            tl.call(() => {
                heroVideo.play().catch(e => console.log(e));
            }, null, 0.1);
            tl.to("#hero-video", { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.1);
        }

        // C. DRONE FLIGHT TRANSITION
        const isForward = targetConfig.videoTime > scrollVideo.currentTime;

        if (isForward && Math.abs(targetConfig.videoTime - scrollVideo.currentTime) > 0.1) {
            // Forward movement: Use native hardware-accelerated playback at dynamic playbackRate
            const timeDelta = targetConfig.videoTime - scrollVideo.currentTime;
            const playRate = timeDelta / flightDuration;
            
            tl.call(() => {
                isNativePlaying = true;
                scrollVideo.playbackRate = playRate;
                scrollVideo.play().catch(e => console.log(e));
            }, null, 0.2);

            // Animate a dummy block to match flightDuration and trigger completion
            tl.to({}, {
                duration: flightDuration,
                onComplete: () => {
                    isNativePlaying = false;
                    scrollVideo.pause();
                    scrollVideo.currentTime = targetConfig.videoTime;
                    triggerFadeIn();
                }
            }, 0.2);
        } else {
            // Backward or micro-movement: Fall back to optimized frame seeking
            tl.to(videoProxyState, {
                time: targetConfig.videoTime,
                duration: flightDuration,
                ease: "power2.inOut",
                onComplete: () => {
                    const timeDiff = Math.abs(scrollVideo.currentTime - targetConfig.videoTime);
                    if (!isSeeking || timeDiff < 0.25) {
                        triggerFadeIn();
                    } else {
                        checkTargetReached = true;
                    }
                }
            }, 0.2);
        }

        // D. GRADIENT OVERLAY & CONFLICT UI OVERLAYS
        tl.to(gradOverlay, { opacity: targetConfig.gradOpacity, duration: flightDuration, ease: "power2.out" }, 0.2);
        
        tl.to(contactsOverlay, { 
            opacity: targetConfig.contactsOpacity, 
            y: targetConfig.contactsOpacity === 0 ? 20 : 0, 
            duration: 0.6, 
            ease: "power2.out" 
        }, 0.2);

        const isMobile = window.innerWidth <= 768;
        const targetIndicatorOpacity = (isMobile && targetIndex >= 3) ? 0 : targetConfig.indicatorOpacity;

        tl.to(scrollIndicator, { 
            opacity: targetIndicatorOpacity, 
            duration: 0.6, 
            ease: "power2.out" 
        }, 0.2);

        // Update Timeline dot positions instantly
        timelineDots.forEach(d => d.classList.remove("active"));
        timelineDots[targetIndex].classList.add("active");

        // Define the fade-in callback
        triggerFadeInFn = triggerFadeIn;

        // E. FADE IN TARGET TEXT FUNCTION (Called when video reaches target frame)
        function triggerFadeIn() {
            triggerFadeInFn = null;
            
            const textTl = gsap.timeline({
                onComplete: () => {
                    currentScreenIndex = targetIndex;
                    isAnimating = false;
                }
            });

            // Prep target positions & show layout
            gsap.set(targetHeading, { y: 45, opacity: 0 });
            if (targetSubtitle) gsap.set(targetSubtitle, { y: 35, opacity: 0 });
            if (targetConfig.hasButton && targetBtn) {
                gsap.set(targetBtn, { y: 30, opacity: 0 });
            }
            
            const rightCol = targetScreen.querySelector(".spa-right-col");
            const rightItems = targetScreen.querySelectorAll(".spa-advantage-item");
            if (rightCol) {
                gsap.set(rightCol, { opacity: 0, y: 20 });
                rightItems.forEach(item => {
                    gsap.set(item, { opacity: 0, x: 15 });
                    const icon = item.querySelector(".spa-advantage-icon");
                    if (icon) {
                        gsap.set(icon, { scale: 0, rotate: -30, opacity: 0 });
                        const shapes = icon.querySelectorAll("svg *");
                        shapes.forEach(shape => {
                            if (typeof shape.getTotalLength === "function") {
                                const len = shape.getTotalLength();
                                gsap.set(shape, { strokeDasharray: len, strokeDashoffset: len });
                            }
                        });
                    }
                });
            }

            targetScreen.classList.add("active");

            // Luxury Word-by-word feel staggers
            textTl.to(targetHeading, { opacity: 1, y: 0, duration: 0.65, ease: "power2.out" }, 0);
            if (targetSubtitle) {
                textTl.to(targetSubtitle, { opacity: 1, y: 0, duration: 0.65, ease: "power2.out" }, 0.15);
            }

            if (targetConfig.hasButton && targetBtn) {
                textTl.to(targetBtn, { opacity: 1, y: 0, duration: 0.65, ease: "power2.out" }, 0.35);
            }

            if (rightCol) {
                textTl.to(rightCol, { opacity: 1, y: 0, duration: 0.65, ease: "power2.out" }, 0.2);
                
                rightItems.forEach((item, idx) => {
                    const itemDelay = 0.35 + (idx * 0.08);
                    
                    // Animate the item container fade/slide
                    textTl.to(item, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, itemDelay);
                    
                    // Pop in the icon container with back-out bounce
                    const icon = item.querySelector(".spa-advantage-icon");
                    if (icon) {
                        textTl.to(icon, { 
                            scale: 1, 
                            rotate: 0, 
                            opacity: 1, 
                            duration: 0.6, 
                            ease: "back.out(1.5)" 
                        }, itemDelay);
                        
                        // Draw SVG strokes dynamically
                        const shapes = icon.querySelectorAll("svg *");
                        shapes.forEach(shape => {
                            if (typeof shape.getTotalLength === "function") {
                                textTl.to(shape, { 
                                    strokeDashoffset: 0, 
                                    duration: 0.7, 
                                    ease: "power2.out" 
                                }, itemDelay + 0.1);
                            }
                        });
                    }
                });
            }
        }
    }

    // ----------------------------------------------------------------------
    // 7. GESTURE DETECTION SYSTEMS
    // ----------------------------------------------------------------------
    function navigate(direction) {
        if (isAnimating) return;
        const target = currentScreenIndex + direction;
        if (target >= 0 && target < screenConfigs.length) {
            goToScreen(target);
        }
    }

    // Wheel Scroll Detection (Guarded by animation state)
    window.addEventListener("wheel", (e) => {
        e.preventDefault();
        
        if (isAnimating) return;

        if (Math.abs(e.deltaY) > 2) {
            if (e.deltaY > 0) {
                navigate(1);
            } else {
                navigate(-1);
            }
        }
    }, { passive: false });

    // Touch Swipe Gesture Detection (Mobile)
    let touchStartY = 0;
    window.addEventListener("touchstart", (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener("touchend", (e) => {
        if (isAnimating) return;
        const touchEndY = e.changedTouches[0].clientY;
        const swipeDistance = touchStartY - touchEndY;

        if (Math.abs(swipeDistance) > 60) {
            if (swipeDistance > 0) {
                navigate(1);
            } else {
                navigate(-1);
            }
        }
    }, { passive: true });

    // Keyboard Accessibility
    window.addEventListener("keydown", (e) => {
        if (isAnimating) return;
        if (["ArrowDown", "PageDown", " "].includes(e.key)) {
            e.preventDefault();
            navigate(1);
        } else if (["ArrowUp", "PageUp"].includes(e.key)) {
            e.preventDefault();
            navigate(-1);
        }
    });

    // ----------------------------------------------------------------------
    // 8. PROGRESS TIMELINE dot click bindings
    // ----------------------------------------------------------------------
    timelineDots.forEach((dot, idx) => {
        dot.addEventListener("click", () => {
            if (isAnimating) return;
            goToScreen(idx);
        });
    });

    // ----------------------------------------------------------------------
    // 9. LUXURY NAVIGATION MENU
    // ----------------------------------------------------------------------
    const menuTrigger = document.getElementById("menu-trigger");
    const menuOverlay = document.getElementById("menu-overlay");
    const menuClose = document.getElementById("menu-close");
    const menuLinks = document.querySelectorAll(".menu-link");

    let menuTimeline = gsap.timeline({ paused: true });
    menuTimeline.to(menuOverlay, { display: "flex", opacity: 1, duration: 0.3, ease: "power2.out" })
                .from(".menu-link", { y: 40, opacity: 0, stagger: 0.1, duration: 0.4, ease: "power2.out" }, "-=0.15");

    menuTrigger.addEventListener("click", () => {
        menuOverlay.setAttribute("aria-hidden", "false");
        menuTimeline.play();
    });

    function closeMenu() {
        menuOverlay.setAttribute("aria-hidden", "true");
        menuTimeline.reverse();
    }
    menuClose.addEventListener("click", closeMenu);

    menuLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            closeMenu();
            
            const targetScreenIndex = parseInt(link.getAttribute("data-target-screen"));
            let targetIdx = 0;
            if (targetScreenIndex === 4) targetIdx = 3;
            else if (targetScreenIndex === 5) targetIdx = 4;
            else if (targetScreenIndex === 6) targetIdx = 5;
            
            setTimeout(() => goToScreen(targetIdx), 350);
        });
    });

    // Close menu on ESC
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && menuOverlay.getAttribute("aria-hidden") === "false") {
            closeMenu();
        }
    });

    // ----------------------------------------------------------------------
    // 10. LUXURY CUSTOM CURSOR PHYSICS & ANIMATION
    // ----------------------------------------------------------------------
    const cursorRing = document.getElementById("custom-cursor");

    let cursorX = 0, cursorY = 0;
    let targetX = 0, targetY = 0;
    const lerpFactor = 0.15; // Smooth ring catch-up delay

    document.addEventListener("mousemove", (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
        
        // Show cursor items on first move
        gsap.set(cursorRing, { opacity: 1 });
    });

    function animateCursor() {
        cursorX += (targetX - cursorX) * lerpFactor;
        cursorY += (targetY - cursorY) * lerpFactor;
        
        gsap.set(cursorRing, { x: cursorX, y: cursorY });
        requestAnimationFrame(animateCursor);
    }
    requestAnimationFrame(animateCursor);

    // Magnetic click styling on hoverable targets
    function bindCursorHovers() {
        const hoverables = document.querySelectorAll("button, a, .menu-trigger, .timeline-dot");
        hoverables.forEach(el => {
            el.addEventListener("mouseenter", () => {
                cursorRing.classList.add("cursor-active");
            });
            el.addEventListener("mouseleave", () => {
                cursorRing.classList.remove("cursor-active");
            });
        });
    }
    bindCursorHovers();

    // Re-bind cursor hovers when dynamic elements change or load
    const observer = new MutationObserver(bindCursorHovers);
    observer.observe(document.body, { childList: true, subtree: true });

    // ----------------------------------------------------------------------
    // 11. INTERACTIVE TRIGGERS
    // ----------------------------------------------------------------------
    const bookingTriggers = document.querySelectorAll(".booking-trigger");
    const menuPdfTrigger = document.querySelector(".menu-pdf-trigger");
    const selectRoomTrigger = document.querySelector(".select-room-trigger");

    bookingTriggers.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            if (index === 0) {
                goToScreen(6); // Flight to Night Finale
            } else {
                showNotification("Дякуємо за ваш вибір! Наш консьєрж зв'яжеться з вами протягом 10 хвилин для підтвердження бронювання.");
            }
        });
    });

    if (menuPdfTrigger) {
        menuPdfTrigger.addEventListener("click", () => {
            showNotification("Відкриваємо гастрономічну карту ресторану Ribas Karpaty... Смачного!");
        });
    }

    if (selectRoomTrigger) {
        selectRoomTrigger.addEventListener("click", () => {
            showNotification("Завантажуємо доступні категорії номерів преміум-класу...");
        });
    }

    const spaPriceTrigger = document.querySelector(".spa-price-trigger");
    if (spaPriceTrigger) {
        spaPriceTrigger.addEventListener("click", () => {
            showNotification("Завантажуємо прайс-лист SPA-послуг готелю Ribas Karpaty...");
        });
    }

    // Luxury Notification Toast
    function showNotification(message) {
        const existingToast = document.querySelector(".luxury-toast");
        if (existingToast) existingToast.remove();

        const toast = document.createElement("div");
        toast.className = "luxury-toast";
        toast.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 40px;
            background: rgba(10, 10, 10, 0.95);
            border: 1px solid var(--gold);
            color: var(--white);
            padding: 16px 28px;
            font-family: var(--font-accent);
            font-size: 16px;
            border-radius: 4px;
            z-index: 9999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            transform: translateY(30px);
            opacity: 0;
            pointer-events: none;
            max-width: 400px;
            line-height: 1.6;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        gsap.to(toast, {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: "power2.out",
            onComplete: () => {
                gsap.to(toast, {
                    opacity: 0,
                    y: 20,
                    duration: 0.4,
                    delay: 5,
                    ease: "power2.in",
                    onComplete: () => toast.remove()
                });
            }
        });
    }
});
