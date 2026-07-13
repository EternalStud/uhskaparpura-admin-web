"use strict";

let progressInterval = null;
let currentProgress = 0;

/**
 * Injects required styles for the premium loader, eyes animation, progress bar, and local loaders.
 */
function injectStyles() {
    if (document.getElementById("loader-styles")) return;
    const style = document.createElement("style");
    style.id = "loader-styles";
    style.textContent = `
        .top-progress-bar {
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--color-primary, #4f46e5), #818cf8);
            z-index: 99999;
            width: 0%;
            transition: width 200ms ease-out, opacity 300ms ease-in-out;
            box-shadow: 0 0 8px rgba(79, 70, 229, 0.4);
        }
        .loader-backdrop {
            background: rgba(248, 250, 252, 0.45) !important;
            backdrop-filter: blur(6px) !important;
            transition: opacity 300ms ease-in-out;
        }
        .loader-spinner-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            background: var(--color-bg, #ffffff);
            padding: 20px 32px;
            border-radius: var(--radius-lg, 12px);
            border: 1px solid var(--color-border, rgba(0, 0, 0, 0.05));
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03);
            animation: loaderPop 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .loader-spinner-text {
            font-size: 0.825rem;
            font-weight: 600;
            color: var(--color-text-dark, #1e293b);
            letter-spacing: -0.012em;
        }
        .eyes-loader {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 32px;
            margin-bottom: 2px;
        }
        .eyes-loader svg {
            animation: eyesBlink 4s infinite ease-in-out;
            transform-origin: center;
        }
        .loader-pupil {
            animation: pupilLook 3s infinite ease-in-out;
            transform-origin: center;
        }
        
        /* Local Progress Indicator Styles */
        .local-progress-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: rgba(79, 70, 229, 0.08);
            border-radius: 0 0 var(--radius-md, 6px) var(--radius-md, 6px);
            overflow: hidden;
            z-index: 10;
        }
        .local-progress-bar-fill {
            height: 100%;
            width: 40%;
            background: linear-gradient(90deg, var(--color-primary, #4f46e5), #818cf8);
            border-radius: inherit;
            animation: localProgressAnim 1s infinite linear;
            transform-origin: left;
        }
        .local-progress-bar.fade-out {
            opacity: 0;
            transition: opacity 250ms ease-in-out;
        }

        @keyframes pupilLook {
            0%, 100% { transform: translate(0px, 0px); }
            15% { transform: translate(-3px, 0px); }
            30% { transform: translate(-3px, 0px); }
            45% { transform: translate(3px, 0px); }
            60% { transform: translate(3px, 0px); }
            75% { transform: translate(0px, -2px); }
            85% { transform: translate(0px, 0px); }
        }
        @keyframes eyesBlink {
            0%, 48%, 50%, 98%, 100% { transform: scaleY(1); }
            49%, 99% { transform: scaleY(0.08); }
        }
        @keyframes loaderPop {
            0% { transform: scale(0.9); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        @keyframes localProgressAnim {
            0% { transform: translateX(-100%) scaleX(1); }
            50% { transform: translateX(0%) scaleX(1.4); }
            100% { transform: translateX(100%) scaleX(1); }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Shows the global loading indicator with a top progress bar.
 * @returns {void}
 */
export function showLoader(options = { blocking: true }) {
    try {
        injectStyles();
        
        // Add top progress bar directly to body
        if (!document.querySelector(".top-progress-bar")) {
            const bar = document.createElement("div");
            bar.className = "top-progress-bar";
            document.body.appendChild(bar);
        }

        if (options && options.blocking !== false) {
            const root = document.querySelector("#loader-root");
            if (root && !root.children.length) {
                root.innerHTML = `
                    <div class="loader-backdrop" role="status" aria-label="Loading">
                        <div class="loader-spinner-container">
                            <div class="eyes-loader">
                                <svg width="70" height="30" viewBox="0 0 70 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <ellipse cx="22" cy="15" rx="12" ry="12" fill="white" stroke="var(--color-primary, #4f46e5)" stroke-width="2.5"/>
                                    <ellipse cx="48" cy="15" rx="12" ry="12" fill="white" stroke="var(--color-primary, #4f46e5)" stroke-width="2.5"/>
                                    <circle class="loader-pupil" cx="22" cy="15" r="4.5" fill="#1e293b"/>
                                    <circle class="loader-pupil" cx="48" cy="15" r="4.5" fill="#1e293b"/>
                                </svg>
                            </div>
                            <div class="loader-spinner-text">Processing request...</div>
                        </div>
                    </div>
                `;
            }
        }

        startProgressBar();
    } catch (error) {
        console.error(error);
    }
}

/**
 * Hides the global loading indicator and finishes the progress bar.
 * @returns {void}
 */
export function hideLoader() {
    try {
        document.querySelector("#loader-root")?.replaceChildren();
        finishProgressBar();
    } catch (error) {
        console.error(error);
    }
}

/**
 * Shows an inline contextual progress bar at the bottom of the wrapper of a specific element.
 * @param {string} elementSelector CSS selector of the input/select element.
 */
export function showLocalLoader(elementSelector) {
    try {
        injectStyles();
        const element = document.querySelector(elementSelector);
        if (!element) return;
        
        const container = element.closest(".filter-field") || element.parentElement;
        if (!container) return;
        
        if (container.querySelector(".local-progress-bar")) return;
        
        container.style.position = "relative";
        const bar = document.createElement("div");
        bar.className = "local-progress-bar";
        bar.innerHTML = `<div class="local-progress-bar-fill"></div>`;
        container.appendChild(bar);
    } catch (error) {
        console.error(error);
    }
}

/**
 * Removes an inline contextual progress bar from the wrapper of a specific element.
 * @param {string} elementSelector CSS selector of the input/select element.
 */
export function hideLocalLoader(elementSelector) {
    try {
        const element = document.querySelector(elementSelector);
        if (!element) return;
        
        const container = element.closest(".filter-field") || element.parentElement;
        if (!container) return;
        
        const bar = container.querySelector(".local-progress-bar");
        if (bar) {
            bar.classList.add("fade-out");
            setTimeout(() => {
                bar.remove();
            }, 250);
        }
    } catch (error) {
        console.error(error);
    }
}

function startProgressBar() {
    const bar = document.querySelector(".top-progress-bar");
    if (!bar) return;
    
    currentProgress = 0;
    bar.style.width = "0%";
    bar.style.opacity = "1";
    
    if (progressInterval) clearInterval(progressInterval);
    
    progressInterval = setInterval(() => {
        if (currentProgress < 30) {
            currentProgress += 5 + Math.random() * 5;
        } else if (currentProgress < 70) {
            currentProgress += 2 + Math.random() * 3;
        } else if (currentProgress < 90) {
            currentProgress += 0.5 + Math.random() * 1;
        }
        
        if (currentProgress > 92) {
            currentProgress = 92;
            clearInterval(progressInterval);
        }
        
        bar.style.width = `${currentProgress}%`;
    }, 150);
}

function finishProgressBar() {
    const bar = document.querySelector(".top-progress-bar");
    if (!bar) return;
    
    if (progressInterval) clearInterval(progressInterval);
    
    bar.style.width = "100%";
    setTimeout(() => {
        bar.style.opacity = "0";
        setTimeout(() => {
            bar.remove();
        }, 300);
    }, 200);
}
