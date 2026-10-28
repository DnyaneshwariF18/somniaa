import { useEffect, useRef } from 'react';
import type { ThemeId } from '@/themes';

interface AIBackgroundProps {
  theme: ThemeId;
  /**
   * When true, renders a calmer background suited to an app shell:
   * fewer particles, no mouse parallax, dimmed orb/glows.
   * Defaults to false (vivid landing mode).
   */
  subtle?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export default function AIBackground({ theme, subtle = false }: AIBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbWrapRef = useRef<HTMLDivElement | null>(null);
  const glowARef = useRef<HTMLDivElement | null>(null);
  const glowBRef = useRef<HTMLDivElement | null>(null);
  const glowCRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const subtleRef = useRef<boolean>(subtle);
  subtleRef.current = subtle;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const isMobile = () => window.innerWidth < 768;

    const buildParticles = () => {
      const sub = subtleRef.current;
      const base = isMobile() ? 34 : 78;
      const count = sub ? Math.round(base * 0.5) : base;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: Math.random() * 1.6 + 0.6,
      }));
    };

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    };

    const getRgb = () => {
      const css = getComputedStyle(document.documentElement)
        .getPropertyValue('--particle')
        .trim();
      return css || '169, 155, 245';
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const rgb = getRgb();
      const sub = subtleRef.current;
      const linkDist = isMobile() ? (sub ? 90 : 110) : sub ? 120 : 150;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${sub ? 0.55 : 0.85})`;
        ctx.shadowBlur = sub ? 5 : 8;
        ctx.shadowColor = `rgba(${rgb}, ${sub ? 0.4 : 0.6})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // neural links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!;
          const b = particles[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * (sub ? 0.2 : 0.32);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reduce) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      draw();
    }

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Parallax on pointer move (desktop, vivid mode only)
  useEffect(() => {
    if (subtle) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.innerWidth < 1024) return;

    let frame = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      if (orbWrapRef.current) {
        orbWrapRef.current.style.transform = `translate(calc(-50% + ${cx * 18}px), calc(-50% + ${cy * 14}px))`;
      }
      if (glowARef.current) {
        glowARef.current.style.marginLeft = `${cx * -24}px`;
        glowARef.current.style.marginTop = `${cy * -16}px`;
      }
      if (glowBRef.current) {
        glowBRef.current.style.marginLeft = `${cx * 24}px`;
        glowBRef.current.style.marginTop = `${cy * 16}px`;
      }
      if (glowCRef.current) {
        glowCRef.current.style.marginLeft = `${cx * 14}px`;
        glowCRef.current.style.marginTop = `${cy * 20}px`;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [subtle]);

  return (
    <div className="ai-bg" data-theme={theme} aria-hidden="true">
      <div className="ai-glow ai-glow--a" ref={glowARef} />
      <div className="ai-glow ai-glow--b" ref={glowBRef} />
      <div className="ai-glow ai-glow--c" ref={glowCRef} />

      <canvas className="ai-canvas" ref={canvasRef} />

      <div className="ai-orb-wrap" ref={orbWrapRef}>
        <div className="ai-orb-haze" />
        <div className="ai-ring ai-ring--3" />
        <div className="ai-ring ai-ring--2">
          <span className="ai-orbit-dot" />
        </div>
        <div className="ai-ring ai-ring--1">
          <span className="ai-orbit-dot" />
        </div>
        <div className="ai-orb" />
      </div>

      <div className="ai-vignette" />
    </div>
  );
}
