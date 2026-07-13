"use strict";

let progressInterval = null;
let currentProgress = 0;

/**
 * Injects required styles for the premium loader and progress bar.
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
            background: rgba(248, 250, 252, 0.4) !important;
            backdrop-filter: blur(8px) !important;
            transition: opacity 300ms ease-in-out;
        }
        .loader-spinner-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            background: var(--color-bg, #ffffff);
            padding: 24px 36px;
            border-radius: var(--radius-lg, 12px);
            border: 1px solid var(--color-border, rgba(0, 0, 0, 0.05));
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03);
            animation: loaderPop 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .loader-spinner-text {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--color-text, #1e293b);
            letter-spacing: -0.01em;
        }
        @keyframes loaderPop {
            0% { transform: scale(0.9); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Shows the global loading indicator with a top progress bar.
 * @returns {void}
 */
export function showLoader() {
    try {
        injectStyles();
        
        const root = document.querySelector("#loader-root");
        if (!root || root.children.length) {
            return;
        }

        // Add top progress bar directly to body
        if (!document.querySelector(".top-progress-bar")) {
            const bar = document.createElement("div");
            bar.className = "top-progress-bar";
            document.body.appendChild(bar);
        }

        root.innerHTML = `
            <div class="loader-backdrop" role="status" aria-label="Loading">
                <div class="loader-spinner-container">
                    <div class="loader-spinner"></div>
                    <div class="loader-spinner-text">Processing request...</div>
                </div>
            </div>
        `;

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
