import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn 유틸리티 함수', () => {
  it('단일 클래스를 반환한다', () => {
    expect(cn('text-red-500')).toBe('text-red-500');
  });

  it('여러 클래스를 병합한다', () => {
    expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500');
  });

  it('조건부 클래스를 처리한다', () => {
    const isActive = true;
    const isDisabled = false;

    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('객체 형태의 조건부 클래스를 처리한다', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('배열 형태의 클래스를 처리한다', () => {
    expect(cn(['text-sm', 'font-bold'])).toBe('text-sm font-bold');
  });

  it('Tailwind 클래스 충돌을 해결한다', () => {
    // tailwind-merge가 충돌하는 클래스를 해결
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('px-4', 'p-2')).toBe('p-2');
  });

  it('빈 값을 무시한다', () => {
    expect(cn('base', '', null, undefined, 'end')).toBe('base end');
  });

  it('복합적인 케이스를 처리한다', () => {
    const variant = 'primary';
    const size = 'lg';
    
    expect(
      cn(
        'btn',
        variant === 'primary' && 'bg-blue-500 text-white',
        variant === 'secondary' && 'bg-gray-500',
        size === 'sm' && 'text-sm p-2',
        size === 'lg' && 'text-lg p-4',
        { 'opacity-50': false, 'cursor-pointer': true }
      )
    ).toBe('btn bg-blue-500 text-white text-lg p-4 cursor-pointer');
  });

  it('공백이 포함된 클래스를 정리한다', () => {
    expect(cn('  text-red-500  ', '  bg-blue-500  ')).toBe('text-red-500 bg-blue-500');
  });
});
