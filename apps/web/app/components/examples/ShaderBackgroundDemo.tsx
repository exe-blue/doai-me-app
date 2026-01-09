"use client";

import React from "react";
import AnimatedShaderBackground from "@/app/components/ui/animated-shader-background";

// Aurora Shader Background 데모 컴포넌트
export function ShaderBackgroundDemo() {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Shader Background */}
      <AnimatedShaderBackground />
      
      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white">
        <h1 className="text-5xl font-bold mb-4 animate-float">
          Aurora Effect
        </h1>
        <p className="text-lg text-neutral-400 text-center max-w-md">
          WebGL 셰이더로 구현된 아름다운 오로라 배경 효과
        </p>
      </div>
    </div>
  );
}

export default ShaderBackgroundDemo;
