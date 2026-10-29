/**
 * Keep @openuidev/react-lang's development-only devtools widget out of our apps.
 *
 * In development, react-lang auto-mounts "OpenUI Inspect" / "OpenUI Debug"
 * trays (role="dialog" asides) and loads their code from jsDelivr at runtime.
 * Its bootstrap checks this global flag when the module first evaluates and
 * skips the mount when it's already set, so this module must run before
 * react-lang does: import it first from every entry that reaches react-lang.
 */
const AUTO_MOUNT_FLAG = Symbol.for("openui.devtools.autoMount");
(globalThis as Record<symbol, unknown>)[AUTO_MOUNT_FLAG] = true;

export {};
