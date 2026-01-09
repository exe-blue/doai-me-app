/**
 * YouTube Pipeline Services Index
 * 
 * 4개 모듈의 서비스 통합 내보내기
 * 
 * @author Axon (Tech Lead)
 */

const MiningService = require('../mining/MiningService');
const SurfingService = require('../surfing/SurfingService');
const ResponseService = require('../response/ResponseService');
const LaborService = require('../labor/LaborService');

module.exports = {
    MiningService,
    SurfingService,
    ResponseService,
    LaborService
};

