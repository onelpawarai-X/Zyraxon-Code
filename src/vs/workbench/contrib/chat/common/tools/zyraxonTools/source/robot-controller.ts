/**
 * ZYRAXON X — Robot Controller
 * Manipulator IK, mobile base, SLAM, sensor fusion
 */
type R = { ok: boolean; data?: any; error?: string }

class PID {
  private integral = 0; private prevError = 0
  constructor(private kp: number, private ki: number, private kd: number, private outMin = -1e9, private outMax = 1e9, private intMax = 1e6) {}
  compute(error: number, dt: number): number {
    this.integral = Math.max(-this.intMax, Math.min(this.intMax, this.integral + error * dt))
    const deriv = dt > 0 ? (error - this.prevError) / dt : 0
    let output = this.kp * error + this.ki * this.integral + this.kd * deriv
    output = Math.max(this.outMin, Math.min(this.outMax, output))
    this.prevError = error; return output
  }
  reset(): void { this.integral = 0; this.prevError = 0 }
}

interface DHParams { a: number; alpha: number; d: number; theta: number }

function dhMatrix(p: DHParams): number[][] {
  const ct = Math.cos(p.theta), st = Math.sin(p.theta)
  const ca = Math.cos(p.alpha), sa = Math.sin(p.alpha)
  return [[ct, -st*ca, st*sa, p.a*ct],[st, ct*ca, -ct*sa, p.a*st],[0, sa, ca, p.d],[0, 0, 0, 1]]
}

function matMul4(A: number[][], B: number[][]): number[][] {
  const C = Array.from({length:4},()=>new Array(4).fill(0))
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)C[i][j]+=A[i][k]*B[k][j]
  return C
}

export class ManipulatorArm {
  private joints: DHParams[]
  private jointAngles: number[]
  private jointLimits: Array<{min:number;max:number}>
  private eePosition = {x:0,y:0,z:0}

  constructor(dhParams: DHParams[]) {
    this.joints = dhParams
    this.jointAngles = dhParams.map(p => p.theta)
    this.jointLimits = dhParams.map(() => ({min:-180,max:180}))
  }

  setJointLimits(joint: number, min: number, max: number): void { this.jointLimits[joint] = {min,max} }

  forwardKinematics(angles?: number[]): {position:{x:number;y:number;z:number};transforms:number[][][]} {
    const q = angles || this.jointAngles
    let T = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
    const transforms: number[][][] = [T]
    for(let i=0;i<this.joints.length;i++){
      const p = {...this.joints[i], theta: q[i]*Math.PI/180}
      T = matMul4(T, dhMatrix(p))
      transforms.push(T.map(r=>[...r]))
    }
    this.eePosition = {x:+T[0][3].toFixed(4),y:+T[1][3].toFixed(4),z:+T[2][3].toFixed(4)}
    return {position:this.eePosition, transforms}
  }

  inverseKinematics(target:{x:number;y:number;z:number}, maxIter=100, tolerance=0.001): R {
    let angles = [...this.jointAngles]
    for(let iter=0;iter<maxIter;iter++){
      const fk = this.forwardKinematics(angles)
      const dx=target.x-fk.position.x, dy=target.y-fk.position.y, dz=target.z-fk.position.z
      const dist = Math.sqrt(dx*dx+dy*dy+dz*dz)
      if(dist<tolerance){this.jointAngles=angles.map(a=>+a.toFixed(2));return{ok:true,data:{angles:this.jointAngles,position:fk.position,iterations:iter,error:+dist.toFixed(4)}}}
      const J:number[][]=[]; const eps=0.01
      for(let j=0;j<this.joints.length;j++){
        const ap=[...angles]; ap[j]+=eps
        const fp=this.forwardKinematics(ap)
        J.push([(fp.position.x-fk.position.x)/eps,(fp.position.y-fk.position.y)/eps,(fp.position.z-fk.position.z)/eps])
      }
      const err=[dx,dy,dz]
      for(let j=0;j<this.joints.length;j++){
        let dq=0; for(let k=0;k<3;k++)dq+=J[j][k]*err[k]
        angles[j]+=0.5*dq*180/Math.PI
        angles[j]=Math.max(this.jointLimits[j].min,Math.min(this.jointLimits[j].max,angles[j]))
      }
    }
    return{ok:false,error:'IK did not converge',data:{lastAngles:angles.map(a=>+a.toFixed(2))}}
  }

