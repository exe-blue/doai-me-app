/**
 * File System API
 * 
 * Aria 명세서 (2025-01-15) - Appsmith Integration
 * 
 * Endpoints:
 * - GET /api/files/:id/list?path=...     - List directory
 * - GET /api/files/:id/read?path=...     - Read file content
 * - GET /api/files/:id/download?path=... - Download file
 * - GET /api/files/:id/tail?path=...     - Tail log file
 * 
 * Security: /sdcard/doai/** 경로만 접근 허용
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const path = require('path');

// 보안: 허용 경로
const ALLOWED_BASE_PATH = '/sdcard/doai';
const MAX_READ_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TAIL_LINES = 1000;
const DEFAULT_TAIL_LINES = 50;

/**
 * 경로 검증 (Path Traversal 방지)
 */
function validatePath(requestedPath) {
    // 기본 경로
    if (!requestedPath) {
        return { valid: true, path: ALLOWED_BASE_PATH };
    }

    // ../ 방지
    if (requestedPath.includes('..')) {
        return { valid: false, error: 'Path traversal not allowed' };
    }

    // 절대 경로 처리
    let normalizedPath = requestedPath;
    if (!normalizedPath.startsWith('/')) {
        normalizedPath = path.posix.join(ALLOWED_BASE_PATH, normalizedPath);
    }

    // 허용 경로 확인
    if (!normalizedPath.startsWith(ALLOWED_BASE_PATH)) {
        return { 
            valid: false, 
            error: `Access denied. Only ${ALLOWED_BASE_PATH}/** allowed` 
        };
    }

    return { valid: true, path: normalizedPath };
}

/**
 * 파일 크기 휴먼 리더블
 */
function formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * GET /api/files/:id/list
 * 디렉토리 목록 조회
 */
router.get('/:id/list', async (req, res) => {
    const { logger, deviceTracker, commander } = req.context;
    const { id } = req.params;
    const { path: requestedPath } = req.query;

    try {
        const device = deviceTracker.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // 경로 검증
        const pathCheck = validatePath(requestedPath);
        if (!pathCheck.valid) {
            return res.status(400).json({
                success: false,
                error: pathCheck.error
            });
        }

        const targetPath = pathCheck.path;

        // ls -la 실행
        const lsOutput = await commander.shell(
            device.id, 
            `ls -la "${targetPath}" 2>/dev/null || echo "NOT_FOUND"`
        );

        if (lsOutput.includes('NOT_FOUND') || lsOutput.includes('No such file')) {
            return res.status(404).json({
                success: false,
                error: 'Directory not found',
                path: targetPath
            });
        }

        // 결과 파싱
        const items = parseDirectoryListing(lsOutput);

        logger.debug('[FilesAPI] 디렉토리 조회', {
            deviceId: id,
            path: targetPath,
            count: items.length
        });

        res.json({
            success: true,
            path: targetPath,
            items
        });

    } catch (e) {
        logger.error('[FilesAPI] 디렉토리 조회 실패', {
            deviceId: id,
            error: e.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to list directory',
            message: e.message
        });
    }
});

/**
 * GET /api/files/:id/read
 * 파일 내용 읽기
 */
router.get('/:id/read', async (req, res) => {
    const { logger, deviceTracker, commander } = req.context;
    const { id } = req.params;
    const { path: requestedPath } = req.query;

    try {
        const device = deviceTracker.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // 경로 검증
        const pathCheck = validatePath(requestedPath);
        if (!pathCheck.valid) {
            return res.status(400).json({
                success: false,
                error: pathCheck.error
            });
        }

        const targetPath = pathCheck.path;

        // 파일 크기 확인
        const statOutput = await commander.shell(
            device.id,
            `stat -c "%s" "${targetPath}" 2>/dev/null || echo "-1"`
        );
        const fileSize = parseInt(statOutput.trim());

        if (fileSize < 0) {
            return res.status(404).json({
                success: false,
                error: 'File not found',
                path: targetPath
            });
        }

        let content;
        let truncated = false;

        if (fileSize > MAX_READ_SIZE) {
            // 대용량 파일: 마지막 10KB만
            content = await commander.shell(
                device.id,
                `tail -c 10240 "${targetPath}"`
            );
            truncated = true;
        } else {
            // 전체 파일 읽기
            content = await commander.readFile(device.id, targetPath);
        }

        logger.debug('[FilesAPI] 파일 읽기', {
            deviceId: id,
            path: targetPath,
            size: fileSize,
            truncated
        });

        res.json({
            success: true,
            path: targetPath,
            content: content || '',
            encoding: 'utf-8',
            size: fileSize,
            truncated,
            truncated_message: truncated ? 'File too large. Showing last 10KB.' : null
        });

    } catch (e) {
        logger.error('[FilesAPI] 파일 읽기 실패', {
            deviceId: id,
            error: e.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to read file',
            message: e.message
        });
    }
});

