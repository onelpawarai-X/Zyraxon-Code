/**
 * ZYRAXON X — Robot Autonomy
 * Motion planner, force control, task scheduler, vision
 */
type R = { ok: boolean; data?: any; error?: string }

class PID {
  private integral = 0; private prevError = 0
  constructor(private kp: number, private ki: number, private kd: number, private outMin = -1e9, private outMax = 1e9) {}
  compute(error: number, dt: number): number {
    this.integral += error * dt; const deriv = dt > 0 ? (error - this.prevError) / dt : 0
    let out = this.kp * error + this.ki * this.integral + this.kd * deriv
    out = Math.max(this.outMin, Math.min(this.outMax, out)); this.prevError = error; return out
  }
  reset(): void { this.integral = 0; this.prevError = 0 }
}

export class MotionPlanner {
  private waypoints: Array<{ x: number; y: number; z: number; speed: number; gripper: number }> = []
  private currentIdx = 0; private blendRadius = 0.05

  loadTrajectory(wp: typeof this.waypoints): void { this.waypoints = wp; this.currentIdx = 0 }

  getNextCommand(pos: { x: number; y: number; z: number }): R {
    if (this.currentIdx >= this.waypoints.length) return { ok: true, data: { action: 'COMPLETE' } }
    const wp = this.waypoints[this.currentIdx]
    const dx = wp.x - pos.x, dy = wp.y - pos.y, dz = wp.z - pos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dist < this.blendRadius) { this.currentIdx++; return this.getNextCommand(pos) }

    const speed = wp.speed || 0.5
    const vx = (dx / dist) * speed, vy = (dy / dist) * speed, vz = (dz / dist) * speed
    return { ok: true, data: { vx: +vx.toFixed(4), vy: +vy.toFixed(4), vz: +vz.toFixed(4), gripper: wp.gripper, targetIdx: this.currentIdx, distance: +dist.toFixed(4) } }
  }

  isComplete(): boolean { return this.currentIdx >= this.waypoints.length }
  getProgress(): number { return this.waypoints.length > 0 ? this.currentIdx / this.waypoints.length : 0 }
}

export class ForceController {
  private pidX: PID; private pidY: PID; private pidZ: PID
  private maxForce = 50; private targetForce = { x: 0, y: 0, z: 0 }
  private stiffness = 0.5; private damping = 0.1

  constructor(maxForce = 50) {
    this.maxForce = maxForce
    this.pidX = new PID(0.1, 0.01, 0.05, -maxForce, maxForce)
    this.pidY = new PID(0.1, 0.01, 0.05, -maxForce, maxForce)
    this.pidZ = new PID(0.1, 0.01, 0.05, -maxForce, maxForce)
  }

  setTargetForce(x: number, y: number, z: number): void { this.targetForce = { x, y, z } }
  setImpedance(stiffness: number, damping: number): void { this.stiffness = stiffness; this.damping = damping }

  compute(currentForce: { x: number; y: number; z: number }, velocity: { x: number; y: number; z: number }, dt: number): R {
    const errX = this.targetForce.x - currentForce.x
    const errY = this.targetForce.y - currentForce.y
    const errZ = this.targetForce.z - currentForce.z
    return { ok: true, data: {
      forceX: +this.pidX.compute(errX - this.damping * velocity.x, dt).toFixed(3),
      forceY: +this.pidY.compute(errY - this.damping * velocity.y, dt).toFixed(3),
      forceZ: +this.pidZ.compute(errZ - this.damping * velocity.z, dt).toFixed(3),
      stiffness: this.stiffness, damping: this.damping
    }}
  }
}

export class TaskScheduler {
  private tasks: Array<{ id: string; priority: number; action: string; params: any; status: 'PENDING'|'RUNNING'|'DONE'|'FAILED'; deadline: number }> = []
  private running: string | null = null

  addTask(id: string, priority: number, action: string, params: any, deadline: number): void {
    this.tasks.push({ id, priority, action, params, status: 'PENDING', deadline })
    this.tasks.sort((a, b) => b.priority - a.priority)
  }

  getNext(): R {
    const now = Date.now()
    const pending = this.tasks.filter(t => t.status === 'PENDING' && t.deadline > now)
    if (pending.length === 0) return { ok: true, data: { action: 'IDLE', queue: 0 } }
    const task = pending[0]; task.status = 'RUNNING'; this.running = task.id
    return { ok: true, data: { id: task.id, action: task.action, params: task.params } }
  }

  complete(id: string): void { const t = this.tasks.find(t => t.id === id); if (t) t.status = 'DONE'; this.running = null }
  fail(id: string, reason: string): void { const t = this.tasks.find(t => t.id === id); if (t) { t.status = 'FAILED'; (t as any).error = reason }; this.running = null }
  getQueue(): number { return this.tasks.filter(t => t.status === 'PENDING').length }
  getStats(): Record<string, number> {
    const stats = { PENDING: 0, RUNNING: 0, DONE: 0, FAILED: 0 }
    this.tasks.forEach(t => (stats as any)[t.status]++)
    return stats
  }
}

export class VisionProcessor {
  private objects: Array<{ x: number; y: number; width: number; height: number; label: string; confidence: number }> = []

  detect(detections: typeof this.objects): void { this.objects = detections }
  getObjectsByLabel(label: string): typeof this.objects { return this.objects.filter(o => o.label === label) }
  getClosestObject(label: string): { x: number; y: number; confidence: number } | null {
    const matches = this.objects.filter(o => o.label === label && o.confidence > 0.5)
    if (matches.length === 0) return null
    return matches.reduce((closest, o) => o.y > closest.y ? o : closest)
  }
  getObjectCount(): number { return this.objects.length }
}

export class RobotAutonomy {
  public motion: MotionPlanner; public force: ForceController; public tasks: TaskScheduler; public vision: VisionProcessor
  constructor(maxForce = 50) { this.motion = new MotionPlanner(); this.force = new ForceController(maxForce); this.tasks = new TaskScheduler(); this.vision = new VisionProcessor() }
  healthCheck(): Record<string, any> { return { taskStats: this.tasks.getStats(), objectsDetected: this.vision.getObjectCount(), motionComplete: this.motion.isComplete() } }
}
