/**
 * Human Pattern Module
 * 인간처럼 행동하는 패턴 구현
 */

class HumanPattern {
    constructor(config, logger) {
        this.config = config.human_pattern;
        this.logger = logger;
    }

    /**
     * 랜덤 대기 시간 생성
     */
    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * 스크롤 대기
     */
    scrollDelay() {
        const delay = this.randomDelay(
            this.config.scroll_delay_min,
            this.config.scroll_delay_max
        );
        this.logger.debug(`스크롤 대기: ${delay}ms`);
        sleep(delay);
    }

    /**
     * 클릭 대기
     */
    clickDelay() {
        const delay = this.randomDelay(
            this.config.click_delay_min,
            this.config.click_delay_max
        );
        this.logger.debug(`클릭 대기: ${delay}ms`);
        sleep(delay);
    }

    /**
     * 타이핑 속도 (글자당 ms)
     */
    typingSpeed() {
        return this.randomDelay(
            this.config.typing_speed_min,
            this.config.typing_speed_max
        );
    }

    /**
     * 자연스러운 스크롤
     */
    naturalScroll(direction = 'down', distance = null) {
        const screenHeight = device.height;
        const scrollDistance = distance || this.randomDelay(
            screenHeight * 0.3,
            screenHeight * 0.6
        );

        // 여러 번에 나눠서 스크롤 (더 자연스럽게)
        const steps = this.randomDelay(3, 6);
        const stepDistance = scrollDistance / steps;

        for (let i = 0; i < steps; i++) {
            if (direction === 'down') {
                scrollDown(stepDistance);
            } else {
                scrollUp(stepDistance);
            }
            sleep(this.randomDelay(100, 300));
        }

        this.scrollDelay();
    }

    /**
     * 자연스러운 클릭 (약간의 오차 추가)
     */
    naturalClick(x, y, offsetRange = 5) {
        const offsetX = this.randomDelay(-offsetRange, offsetRange);
        const offsetY = this.randomDelay(-offsetRange, offsetRange);

        click(x + offsetX, y + offsetY);
        this.clickDelay();
    }

    /**
     * 자연스러운 텍스트 입력
     */
    naturalInput(text) {
        for (let char of text) {
            setText(char);
            sleep(this.typingSpeed());
        }
    }

    /**
     * 랜덤 화면 터치 (살아있는 것처럼)
     */
    randomTouch() {
        const x = this.randomDelay(100, device.width - 100);
        const y = this.randomDelay(100, device.height - 100);

        this.logger.debug(`랜덤 터치: (${x}, ${y})`);
        click(x, y);
        sleep(this.randomDelay(500, 1000));
    }

    /**
     * 시청 시간 계산 (자연스러운 범위)
     */
    calculateWatchTime(minTime, maxTime) {
        return this.randomDelay(minTime, maxTime);
    }
}

module.exports = HumanPattern;
