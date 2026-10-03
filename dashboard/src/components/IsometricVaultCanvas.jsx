import React, { useRef, useEffect } from "react";

/**
 * IsometricVaultCanvas:
 * Interactive 3D Canvas rendering a high-precision isometric wireframe vault core
 * with orbiting nodes (Consensus, Sentinel, HotKey, DEX) and animated transaction packets.
 */
export default function IsometricVaultCanvas() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let width = (canvas.width = canvas.parentElement.clientWidth || 500);
    let height = (canvas.height = canvas.parentElement.clientHeight || 460);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || 500;
      height = canvas.height = canvas.parentElement.clientHeight || 460;
    };

    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / height - 0.5) * 2;
      mouseRef.current.targetX = x;
      mouseRef.current.targetY = y;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 3D Math & Isometric Projection Helpers
    let angle = 0;
    const nodes = [
      { name: "Monad RPC", sub: "400ms Blocks", angleOffset: 0, color: "#836EF9" },
      { name: "Risk Sentinel", sub: "Circuit Breaker", angleOffset: Math.PI / 2, color: "#10B981" },
      { name: "Agent Key", sub: "No Withdrawal", angleOffset: Math.PI, color: "#836EF9" },
      { name: "DEX Venues", sub: "UniV3 / Ambient", angleOffset: (3 * Math.PI) / 2, color: "#38BDF8" }
    ];

    // Simulated transaction energy packets traveling along paths
    const packets = [
      { fromIdx: 0, toIdx: 1, progress: 0.1, speed: 0.012 },
      { fromIdx: 1, toIdx: 2, progress: 0.6, speed: 0.015 },
      { fromIdx: 2, toIdx: 3, progress: 0.35, speed: 0.011 },
      { fromIdx: 3, toIdx: 0, progress: 0.85, speed: 0.014 }
    ];

    const project = (x, y, z, rotX, rotY) => {
      // Rotate around Y
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;

      // Rotate around X
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      // Perspective projection
      const distance = 550;
      const scale = distance / (distance + z2);
      return {
        x: width / 2 + x1 * scale,
        y: height / 2 + y2 * scale,
        scale,
        depth: z2
      };
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerping
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const baseRotX = 0.55 + mouseRef.current.y * 0.2;
      const baseRotY = angle + mouseRef.current.x * 0.3;
      angle += 0.005;

      // 1. Draw atmospheric background glow
      const grad = ctx.createRadialGradient(
        width / 2, height / 2, 20,
        width / 2, height / 2, 220
      );
      grad.addColorStop(0, "rgba(131, 110, 249, 0.14)");
      grad.addColorStop(0.5, "rgba(131, 110, 249, 0.03)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Floor Ring / Consensus Horizon
      ctx.beginPath();
      const ringSteps = 48;
      const ringRadius = 180;
      for (let i = 0; i <= ringSteps; i++) {
        const theta = (i / ringSteps) * Math.PI * 2;
        const pt = project(Math.cos(theta) * ringRadius, 40, Math.sin(theta) * ringRadius, baseRotX, baseRotY);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = "rgba(131, 110, 249, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Central Vault Core (3D Wireframe Cube with translucent faces)
      const cubeSize = 46;
      const vertices = [
        { x: -cubeSize, y: -cubeSize, z: -cubeSize },
        { x: cubeSize, y: -cubeSize, z: -cubeSize },
        { x: cubeSize, y: cubeSize, z: -cubeSize },
        { x: -cubeSize, y: cubeSize, z: -cubeSize },
        { x: -cubeSize, y: -cubeSize, z: cubeSize },
        { x: cubeSize, y: -cubeSize, z: cubeSize },
        { x: cubeSize, y: cubeSize, z: cubeSize },
        { x: -cubeSize, y: cubeSize, z: cubeSize }
      ];

      const projVerts = vertices.map((v) =>
        project(v.x, v.y - 10, v.z, baseRotX, baseRotY)
      );

      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
      ];

      // Draw Cube Edges
      edges.forEach(([i, j]) => {
        ctx.beginPath();
        ctx.moveTo(projVerts[i].x, projVerts[i].y);
        ctx.lineTo(projVerts[j].x, projVerts[j].y);
        ctx.strokeStyle = "rgba(131, 110, 249, 0.65)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });

      // Central Vault Core Glow
      const centerProj = project(0, -10, 0, baseRotX, baseRotY);
      const coreGrad = ctx.createRadialGradient(
        centerProj.x, centerProj.y, 4,
        centerProj.x, centerProj.y, 35
      );
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      coreGrad.addColorStop(0.3, "rgba(131, 110, 249, 0.8)");
      coreGrad.addColorStop(1, "rgba(131, 110, 249, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerProj.x, centerProj.y, 35, 0, Math.PI * 2);
      ctx.fill();

      // Core text label
      ctx.font = "600 11px 'Space Grotesk', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText("WARDEN CORE", centerProj.x, centerProj.y + 4);
      ctx.font = "400 9px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.fillText("ERC-4626", centerProj.x, centerProj.y + 16);

      // 4. Compute Orbiting Node Positions
      const nodePos = nodes.map((node) => {
        const nAngle = angle + node.angleOffset;
        const x = Math.cos(nAngle) * ringRadius;
        const z = Math.sin(nAngle) * ringRadius;
        const y = 30 + Math.sin(nAngle * 2) * 12; // gentle vertical wave
        const proj = project(x, y, z, baseRotX, baseRotY);
        return { ...node, proj, x, y, z };
      });

      // 5. Draw connecting flow conduits between core and nodes
      nodePos.forEach((node) => {
        ctx.beginPath();
        ctx.moveTo(centerProj.x, centerProj.y);
        ctx.lineTo(node.proj.x, node.proj.y);
        ctx.strokeStyle = "rgba(131, 110, 249, 0.22)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 6. Draw Animated Transaction Packets
      packets.forEach((pkt) => {
        pkt.progress += pkt.speed;
        if (pkt.progress >= 1) pkt.progress = 0;

        const startNode = nodePos[pkt.fromIdx];
        const endNode = nodePos[pkt.toIdx];

        // Linear interpolation in 3D
        const px = startNode.x + (endNode.x - startNode.x) * pkt.progress;
        const py = startNode.y + (endNode.y - startNode.y) * pkt.progress;
        const pz = startNode.z + (endNode.z - startNode.z) * pkt.progress;
        const pt = project(px, py, pz, baseRotX, baseRotY);

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5 * pt.scale, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#836ef9";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      // 7. Draw Nodes (sort by depth so foreground renders properly)
      const sortedNodes = [...nodePos].sort((a, b) => b.proj.depth - a.proj.depth);

      sortedNodes.forEach((node) => {
        const { proj, name, sub, color } = node;

        // Node Outer Ring
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 14 * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(10, 12, 18, 0.85)";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Node Inner Core Dot
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 4 * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Node Labels
        ctx.font = `600 ${Math.max(10, 12 * proj.scale)}px 'Plus Jakarta Sans', sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(name, proj.x, proj.y + 24 * proj.scale);

        ctx.font = `400 ${Math.max(8, 10 * proj.scale)}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
        ctx.fillText(sub, proj.x, proj.y + 36 * proj.scale);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "460px" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "crosshair"
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "0.75rem",
          color: "rgba(148, 163, 184, 0.6)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.04em",
          pointerEvents: "none"
        }}
      >
        ✦ 3D ISOMETRIC TELEMETRY MESH • INTERACTIVE DRAG & TILT
      </div>
    </div>
  );
}
