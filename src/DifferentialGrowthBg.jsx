import React, { useRef, useEffect } from 'react'

/**
 * Differential Growth System
 * Adapted from the inconvergent prototype.
 * Nodes along a path repel nearby nodes and attract their neighbors,
 * producing organic, coral-like branching forms.
 */
class DifferentialGrowth {
  constructor(opts = {}) {
    this.maxNodes = opts.maxNodes || 4000
    this.repulsionRadius = opts.repulsionRadius || 18
    this.attractionForce = opts.attractionForce || 0.3
    this.repulsionForce = opts.repulsionForce || 0.8
    this.splitDist = opts.splitDist || 8
    this.damping = opts.damping || 0.92
    this.jitter = opts.jitter || 0.3
    this.bounds = opts.bounds || { x: 0, y: 0, w: 1000, h: 1000 }
    this.paths = []
  }

  addPath(points) {
    const path = points.map(p => ({ x: p.x, y: p.y, vx: 0, vy: 0 }))
    this.paths.push(path)
  }

  totalNodes() {
    let total = 0
    for (const path of this.paths) total += path.length
    return total
  }

  step() {
    for (const path of this.paths) {
      this._applyForces(path)
      this._integrate(path)
    }
    if (this.totalNodes() < this.maxNodes) {
      for (let pi = 0; pi < this.paths.length; pi++) {
        this.paths[pi] = this._splitEdges(this.paths[pi])
      }
    }
  }

  _applyForces(path) {
    const n = path.length
    if (n < 3) return
    const allNodes = []
    for (const p of this.paths) for (const node of p) allNodes.push(node)

    for (let i = 0; i < n; i++) {
      const node = path[i]
      let fx = 0, fy = 0

      if (i > 0) {
        const prev = path[i - 1]
        fx += (prev.x - node.x) * this.attractionForce
        fy += (prev.y - node.y) * this.attractionForce
      }
      if (i < n - 1) {
        const next = path[i + 1]
        fx += (next.x - node.x) * this.attractionForce
        fy += (next.y - node.y) * this.attractionForce
      }

      const rr = this.repulsionRadius * this.repulsionRadius
      for (let j = 0; j < allNodes.length; j++) {
        const other = allNodes[j]
        if (other === node) continue
        const dx = node.x - other.x
        const dy = node.y - other.y
        const d2 = dx * dx + dy * dy
        if (d2 < rr && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const force = this.repulsionForce * (1 - d / this.repulsionRadius)
          fx += (dx / d) * force
          fy += (dy / d) * force
        }
      }

      fx += (Math.random() - 0.5) * this.jitter
      fy += (Math.random() - 0.5) * this.jitter
      node.vx += fx
      node.vy += fy
    }
  }

  _integrate(path) {
    const { x: bx, y: by, w: bw, h: bh } = this.bounds
    const margin = 20
    for (const node of path) {
      node.vx *= this.damping
      node.vy *= this.damping
      node.x += node.vx
      node.y += node.vy
      if (node.x < bx + margin) node.vx += 0.5
      if (node.x > bx + bw - margin) node.vx -= 0.5
      if (node.y < by + margin) node.vy += 0.5
      if (node.y > by + bh - margin) node.vy -= 0.5
    }
  }

  _splitEdges(path) {
    const newPath = [path[0]]
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1]
      const curr = path[i]
      const dx = curr.x - prev.x
      const dy = curr.y - prev.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > this.splitDist) {
        newPath.push({
          x: (prev.x + curr.x) / 2 + (Math.random() - 0.5) * 0.5,
          y: (prev.y + curr.y) / 2 + (Math.random() - 0.5) * 0.5,
          vx: 0, vy: 0,
        })
      }
      newPath.push(curr)
    }
    return newPath
  }
}

// Colors from the palette, muted for background
const COLORS = [
  { r: 175, g: 180, b: 140, a: 0.35 },  // muted green
  { r: 120, g: 140, b: 90,  a: 0.40 },  // sage
  { r: 139, g: 94,  b: 60,  a: 0.30 },  // brick
  { r: 180, g: 170, b: 155, a: 0.20 },  // overcast
  { r: 27,  g: 75,  b: 107, a: 0.15 },  // deep blue
]