  setJointAngle(joint:number,angle:number):void{if(joint>=0&&joint<this.joints.length)this.jointAngles[joint]=Math.max(this.jointLimits[joint].min,Math.min(this.jointLimits[joint].max,angle))}
  getJointAngles():number[]{return[...this.jointAngles]}
  getEndEffector(){return this.eePosition}
  getJointCount():number{return this.joints.length}
  getStatus():Record<string,any>{return{joints:this.jointAngles.map((a,i)=>({angle:a,limits:this.jointLimits[i]})),endEffector:this.eePosition}}
}

// ═══════════════════════════════════════════════════════════════════
// MOBILE BASE — Differential drive with odometry + path following
// ═══════════════════════════════════════════════════════════════════
export class MobileBase {
  private x=0;private y=0;private theta=0
  private wheelBase:number;private wheelRadius:number
  private leftEncoder=0;private rightEncoder=0
  private leftPID:PID;private rightPID:PID

  constructor(wheelBase=0.3, wheelRadius=0.05){
    this.wheelBase=wheelBase;this.wheelRadius=wheelRadius
    this.leftPID=new PID(2.0,0.5,0.1,-10,10,50)
    this.rightPID=new PID(2.0,0.5,0.1,-10,10,50)
  }

  updateOdometry(leftTicks:number,rightTicks:number,ticksPerRev=360):void{
    const ld=(leftTicks-this.leftEncoder)*(2*Math.PI*this.wheelRadius/ticksPerRev)
    const rd=(rightTicks-this.rightEncoder)*(2*Math.PI*this.wheelRadius/ticksPerRev)
    this.leftEncoder=leftTicks;this.rightEncoder=rightTicks
    const dist=(ld+rd)/2, dTheta=(rd-ld)/this.wheelBase
    this.x+=dist*Math.cos(this.theta+dTheta/2)
    this.y+=dist*Math.sin(this.theta+dTheta/2)
    this.theta+=dTheta
  }

  followPath(path:Array<{x:number;y:number}>,lookahead=0.3):{leftSpeed:number;rightSpeed:number}{
    if(path.length<2)return{leftSpeed:0,rightSpeed:0}
    let ci=0,cd=Infinity
    for(let i=0;i<path.length;i++){const dx=path[i].x-this.x,dy=path[i].y-this.y;const d=dx*dx+dy*dy;if(d<cd){cd=d;ci=i}}
    let ti=ci
    for(let i=ci;i<path.length;i++){const dx=path[i].x-this.x,dy=path[i].y-this.y;if(Math.sqrt(dx*dx+dy*dy)>=lookahead){ti=i;break}}
    const tgt=path[ti],dx=tgt.x-this.x,dy=tgt.y-this.y
    const ta=Math.atan2(dy,dx)
    let ae=ta-this.theta;while(ae>Math.PI)ae-=2*Math.PI;while(ae<-Math.PI)ae+=2*Math.PI
    const ls=0.5,as_=2.0*ae
    const ls_=((ls-as_*this.wheelBase/2)/this.wheelRadius)
    const rs=((ls+as_*this.wheelBase/2)/this.wheelRadius)
    return{leftSpeed:+ls_.toFixed(2),rightSpeed:+rs.toFixed(2)}
  }

  avoidObstacle(dist:number,angle:number):{leftSpeed:number;rightSpeed:number}{
    if(dist>1.0)return{leftSpeed:0.5,rightSpeed:0.5}
    if(angle>0)return{leftSpeed:0.3,rightSpeed:-0.3}
    return{leftSpeed:-0.3,rightSpeed:0.3}
  }

