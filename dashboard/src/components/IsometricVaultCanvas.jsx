import React, { useRef, useEffect } from "react";

/**
 * IsometricVaultCanvas:
 * Interactive 3D Canvas rendering a high-precision isometric wireframe vault core
 * with orbiting nodes (Monad RPC, Sentinel, HotKey, DEX Venues) and animated transaction packets.
 * Strictly adheres to shiny obsidian black and Monad purple color palette.
 */
export default function IsometricVaultCanvas() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    let width = 500;
    let height = 460;

    const handleResize = () => {
      if (!canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width || 500;
      height = rect.height || 460;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / height - 0.5) * 2;
      mouseRef.current.targetX = Math.max(-1, Math.min(1, x));
      mouseRef.current.targetY = Math.max(-1, Math.min(1, y));
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 3D Math & Isometric Projection Helpers
    let angle = 0;
    // Nodes strictly styled in Monad purple & starlight white (Zero color riot)
    const nodes = [
      { name: "Monad RPC", sub: "400ms Blocks", angleOffset: 0, color: "#836EF9" },
      { name: "Risk Sentinel", sub: "Circuit Breaker", angleOffset: Math.PI / 2, color: "#A78BFA" },
      { name: "Agent Key", sub: "Zero Withdrawal", angleOffset: Math.PI, color: "#C4B5FD" },
      { name: "DEX Venues", sub: "UniV3 / Ambient", angleOffset: (3 * Math.PI) / 2, color: "#9D8DFA" }
    ];

    // Transaction energy packets along orbital pathways
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

      // Perspective projection shifted upward to sit comfortably inside card
      const distance = 520;
      const scale = distance / (distance + z2);
      const centerY = height / 2 - 48;
      return {
        x: width / 2 + x1 * scale,
        y: centerY + y2 * scale,
        scale,
        depth: z2
      };
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerping
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // True isometric perspective tilt angle
      const baseRotX = 0.60 + mouseRef.current.y * 0.12;
      const baseRotY = angle + mouseRef.current.x * 0.20;
      angle += 0.005;

      const centerY = height / 2 - 48;

      // 1. Draw atmospheric background glow (Monad Purple)
      const grad = ctx.createRadialGradient(
        width / 2, centerY, 10,
        width / 2, centerY, Math.min(width * 0.45, 230)
      );
      grad.addColorStop(0, "rgba(131, 110, 249, 0.16)");
      grad.addColorStop(0.5, "rgba(131, 110, 249, 0.04)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Calibrated orbital ring radius so rolling nodes stay completely inside the frame
      const ringRadius = Math.min(width * 0.38, 192);

      // 2. Draw Floor Ring / Consensus Horizon
      ctx.beginPath();
      const ringSteps = 48;
      for (let i = 0; i <= ringSteps; i++) {
        const theta = (i / ringSteps) * Math.PI * 2;
        const pt = project(Math.cos(theta) * ringRadius, 10, Math.sin(theta) * ringRadius, baseRotX, baseRotY);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = "rgba(131, 110, 249, 0.22)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Central Vault Core: Enlarged to comfortably enclose "WARDEN CORE ERC-4626"
      const cubeSize = 56;
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
        project(v.x, v.y, v.z, baseRotX, baseRotY)
      );

      // Translucent faces for obsidian crystal look
      const faces = [
        [0, 1, 2, 3], // back
        [4, 5, 6, 7], // front
        [0, 1, 5, 4], // top
        [2, 3, 7, 6], // bottom
        [0, 3, 7, 4], // left
        [1, 2, 6, 5]  // right
      ];

      faces.forEach((face) => {
        ctx.beginPath();
        ctx.moveTo(projVerts[face[0]].x, projVerts[face[0]].y);
        for (let i = 1; i < face.length; i++) {
          ctx.lineTo(projVerts[face[i]].x, projVerts[face[i]].y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(131, 110, 249, 0.05)";
        ctx.fill();
      });

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
        ctx.strokeStyle = "rgba(167, 139, 250, 0.75)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });

      // Vertex anchor dots
      projVerts.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2 * pt.scale, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      });

      // Central Vault Core Glow
      const centerProj = project(0, 0, 0, baseRotX, baseRotY);
      const coreGrad = ctx.createRadialGradient(
        centerProj.x, centerProj.y, 2,
        centerProj.x, centerProj.y, 44
      );
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      coreGrad.addColorStop(0.35, "rgba(131, 110, 249, 0.75)");
      coreGrad.addColorStop(1, "rgba(131, 110, 249, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerProj.x, centerProj.y, 44, 0, Math.PI * 2);
      ctx.fill();

      // Core text label — contained neatly inside enlarged cube
      ctx.font = "700 11.5px 'Space Grotesk', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText("WARDEN CORE", centerProj.x, centerProj.y - 1);
      ctx.font = "600 8.5px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(196, 181, 253, 0.95)";
      ctx.fillText("ERC-4626", centerProj.x, centerProj.y + 13);

      // 4. Compute Orbiting Node Positions with guaranteed outward clearance
      const nodePos = nodes.map((node) => {
        const rawX = Math.cos(node.angleOffset) * ringRadius;
        const rawZ = Math.sin(node.angleOffset) * ringRadius;
        const rawY = 10;
        let proj = project(rawX, rawY, rawZ, baseRotX, baseRotY);

        // Clearance guard: guarantee at least 124px 2D separation from centerProj so nodes never touch or block the cube
        const dx = proj.x - centerProj.x;
        const dy = proj.y - centerProj.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minClearance = 124;
        if (dist < minClearance) {
          const factor = minClearance / dist;
          proj = {
            ...proj,
            x: centerProj.x + dx * factor,
            y: centerProj.y + dy * factor
          };
        }

        return { ...node, proj, x: rawX, y: rawY, z: rawZ, dirX: dx / dist, dirY: dy / dist };
      });

      // 5. Draw connecting conduits from outside of cube to nodes (never crossing through core text)
      nodePos.forEach((node) => {
        const startX = centerProj.x + node.dirX * 62;
        const startY = centerProj.y + node.dirY * 62;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(node.proj.x, node.proj.y);
        ctx.strokeStyle = "rgba(131, 110, 249, 0.22)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 6. Draw Animated Transaction Packets along conduits
      packets.forEach((pkt) => {
        pkt.progress += pkt.speed;
        if (pkt.progress >= 1) pkt.progress = 0;

        const startNode = nodePos[pkt.fromIdx];
        const endNode = nodePos[pkt.toIdx];

        const px = startNode.proj.x + (endNode.proj.x - startNode.proj.x) * pkt.progress;
        const py = startNode.proj.y + (endNode.proj.y - startNode.proj.y) * pkt.progress;

        ctx.beginPath();
        ctx.arc(px, py, 3 * startNode.proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#836ef9";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 7. Draw Nodes (depth-sorted)
      const sortedNodes = [...nodePos].sort((a, b) => b.proj.depth - a.proj.depth);

      sortedNodes.forEach((node) => {
        const { proj, name, sub, color, dirX, dirY } = node;

        // Node Outer Ring
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 11 * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(8, 10, 16, 0.94)";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Node Inner Core Dot
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3.4 * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Radial Outward Vector: text label points strictly OUTWARD away from centerProj
        const offsetDist = 18 * proj.scale;
        const labelCenterX = proj.x + dirX * offsetDist;
        const labelCenterY = proj.y + dirY * offsetDist;

        ctx.font = `600 ${Math.max(10, 11 * proj.scale)}px 'Plus Jakarta Sans', sans-serif`;
        const textMetrics = ctx.measureText(name);
        const textWidth = textMetrics.width;

        // Pill background centered on outward label
        ctx.fillStyle = "rgba(6, 8, 14, 0.90)";
        ctx.beginPath();
        ctx.roundRect(
          labelCenterX - textWidth / 2 - 6,
          labelCenterY - 8,
          textWidth + 12,
          15,
          4
        );
        ctx.fill();

        // Text
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(name, labelCenterX, labelCenterY + 3);

        ctx.font = `500 ${Math.max(8, 8.5 * proj.scale)}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = "rgba(196, 181, 253, 0.9)";
        ctx.fillText(sub, labelCenterX, labelCenterY + 14);
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
          cursor: "grab"
        }}
      />
    </div>
  );
}
