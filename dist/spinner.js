// A tiny terminal spinner for long-running steps (e.g. waiting on an agent CLI).
// Animates only on a real TTY; piped/CI runs just print one line.
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
/** Run `task` while showing an animated spinner with elapsed time. Returns task's result. */
export async function withSpinner(label, task) {
    if (!process.stderr.isTTY) {
        process.stderr.write(`${label}…\n`);
        return task();
    }
    let i = 0;
    const start = Date.now();
    const render = () => {
        const secs = Math.round((Date.now() - start) / 1000);
        i = (i + 1) % FRAMES.length;
        process.stderr.write(`\r${FRAMES[i]} ${label}… ${secs}s`);
    };
    process.stderr.write('\x1b[?25l'); // hide cursor
    const timer = setInterval(render, 90);
    try {
        return await task();
    }
    finally {
        clearInterval(timer);
        process.stderr.write('\r\x1b[K\x1b[?25h'); // clear line, restore cursor
    }
}