  getPosition(){return{x:+this.x.toFixed(4),y:+this.y.toFixed(4),theta:+this.theta.toFixed(4),heading:+((this.theta*180/Math.PI+360)%360).toFixed(1)}}
  reset():void{this.x=0;this.y=0;this.theta=0;this.leftEncoder=0;this.rightEncoder=0}
  getStatus(){return{position:this.getPosition(),wheelBase:this.wheelBase,wheelRadius:this.wheelRadius,encoders:{left:this.leftEncoder,right:this.rightEncoder}}}
}

// ═══════════════════════════════════════════════════════════════════
// OCCUPANCY GRID — SLAM with log-odds Bayesian update
// ═══════════════════════════════════════════════════════════════════
export class OccupancyGrid {
  private width:number;height:number;resolution:number
  private grid:Float32Array
  private logOcc=0.85;private logFree=-0.4

  constructor(width=100,height=100,resolution=0.1){
    this.width=width;this.height=height;this.resolution=resolution
    this.grid=new Float32Array(width*height)
  }

  updateRay(sx:number,sy:number,angle:number,range:number,maxRange=10):void{
    const cells=Math.min(Math.ceil(range/this.resolution),Math.ceil(maxRange/this.resolution))
    for(let i=0;i<cells;i++){
      const d=i*this.resolution
      const wx=sx+d*Math.cos(angle),wy=sy+d*Math.sin(angle)
      const gx=Math.floor(wx/this.resolution+this.width/2)
      const gy=Math.floor(wy/this.resolution+this.height/2)
      if(gx<0||gx>=this.width||gy<0||gy>=this.height)continue
      const idx=gy*this.width+gx
      if(i<cells-1)this.grid[idx]=Math.max(-5,this.grid[idx]+this.logFree)
      else if(range<maxRange)this.grid[idx]=Math.min(5,this.grid[idx]+this.logOcc)
    }
  }

  isOccupied(gx:number,gy:number):boolean{if(gx<0||gx>=this.width||gy<0||gy>=this.height)return true;return this.grid[gy*this.width+gx]>0}
  getProbability(gx:number,gy:number):number{if(gx<0||gx>=this.width||gy<0||gy>=this.height)return 1;const lo=this.grid[gy*this.width+gx];return 1-1/(1+Math.exp(lo))}

  findFreeNear(tx:number,ty:number,radius=5):{x:number;y:number}|null{
    const cx=Math.floor(tx/this.resolution+this.width/2),cy=Math.floor(ty/this.resolution+this.height/2)
    for(let r=0;r<=radius;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++)
      if(!this.isOccupied(cx+dx,cy+dy))return{x:(cx+dx-this.width/2)*this.resolution,y:(cy+dy-this.height/2)*this.resolution}
    return null
  }

  getGrid(){return this.grid}
  getSize(){return{width:this.width,height:this.height,resolution:this.resolution}}
}

// ═══════════════════════════════════════════════════════════════════
// SENSOR FUSION — Kalman filter for IMU + wheel odometry fusion
// ═══════════════════════════════════════════════════════════════════
export class SensorFusion {
  private state = new Float64Array(6) // x,y,theta,dx,dy,dtheta
  private P = Float64Array.from([1,0,0,0,0,0, 0,1,0,0,0,0, 0,0,1,0,0,0, 0,0,0,1,0,0, 0,0,0,0,1,0, 0,0,0,0,0,1])
  private Q = Float64Array.from([0.01,0,0,0,0,0, 0,0.01,0,0,0,0, 0,0,0.001,0,0,0, 0,0,0,0.1,0,0, 0,0,0,0,0.1,0, 0,0,0,0,0,0.01])
  private R_imu = 0.05; private R_encoder = 0.1

  // IMU + encoder fusion step
  predict(dt: number, wheelSpeed: number, steeringAngle: number, imuYaw: number, imuAccel: number): void {
    const {x,y,theta} = {x:this.state[0],y:this.state[1],theta:this.state[2]}
    const v = wheelSpeed, dTheta = imuYaw * Math.PI / 180 - theta
    this.state[0] += v * Math.cos(this.state[2] + dTheta/2) * dt
    this.state[1] += v * Math.sin(this.state[2] + dTheta/2) * dt
    this.state[2] = imuYaw * Math.PI / 180
    this.state[3] = v * Math.cos(this.state[2])
    this.state[4] = v * Math.sin(this.state[2])
    this.state[5] = imuAccel / dt
    // Simple covariance prediction (add Q)
    for(let i=0;i<36;i++)this.P[i]+=this.Q[i]
  }

