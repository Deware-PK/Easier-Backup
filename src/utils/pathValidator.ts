import path from 'path';

/**
 * Validate and sanitize file/directory paths to prevent path traversal attacks
 * STRICT MODE: Only accepts absolute paths - rejects all relative paths
 * @param inputPath - User-provided path
 * @returns Canonicalized absolute path or null if unsafe
 */
export function sanitizePath(inputPath: string): string | null {
  if (!inputPath || typeof inputPath !== 'string') return null;

  // 1. Reject null bytes
  if (inputPath.includes('\0')) return null;

  // 2. Reject relative path markers BEFORE any processing
  if (inputPath.includes('..')) return null;
  if (inputPath.includes('./') || inputPath.includes('.\\')) return null;

  let canonicalPath: string;

  try {
    // 3. Platform-aware normalization
    if (process.platform === 'win32') {
      // Windows: convert forward slashes to backslashes
      const normalized = inputPath.replace(/\//g, '\\');
      
      // STRICT: Reject if not starting with drive letter
      if (!/^[A-Z]:\\/i.test(normalized)) {
        return null; // Must be absolute Windows path like C:\...
      }
      
      canonicalPath = path.win32.normalize(normalized);
    } else {
      // POSIX: convert backslashes to forward slashes
      const normalized = inputPath.replace(/\\/g, '/');
      
      // STRICT: Reject if not starting with /
      if (!normalized.startsWith('/')) {
        return null; // Must be absolute POSIX path like /home/...
      }
      
      canonicalPath = path.posix.normalize(normalized);
    }
  } catch {
    return null;
  }

  // 4. After normalization, double-check no traversal markers remain
  if (canonicalPath.includes('..')) return null;

  // 5. Block critical system directories (minimal blacklist)
  const forbiddenPatterns = [
    // Linux/Unix critical paths
    '/etc/shadow', '/etc/passwd', '/etc/sudoers',
    '/root/.ssh', '/root/.gnupg',
    '/var/run', '/proc', '/sys', '/dev',
    
    // Windows critical paths (case-insensitive)
    'c:\\windows\\system32\\config',
    'c:\\windows\\system32\\drivers\\etc\\hosts',
    'c:\\$recycle.bin',
    'c:\\pagefile.sys', 'c:\\hiberfil.sys',
  ];

  const lowerPath = canonicalPath.toLowerCase();
  for (const forbidden of forbiddenPatterns) {
    const normalizedForbidden = (process.platform === 'win32' 
      ? forbidden.replace(/\//g, '\\') 
      : forbidden.replace(/\\/g, '/')
    ).toLowerCase();
    
    // Check exact match or starts with forbidden path
    if (lowerPath === normalizedForbidden || lowerPath.startsWith(normalizedForbidden + path.sep)) {
      return null;
    }
  }

  return canonicalPath;
}

/**
 * Validate cron schedule format (basic validation)
 */
export function isValidCronSchedule(schedule: string): boolean {
  return /^[\d\*\/\-,\s]+$/.test(schedule) && schedule.length >= 5 && schedule.length <= 50;
}