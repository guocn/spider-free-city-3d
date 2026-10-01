// Small WebGL renderer: lit meshes, atmospheric fog and a movable 3D camera.
export const V=(x=0,y=0,z=0)=>({x,y,z});
export const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z);
export const sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
export const mul=(a,k)=>V(a.x*k,a.y*k,a.z*k);
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const length=a=>Math.hypot(a.x,a.y,a.z);
export const unit=a=>mul(a,1/(length(a)||1));
export const cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const mix=(a,b,t)=>add(a,mul(sub(b,a),t));
export const color=h=>{h=h.replace('#','');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];};
export function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;}
export function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),r=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(near+far)*r,-1,0,0,2*near*far*r,0]);}
export function lookAt(eye,target){const z=unit(sub(eye,target)),x=unit(cross(V(0,1,0),z)),y=cross(z,x);return new Float32Array([x.x,y.x,z.x,0,x.y,y.y,z.y,0,x.z,y.z,z.z,0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export class Geometry {
 constructor(){this.data=[];}
 triangle(a,b,c,n,col){for(const p of [a,b,c])this.data.push(p.x,p.y,p.z,n.x,n.y,n.z,...col);}
 quad(a,b,c,d,n,col){this.triangle(a,b,c,n,col);this.triangle(a,c,d,n,col);}
 box(x,y,z,w,h,d,col,yaw=0){const co=Math.cos(yaw),si=Math.sin(yaw);const point=(a,b,c)=>V(x+a*co+c*si,y+b,z-a*si+c*co);const normal=(a,b,c)=>V(a*co+c*si,b,-a*si+c*co);const X=w/2,Y=h/2,Z=d/2;
 this.quad(point(-X,-Y,Z),point(X,-Y,Z),point(X,Y,Z),point(-X,Y,Z),normal(0,0,1),col);
 this.quad(point(X,-Y,-Z),point(-X,-Y,-Z),point(-X,Y,-Z),point(X,Y,-Z),normal(0,0,-1),col);
 this.quad(point(X,-Y,Z),point(X,-Y,-Z),point(X,Y,-Z),point(X,Y,Z),normal(1,0,0),col);
 this.quad(point(-X,-Y,-Z),point(-X,-Y,Z),point(-X,Y,Z),point(-X,Y,-Z),normal(-1,0,0),col);
 this.quad(point(-X,Y,Z),point(X,Y,Z),point(X,Y,-Z),point(-X,Y,-Z),V(0,1,0),col);
 this.quad(point(-X,-Y,-Z),point(X,-Y,-Z),point(X,-Y,Z),point(-X,-Y,Z),V(0,-1,0),col);}
 sphere(x,y,z,r,col,rx=1,ry=1,rz=1){const rings=6,sides=10;const p=(j,i)=>{const a=j/rings*Math.PI,b=i/sides*Math.PI*2;return V(x+Math.sin(a)*Math.cos(b)*r*rx,y+Math.cos(a)*r*ry,z+Math.sin(a)*Math.sin(b)*r*rz);};for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=p(j,i),b=p(j+1,i),c=p(j+1,i+1),d=p(j,i+1),n=unit(sub(mul(add(add(a,b),c),1/3),V(x,y,z)));this.quad(a,b,c,d,n,col);}}
 limb(a,b,r,col){const axis=unit(sub(b,a)),right=unit(cross(axis,Math.abs(axis.y)>.9?V(1,0,0):V(0,1,0))),front=cross(axis,right);const p=(base,angle)=>add(base,add(mul(right,Math.cos(angle)*r),mul(front,Math.sin(angle)*r)));for(let i=0;i<6;i++){const an=i/6*Math.PI*2,next=(i+1)/6*Math.PI*2;this.quad(p(a,an),p(b,an),p(b,next),p(a,next),unit(add(mul(right,Math.cos((an+next)/2)),mul(front,Math.sin((an+next)/2)))),col);}}
 cone(x,y,z,r,h,col){for(let i=0;i<8;i++){const a=i/8*Math.PI*2,b=(i+1)/8*Math.PI*2;const p=V(x+Math.cos(a)*r,y,z+Math.sin(a)*r),q=V(x+Math.cos(b)*r,y,z+Math.sin(b)*r),top=V(x,y+h,z);this.triangle(p,q,top,unit(V(Math.cos((a+b)/2),r/h,Math.sin((a+b)/2))),col);}}
}
export class Renderer {
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl');if(!gl)throw new Error('这个浏览器暂时无法开启 3D。请用 Safari 或 Chrome 打开。');this.gl=gl;
 const vertex='attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor; uniform mat4 uVP; uniform vec3 uEye; varying vec3 vColor; varying float vDist; void main(){ float light=0.48+0.52*max(dot(normalize(aNormal),normalize(vec3(-0.4,0.9,0.3))),0.0); vColor=aColor*light; vDist=distance(aPosition,uEye); gl_Position=uVP*vec4(aPosition,1.0); }';
 const fragment='precision mediump float; varying vec3 vColor; varying float vDist; void main(){ float fog=smoothstep(170.0,640.0,vDist); vec3 sky=vec3(0.055,0.105,0.18); gl_FragColor=vec4(mix(vColor,sky,fog),1.0); }';
 const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.useProgram(p);this.program=p;this.vp=gl.getUniformLocation(p,'uVP');this.eye=gl.getUniformLocation(p,'uEye');this.position=gl.getAttribLocation(p,'aPosition');this.normal=gl.getAttribLocation(p,'aNormal');this.col=gl.getAttribLocation(p,'aColor');for(const a of [this.position,this.normal,this.col])gl.enableVertexAttribArray(a);gl.enable(gl.DEPTH_TEST);gl.clearColor(.055,.105,.18,1);this.dynamic=gl.createBuffer();this.lineBuffer=gl.createBuffer();this.resize();}
 resize(){const dpr=Math.min(devicePixelRatio||1,1.6);this.width=innerWidth;this.height=innerHeight;this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
 upload(geometry){const gl=this.gl,b=gl.createBuffer(),array=new Float32Array(geometry.data);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,array,gl.STATIC_DRAW);return{buffer:b,count:array.length/9};}
 bind(buffer){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,36,0);gl.vertexAttribPointer(this.normal,3,gl.FLOAT,false,36,12);gl.vertexAttribPointer(this.col,3,gl.FLOAT,false,36,24);}
 render(staticMesh,dynamicGeometry,lines,eye,target){const gl=this.gl;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.matrix=multiply(perspective(Math.PI/3,this.width/this.height,.15,1500),lookAt(eye,target));gl.uniformMatrix4fv(this.vp,false,this.matrix);gl.uniform3f(this.eye,eye.x,eye.y,eye.z);this.bind(staticMesh.buffer);gl.drawArrays(gl.TRIANGLES,0,staticMesh.count);this.bind(this.dynamic);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(dynamicGeometry.data),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,dynamicGeometry.data.length/9);
 if(lines.length){const data=[];for(const l of lines)for(const p of [l.a,l.b])data.push(p.x,p.y,p.z,0,1,0,...l.color);this.bind(this.lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);gl.drawArrays(gl.LINES,0,data.length/9);}}
 project(p){const m=this.matrix;if(!m)return null;const w=m[3]*p.x+m[7]*p.y+m[11]*p.z+m[15];if(w<=0)return null;const x=(m[0]*p.x+m[4]*p.y+m[8]*p.z+m[12])/w,y=(m[1]*p.x+m[5]*p.y+m[9]*p.z+m[13])/w;return{x:(x+1)/2*this.width,y:(1-y)/2*this.height,visible:Math.abs(x)<.9&&Math.abs(y)<.9};}
}
