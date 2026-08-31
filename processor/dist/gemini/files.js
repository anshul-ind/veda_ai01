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
// ✅ Resumable two-step upload
// Step 1: POST to start resumable session → returns X-Goog-Upload-URL + upload_id
// Step 2: PUT immediately to returned URL with file bytes + finalize command
// upload_id expires quickly, so steps happen back-to-back with no caching
async function uploadDirect(fileBuffer, mimeType, displayName) {
    console.log(`[gemini:upload] 📤 Uploading: ${displayName} (${fileBuffer.length} bytes)`);
    // ==========================================
    // STEP 1: Start resumable session (POST)
    // ==========================================
    const startController = new AbortController();
    const startTimeout = setTimeout(() => startController.abort(), 60000);
    let startResponse;
    try {
        startResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': String(fileBuffer.length),
                'X-Goog-Upload-Header-Content-Type': mimeType,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ file: { display_name: displayName } }),
            signal: startController.signal,
        });
    }
    catch (e) {
        clearTimeout(startTimeout);
        console.error(`[gemini:upload] ❌ Start fetch error: ${e.message}`);
        if (e.cause)
            console.error(`[gemini:upload] ❌ Cause:`, e.cause);
        if (e.stack)
            console.error(`[gemini:upload] ❌ Stack:`, e.stack?.substring(0, 500));
        throw e;
    }
    clearTimeout(startTimeout);
    const startResponseText = await startResponse.text();
    console.log(`[gemini:upload] 📡 Start response status: ${startResponse.status}`);
    if (!startResponse.ok) {
        throw new Error(`Resume start failed (${startResponse.status}): ${startResponseText}`);
    }
    // Capture upload URL and upload_id from response headers
    const uploadUrl = startResponse.headers.get('X-Goog-Upload-URL');
    const uploadId = startResponse.headers.get('X-Goog-Upload-Id');
    if (!uploadUrl) {
        throw new Error(`No X-Goog-Upload-URL in start response: ${startResponseText}`);
    }
    console.log(`[gemini:upload] ✅ Resumable session started`);
    console.log(`[gemini:upload] 🔗 Upload URL: ${uploadUrl}`);
    console.log(`[gemini:upload] 🆔 Upload ID: ${uploadId}`);
    // ==========================================
    // STEP 2: Upload file bytes via PUT (finalize included)
    // ==========================================
    const putController = new AbortController();
    const putTimeout = setTimeout(() => putController.abort(), 60000);
    let putResponse;
    try {
        putResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'X-Goog-Upload-Offset': '0',
                'X-Goog-Upload-Command': 'upload, finalize',
                'Content-Type': mimeType,
            },
            body: fileBuffer,
            signal: putController.signal,
        });
    }
    catch (e) {
        clearTimeout(putTimeout);
        console.error(`[gemini:upload] ❌ PUT fetch error: ${e.message}`);
        if (e.cause)
            console.error(`[gemini:upload] ❌ Cause:`, e.cause);
        if (e.stack)
            console.error(`[gemini:upload] ❌ Stack:`, e.stack?.substring(0, 500));
        throw e;
    }
    clearTimeout(putTimeout);
    const putResponseText = await putResponse.text();
    console.log(`[gemini:upload] 📡 PUT response status: ${putResponse.status}`);
    console.log(`[gemini:upload] 📡 PUT response: ${putResponseText.substring(0, 500)}...`);
    if (!putResponse.ok) {
        throw new Error(`Upload PUT failed (${putResponse.status}): ${putResponseText}`);
    }
    // The response should contain file info with state ACTIVE
    const data = JSON.parse(putResponseText);
    const fileInfo = data.file || data;
    if (!fileInfo.name || !fileInfo.uri) {
        throw new Error(`Invalid response: ${putResponseText}`);
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
    const tmp = path.join(os.tmpdir(), `veda-upload-${Date.now()}.bin`);
    // Step 1: Start resumable session via curl (POST)
    const startUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;
    const startCmd = ['-s', '-i', '-X', 'POST', '-H', 'X-Goog-Upload-Protocol: resumable', '-H', 'X-Goog-Upload-Command: start', '-H', `X-Goog-Upload-Header-Content-Length: ${fileBuffer.length}`, '-H', `X-Goog-Upload-Header-Content-Type: ${mimeType}`, '-H', 'Content-Type: application/json', '-d', `{"file": {"display_name": "${displayName}"}}`, startUrl];
    console.log(`[gemini:upload:curl] 📤 Starting resumable session via curl`);
    let startStdout = '', startStderr = '';
    return new Promise((resolve, reject) => {
        execFile('curl', startCmd, { maxBuffer: 10 * 1024 * 1024 }, (err1, stdout1, stderr1) => {
            try {
                fs.unlinkSync(tmp);
            }
            catch { }
            if (err1)
                return reject(new Error(`curl start failed: ${err1.message} stderr=${stderr1}`));
            startStdout = stdout1;
            startStderr = stderr1;
            // Parse X-Goog-Upload-URL from headers (curl -i includes headers)
            const headerEnd = (stdout1 + startStderr).indexOf('\r\n\r\n');
            const headerBlock = (stdout1 + '\n' + startStderr).substring(0, headerEnd >= 0 ? headerEnd : (stdout1 + startStderr).length);
            const urlMatch = headerBlock.match(/X-Goog-Upload-URL: (.+)/);
            if (!urlMatch)
                return reject(new Error(`No upload URL in curl start response: ${stdout1}\n---stderr---\n${startStderr}`));
            const uploadUrl = urlMatch[1];
            const uploadIdMatch = headerBlock.match(/X-Goog-Upload-Id: (.+)/);
            const uploadId = uploadIdMatch ? uploadIdMatch[1] : '';
            console.log(`[gemini:upload:curl] ✅ Session started, upload URL: ${uploadUrl}`);
            // Step 2: PUT file bytes to the returned URL with finalize
            const body = fileBuffer;
            const putCmd = ['-s', '-X', 'PUT', '-H', `X-Goog-Upload-Offset: 0`, '-H', 'X-Goog-Upload-Command: upload, finalize', '-H', `Content-Length: ${body.length}`, '--data-binary', `@${tmp}`, uploadUrl];
            execFile('curl', putCmd, { maxBuffer: 10 * 1024 * 1024 }, (err2, stdout2, stderr2) => {
                try {
                    fs.unlinkSync(tmp);
                }
                catch { }
                if (err2)
                    return reject(new Error(`curl PUT failed: ${err2.message} stderr=${stderr2}`));
                console.log(`[gemini:upload:curl] 📡 PUT response: ${stdout2.substring(0, 500)}...`);
                try {
                    const data = JSON.parse(stdout2);
                    const fileInfo = data.file || data;
                    if (!fileInfo.name || !fileInfo.uri)
                        return reject(new Error(`Invalid curl response: ${stdout2}`));
                    console.log(`[gemini:upload:curl] ✅ Upload successful!`);
                    resolve({ name: fileInfo.name, uri: fileInfo.uri });
                }
                catch (e) {
                    reject(new Error(`curl parse failed: ${e.message} raw=${stdout2.substring(0, 500)}`));
                }
            });
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
