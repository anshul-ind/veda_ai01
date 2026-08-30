import { ProcessorError } from '../errors';
import fs from 'fs';
import logger from '../logger';
// ... [rest of existing code] 
// Insert after file extraction from request
const filePath = `./uploads/${file.name}`; // Use relative path
if (!fs.existsSync(filePath)) {
    throw new ProcessorError('FILE_NOT_FOUND', 400, `File ${file.name} not found at ${filePath}`);
}
logger.info({ filename: file.name, filePath, size: file.size });
// Proceed with MIME detection and upload
const fileStream = fs.createReadStream(filePath);
// ... [rest of upload logic]
