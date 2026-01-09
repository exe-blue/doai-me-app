import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  SidebarProvider,
  useSidebar,
} from '@/app/components/ui/sidebar';
import { Home } from 'lucide-react';

// useSidebar 훅 테스트용 컴포넌트
function TestSidebarConsumer() {
  const { open, setOpen, animate } = useSidebar();
  return (
    <div>
      <span data-testid="open-state">{open ? 'open' : 'closed'}</span>
      <span data-testid="animate-state">{animate ? 'animated' : 'static'}</span>
      <button onClick={() => setOpen(!open)}>Toggle</button>
    </div>
  );
}

describe('Sidebar 컴포넌트', () => {
  describe('SidebarProvider', () => {
    it('기본값으로 closed 상태와 animate=true로 렌더링된다', () => {
      render(
        <SidebarProvider>
          <TestSidebarConsumer />
        </SidebarProvider>
      );

      expect(screen.getByTestId('open-state')).toHaveTextContent('closed');
      expect(screen.getByTestId('animate-state')).toHaveTextContent('animated');
    });

    it('open prop을 전달하면 해당 상태로 초기화된다', () => {
      render(
        <SidebarProvider open={true} setOpen={vi.fn()}>
          <TestSidebarConsumer />
        </SidebarProvider>
      );

      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
    });

    it('animate=false를 전달하면 static 상태가 된다', () => {
      render(
        <SidebarProvider animate={false}>
          <TestSidebarConsumer />
        </SidebarProvider>
      );

      expect(screen.getByTestId('animate-state')).toHaveTextContent('static');
    });

    it('setOpen 함수로 상태를 토글할 수 있다', () => {
      render(
        <SidebarProvider>
          <TestSidebarConsumer />
        </SidebarProvider>
      );

      expect(screen.getByTestId('open-state')).toHaveTextContent('closed');
      
      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
      
      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
    });
  });

  describe('Sidebar', () => {
    it('children을 렌더링한다', () => {
      render(
        <Sidebar>
          <div data-testid="child">Child Content</div>
        </Sidebar>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('open과 setOpen props를 SidebarProvider에 전달한다', () => {
      const setOpen = vi.fn();
      render(
        <Sidebar open={true} setOpen={setOpen}>
          <TestSidebarConsumer />
        </Sidebar>
      );

      expect(screen.getByTestId('open-state')).toHaveTextContent('open');
    });
  });

  describe('SidebarBody', () => {
    it('Desktop과 Mobile 사이드바를 모두 렌더링한다', () => {
      render(
        <Sidebar>
          <SidebarBody data-testid="sidebar-body">
            <div>Content</div>
          </SidebarBody>
        </Sidebar>
      );

      // Desktop sidebar (hidden on mobile)
      const desktopSidebar = document.querySelector('.hidden.md\\:flex');
      expect(desktopSidebar).toBeInTheDocument();

      // Mobile sidebar (hidden on desktop)
      const mobileSidebar = document.querySelector('.md\\:hidden');
      expect(mobileSidebar).toBeInTheDocument();
    });
  });

  describe('SidebarLink', () => {
    const mockLink = {
      label: 'Home',
      href: '/home',
      icon: <Home data-testid="home-icon" />,
    };

    it('링크와 아이콘을 렌더링한다', () => {
      render(
        <Sidebar>
          <SidebarLink link={mockLink} />
        </Sidebar>
      );

      expect(screen.getByRole('link')).toHaveAttribute('href', '/home');
      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
    });

    it('라벨 텍스트를 포함한다', () => {
      render(
        <Sidebar open={true} setOpen={vi.fn()}>
          <SidebarLink link={mockLink} />
        </Sidebar>
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('커스텀 className을 적용할 수 있다', () => {
      render(
        <Sidebar>
          <SidebarLink link={mockLink} className="custom-class" />
        </Sidebar>
      );

      expect(screen.getByRole('link')).toHaveClass('custom-class');
    });
  });

  describe('useSidebar 훅', () => {
    it('SidebarProvider 외부에서 사용하면 에러를 던진다', () => {
      // 에러 콘솔 출력 억제
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestSidebarConsumer />);
      }).toThrow('useSidebar must be used within a SidebarProvider');

      consoleSpy.mockRestore();
    });
  });
});
