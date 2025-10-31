import path from 'path';

/**
 * Validate and sanitize file/directory paths to prevent path traversal attacks
 * Platform-agnostic: accepts both Windows (C:\...) and POSIX (/home/...) absolute paths
 * @param inputPath - User-provided path
 * @returns Canonicalized path or null if unsafe
 */
export function sanitizePath(inputPath: string): string | null {
  if (!inputPath || typeof inputPath !== 'string') return null;

  // 1. Reject null bytes
  if (inputPath.includes('\0')) return null;

  // 2. Reject relative path markers BEFORE any processing
  if (inputPath.includes('..')) return null;
  if (inputPath.includes('./') || inputPath.includes('.\\')) return null;

  let canonicalPath: string;
  let isWindowsPath = false;
  let isPosixPath = false;

  try {
    // 3. Detect path type (Windows vs POSIX) independent of server platform
    const winMatch = /^[A-Z]:\\/i.test(inputPath);
    const posixMatch = inputPath.startsWith('/');

    if (winMatch) {
      // Windows path detected (e.g., C:\Users\...)
      isWindowsPath = true;
      const normalized = inputPath.replace(/\//g, '\\');
      canonicalPath = path.win32.normalize(normalized);
    } else if (posixMatch) {
      // POSIX path detected (e.g., /home/...)
      isPosixPath = true;
      const normalized = inputPath.replace(/\\/g, '/');
      canonicalPath = path.posix.normalize(normalized);
    } else {
      // Neither Windows nor POSIX absolute path
      return null;
    }
  } catch {
    return null;
  }

  // 4. After normalization, double-check no traversal markers remain
  if (canonicalPath.includes('..')) return null;

  // 5. Block critical system directories (platform-specific)
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
    // Normalize forbidden pattern to match path type
    const normalizedForbidden = isWindowsPath 
      ? forbidden.replace(/\//g, '\\') 
      : forbidden.replace(/\\/g, '/');
    
    const lowerForbidden = normalizedForbidden.toLowerCase();
    
    // Check exact match or starts with forbidden path
    const separator = isWindowsPath ? '\\' : '/';
    if (lowerPath === lowerForbidden || lowerPath.startsWith(lowerForbidden + separator)) {
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