/**
 * GET /api/files/:id/download
 * 파일 다운로드
 */
router.get('/:id/download', async (req, res) => {
    const { logger, deviceTracker, commander } = req.context;
    const { id } = req.params;
    const { path: requestedPath } = req.query;

    try {
        const device = deviceTracker.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // 경로 검증
        const pathCheck = validatePath(requestedPath);
        if (!pathCheck.valid) {
            return res.status(400).json({
                success: false,
                error: pathCheck.error
            });
        }

        const targetPath = pathCheck.path;
        const fileName = path.basename(targetPath);

        // 파일 내용 가져오기 (바이너리)
        const content = await commander.execOut(device.id, `cat "${targetPath}"`);

        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        logger.info('[FilesAPI] 파일 다운로드', {
            deviceId: id,
            path: targetPath,
            size: content.length
        });

        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="${fileName}"`);
        res.set('Content-Length', content.length);
        res.send(content);

    } catch (e) {
        logger.error('[FilesAPI] 파일 다운로드 실패', {
            deviceId: id,
            error: e.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to download file',
            message: e.message
        });
    }
});

/**
 * GET /api/files/:id/tail
 * 로그 파일 tail
 */
router.get('/:id/tail', async (req, res) => {
    const { logger, deviceTracker, commander } = req.context;
    const { id } = req.params;
    const { path: requestedPath, lines } = req.query;

    try {
        const device = deviceTracker.getDevice(id);
        
        if (!device) {
            return res.status(404).json({
                success: false,
                error: 'Device not found'
            });
        }

        // 경로 검증
        const pathCheck = validatePath(requestedPath);
        if (!pathCheck.valid) {
            return res.status(400).json({
                success: false,
                error: pathCheck.error
            });
        }

        const targetPath = pathCheck.path;
        const lineCount = Math.min(
            parseInt(lines) || DEFAULT_TAIL_LINES,
            MAX_TAIL_LINES
        );

        // tail 실행
        const tailOutput = await commander.shell(
            device.id,
            `tail -n ${lineCount} "${targetPath}" 2>/dev/null || echo "FILE_NOT_FOUND"`
        );

        if (tailOutput.includes('FILE_NOT_FOUND')) {
            return res.status(404).json({
                success: false,
                error: 'File not found',
                path: targetPath
            });
        }

        // 총 라인 수 확인
        const wcOutput = await commander.shell(
            device.id,
            `wc -l < "${targetPath}" 2>/dev/null || echo "0"`
        );
        const totalLines = parseInt(wcOutput.trim()) || 0;

        // 라인 배열로 분리
        const lineArray = tailOutput.split('\n').filter(l => l.length > 0);

        logger.debug('[FilesAPI] Tail', {
            deviceId: id,
            path: targetPath,
            lines: lineArray.length
        });

        res.json({
            success: true,
            path: targetPath,
            lines: lineArray,
            total_lines: totalLines
        });

    } catch (e) {
        logger.error('[FilesAPI] Tail 실패', {
            deviceId: id,
            error: e.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to tail file',
            message: e.message
        });
    }
});

/**
 * ls -la 출력 파싱
 */
function parseDirectoryListing(lsOutput) {
    const items = [];
    const lines = lsOutput.split('\n');

    for (const line of lines) {
        // total 라인 무시
        if (line.startsWith('total') || line.trim() === '') continue;

        // ls -la 포맷: drwxr-xr-x 2 root root 4096 Jan 15 12:00 dirname
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9) continue;

        const permissions = parts[0];
        const isDirectory = permissions.startsWith('d');
        const size = parseInt(parts[4]) || 0;
        const name = parts.slice(8).join(' ');

        // . 과 .. 무시
        if (name === '.' || name === '..') continue;

        // 날짜 파싱 (간단하게)
        const month = parts[5];
        const day = parts[6];
        const timeOrYear = parts[7];

        items.push({
            name,
            type: isDirectory ? 'directory' : 'file',
            size: isDirectory ? null : size,
            size_human: isDirectory ? null : formatFileSize(size),
            modified: `${month} ${day} ${timeOrYear}`,
            permissions
        });
    }

    // 디렉토리 먼저, 그 다음 파일 (이름순)
    items.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });

    return items;
}

module.exports = router;

