import React, { useEffect, useRef } from "react";

export default function ParticleVortexCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId;
    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let mouseX = 0;
    let mouseY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let tiltX = 0;
    let tiltY = 0;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX = x * 2;
      mouseY = y * 2;
      targetTiltY = mouseX * 0.35;
      targetTiltX = -mouseY * 0.2;
    };

    window.addEventListener("mousemove", handleMouseMove);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.parentElement.clientWidth;
      height = canvas.parentElement.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener("resize", handleResize);

    // =========================================================================
    // 3D Tree-of-Light & Particle Vortex Engine (Anchor AI Signature)
    // =========================================================================
    const PARTICLE_COUNT = 2400;
    const particles = [];

    // Elegant Monad Purple & Obsidian Galaxy palette (Zero color riot)
    const colors = [
      { r: 131, g: 110, b: 249 },  // Monad Purple (#836ef9)
      { r: 168, g: 85, b: 247 },   // Vivid Violet (#a855f7)
      { r: 192, g: 132, b: 252 },  // Lavender Glow (#c084fc)
      { r: 104, g: 78, b: 245 },   // Deep Monad Indigo (#684ef5)
      { r: 216, g: 180, b: 254 },  // Soft Purple Tint (#d8b4fe)
      { r: 255, g: 255, b: 255 },  // Pure White Core
      { r: 226, g: 232, b: 240 }   // Platinum / Starlight Silver (#e2e8f0)
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 70% in tree canopy & vortex, 30% floating ambient stardust
      const isAmbient = Math.random() < 0.2;
      const yNorm = Math.random(); // 0 = base, 1 = top canopy
      const colorObj = colors[Math.floor(Math.random() * colors.length)];

      let baseR;
      if (isAmbient) {
        // Wide ambient drifting particles
        baseR = 100 + Math.random() * 550;
      } else {
        // Tree / Vortex mushroom profile:
        // Lower stem (y < 0.35): narrow funnel
        // Upper canopy (y >= 0.35): billowing umbrella / cloud
        if (yNorm < 0.35) {
          const stemProgress = yNorm / 0.35;
          baseR = 12 + stemProgress * 45 + (Math.random() - 0.5) * 25;
        } else {
          const canopyProgress = (yNorm - 0.35) / 0.65;
          // Canopy balloons outward like a glowing cloud
          const expansion = Math.sin(canopyProgress * Math.PI * 0.85);
          baseR = 55 + expansion * 340 + (Math.random() - 0.5) * 80;
        }
      }

      const theta = Math.random() * Math.PI * 2;

      particles.push({
        yNorm,
        theta,
        baseR,
        isAmbient,
        speed: (isAmbient ? 0.003 : 0.008) + (1 - yNorm * 0.4) * 0.012,
        verticalSpeed: (isAmbient ? 0.0008 : 0.0018) + Math.random() * 0.0018,
        size: Math.random() * (isAmbient ? 1.8 : 2.4) + 0.5,
        alpha: Math.random() * 0.75 + 0.25,
        pulseOffset: Math.random() * Math.PI * 2,
        color: colorObj
      });
    }

    // =========================================================================
    // Concentric Ripples on Ground Plane
    // =========================================================================
    const ripples = [];
    for (let i = 0; i < 6; i++) {
      ripples.push({
        radius: (i / 6) * 440,
        maxRadius: 440,
        speed: 0.75
      });
    }

    let time = 0;

    const render = () => {
      time += 0.016;
      tiltX += (targetTiltX - tiltX) * 0.04;
      tiltY += (targetTiltY - tiltY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.46;
      const fov = 460;

      // -----------------------------------------------------------------------
      // 1. Draw Concentric Floor Ripples
      // -----------------------------------------------------------------------
      ctx.save();
      const floorY = centerY + 190;
      const ellipseRatio = 0.26; // perspective flatten for ground water plane

      ripples.forEach((rip) => {
        rip.radius += rip.speed;
        if (rip.radius > rip.maxRadius) {
          rip.radius = 12;
        }

        const progress = rip.radius / rip.maxRadius;
        const alpha = Math.sin(progress * Math.PI) * 0.35;

        ctx.beginPath();
        ctx.ellipse(
          centerX + tiltY * 35,
          floorY + tiltX * 25,
          rip.radius,
          rip.radius * ellipseRatio,
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = `rgba(131, 110, 249, ${alpha})`;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = "#836ef9";
        ctx.shadowBlur = 10;
        ctx.stroke();
      });
      ctx.restore();

      // -----------------------------------------------------------------------
      // 2. Draw 3D Tree-of-Light Particles
      // -----------------------------------------------------------------------
      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Animate altitude upwards and loop
        p.yNorm += p.verticalSpeed;
        if (p.yNorm > 1.15) {
          p.yNorm = 0.02;
          p.theta = Math.random() * Math.PI * 2;
        }

        p.theta += p.speed;

        // Radius calculation
        let currentR = p.baseR;
        if (!p.isAmbient) {
          if (p.yNorm < 0.35) {
            const stemProgress = p.yNorm / 0.35;
            currentR = 12 + stemProgress * 50;
          } else {
            const canopyProgress = (p.yNorm - 0.35) / 0.65;
            const expansion = Math.sin(canopyProgress * Math.PI * 0.85);
            currentR = 55 + expansion * 340;
          }
        }

        // 3D coordinates relative to origin
        const rawX = Math.cos(p.theta) * currentR;
        const rawY = (1 - p.yNorm) * 360 - 150; // bottom is ~+190, top is ~-210
        const rawZ = Math.sin(p.theta) * currentR;

        // 3D rotation with mouse tilt
        const cosY = Math.cos(tiltY);
        const sinY = Math.sin(tiltY);
        const rotX1 = rawX * cosY - rawZ * sinY;
        const rotZ1 = rawX * sinY + rawZ * cosY;

        const cosX = Math.cos(tiltX);
        const sinX = Math.sin(tiltX);
        const rotY2 = rawY * cosX - rotZ1 * sinX;
        const rotZ2 = rawY * sinX + rotZ1 * cosX;

        const cameraDist = 620;
        const z = rotZ2 + cameraDist;

        if (z > 40) {
          const scale = fov / z;
          const projX = centerX + rotX1 * scale;
          const projY = centerY + rotY2 * scale;

          const pulse = Math.sin(time * 2.5 + p.pulseOffset) * 0.25 + 0.75;
          const alpha = p.alpha * pulse * Math.min(1, (z - 40) / 100);

          projected.push({
            x: projX,
            y: projY,
            size: p.size * scale,
            color: p.color,
            alpha,
            z
          });
        }
      }

      // Sort from back to front for clean depth
      projected.sort((a, b) => b.z - a.z);

      // Render glowing particles
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha})`;
        if (p.size > 1.2) {
          ctx.shadowColor = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0.7)`;
          ctx.shadowBlur = p.size * 2.5;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0
      }}
    />
  );
}
