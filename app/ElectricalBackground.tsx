"use client";

import { useEffect, useRef } from "react";

/**
 * Animated 3D electrical background.
 * A perspective-projected network of glowing nodes drifting through 3D space,
 * with energy pulses traveling along connections and occasional lightning arcs.
 */
export default function ElectricalBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;

    type Node3D = { x: number; y: number; z: number; vx: number; vy: number; vz: number };
    type Pulse = { a: number; b: number; t: number; speed: number };
    type Arc = { pts: { x: number; y: number }[]; life: number; max: number };

    const NODE_COUNT = 64;
    const SPACE = 900; // half-extent of the node cloud
    const FOV = 620;

    const nodes: Node3D[] = [];
    const pulses: Pulse[] = [];
    const arcs: Arc[] = [];

    function rand(min: number, max: number) {
      return min + Math.random() * (max - min);
    }

    function seedNodes() {
      nodes.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: rand(-SPACE, SPACE),
          y: rand(-SPACE * 0.6, SPACE * 0.6),
          z: rand(-SPACE, SPACE),
          vx: rand(-0.12, 0.12),
          vy: rand(-0.08, 0.08),
          vz: rand(-0.12, 0.12),
        });
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      canvas!.style.width = width + "px";
      canvas!.style.height = height + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Slow rotation of the whole cloud around the Y axis.
    let angle = 0;

    function project(n: Node3D) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rx = n.x * cos - n.z * sin;
      const rz = n.x * sin + n.z * cos;
      const scale = FOV / (FOV + rz + SPACE * 0.35);
      return {
        sx: width / 2 + rx * scale,
        sy: height / 2 + n.y * scale,
        scale,
      };
    }

    function spawnLightning() {
      const a = nodes[Math.floor(Math.random() * nodes.length)];
      const b = nodes[Math.floor(Math.random() * nodes.length)];
      if (!a || !b || a === b) return;
      const pa = project(a);
      const pb = project(b);
      const pts = [{ x: pa.sx, y: pa.sy }];
      const steps = 7;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        pts.push({
          x: pa.sx + (pb.sx - pa.sx) * t + rand(-34, 34),
          y: pa.sy + (pb.sy - pa.sy) * t + rand(-34, 34),
        });
      }
      pts.push({ x: pb.sx, y: pb.sy });
      arcs.push({ pts, life: 1, max: rand(220, 420) });
    }

    function frame() {
      if (!running) return;
      angle += 0.0012;

      // Transparent base — the lab photo layer below shows through.
      ctx!.clearRect(0, 0, width, height);

      const glow = ctx!.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7
      );
      glow.addColorStop(0, "rgba(111,94,244,0.16)");
      glow.addColorStop(0.5, "rgba(79,216,255,0.05)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, width, height);

      // Move nodes and wrap them inside the cloud bounds.
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy; n.z += n.vz;
        if (Math.abs(n.x) > SPACE) n.vx *= -1;
        if (Math.abs(n.y) > SPACE * 0.6) n.vy *= -1;
        if (Math.abs(n.z) > SPACE) n.vz *= -1;
      }

      // Connections between nearby nodes.
      ctx!.lineCap = "round";
      for (let i = 0; i < nodes.length; i++) {
        const pa = project(nodes[i]);
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dz = nodes[i].z - nodes[j].z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > 260 * 260) continue;
          const pb = project(nodes[j]);
          const depth = Math.min(pa.scale, pb.scale);
          const alpha = (1 - Math.sqrt(d2) / 260) * 0.38 * depth;
          ctx!.strokeStyle = `rgba(138,123,255,${alpha.toFixed(3)})`;
          ctx!.lineWidth = Math.max(0.4, 1.1 * depth);
          ctx!.beginPath();
          ctx!.moveTo(pa.sx, pa.sy);
          ctx!.lineTo(pb.sx, pb.sy);
          ctx!.stroke();
        }
      }

      // Nodes with depth-based glow.
      for (const n of nodes) {
        const p = project(n);
        const r = Math.max(0.8, 2.4 * p.scale);
        const g = ctx!.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 4);
        g.addColorStop(0, `rgba(180,200,255,${(0.85 * p.scale).toFixed(3)})`);
        g.addColorStop(0.4, `rgba(138,123,255,${(0.35 * p.scale).toFixed(3)})`);
        g.addColorStop(1, "rgba(138,123,255,0)");
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(p.sx, p.sy, r * 4, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Energy pulses traveling along random connections.
      if (pulses.length < 10 && Math.random() < 0.06) {
        pulses.push({
          a: Math.floor(Math.random() * nodes.length),
          b: Math.floor(Math.random() * nodes.length),
          t: 0,
          speed: rand(0.008, 0.02),
        });
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pu = pulses[i];
        const pa = project(nodes[pu.a]);
        const pb = project(nodes[pu.b]);
        pu.t += pu.speed;
        if (pu.t >= 1) { pulses.splice(i, 1); continue; }
        const px = pa.sx + (pb.sx - pa.sx) * pu.t;
        const py = pa.sy + (pb.sy - pa.sy) * pu.t;
        const g = ctx!.createRadialGradient(px, py, 0, px, py, 9);
        g.addColorStop(0, "rgba(210,240,255,0.9)");
        g.addColorStop(0.5, "rgba(79,216,255,0.45)");
        g.addColorStop(1, "rgba(79,216,255,0)");
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(px, py, 9, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Occasional lightning arcs between nodes.
      if (Math.random() < 0.015 && arcs.length < 3) spawnLightning();
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        arc.life -= 1 / arc.max;
        if (arc.life <= 0) { arcs.splice(i, 1); continue; }
        const a = arc.life;
        ctx!.shadowBlur = 18;
        ctx!.shadowColor = `rgba(160,190,255,${(0.8 * a).toFixed(3)})`;
        ctx!.strokeStyle = `rgba(200,220,255,${(0.75 * a).toFixed(3)})`;
        ctx!.lineWidth = 1.6;
        ctx!.beginPath();
        ctx!.moveTo(arc.pts[0].x, arc.pts[0].y);
        for (let k = 1; k < arc.pts.length; k++) ctx!.lineTo(arc.pts[k].x, arc.pts[k].y);
        ctx!.stroke();
        ctx!.shadowBlur = 0;
      }

      // Vignette so the modal card stays readable.
      const vig = ctx!.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.35,
        width / 2, height / 2, Math.max(width, height) * 0.75
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(3,5,10,0.55)");
      ctx!.fillStyle = vig;
      ctx!.fillRect(0, 0, width, height);

      raf = requestAnimationFrame(frame);
    }

    resize();
    seedNodes();

    if (reducedMotion) {
      angle = 0.6;
      frame();
      cancelAnimationFrame(raf); // draw a single static frame
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      resize();
      if (reducedMotion) {
        angle = 0.6;
        frame();
        cancelAnimationFrame(raf);
      }
    };
    const onVisibility = () => {
      if (reducedMotion) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="electrical-bg" aria-hidden="true" />;
}
