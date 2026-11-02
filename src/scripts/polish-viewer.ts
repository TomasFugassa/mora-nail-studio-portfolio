import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';

export type PolishViewer = {
  changeColor: (hex:string)=>void;
  available: ()=>boolean;
  dispose: ()=>void;
};

export async function createPolishViewer(host:HTMLElement, initialColor:string):Promise<PolishViewer> {
  await document.fonts.load('500 100px "Bricolage Grotesque"');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
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
  const bottle=new THREE.Group();scene.add(bottle);
  const polish=new THREE.MeshPhysicalMaterial({color:initialColor,roughness:.2,metalness:.02,clearcoat:1,clearcoatRoughness:.075,ior:1.48,envMapIntensity:1.1});
  const glass=new THREE.MeshPhysicalMaterial({color:'#cfbca9',roughness:.12,metalness:.16,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.4});
  const collarMaterial=new THREE.MeshStandardMaterial({color:'#c4bbb0',metalness:.85,roughness:.24});
  const capMaterial=new THREE.MeshStandardMaterial({color:'#202120',metalness:.12,roughness:.31});
  const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,y:number)=>{
    const object=new THREE.Mesh(geometry,material);object.position.y=y;bottle.add(object);return object;
  };
  mesh(new RoundedBoxGeometry(1.64,1.62,.86,5,.2),polish,-.35);
  mesh(new RoundedBoxGeometry(1.67,.18,.9,4,.08),glass,-1.09);
  mesh(new THREE.CylinderGeometry(.31,.34,.27,64),collarMaterial,.565);
  const capGeometry=new THREE.CylinderGeometry(.425,.44,1.08,256,1);
  const vertices=capGeometry.attributes.position;
  for(let index=0;index<vertices.count;index++){
    const x=vertices.getX(index),z=vertices.getZ(index),radius=Math.hypot(x,z);
    if(radius<.1)continue;
    const angle=Math.atan2(z,x),rib=1+.016*Math.cos(angle*64);
    vertices.setX(index,x*rib);vertices.setZ(index,z*rib);
  }
  capGeometry.computeVertexNormals();mesh(capGeometry,capMaterial,1.18);
  const ring=mesh(new THREE.TorusGeometry(.435,.012,8,96),capMaterial,.65);ring.rotation.x=Math.PI/2;

  const label=document.createElement('canvas');label.width=1024;label.height=512;
  const context=label.getContext('2d');
  if(!context)throw Error('No se pudo preparar la etiqueta del frasco.');
  context.fillStyle='#fff3e8';context.textAlign='center';
  context.font='500 178px "Bricolage Grotesque"';
  context.fillText(host.dataset.brand||'mora',512,265,930);
  context.font='500 29px "Instrument Sans"';
  const letters='NAIL COLOR',spacing=10;
  const textWidth=context.measureText(letters).width+(letters.length-1)*spacing;
  let cursor=(1024-textWidth)/2;
  context.textAlign='left';
  for(const letter of letters){context.fillText(letter,cursor,375);cursor+=context.measureText(letter).width+spacing;}
  const labelTexture=new THREE.CanvasTexture(label);labelTexture.colorSpace=THREE.SRGBColorSpace;
  labelTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const printMaterial=new THREE.MeshBasicMaterial({map:labelTexture,transparent:true,depthWrite:false,toneMapped:false});
  const print=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.6),printMaterial);print.position.set(0,-.29,.438);bottle.add(print);

  const state={yaw:-.32,roll:-.13,lift:0};
  const pointer={x:0,y:0},smoothPointer={x:0,y:0};
  let disposed=false,lost=false,visible=true,raf=0,lastFrame=0,frames=0;
  let turn:gsap.core.Timeline|undefined;
  let needsFrame=true;
  function resize(){
    const width=host.clientWidth,height=host.clientHeight;
    if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;
    camera.position.set(0,.12,width<500?6.1:5.6);camera.lookAt(0,.06,0);camera.updateProjectionMatrix();
    needsFrame=true;queue();
  }
  function queue(){if(!raf&&!disposed&&!lost&&visible&&!document.hidden)raf=requestAnimationFrame(draw);}
  function draw(time:number){
    raf=0;if(disposed||lost||!visible||document.hidden)return;
    if(time-lastFrame<25){queue();return;}lastFrame=time;
    const reduced=motion.matches,t=time/1000;
    smoothPointer.x+=(pointer.x-smoothPointer.x)*.08;smoothPointer.y+=(pointer.y-smoothPointer.y)*.08;
    bottle.rotation.set(.06+(reduced?0:smoothPointer.y*.09),state.yaw+(reduced?0:smoothPointer.x*.17),state.roll+(reduced?0:Math.sin(t*.8)*.012));
    bottle.position.y=-.25+state.lift+(reduced?0:Math.sin(t*.9)*.035);
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
    turn=gsap.timeline({onUpdate:()=>{needsFrame=true;queue();},onComplete:()=>{host.dataset.turning='false';needsFrame=true;queue();}});
    if(reduced){
      turn.to(polish.color,{r:target.r,g:target.g,b:target.b,duration:.28,ease:'power1.inOut'});
    }else{
      turn.to(state,{yaw:2.0,roll:-.025,lift:.13,duration:.6,ease:'power2.inOut'},0)
        .to(polish.color,{r:target.r,g:target.g,b:target.b,duration:.72,ease:'power2.inOut'},.28)
        .to(state,{yaw:-.32,roll:-.13,lift:0,duration:.9,ease:'power3.inOut'},.6);
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
    bottle.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();}});
    polish.dispose();glass.dispose();collarMaterial.dispose();capMaterial.dispose();printMaterial.dispose();labelTexture.dispose();environmentTarget.dispose();renderer.dispose();canvas.remove();
  }
  resize();if(raf){cancelAnimationFrame(raf);raf=0;}draw(performance.now()+30);
  host.dataset.state='ready';host.dataset.turning='false';art.dataset.polishRenderer='three';
  return {changeColor,available:()=>!disposed&&!lost,dispose};
}
