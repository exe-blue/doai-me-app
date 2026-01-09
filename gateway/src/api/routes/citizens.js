/**
 * Citizens API Router
 * AI 시민(Persona) CRUD 및 동기화
 * 
 * @author Axon (Tech Lead)
 * @version 1.0.0
 * @spec docs/IMPLEMENTATION_SPEC.md Section 1
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * POST /api/citizens
 * 새 시민 생성
 */
router.post('/', async (req, res) => {
    try {
        const { device_serial, device_model, connection_type } = req.body;

        if (!device_serial) {
            return res.status(400).json({
                success: false,
                error: 'device_serial is required'
            });
        }

        const personaService = req.context?.personaService;
        if (!personaService) {
            return res.status(503).json({
                success: false,
                error: 'PersonaService not available'
            });
        }

        // 기존 시민 확인 또는 새로 생성
        const citizen = await personaService.getOrCreateForDevice(
            device_serial,
            device_model || 'Unknown',
            connection_type || 'USB'
        );

        res.status(201).json({
            success: true,
            data: personaService.toApiFormat(citizen)
        });

    } catch (error) {
        logger.error('[Citizens API] POST / failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to create citizen',
            message: error.message
        });
    }
});

/**
 * GET /api/citizens/:id
 * 시민 정보 조회
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const personaService = req.context?.personaService;

        if (!personaService) {
            return res.status(503).json({
                success: false,
                error: 'PersonaService not available'
            });
        }

        const citizen = await personaService.findById(id);

        if (!citizen) {
            return res.status(404).json({
                success: false,
                error: 'Citizen not found'
            });
        }

        res.json({
            success: true,
            data: personaService.toApiFormat(citizen)
        });

    } catch (error) {
        logger.error('[Citizens API] GET /:id failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch citizen',
            message: error.message
        });
    }
});

/**
 * GET /api/citizens/serial/:serial
 * 디바이스 시리얼로 시민 조회
 */
router.get('/serial/:serial', async (req, res) => {
    try {
        const { serial } = req.params;
        const personaService = req.context?.personaService;

        if (!personaService) {
            return res.status(503).json({
                success: false,
                error: 'PersonaService not available'
            });
        }

        const citizen = await personaService.findBySerial(decodeURIComponent(serial));

        if (!citizen) {
            return res.status(404).json({
                success: false,
                error: 'Citizen not found'
            });
        }

        res.json({
            success: true,
            data: personaService.toApiFormat(citizen)
        });

    } catch (error) {
        logger.error('[Citizens API] GET /serial/:serial failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch citizen',
            message: error.message
        });
    }
});

/**
 * PATCH /api/citizens/:id
 * 시민 정보 업데이트
 */
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const personaService = req.context?.personaService;

        if (!personaService) {
            return res.status(503).json({
                success: false,
                error: 'PersonaService not available'
            });
        }

        // 업데이트 불가 필드 제거
        delete updates.citizen_id;
        delete updates.device_serial;
        delete updates.created_at;

        const citizen = await personaService.update(id, updates);

        if (!citizen) {
            return res.status(404).json({
                success: false,
                error: 'Citizen not found'
            });
        }

        res.json({
            success: true,
            data: personaService.toApiFormat(citizen)
        });

    } catch (error) {
        logger.error('[Citizens API] PATCH /:id failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to update citizen',
            message: error.message
        });
    }
});

/**
 * POST /api/citizens/:id/sync
 * 디바이스 상태 동기화
 */
router.post('/:id/sync', async (req, res) => {
    try {
        const { id } = req.params;
        const clientState = req.body;
        const syncService = req.context?.syncService;

        if (!syncService) {
            return res.status(503).json({
                success: false,
                error: 'SyncService not available'
            });
        }

        const result = await syncService.syncState(id, clientState);

        res.json({
            success: true,
            action: result.action,
            finalState: result.finalState,
            anomalies: result.anomalies
        });

    } catch (error) {
        logger.error('[Citizens API] POST /:id/sync failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to sync state',
            message: error.message
        });
    }
});

/**
 * GET /api/citizens/:id/transactions
 * 시민의 거래 내역 조회
 */
router.get('/:id/transactions', async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        const creditService = req.context?.creditService;

        if (!creditService) {
            return res.status(503).json({
                success: false,
                error: 'CreditService not available'
            });
        }

        const transactions = await creditService.getTransactions(id, {
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: transactions,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        logger.error('[Citizens API] GET /:id/transactions failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions',
            message: error.message
        });
    }
});

/**
 * GET /api/citizens/stats/existence
 * Existence State별 시민 수 통계
 */
router.get('/stats/existence', async (req, res) => {
    try {
        const personaService = req.context?.personaService;

        if (!personaService) {
            return res.status(503).json({
                success: false,
                error: 'PersonaService not available'
            });
        }

        const stats = await personaService.getCountByExistenceState();
        const total = await personaService.getTotalCount();

        res.json({
            success: true,
            data: {
                total,
                byState: stats
            }
        });

    } catch (error) {
        logger.error('[Citizens API] GET /stats/existence failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats',
            message: error.message
        });
    }
});

module.exports = router;

