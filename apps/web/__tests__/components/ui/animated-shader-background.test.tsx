import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Three.js mock을 테스트 파일 내에서 정의
vi.mock('three', () => {
  const mockCanvas = document.createElement('canvas');
  
  class MockWebGLRenderer {
    domElement = mockCanvas;
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  
  class MockScene {
    add = vi.fn();
  }
  
  class MockOrthographicCamera {}
  
  class MockShaderMaterial {
    uniforms = {
      iTime: { value: 0 },
      iResolution: { value: { set: vi.fn() } },
    };
    dispose = vi.fn();
  }
  
  class MockPlaneGeometry {
    dispose = vi.fn();
  }
  
  class MockMesh {}
  
  class MockVector2 {
    set = vi.fn();
    constructor() {}
  }
  
  return {
    Scene: MockScene,
    OrthographicCamera: MockOrthographicCamera,
    WebGLRenderer: MockWebGLRenderer,
    ShaderMaterial: MockShaderMaterial,
    PlaneGeometry: MockPlaneGeometry,
    Mesh: MockMesh,
    Vector2: MockVector2,
  };
});

import { render, cleanup } from '@testing-library/react';
import AnimatedShaderBackground from '@/app/components/ui/animated-shader-background';

describe('AnimatedShaderBackground 컴포넌트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('컨테이너 div를 렌더링한다', () => {
    const { container } = render(<AnimatedShaderBackground />);
    
    const containerDiv = container.querySelector('.absolute.inset-0.overflow-hidden');
    expect(containerDiv).toBeInTheDocument();
  });

  it('children div가 z-10 클래스를 가진다', () => {
    const { container } = render(<AnimatedShaderBackground />);
    
    const innerDiv = container.querySelector('.relative.z-10');
    expect(innerDiv).toBeInTheDocument();
  });

  it('canvas 요소가 DOM에 추가된다', () => {
    const { container } = render(<AnimatedShaderBackground />);
    
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('애니메이션 프레임이 요청된다', () => {
    render(<AnimatedShaderBackground />);
    
    expect(global.requestAnimationFrame).toHaveBeenCalled();
  });

  it('resize 이벤트 리스너가 등록된다', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    
    render(<AnimatedShaderBackground />);
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    
    addEventListenerSpy.mockRestore();
  });

  it('언마운트 시 cleanup이 실행된다', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    const { unmount } = render(<AnimatedShaderBackground />);
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
    
    removeEventListenerSpy.mockRestore();
  });
});
