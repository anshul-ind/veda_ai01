// processor/src/gemini/files.ts
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
// Load environment
const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
];
for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
        console.log(`[gemini:env] Loading from: ${envFile}`);
        dotenv.config({ path: envFile });
    }
}
import dns from 'node:dns';
try {
    dns.setDefaultResultOrder('ipv4first');
}
catch { }
import { fetch as undiciFetch, Agent } from 'undici';
const geminiAgent = new Agent({ connect: { timeout: 30000 }, bodyTimeout: 120000, headersTimeout: 30000, allowH2: false });
import { ProcessorError } from '../utils/errors.js';
import { sleep } from '../utils/timeout.js';
import { DEFAULT_MAX_POLL_ATTEMPTS } from '../config.js';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('[gemini:env] ❌ GEMINI_API_KEY is not set!');
    throw new Error('GEMINI_API_KEY not configured');
}
console.log(`[gemini:env] ✅ API Key found: ${GEMINI_API_KEY.substring(0, 15)}...`);
// Helper: Get file buffer
async function getFileBuffer(file) {
    if (Buffer.isBuffer(file))
        return file;
    if (file instanceof File || (file && typeof file.arrayBuffer === 'function')) {
        const arrayBuffer = await file.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    if (file?.path && typeof file.path === 'string') {
        if (!fs.existsSync(file.path)) {
            throw new Error(`File not found: ${file.path}`);
        }
        return fs.readFileSync(file.path);
    }
    throw new Error('Unable to read file - unknown format');
}
// Helper: Detect MIME type
function detectMimeType(file) {
    if (file?.type && file.type !== 'application/octet-stream' && file.type !== '') {
        return file.type;
    }
    const name = file?.name || file?.filename || '';
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const mimeMap = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
    };
    return mimeMap[ext] || 'application/octet-stream';
}
// ✅ FIXED: Single-step upload - NO SECOND STEP!
async function uploadDirect(fileBuffer, mimeType, displayName) {
    console.log(`[gemini:upload] 📤 Uploading: ${displayName} (${fileBuffer.length} bytes)`);
    // ✅ Create multipart upload
    const boundary = '-------' + Date.now().toString(36);
    // Part 1: Metadata (JSON)
    const metadata = JSON.stringify({
        file: {
            display_name: displayName,
            mime_type: mimeType,
        },
    });
    // Build multipart body
    const parts = [
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=utf-8\r\n\r\n',
        metadata,
        '\r\n',
        `--${boundary}\r\n`,
        `Content-Type: ${mimeType}\r\n`,
        `Content-Transfer-Encoding: base64\r\n\r\n`,
        fileBuffer.toString('base64'),
        '\r\n',
        `--${boundary}--\r\n`,
    ];
    const body = Buffer.concat(parts.map(p => Buffer.from(p)));
    console.log(`[gemini:upload] 🔄 Sending to Gemini API...`);
    // ✅ SINGLE API CALL - Upload file directly (native fetch - undici caused SocketError for POST)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    let response;
    try {
        response = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}&uploadType=multipart`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: body,
            signal: controller.signal,
        });
    }
    catch (e) {
        clearTimeout(timeout);
        console.error(`[gemini:upload] ❌ Fetch error: ${e.message}`);
        if (e.cause)
            console.error(`[gemini:upload] ❌ Cause:`, e.cause);
        if (e.stack)
            console.error(`[gemini:upload] ❌ Stack:`, e.stack?.substring(0, 500));
        throw e;
    }
    clearTimeout(timeout);
    const responseText = await response.text();
    console.log(`[gemini:upload] 📡 Response status: ${response.status}`);
    console.log(`[gemini:upload] 📡 Response: ${responseText.substring(0, 500)}...`);
    if (!response.ok) {
        throw new Error(`Upload failed (${response.status}): ${responseText}`);
    }
    const data = JSON.parse(responseText);
    // ✅ The response already contains the file info!
    const fileInfo = data.file || data;
    if (!fileInfo.name || !fileInfo.uri) {
        throw new Error(`Invalid response: ${responseText}`);
    }
    console.log(`[gemini:upload] ✅ Upload successful!`);
    console.log(`[gemini:upload] 📄 Name: ${fileInfo.name}`);
    console.log(`[gemini:upload] 🔗 URI: ${fileInfo.uri}`);
    console.log(`[gemini:upload] 📊 State: ${fileInfo.state}`);
    return {
        name: fileInfo.name,
        uri: fileInfo.uri,
    };
}
async function uploadViaCurl(fileBuffer, mimeType, displayName) {
    const { execFile } = await import('node:child_process');
    const os = await import('node:os');
    const boundary = '-------' + Date.now().toString(36);
    const metadata = JSON.stringify({ file: { display_name: displayName, mime_type: mimeType } });
    const parts = [
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=utf-8\r\n\r\n',
        metadata,
        '\r\n',
        `--${boundary}\r\n`,
        `Content-Type: ${mimeType}\r\n`,
        `Content-Transfer-Encoding: base64\r\n\r\n`,
        fileBuffer.toString('base64'),
        '\r\n',
        `--${boundary}--\r\n`,
    ];
    const body = Buffer.concat(parts.map(p => Buffer.from(p)));
    const tmp = path.join(os.tmpdir(), `veda-upload-${Date.now()}.bin`);
    fs.writeFileSync(tmp, body);
    const url = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}&uploadType=multipart`;
    console.log(`[gemini:upload:curl] 📤 Fallback via curl ${body.length} bytes`);
    return new Promise((resolve, reject) => {
        execFile('curl', ['-s', '-X', 'POST', '-H', `Content-Type: multipart/related; boundary=${boundary}`, '--data-binary', `@${tmp}`, url], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            try {
                fs.unlinkSync(tmp);
            }
            catch { }
            if (err)
                return reject(new Error(`curl failed: ${err.message} stderr=${stderr}`));
            console.log(`[gemini:upload:curl] 📡 Response: ${stdout.substring(0, 500)}...`);
            try {
                const data = JSON.parse(stdout);
                const fileInfo = data.file || data;
                if (!fileInfo.name || !fileInfo.uri)
                    return reject(new Error(`Invalid curl response: ${stdout}`));
                console.log(`[gemini:upload:curl] ✅ Upload successful!`);
                resolve({ name: fileInfo.name, uri: fileInfo.uri });
            }
            catch (e) {
                reject(new Error(`curl parse failed: ${e.message} raw=${stdout.substring(0, 500)}`));
            }
        });
    });
}
// ✅ Main upload function
export async function uploadToGemini(file) {
    const maxRetries = 3;
    let lastError = null;
    const displayName = file?.name || file?.filename || 'unnamed-file';
    const mimeType = detectMimeType(file);
    const fileBuffer = await getFileBuffer(file);
    console.log(`[gemini:upload] 🚀 Uploading: ${displayName}`);
    console.log(`[gemini:upload] 📊 Size: ${fileBuffer.length} bytes, MIME: ${mimeType}`);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[gemini:upload] 🚀 Attempt ${attempt}/${maxRetries}`);
            // ✅ Single-step upload
            const result = await uploadDirect(fileBuffer, mimeType, displayName);
            return {
                name: result.name,
                uri: result.uri,
                mimeType: mimeType,
                size: fileBuffer.length,
                displayName: displayName,
            };
        }
        catch (error) {
            lastError = error;
            console.error(`[gemini:upload] ❌ Attempt ${attempt} failed:`, error.message);
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`[gemini:upload] ⏳ Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }
    // Fallback via curl (curl.exe succeeded for GET while undici fetch timed out)
    console.log(`[gemini:upload] 🔄 Trying curl fallback for ${displayName}...`);
    try {
        const result = await uploadViaCurl(fileBuffer, mimeType, displayName);
        return {
            name: result.name,
            uri: result.uri,
            mimeType: mimeType,
            size: fileBuffer.length,
            displayName: displayName,
        };
    }
    catch (e) {
        console.error(`[gemini:upload:curl] ❌ Fallback failed:`, e.message);
        lastError = e;
    }
    throw new ProcessorError('GEMINI_UPLOAD_FAILED', 502, `Failed to upload ${displayName} after ${maxRetries} attempts + curl fallback: ${lastError?.message || 'Unknown error'}`);
}
function normalizeGeminiFileName(input) {
    const m = input.match(/files\/[^\/\?#]+/);
    if (m)
        return m[0];
    const id = input.split('/').pop()?.split('?')[0]?.split('#')[0]?.trim();
    if (!id)
        throw new Error(`Invalid file URI: ${input}`);
    return `files/${id}`;
}
// ✅ Wait for file to be active (usually already ACTIVE from upload)
// Handles both options object: pollUntilActive(uri, { signal }) and legacy positional args: pollUntilActive(uri, 30, signal)
export async function waitForFileActive(fileUri, optionsOrMaxAttempts, legacySignal) {
    let options = {};
    if (typeof optionsOrMaxAttempts === 'number') {
        options = { maxAttempts: optionsOrMaxAttempts, signal: legacySignal };
    }
    else if (optionsOrMaxAttempts && typeof optionsOrMaxAttempts === 'object') {
        options = optionsOrMaxAttempts;
    }
    const fileName = normalizeGeminiFileName(fileUri);
    const maxAttempts = typeof options.maxAttempts === 'number' && !isNaN(options.maxAttempts) ? options.maxAttempts : DEFAULT_MAX_POLL_ATTEMPTS;
    let delay = options.initialIntervalMs ?? 1000;
    const maxIntervalMs = options.maxIntervalMs ?? 5000;
    const signal = options.signal ?? legacySignal;
    console.log(`[polling:start] Checking file: raw="${fileUri}" normalized="${fileName}" maxAttempts=${maxAttempts}`);
    let attempts = 0;
    // ✅ Check if file is already ACTIVE from upload — skip polling if so
    try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 15000);
        const stateResponse = await undiciFetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`, { signal: ac.signal, dispatcher: geminiAgent });
        clearTimeout(t);
        if (stateResponse.ok) {
            const stateFile = await stateResponse.json();
            console.log(`[polling:file_state] ${fileName} state=${stateFile.state}`);
            if (stateFile.state === 'ACTIVE') {
                console.log(`[polling:active] ${fileName} is ACTIVE, continuing immediately`);
                return stateFile;
            }
            if (stateFile.state === 'FAILED') {
                throw new ProcessorError('GEMINI_FILE_FAILED', 502, `File ${fileName} processing failed on Gemini server`);
            }
        }
        else {
            const txt = await stateResponse.text().catch(() => '');
            console.log(`[polling:file_state] ${fileName} fetch status ${stateResponse.status}: ${txt.substring(0, 200)}`);
        }
    }
    catch (error) {
        if (error instanceof ProcessorError)
            throw error;
        console.log(`[polling:file_state] ⚠️ Initial state check note: ${error.message}`);
    }
    while (attempts < maxAttempts) {
        if (signal?.aborted) {
            throw new ProcessorError('PROCESSING_TIMEOUT', 504, 'Processing aborted.');
        }
        try {
            const response = await undiciFetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`, { dispatcher: geminiAgent });
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`[polling:attempt] ${fileName} not found (attempt ${attempts + 1}/${maxAttempts})`);
                }
                else {
                    console.log(`[polling:attempt] ${fileName} status ${response.status} (attempt ${attempts + 1}/${maxAttempts})`);
                }
                await sleep(delay, signal);
                delay = Math.min(delay * 1.5, maxIntervalMs);
                attempts++;
                continue;
            }
            const file = await response.json();
            console.log(`[polling:attempt] ${fileName} state=${file.state} (attempt ${attempts + 1}/${maxAttempts})`);
            if (file.state === 'ACTIVE') {
                console.log(`[polling:active] ${fileName} is now ACTIVE`);
                return file;
            }
            if (file.state === 'FAILED') {
                throw new ProcessorError('GEMINI_FILE_FAILED', 502, `File ${fileName} processing failed on Gemini server`);
            }
        }
        catch (error) {
            if (error instanceof ProcessorError)
                throw error;
            console.log(`[polling:attempt] ⚠️ Attempt error: ${error.message}`);
        }
        await sleep(delay, signal);
        delay = Math.min(delay * 1.5, maxIntervalMs);
        attempts++;
    }
    throw new ProcessorError('GEMINI_FILE_TIMEOUT', 504, `File ${fileName} did not become active within ${maxAttempts} attempts`);
}
// ✅ Delete file (best effort)
export async function deleteGeminiFileBestEffort(fileName) {
    try {
        const normalized = normalizeGeminiFileName(fileName);
        await undiciFetch(`https://generativelanguage.googleapis.com/v1beta/${normalized}?key=${GEMINI_API_KEY}`, { method: 'DELETE', dispatcher: geminiAgent });
        console.log(`[gemini:cleanup] ✅ Deleted: ${normalized}`);
    }
    catch (error) {
        console.warn(`[gemini:cleanup] ⚠️ Could not delete: ${fileName}`);
    }
}
// ✅ Alias for backward compatibility
export const pollUntilActive = waitForFileActive;
