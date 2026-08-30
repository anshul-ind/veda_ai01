export function withDeadline(promise, ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Processing deadline exceeded after ${ms}ms`)), ms);
        if (signal) {
            signal.addEventListener("abort", () => {
                clearTimeout(timer);
                reject(new Error("Aborted"));
            });
        }
        promise.then((v) => {
            clearTimeout(timer);
            resolve(v);
        }, (e) => {
            clearTimeout(timer);
            reject(e);
        });
    });
}
export function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(resolve, ms);
        if (signal) {
            signal.addEventListener("abort", () => {
                clearTimeout(t);
                reject(new Error("Aborted"));
            });
        }
    });
}