  // Measurement update (IMU or encoder)
  update(measurement:number, measurementIndex:number, noise:number):void{
    const H = new Float64Array(36) // 6x6
    H[measurementIndex*6+measurementIndex]=1
    const innov = measurement - this.state[measurementIndex]
    const S = this.P[measurementIndex*6+measurementIndex] + noise
    const K = new Float64Array(6)
    for(let i=0;i<6;i++)K[i]=this.P[i*6+measurementIndex]/S
    for(let i=0;i<6;i++)this.state[i]+=K[i]*innov
    for(let i=0;i<6;i++)for(let j=0;j<6;j++)this.P[i*6+j]-=K[i]*this.P[measurementIndex*6+j]
  }

  getState():{x:number,y:number,theta:number;vx:number;vy:number;vtheta:number}{
    return{x:+this.state[0].toFixed(4),y:+this.state[1].toFixed(4),theta:+(this.state[2]*180/Math.PI).toFixed(2),
      vx:+this.state[3].toFixed(4),vy:+this.state[4].toFixed(4),vtheta:+this.state[5].toFixed(4)}
  }

  reset():void{this.state.fill(0);this.P.fill(0);for(let i=0;i<6;i++)this.P[i*6+i]=1}
}

// ═══════════════════════════════════════════════════════════════════
// ROBOT CONTROLLER — Master class combining all subsystems
// ═══════════════════════════════════════════════════════════════════
export class RobotController {
  public arm?:ManipulatorArm
  public base:MobileBase
  public map:OccupancyGrid
  public fusion:SensorFusion

  constructor(config?:{dhParams?:DHParams[];wheelBase?:number;wheelRadius?:number;mapSize?:number}){
    if(config?.dhParams)this.arm=new ManipulatorArm(config.dhParams)
    this.base=new MobileBase(config?.wheelBase,config?.wheelRadius)
    this.map=new OccupancyGrid(config?.mapSize||100,config?.mapSize||100)
    this.fusion=new SensorFusion()
  }

  async pickAndPlace(target:{x:number;y:number;z:number},place:{x:number;y:number;z:number}):Promise<R>{
    if(!this.arm)return{ok:false,error:'No arm configured'}
    const ik1=this.arm.inverseKinematics(target)
    if(!ik1.ok)return{ok:false,error:'Cannot reach target'}
    const ik2=this.arm.inverseKinematics(place)
    if(!ik2.ok)return{ok:false,error:'Cannot reach place location'}
    return{ok:true,data:{picked:target,placed:place,armAngles:this.arm.getJointAngles()}}
  }

  navigateTo(target:{x:number;y:number}):{leftSpeed:number;rightSpeed:number}{
    const pos=this.base.getPosition()
    const dx=target.x-pos.x,dy=target.y-pos.y
    const dist=Math.sqrt(dx*dx+dy*dy)
    if(dist<0.05)return{leftSpeed:0,rightSpeed:0}
    const targetAngle=Math.atan2(dy,dx)
    let angleErr=targetAngle-pos.theta*Math.PI/180
    while(angleErr>Math.PI)angleErr-=2*Math.PI
    while(angleErr<-Math.PI)angleErr+=2*Math.PI
    const k=2.0,ls=0.5,ang=k*angleErr
    return{
      leftSpeed:+((ls-ang*0.15)/0.05).toFixed(2),
      rightSpeed:+((ls+ang*0.15)/0.05).toFixed(2)
    }
  }

  getHealth():Record<string,any>{
    return{
      arm:this.arm?.getStatus()||null,
      base:this.base.getStatus(),
      map:this.map.getSize(),
      fusion:this.fusion.getState()
    }
  }
}

