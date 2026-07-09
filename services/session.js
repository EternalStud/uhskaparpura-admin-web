"use strict";

import { readStorage, removeStorage, writeStorage } from "./storage.js";

const SESSION_KEY = "uhs_exam_session";

let activeSession = null;

/**
 * Returns the current in-memory session.
 * @returns {object|null}
 */
export function getSession() {
    try {
        return activeSession;
    } catch (error) {
        console.error(error);
        return null;
    }
}

/**
 * Persists a user session.
 * @param {object} session Session payload.
 * @returns {object|null}
 */
export function saveSession(session) {
    try {
        activeSession = session;
        writeStorage(SESSION_KEY, session);
        return activeSession;
    } catch (error) {
        console.error(error);
        return null;
    }
}

/**
 * Restores a saved session when still valid.
 * @returns {Promise<object|null>}
 */
export async function restoreSession() {
    try {
        const session = readStorage(SESSION_KEY);
        if (!session || Date.now() > Number(session.expiresAt)) {
            clearSession();
            return null;
        }

        activeSession = session;
        return activeSession;
    } catch (error) {
        console.error(error);
        clearSession();
        return null;
    }
}

/**
 * Clears the active session.
 * @returns {void}
 */
export function clearSession() {
    try {
        activeSession = null;
        removeStorage(SESSION_KEY);
    } catch (error) {
        console.error(error);
    }
}
