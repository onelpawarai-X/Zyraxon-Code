/**
 * ZYRAXON X — Car Autonomy
 * Sensor fusion, path planner, lane control, parking, AEB, ADAS, monitoring
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

export class SensorFusionEngine {
  private objects: Map<number, { x: number; y: number; z: number; vx: number; vy: number; type: string; confidence: number; lastSeen: number }> = new Map()
  private nextId = 1; private ttl = 2000

  mergeLidar(d: Array<{ x: number; y: number; z: number; intensity: number }>): void {
    for (const p of d) {
      const id = this.findClosest(p.x, p.y, p.z)
      if (id !== null) { const o = this.objects.get(id)!; o.x=p.x;o.y=p.y;o.z=p.z;o.confidence=Math.min(1,o.confidence+0.1);o.lastSeen=Date.now() }
      else this.objects.set(this.nextId++, { x:p.x,y:p.y,z:p.z,vx:0,vy:0,type:'UNKNOWN',confidence:0.5,lastSeen:Date.now() })
    }
  }
  mergeCamera(d: Array<{ x: number; y: number; w: number; h: number; label: string; confidence: number }>): void {
    for (const p of d) { const id=this.findClosest2D(p.x+p.w/2,p.y+p.h/2); if(id!==null){const o=this.objects.get(id)!;o.type=p.label;o.confidence=Math.max(o.confidence,p.confidence);o.lastSeen=Date.now()} }
  }
  mergeRadar(d: Array<{ range: number; angle: number; velocity: number }>): void {
    for (const p of d) { const x=p.range*Math.cos(p.angle),y=p.range*Math.sin(p.angle),id=this.findClosest(x,y,0)
      if(id!==null){const o=this.objects.get(id)!;o.vx=p.velocity*Math.cos(p.angle);o.vy=p.velocity*Math.sin(p.angle);o.lastSeen=Date.now()} }
  }
  private findClosest(x:number,y:number,z:number):number|null{let b=null,bd=2;this.objects.forEach((o,id)=>{const d=Math.sqrt((o.x-x)**2+(o.y-y)**2+(o.z-z)**2);if(d<bd){bd=d;b=id}});return b}
  private findClosest2D(x:number,y:number):number|null{let b=null,bd=50;this.objects.forEach((o,id)=>{const d=Math.sqrt(o.x**2+(y-o.y)**2);if(d<bd){bd=d;b=id}});return b}
  prune():void{const now=Date.now();this.objects.forEach((o,id)=>{if(now-o.lastSeen>this.ttl)this.objects.delete(id)})}
  getObjects(){return Array.from(this.objects.values())}
  getObjectCount():number{return this.objects.size}
}

export class PathPlanner {
  private roadGraph: Map<string,Array<{to:string;cost:number}>> = new Map()
  addRoad(from:string,to:string,cost:number):void{if(!this.roadGraph.has(from))this.roadGraph.set(from,[]);this.roadGraph.get(from)!.push({to,cost})}
  findPath(start:string,goal:string):R{
    if(!this.roadGraph.has(start)||!this.roadGraph.has(goal))return{ok:false,error:'Invalid nodes'}
    const dist=new Map<string,number>(),prev=new Map<string,string>(),visited=new Set<string>()
    dist.set(start,0);const pq:Array<[string,number]>=[[start,0]]
    while(pq.length>0){pq.sort((a,b)=>a[1]-b[1]);const[curr,cost]=pq.shift()!;if(visited.has(curr))continue;visited.add(curr);if(curr===goal)break
      for(const e of this.roadGraph.get(curr)||[]){const nc=cost+e.cost;if(!dist.has(e.to)||nc<dist.get(e.to)!){dist.set(e.to,nc);prev.set(e.to,curr);pq.push([e.to,nc])}}}
    const path:string[]=[];let c:string|undefined=goal;while(c){path.unshift(c);c=prev.get(c)}
    return path[0]===start?{ok:true,data:{path,totalCost:dist.get(goal)}}:{ok:false,error:'No path found'}
  }
  smoothPath(points:Array<{x:number;y:number}>,w=0.3,iters=3):Array<{x:number;y:number}>{
    const r=points.map(p=>({...p}));for(let i=0;i<iters;i++)for(let j=1;j<r.length-1;j++){r[j].x+=w*((points[j].x-r[j].x)+(r[j-1].x+r[j+1].x-2*r[j].x)*0.5);r[j].y+=w*((points[j].y-r[j].y)+(r[j-1].y+r[j+1].y-2*r[j].y)*0.5)};return r
  }
}

export class LaneController {
  private pid=new PID(2.0,0.05,0.8,-1,1);private laneWidth=3.7;private safetyBuffer=0.5
  update(laneCenter:number,vehCenter:number,vehHdg:number,laneHdg:number,dt:number):R{
    const lo=vehCenter-laneCenter,he=vehHdg-laneHdg,sc=this.pid.compute(lo+he*0.5,dt)
    return{ok:true,data:{steerCmd:+Math.max(-1,Math.min(1,sc)).toFixed(3),laneOffset:+lo.toFixed(2),headingError:+he.toFixed(2),crossTrackError:+(Math.abs(lo)-(this.laneWidth/2-this.safetyBuffer)).toFixed(2)}}
  }
}

export class ParkingController {
  private phase:'SEARCH'|'APPROACH'|'REVERSE'|'ADJUST'|'COMPLETE'='SEARCH'
  private spot:{x:number;y:number;heading:number}|null=null;private maxSteer=35
  foundSpot(s:{x:number;y:number;heading:number}):void{this.spot=s;this.phase='APPROACH'}
  compute(pos:{x:number;y:number;heading:number}):R{
    if(!this.spot)return{ok:true,data:{action:'SEARCH',steer:0,throttle:0}}
    const dx=this.spot.x-pos.x,dy=this.spot.y-pos.y,dist=Math.sqrt(dx*dx+dy*dy)
    let he=Math.atan2(dy,dx)*180/Math.PI-pos.heading;if(he>180)he-=360;if(he<-180)he+=360
    if(this.phase==='APPROACH'&&dist<2)this.phase='REVERSE'
    if(this.phase==='REVERSE'&&dist<0.3)this.phase='ADJUST'
    if(this.phase==='ADJUST'&&Math.abs(he)<5)this.phase='COMPLETE'
    return{ok:true,data:{phase:this.phase,steer:+Math.max(-this.maxSteer,Math.min(this.maxSteer,he*2)).toFixed(1),throttle:this.phase==='REVERSE'?-15:this.phase==='ADJUST'?5:10,distance:+dist.toFixed(2)}}
  }
}

export class AutonomousEmergencyBraking {
  private active=false;private ttcThreshold=1.5;private brakingDecel=8
  check(speed:number,objects:Array<{x:number;y:number;vx:number;vy:number;type:string}>):R{
    this.active=false;let minTTC=Infinity,closestObj=null
    for(const o of objects){if(o.x<0)continue;const rv=speed/3.6-o.vx,ttc=rv>0?o.x/rv:Infinity;if(ttc<minTTC){minTTC=ttc;closestObj=o}}
    if(minTTC<this.ttcThreshold&&closestObj){this.active=true;return{ok:true,data:{braking:true,ttc:+minTTC.toFixed(2),object:closestObj.type,decel:this.brakingDecel}}}
    return{ok:true,data:{braking:false,ttc:minTTC===Infinity?'NONE':+minTTC.toFixed(2)}}
  }
  isActive():boolean{return this.active}
}

export class DriverMonitoring {
  private blinkRate=15;private eyeClosure=0;private headPose={yaw:0,pitch:0}
  private alertLevel:'NORMAL'|'ALERT'|'WARNING'|'CRITICAL'='NORMAL'
  private drowsinessScore=0
  update(data:{blinkRate?:number;eyeClosure?:number;headYaw?:number;headPitch?:number}):void{
    if(data.blinkRate!==undefined)this.blinkRate=data.blinkRate
    if(data.eyeClosure!==undefined)this.eyeClosure=data.eyeClosure
    if(data.headYaw!==undefined)this.headPose.yaw=data.headYaw
    if(data.headPitch!==undefined)this.headPose.pitch=data.headPitch
    this.drowsinessScore=0
    if(this.blinkRate>20)this.drowsinessScore+=30
    if(this.eyeClosure>0.5)this.drowsinessScore+=40
    if(Math.abs(this.headPose.yaw)>20)this.drowsinessScore+=20
    if(Math.abs(this.headPose.pitch)>15)this.drowsinessScore+=10
    if(this.drowsinessScore>=70)this.alertLevel='CRITICAL'
    else if(this.drowsinessScore>=50)this.alertLevel='WARNING'
    else if(this.drowsinessScore>=30)this.alertLevel='ALERT'
    else this.alertLevel='NORMAL'
  }
  getAlertLevel():string{return this.alertLevel}
  getDrowsinessScore():number{return this.drowsinessScore}
}

export class TrafficSignRecognition {
  private signs:Array<{x:number;y:number;type:string;confidence:number}>=[]
  detect(detections:Array<{x:number;y:number;type:string;confidence:number}>):void{this.signs=detections}
  getSpeedLimit():number|null{const sl=this.signs.find(s=>s.type.startsWith('SPEED_'));return sl?parseInt(sl.type.replace('SPEED_','')):null}
  getStopAhead():boolean{return this.signs.some(s=>s.type==='STOP')}
  getRedLight():boolean{return this.signs.some(s=>s.type==='TRAFFIC_LIGHT_RED')}
  getSigns(){return this.signs}
}

export class AdaptiveCruiseControl {
  private pid=new PID(0.8,0.02,0.3,0,100);private targetSpeed=0;private followDist=30
  setTarget(speed:number):void{this.targetSpeed=speed}
  setFollowDistance(m:number):void{this.followDist=m}
  compute(currentSpeed:number,leadVehicleDist:number|null,dt:number):R{
    if(leadVehicleDist!==null&&leadVehicleDist<this.followDist){
      const safeSpeed=Math.sqrt(2*8*leadVehicleDist)*3.6
      return{ok:true,data:{throttle:+Math.max(0,Math.min(100,this.pid.compute(safeSpeed-currentSpeed,dt))).toFixed(1),braking:safeSpeed<currentSpeed-5,followDist:leadVehicleDist}}
    }
    return{ok:true,data:{throttle:+Math.max(0,Math.min(100,this.pid.compute(this.targetSpeed-currentSpeed,dt))).toFixed(1),braking:false,followDist:leadVehicleDist}}
  }
}

export class CarAutonomy {
  public fusion:SensorFusionEngine;public pathPlanner:PathPlanner;public lane:LaneController
  public parking:ParkingController;public aeb:AutonomousEmergencyBraking;public driver:DriverMonitoring
  public signs:TrafficSignRecognition;public acc:AdaptiveCruiseControl
  constructor(){this.fusion=new SensorFusionEngine();this.pathPlanner=new PathPlanner();this.lane=new LaneController();this.parking=new ParkingController();this.aeb=new AutonomousEmergencyBraking();this.driver=new DriverMonitoring();this.signs=new TrafficSignRecognition();this.acc=new AdaptiveCruiseControl()}
  healthCheck():Record<string,any>{return{objects:this.fusion.getObjectCount(),aebActive:this.aeb.isActive(),driverAlert:this.driver.getAlertLevel(),speedLimit:this.signs.getSpeedLimit()}}
}
