"use strict";

/**
 * Reads and parses a value from localStorage.
 * @param {string} key Storage key.
 * @returns {unknown|null}
 */
export function readStorage(key) {
    try {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.error(error);
        return null;
    }
}

/**
 * Writes a serializable value to localStorage.
 * @param {string} key Storage key.
 * @param {unknown} value Value to store.
 * @returns {void}
 */
export function writeStorage(key, value) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(error);
    }
}

/**
 * Removes a value from localStorage.
 * @param {string} key Storage key.
 * @returns {void}
 */
export function removeStorage(key) {
    try {
        window.localStorage.removeItem(key);
    } catch (error) {
        console.error(error);
    }
}