function drawPath(ctx, path, colorIndex, baseWidth) {
  if (path.length < 2) return
  const c = COLORS[colorIndex % COLORS.length]
  ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`
  ctx.lineWidth = baseWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length - 1; i++) {
    const xc = (path[i].x + path[i + 1].x) / 2
    const yc = (path[i].y + path[i + 1].y) / 2
    ctx.quadraticCurveTo(path[i].x, path[i].y, xc, yc)
  }
  ctx.lineTo(path[path.length - 1].x, path[path.length - 1].y)
  ctx.stroke()
}

function drawPathIncomplete(ctx, path, colorIndex, baseWidth) {
  if (path.length < 3) return
  const c = COLORS[colorIndex % COLORS.length]
  ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  let drawing = true
  let segStart = 0

  for (let i = 0; i < path.length; i++) {
    if (Math.random() < 0.008) {
      if (drawing && i > segStart + 2) {
        ctx.lineWidth = baseWidth * (0.7 + Math.random() * 0.35)
        ctx.beginPath()
        ctx.moveTo(path[segStart].x, path[segStart].y)
        for (let j = segStart + 1; j < i; j++) {
          const next = j + 1 < path.length ? j + 1 : j
          const xc = (path[j].x + path[next].x) / 2
          const yc = (path[j].y + path[next].y) / 2
          ctx.quadraticCurveTo(path[j].x, path[j].y, xc, yc)
        }
        ctx.stroke()
      }
      drawing = !drawing
      segStart = i
    }
  }

  if (drawing && path.length > segStart + 2) {
    ctx.lineWidth = baseWidth * (0.7 + Math.random() * 0.35)
    ctx.beginPath()
    ctx.moveTo(path[segStart].x, path[segStart].y)
    for (let j = segStart + 1; j < path.length - 1; j++) {
      const xc = (path[j].x + path[j + 1].x) / 2
      const yc = (path[j].y + path[j + 1].y) / 2
      ctx.quadraticCurveTo(path[j].x, path[j].y, xc, yc)
    }
    ctx.stroke()
  }
}

export default function DifferentialGrowthBg() {
  const canvasRef = useRef(null)
  const growthRef = useRef(null)
  const frameRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    function renderCurrentFrame() {
      const cw = canvas.width / dpr
      const ch = canvas.height / dpr
      ctx.fillStyle = '#E8E4DB'
      ctx.fillRect(0, 0, cw, ch)
      const growth = growthRef.current
      if (!growth) return
      for (let i = 0; i < growth.paths.length; i++) {
        const path = growth.paths[i]
        if (frameRef.current < 200) {
          drawPath(ctx, path, i, 1.45)
        } else if (i % 3 === 0) {
          drawPathIncomplete(ctx, path, i, 1.25)
        } else {
          drawPath(ctx, path, i, 1.0)
        }
      }
    }

    function resize() {
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return { w, h }
    }

    let { w, h } = resize()

    const growth = new DifferentialGrowth({
      maxNodes: 5000,
      repulsionRadius: 16,
      attractionForce: 0.25,
      repulsionForce: 0.7,
      splitDist: 7,
      jitter: 0.25,
      damping: 0.9,
      bounds: { x: 0, y: 0, w, h },
    })
    growthRef.current = growth

    // Seed paths
    const numPaths = 6
    for (let p = 0; p < numPaths; p++) {
      const points = []
      const numPoints = 15 + Math.floor(Math.random() * 10)
      const yBase = h * (0.2 + 0.6 * (p / (numPaths - 1)))
      const xStart = w * 0.1
      const xEnd = w * 0.9
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1)
        points.push({
          x: xStart + (xEnd - xStart) * t,
          y: yBase + (Math.random() - 0.5) * 60,
        })
      }
      growth.addPath(points)
    }

    // Circular seed forms, biased toward the sides instead of the center
    for (let c = 0; c < 2; c++) {
      const side = Math.random() < 0.5 ? 'left' : 'right'
      const cx = side === 'left'
        ? w * (0.05 + Math.random() * 0.25)
        : w * (0.7 + Math.random() * 0.25)
      const cy = h * (0.3 + Math.random() * 0.4)
      const r = 30 + Math.random() * 40
      const n = 20
      const points = []
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2
        points.push({
          x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 5,
          y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 5,
        })
      }
      points.push({ ...points[0] })
      growth.addPath(points)
    }

    // Initial clear
    ctx.fillStyle = '#E8E4DB'
    ctx.fillRect(0, 0, w, h)

    let frame = 0
    let lastTime = performance.now()
    let elapsed = 0
    let growthAccumulator = 0
    let fadeAccumulator = 0

    function animate(now) {
      rafRef.current = requestAnimationFrame(animate)

      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      elapsed += dt

      // Use wall-clock time so pacing is consistent across machines while
      // preserving the original visual behavior. The step rate decays over time
      // instead of cutting to a hard stop.
      const initialGrowthRate = 30
      const minimumGrowthRate = 0.35
      const slowdownTau = 18
      const growthRate = minimumGrowthRate + (initialGrowthRate - minimumGrowthRate) * Math.exp(-elapsed / slowdownTau)
      growthAccumulator += dt * growthRate

      while (growthAccumulator >= 1) {
        growth.step()
        growthAccumulator -= 1
      }

      const fadeRate = 0.89 + (growthRate - minimumGrowthRate) / (initialGrowthRate - minimumGrowthRate) * 4.7
      const fadeAlpha = 0.0156 + (growthRate - minimumGrowthRate) / (initialGrowthRate - minimumGrowthRate) * 0.03
      fadeAccumulator += dt * fadeRate
      while (fadeAccumulator >= 1) {
        ctx.fillStyle = `rgba(232, 228, 219, ${fadeAlpha.toFixed(4)})`
        ctx.fillRect(0, 0, w, h)
        fadeAccumulator -= 1
      }

      for (let i = 0; i < growth.paths.length; i++) {
        const path = growth.paths[i]
        if (frame < 200) {
          drawPath(ctx, path, i, 1.24 + Math.random() * 0.24)
        } else {
          if (i % 3 === 0) {
            drawPathIncomplete(ctx, path, i, 1.02 + Math.random() * 0.22)
          } else {
            drawPath(ctx, path, i, 0.84 + Math.random() * 0.18)
          }
        }
      }

      frame = Math.floor(elapsed * 60)
      frameRef.current = frame
    }

    animate(lastTime)

    let resizeTimeout
    function handleResize() {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        const dims = resize()
        w = dims.w
        h = dims.h
        growth.bounds = { x: 0, y: 0, w, h }
        renderCurrentFrame()
      }, 200)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
