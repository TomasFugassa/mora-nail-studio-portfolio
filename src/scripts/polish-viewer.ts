import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { motionPreference as motion } from './motion-preference';

export type PolishViewer = {
  changeColor: (hex:string)=>void;
  available: ()=>boolean;
  dispose: ()=>void;
};

export async function createPolishViewer(host:HTMLElement, initialColor:string):Promise<PolishViewer> {
  await Promise.all([
    document.fonts.load('500 100px "Bricolage Grotesque"'),
    document.fonts.load('600 64px "Instrument Sans"'),
    document.fonts.load('500 55px "Instrument Sans"'),
  ]);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.85;
  const canvas=renderer.domElement;
  canvas.setAttribute('aria-hidden','true');
  host.append(canvas);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,.1,30);
  const environment=new RoomEnvironment();
  const pmrem=new THREE.PMREMGenerator(renderer);
  const environmentTarget=pmrem.fromScene(environment,.04);
  scene.environment=environmentTarget.texture;
  scene.environmentIntensity=.8;
  environment.dispose();pmrem.dispose();

  const key=new THREE.DirectionalLight(0xfff1df,2);key.position.set(-3,4,5);scene.add(key);
  const fill=new THREE.DirectionalLight(0xd3e7ff,.8);fill.position.set(4,1,3);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffd4aa,1.4);rim.position.set(-2,3,-3);scene.add(rim);
  const bottle=new THREE.Group();bottle.scale.setScalar(.77);scene.add(bottle);
  const model=new THREE.Group();model.position.y=-.215;bottle.add(model);
  const polish=new THREE.MeshPhysicalMaterial({color:initialColor,roughness:.18,metalness:0,clearcoat:1,clearcoatRoughness:.06,ior:1.48,envMapIntensity:.95});
  // A coloured reservoir inside a separate glass envelope keeps the edges clear.
  const glass=new THREE.MeshPhysicalMaterial({color:'#f8f2e8',transparent:true,opacity:.055,depthWrite:false,roughness:.055,metalness:0,clearcoat:.8,clearcoatRoughness:.025,ior:1.5,envMapIntensity:1.45});
  const baseGlass=glass.clone();baseGlass.opacity=.18;baseGlass.roughness=.09;
  const collarMaterial=new THREE.MeshStandardMaterial({color:'#a68e75',metalness:.9,roughness:.2});
  const capMaterial=new THREE.MeshStandardMaterial({color:'#baa58c',metalness:.9,roughness:.21});
  const seamMaterial=new THREE.MeshStandardMaterial({color:'#302a27',roughness:.38});
  const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,y:number)=>{
    const object=new THREE.Mesh(geometry,material);object.position.y=y;model.add(object);return object;
  };
  mesh(new RoundedBoxGeometry(1.45,1.29,.75,7,.16),polish,-.31);
  mesh(new RoundedBoxGeometry(1.72,1.58,.98,7,.16),glass,-.35);
  mesh(new RoundedBoxGeometry(1.72,.17,.98,6,.075),baseGlass,-1.065);
  mesh(new THREE.CylinderGeometry(.25,.29,.2,64),polish,.4);
  mesh(new THREE.CylinderGeometry(.29,.3,.2,64),glass,.44);
  mesh(new THREE.CylinderGeometry(.29,.29,.065,64),collarMaterial,.535);
  mesh(new THREE.CylinderGeometry(.305,.305,.025,64),seamMaterial,.581);
  const capProfile=[[0,-.5],[.329,-.5],[.349,-.49],[.357,-.46],[.357,.46],[.349,.49],[.329,.5],[0,.5]].map(([r,y])=>new THREE.Vector2(r,y));
  mesh(new THREE.LatheGeometry(capProfile,128),capMaterial,1.085);
  for(const y of [.626,.65]){
    const ring=mesh(new THREE.TorusGeometry(.356,.0045,6,128),collarMaterial,y);ring.rotation.x=Math.PI/2;
  }
  for(const y of [.425,.465,.505]){
    const thread=mesh(new THREE.TorusGeometry(.285,.009,8,64),baseGlass,y);thread.rotation.x=Math.PI/2;
  }
  const topRim=mesh(new THREE.TorusGeometry(.302,.006,8,96),collarMaterial,1.585);topRim.rotation.x=Math.PI/2;
  const grooveMaterial=new THREE.LineBasicMaterial({color:'#685847',transparent:true,opacity:.18});
  const groovePoints:number[]=[];
  for(let i=0;i<56;i++){
    const angle=i/56*Math.PI*2,x=Math.cos(angle)*.358,z=Math.sin(angle)*.358;
    groovePoints.push(x,.7,z,x,1.48,z);
  }
  const grooves=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(groovePoints,3)),grooveMaterial);model.add(grooves);

  const label=document.createElement('canvas');label.width=1024;label.height=640;
  const context=label.getContext('2d');
  if(!context)throw Error('No se pudo preparar la etiqueta del frasco.');
  context.fillStyle='#fff3e8';context.textAlign='center';
  context.font='500 210px "Bricolage Grotesque"';
  context.fillText(host.dataset.brand||'mora',512,255,930);
  context.font='600 64px "Instrument Sans"';
  const letters='NAIL COLOR',spacing=8;
  const textWidth=context.measureText(letters).width+(letters.length-1)*spacing;
  let cursor=(1024-textWidth)/2;
  context.textAlign='left';
  for(const letter of letters){context.fillText(letter,cursor,370);cursor+=context.measureText(letter).width+spacing;}
  context.textAlign='center';context.font='500 55px "Instrument Sans"';
  context.fillText('STUDIO EDITION',512,475);
  context.font='500 52px "Instrument Sans"';context.fillText('10 ml · 0.34 fl oz',512,550);
  const labelTexture=new THREE.CanvasTexture(label);labelTexture.colorSpace=THREE.SRGBColorSpace;
  labelTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const printMaterial=new THREE.MeshBasicMaterial({map:labelTexture,transparent:true,depthWrite:false,toneMapped:false});
  const print=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.75),printMaterial);print.position.set(0,-.28,.499);model.add(print);

  const restYaw=-.32,fullTurn=Math.PI*2;
  const state={yaw:restYaw,roll:-.13,lift:0};
  const pointer={x:0,y:0},smoothPointer={x:0,y:0};
  let disposed=false,lost=false,visible=true,raf=0,lastFrame=0,frames=0;
  let turn:gsap.core.Timeline|undefined;
  let needsFrame=true;
  function resize(){
    const width=host.clientWidth,height=host.clientHeight;
    if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;
    const disc=host.parentElement?.querySelector<HTMLElement>('.palette-disc');
    const diameter=disc?.clientWidth||Math.min(width*.64,360);
    const distance=2.11*height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*diameter*.92);
    camera.position.set(0,.04,Math.max(4.8,distance));camera.lookAt(0,0,0);camera.updateProjectionMatrix();
    needsFrame=true;queue();
  }
  function queue(){if(!raf&&!disposed&&!lost&&visible&&!document.hidden)raf=requestAnimationFrame(draw);}
  function draw(time:number){
    raf=0;if(disposed||lost||!visible||document.hidden)return;
    if(time-lastFrame<25){queue();return;}lastFrame=time;
    const reduced=motion.matches,t=time/1000;
    smoothPointer.x+=(pointer.x-smoothPointer.x)*.08;smoothPointer.y+=(pointer.y-smoothPointer.y)*.08;
    bottle.rotation.set(.06+(reduced?0:smoothPointer.y*.09),state.yaw+(reduced?0:smoothPointer.x*.17),state.roll+(reduced?0:Math.sin(t*.8)*.012));
    bottle.position.y=state.lift+(reduced?0:Math.sin(t*.9)*.025);
    renderer.render(scene,camera);frames++;
    host.dataset.yaw=state.yaw.toFixed(3);host.dataset.color=polish.color.getHexString();host.dataset.frames=String(frames);
    needsFrame=false;
    if(!reduced||turn?.isActive()||needsFrame)queue();
  }
  function changeColor(hex:string){
    if(disposed||lost)return;
    turn?.kill();gsap.killTweensOf(polish.color);
    const target=new THREE.Color(hex),reduced=motion.matches;
    host.dataset.turning='true';
    turn=gsap.timeline({onUpdate:()=>{needsFrame=true;queue();},onComplete:()=>{
      // Equivalent angles keep the front label in place without an accumulating yaw.
      state.yaw=restYaw;state.roll=-.13;state.lift=0;
      host.dataset.turning='false';needsFrame=true;queue();
    }});
    if(reduced){
      state.yaw=restYaw;state.roll=-.13;state.lift=0;
      turn.to(polish.color,{r:target.r,g:target.g,b:target.b,duration:.28,ease:'power1.inOut'});
    }else{
      // Retarget an interrupted turn from its current angle, always going forward.
      const nextFront=restYaw+(Math.floor((state.yaw-restYaw)/fullTurn)+1)*fullTurn;
      const duration=Math.max(1.05,1.9*(nextFront-state.yaw)/fullTurn);
      turn.to(state,{yaw:nextFront,duration,ease:'power2.inOut'},0)
        .to(state,{roll:-.025,lift:.1,duration:duration*.45,ease:'sine.out'},0)
        .to(state,{roll:-.13,lift:0,duration:duration*.55,ease:'sine.inOut'},duration*.45)
        .to(polish.color,{r:target.r,g:target.g,b:target.b,duration:duration*.46,ease:'power2.inOut'},duration*.24);
    }
    queue();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  const visibilityObserver=new IntersectionObserver(entries=>{
    visible=entries.some(entry=>entry.isIntersecting);
    if(visible){needsFrame=true;queue();}else if(raf){cancelAnimationFrame(raf);raf=0;}
  });visibilityObserver.observe(host);
  const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{needsFrame=true;queue();}};
  const onPointer=(event:PointerEvent)=>{if(event.pointerType==='touch')return;const rect=host.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/rect.width-.5;pointer.y=(event.clientY-rect.top)/rect.height-.5;needsFrame=true;queue();};
  const onLeave=()=>{pointer.x=pointer.y=0;needsFrame=true;queue();};
  const onMotion=()=>{if(motion.matches)turn?.progress(1);needsFrame=true;queue();};
  const art=host.parentElement!;
  art.addEventListener('pointermove',onPointer);art.addEventListener('pointerleave',onLeave);
  document.addEventListener('visibilitychange',onVisibility);motion.addEventListener('change',onMotion);
  const onLost=(event:Event)=>{event.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;host.dataset.state='fallback';art.dataset.polishRenderer='fallback';};
  canvas.addEventListener('webglcontextlost',onLost);
  function dispose(){
    if(disposed)return;disposed=true;turn?.kill();gsap.killTweensOf(polish.color);cancelAnimationFrame(raf);
    resizeObserver.disconnect();visibilityObserver.disconnect();
    art.removeEventListener('pointermove',onPointer);art.removeEventListener('pointerleave',onLeave);
    document.removeEventListener('visibilitychange',onVisibility);motion.removeEventListener('change',onMotion);canvas.removeEventListener('webglcontextlost',onLost);
    bottle.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.LineSegments){object.geometry.dispose();}});
    polish.dispose();glass.dispose();baseGlass.dispose();collarMaterial.dispose();capMaterial.dispose();seamMaterial.dispose();grooveMaterial.dispose();printMaterial.dispose();labelTexture.dispose();environmentTarget.dispose();renderer.dispose();canvas.remove();
  }
  resize();if(raf){cancelAnimationFrame(raf);raf=0;}draw(performance.now()+30);
  host.dataset.state='ready';host.dataset.turning='false';art.dataset.polishRenderer='three';
  return {changeColor,available:()=>!disposed&&!lost,dispose};
}
