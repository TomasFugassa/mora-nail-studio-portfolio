import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { PolishViewer } from './polish-viewer';
gsap.registerPlugin(ScrollTrigger);
export {};

const filters = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
const cards = [...document.querySelectorAll<HTMLElement>('.gallery-item')];
const photoButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-photo-id]')];
const count = document.getElementById('photo-count');
const dialog = document.querySelector<HTMLDialogElement>('#photo-dialog');
const dialogImage = document.querySelector<HTMLImageElement>('#dialog-image');
const dialogTitle = document.getElementById('dialog-title');
const dialogLabel = document.getElementById('dialog-label');
let currentPhoto: HTMLButtonElement | null = null;
let photoOpener: HTMLButtonElement | null = null;
let selectedReference: { number: string; title: string } | null = null;
let nextFocus: HTMLElement | null = null;

filters.forEach((filter) =>
  filter.addEventListener('click', () => {
    const category = filter.dataset.filter;
    const previous = new Map(
      cards.filter((card) => !card.hidden).map((card) => [card, card.getBoundingClientRect()]),
    );
    filters.forEach((button) => {
      const active = button === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    cards.forEach((card) => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
    });
    if (count) count.textContent = String(cards.filter((card) => !card.hidden).length);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cards
        .filter((card) => !card.hidden)
        .forEach((card, index) => {
          const before = previous.get(card),
            after = card.getBoundingClientRect();
          card.classList.add('revealed');
          card
            .getAnimations()
            .filter((animation) => animation.id === 'filter-move')
            .forEach((animation) => animation.cancel());
          const animation = card.animate(
            before
              ? [
                  {
                    transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)`,
                  },
                  { transform: 'translate(0, 0)' },
                ]
              : [
                  { opacity: 0, transform: 'translateY(18px) scale(.97)' },
                  { opacity: 1, transform: 'translateY(0) scale(1)' },
                ],
            {
              duration: 430,
              delay: before ? 0 : index * 35,
              easing: 'cubic-bezier(.2,.7,.3,1)',
              fill: 'backwards',
            },
          );
          animation.id = 'filter-move';
        });
    }
  }),
);

function displayPhoto(button: HTMLButtonElement) {
  currentPhoto = button;
  if (dialogImage) {
    dialogImage.src = button.dataset.photoSrc ?? '';
    dialogImage.alt = button.dataset.photoAlt ?? '';
  }
  if (dialogImage && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    dialogImage
      .decode()
      .then(() => {
        if (currentPhoto === button)
          dialogImage.animate(
            [
              { opacity: 0.35, transform: 'scale(.985)' },
              { opacity: 1, transform: 'scale(1)' },
            ],
            { duration: 320, easing: 'ease-out' },
          );
      })
      .catch(() => {});
  }
  if (dialogTitle) dialogTitle.textContent = button.dataset.photoTitle ?? '';
  if (dialogLabel)
    dialogLabel.textContent = `${button.dataset.photoNumber} / ${button.dataset.photoLabel}`;
  const visible = photoButtons.filter(
    (photo) => !photo.closest<HTMLElement>('.gallery-item')?.hidden,
  );
  const position = document.getElementById('dialog-position');
  if (position)
    position.textContent = `${visible.indexOf(button) + 1} de ${visible.length} · Usá las flechas para explorar`;
}
photoButtons.forEach((button) =>
  button.addEventListener('click', () => {
    photoOpener = button;
    displayPhoto(button);
    dialog?.showModal();
    document.body.classList.add('dialog-open');
  }),
);
function closeDialog() {
  dialog?.close();
}
dialog?.addEventListener('close', () => {
  document.body.classList.remove('dialog-open');
  (nextFocus ?? photoOpener)?.focus({ preventScroll: true });
  nextFocus = null;
});
document.querySelector('.dialog-close')?.addEventListener('click', closeDialog);
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog();
});
function movePhoto(direction: number) {
  const visible = photoButtons.filter(
    (button) => !button.closest<HTMLElement>('.gallery-item')?.hidden,
  );
  const index = visible.indexOf(currentPhoto!);
  const next = visible[(index + direction + visible.length) % visible.length];
  if (next) displayPhoto(next);
}
document.querySelector('.dialog-prev')?.addEventListener('click', () => movePhoto(-1));
document.querySelector('.dialog-next')?.addEventListener('click', () => movePhoto(1));
dialog?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    movePhoto(-1);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    movePhoto(1);
  }
});

const referenceBox = document.getElementById('selected-reference');
const referenceName = document.getElementById('reference-name');
const contact = document.getElementById('contacto');
const serviceSelect = document.querySelector<HTMLSelectElement>('#service');
document.getElementById('use-reference')?.addEventListener('click', () => {
  if (!currentPhoto) return;
  selectedReference = {
    number: currentPhoto.dataset.photoNumber ?? '',
    title: currentPhoto.dataset.photoTitle ?? '',
  };
  if (referenceName)
    referenceName.textContent = `${selectedReference.number} · ${selectedReference.title}`;
  if (referenceBox) referenceBox.hidden = false;
  nextFocus = serviceSelect;
  closeDialog();
  contact?.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  });
  serviceSelect?.focus({ preventScroll: true });
});

// On touchscreens, a horizontal swipe browses the visible collection.
let touchStart: { x: number; y: number } | null = null;
dialogImage?.addEventListener(
  'touchstart',
  (event) => {
    if (event.touches.length === 1)
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  },
  { passive: true },
);
dialogImage?.addEventListener(
  'touchend',
  (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(touch.clientY - touchStart.y) * 1.4)
      movePhoto(dx > 0 ? -1 : 1);
    touchStart = null;
  },
  { passive: true },
);

document.getElementById('clear-reference')?.addEventListener('click', () => {
  selectedReference = null;
  if (referenceBox) referenceBox.hidden = true;
  serviceSelect?.focus();
});

document.querySelectorAll<HTMLAnchorElement>('[data-service]').forEach((link) =>
  link.addEventListener('click', () => {
    const value = link.dataset.service;
    const mapped = value === 'Semipermanente' ? 'Esmaltado semipermanente' : value;
    if (serviceSelect && [...serviceSelect.options].some((option) => option.value === mapped))
      serviceSelect.value = mapped ?? '';
  }),
);

document.getElementById('inquiry-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const service = serviceSelect?.value;
  const idea = document.querySelector<HTMLTextAreaElement>('#idea')?.value.trim();
  const lines = ['¡Hola! Me gustaría hacer una consulta a Mora Nail Studio.'];
  if (service) lines.push(`Servicio: ${service}.`);
  if (selectedReference)
    lines.push(
      `Mi referencia de la colección es ${selectedReference.number}: ${selectedReference.title}.`,
    );
  if (idea) lines.push(`Mi idea: ${idea}`);
  lines.push('¿Me contás disponibilidad, precio y ubicación actual?');
  void lines; // La demostración no envía consultas.
  const status = document.getElementById('form-status');
  if (status)
    status.textContent =
      'Demostración: la consulta no se envía y no se reserva ningún turno.';
});

const menuToggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
const mobileNav = document.getElementById('mobile-nav');
function setMenu(open: boolean) {
  if (mobileNav) mobileNav.hidden = !open;
  menuToggle?.setAttribute('aria-expanded', String(open));
  menuToggle?.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
}
menuToggle?.addEventListener('click', () =>
  setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'),
);
mobileNav
  ?.querySelectorAll('a')
  .forEach((link) => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menuToggle.focus();
  }
});
matchMedia('(min-width: 761px)').addEventListener('change', (event) => {
  if (event.matches) setMenu(false);
});

const motion = matchMedia('(prefers-reduced-motion: reduce)');
type Slide = {id:string;number:string;title:string;alt:string;src:string;label:string;tone:string;copyIndex:number};
type HeroCopy = {lines:string[];description:string};
const heroCopies:HeroCopy[]=JSON.parse(document.getElementById('hero-copies')?.textContent||'[]');
const headline=document.querySelector<HTMLElement>('#hero-title');
const headlineLines=[...document.querySelectorAll<HTMLElement>('#hero-title>span')];
const heroDescription=document.querySelector<HTMLElement>('.hero-description');
let currentCopy=0;
function fitHeadline(){
  if(!headline)return;
  const available=headline.clientWidth;
  if(!available)return;
  headlineLines.forEach(line=>{
    line.style.fontSize='';
    const range=document.createRange();range.selectNodeContents(line);
    const width=range.getBoundingClientRect().width;
    if(width>available){const size=parseFloat(getComputedStyle(line).fontSize);line.style.fontSize=(size*available/width*.985).toFixed(2)+'px';}
  });
  if(heroDescription&&heroCopies.length){
    const measure=heroDescription.cloneNode(false) as HTMLElement;
    measure.style.cssText=`position:absolute;visibility:hidden;pointer-events:none;width:${heroDescription.getBoundingClientRect().width}px;min-height:0;height:auto;opacity:0;`;
    heroDescription.parentElement?.append(measure);
    let height=0;heroCopies.forEach(copy=>{measure.textContent=copy.description;height=Math.max(height,measure.getBoundingClientRect().height);});
    measure.remove();heroDescription.style.minHeight=Math.ceil(height)+'px';
  }
}
const slides:Slide[] = JSON.parse(document.getElementById('hero-slides')?.textContent || '[]');
const hero = document.querySelector<HTMLElement>('.hero');
const heroVisual = document.querySelector<HTMLElement>('.hero-visual');
const heroLayers = [...document.querySelectorAll<HTMLElement>('.hero-slide')];
const heroImages = [...document.querySelectorAll<HTMLImageElement>('.hero-slide img')];
const previews = [...document.querySelectorAll<HTMLButtonElement>('.hero-preview')];
let currentIndex=0, layer=0, busy=false;
let autoplay:ReturnType<typeof setTimeout>|undefined;
function playLater(){
  clearTimeout(autoplay);
  gsap.killTweensOf(previews);
  gsap.set(previews,{'--slide-progress':0});
  if(!document.hidden && !motion.matches && slides.length>1){
    gsap.to(previews[currentIndex],{'--slide-progress':1,duration:6,ease:'none'});
    autoplay=setTimeout(()=>{void showSlide(currentIndex+1);},6000);
  }
}
async function showSlide(index:number){
  if(busy || slides.length<2 || heroImages.length!==2 || heroLayers.length!==2)return;
  const next=(index+slides.length)%slides.length;
  if(next===currentIndex){playLater();return;}
  busy=true;clearTimeout(autoplay);
  gsap.killTweensOf(previews);
  if(hero)hero.dataset.transitioning='true';
  const incoming=heroLayers[1-layer],outgoing=heroLayers[layer],slide=slides[next];
  const incomingImage=heroImages[1-layer];
  const direction=index<currentIndex?-1:1;
  try{
    incomingImage.src=slide.src;await incomingImage.decode();
    const reduced=motion.matches,duration=reduced ? 0.32 : 1.5;
    incomingImage.alt=slide.alt;incoming.removeAttribute('aria-hidden');outgoing.setAttribute('aria-hidden','true');
    gsap.set(incoming,{zIndex:2,autoAlpha:0,xPercent:reduced?0:direction*6,scale:reduced?1:1.08,filter:reduced?'none':'blur(9px)'});
    gsap.set(outgoing,{zIndex:1,autoAlpha:1,xPercent:0,filter:'none'});
    const caption=document.getElementById('hero-caption');
    const category=document.getElementById('hero-category');
    const nextCopy=slide.copyIndex??next%Math.max(1,heroCopies.length);
    const changeCopy=nextCopy!==currentCopy&&!!heroCopies[nextCopy];
    const labels=[caption,category,...(changeCopy?[...headlineLines,heroDescription]:[])].filter((element):element is HTMLElement=>!!element);
    gsap.killTweensOf(labels);
    await new Promise<void>(resolve=>{
      gsap.timeline({onComplete:resolve})
        .to(outgoing,{opacity:0,xPercent:reduced?0:direction*-4,scale:reduced?1:1.04,filter:reduced?'none':'blur(4px)',duration,ease:'power2.inOut'},0)
        .to(incoming,{autoAlpha:1,xPercent:0,scale:1,filter:'blur(0px)',duration,ease:'power2.inOut'},0)
        .to(hero,{'--tone':slide.tone,duration,ease:'power2.inOut'},0)
        .to(labels,{opacity:0,y:reduced?0:-6,duration:duration*.2},0)
        .call(()=>{
          if(caption)caption.textContent=slide.title;
          if(category)category.textContent=slide.label;
          if(changeCopy){
            headlineLines.forEach((line,index)=>{line.textContent=heroCopies[nextCopy].lines[index]||'';});
            if(heroDescription)heroDescription.textContent=heroCopies[nextCopy].description;
            if(headline)headline.dataset.copyIndex=String(nextCopy);
            currentCopy=nextCopy;fitHeadline();
          }
          const counter=document.getElementById('hero-position');
          if(counter)counter.textContent=String(next+1).padStart(2,'0');
          previews.forEach((button,i)=>{button.classList.toggle('is-active',i===next);button.setAttribute('aria-pressed',String(i===next));});
        },[],duration*.25)
        .fromTo(labels,{opacity:0,y:reduced?0:8},{opacity:1,y:0,duration:duration*.45,ease:'power2.out'},duration*.26);
    });
    outgoing.classList.remove('is-current');incoming.classList.add('is-current');
    gsap.set(outgoing,{autoAlpha:0,xPercent:0,scale:1,filter:'none'});
    gsap.set(incoming,{filter:'none'});
    currentIndex=next;layer=1-layer;
    if(hero)hero.dataset.activeSlide=String(currentIndex);
    const previewStrip=document.querySelector<HTMLElement>('.hero-previews');
    if(previewStrip&&previews[next])previewStrip.scrollTo({left:previews[next].offsetLeft-previewStrip.clientWidth/2+previews[next].clientWidth/2,behavior:reduced?'instant':'smooth'});
    const preload=new Image();preload.src=slides[(next+1)%slides.length].src;
  }catch{
    gsap.set(outgoing,{autoAlpha:1,xPercent:0,scale:1,filter:'none'});
    gsap.set(incoming,{autoAlpha:0,xPercent:0,scale:1,filter:'none'});
    outgoing.removeAttribute('aria-hidden');incoming.setAttribute('aria-hidden','true');
  }finally{busy=false;if(hero)hero.dataset.transitioning='false';playLater();}
}
if(hero){hero.dataset.transitioning='false';hero.dataset.activeSlide='0';}
document.getElementById('hero-prev')?.addEventListener('click',()=>{void showSlide(currentIndex-1);});
document.getElementById('hero-next')?.addEventListener('click',()=>{void showSlide(currentIndex+1);});
previews.forEach((button,i)=>button.addEventListener('click',()=>{void showSlide(i);}));
heroVisual?.addEventListener('keydown',event=>{
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();void showSlide(currentIndex+(event.key==='ArrowRight'?1:-1));}
});
let dragStart:{x:number;y:number}|null=null;
heroVisual?.addEventListener('pointerdown',event=>{dragStart={x:event.clientX,y:event.clientY};});
heroVisual?.addEventListener('pointerup',event=>{
  if(!dragStart)return;
  const x=event.clientX-dragStart.x,y=event.clientY-dragStart.y;
  if(Math.abs(x)>45&&Math.abs(x)>Math.abs(y)*1.5)void showSlide(currentIndex+(x<0?1:-1));
  dragStart=null;
});
heroVisual?.addEventListener('pointercancel',()=>{dragStart=null;});
document.addEventListener('visibilitychange',playLater);
motion.addEventListener('change',playLater);
playLater();

// Native horizontal scrolling remains available for touch, keyboard and reduced motion.
const galleryWindow=document.querySelector<HTMLElement>('.gallery-window');
const gallery=document.querySelector<HTMLElement>('.gallery');
const collection=document.querySelector<HTMLElement>('.collection');
const media=gsap.matchMedia();
let scrollContext:gsap.Context|undefined;
function setUpCollection(){
  scrollContext?.revert();
  collection?.classList.remove('is-pinned');
  if(!gallery || !galleryWindow || !collection)return;
  galleryWindow.scrollLeft=0;
  const distance=gallery.scrollWidth-galleryWindow.clientWidth;
  if(motion.matches || innerWidth<1000 || innerHeight<800 || distance<60)return;
  scrollContext=gsap.context(()=>{
    collection.classList.add('is-pinned');
    gsap.to(gallery,{x:()=>-Math.max(0,gallery.scrollWidth-galleryWindow.clientWidth),ease:'none',scrollTrigger:{id:'lookbook',trigger:galleryWindow,start:'top 35px',end:()=>'+='+Math.max(400,gallery.scrollWidth-galleryWindow.clientWidth),scrub:.65,pin:galleryWindow,invalidateOnRefresh:true}});
  },collection);
}
filters.forEach(button=>button.addEventListener('click',()=>{requestAnimationFrame(()=>{setUpCollection();ScrollTrigger.refresh();});}));
let keyboardNavigation=false;
document.addEventListener('keydown',event=>{keyboardNavigation=event.key==='Tab';});
document.addEventListener('pointerdown',()=>{keyboardNavigation=false;});
galleryWindow?.addEventListener('focusin',event=>{
  if(!keyboardNavigation)return;
  const target=event.target instanceof HTMLElement?event.target.closest<HTMLElement>('.gallery-item'):null;
  const trigger=ScrollTrigger.getById('lookbook');
  if(!target||!trigger||!gallery)return;
  const distance=gallery.scrollWidth-galleryWindow.clientWidth;
  if(distance>0){galleryWindow.scrollLeft=0;window.scrollTo({top:trigger.start+Math.min(1,target.offsetLeft/distance)*(trigger.end-trigger.start),behavior:'instant'});}
});
media.add('(prefers-reduced-motion: no-preference)',()=>{
  document.body.classList.add('motion-ready');
  const revealTargets=gsap.utils.toArray<HTMLElement>('.section-heading > *, .palette-copy > *, .services-header > div, .service-list > details, .booking-intro > *, .booking-card, .contact-heading > *, .inquiry-form, .contact-photo-caption, .faq-heading > *, .faq-list article, .footer-top > *');
  const distance=innerWidth<761?28:50;
  revealTargets.forEach(element=>{element.dataset.scrollReveal='true';});
  gsap.set(revealTargets,{opacity:0,y:distance});
  ScrollTrigger.batch(revealTargets,{
    start:'top 91%',once:true,batchMax:4,interval:.08,
    onEnter:batch=>gsap.to(batch,{opacity:1,y:0,duration:1,stagger:.1,ease:'power3.out',overwrite:'auto',clearProps:'opacity,transform'}),
  });
  gsap.from('.hero h1>span',{yPercent:30,opacity:0,stagger:.08,duration:1.05,ease:'power3.out',clearProps:'transform,opacity'});
  gsap.from('.hero-visual',{clipPath:'inset(0 0 100% 0)',duration:1.25,ease:'power3.inOut',clearProps:'clipPath'});
  gsap.to('.polish-bottle',{y:-12,rotation:-9,duration:3.2,repeat:-1,yoyo:true,ease:'sine.inOut'});
  gsap.fromTo('.polish-bottle',{rotationY:-9},{rotationY:9,ease:'none',scrollTrigger:{trigger:'.palette-section',start:'top bottom',end:'bottom top',scrub:1.2}});
  gsap.fromTo('.shot-frame',{y:24,rotation:-3},{y:-18,rotation:3,ease:'none',scrollTrigger:{trigger:'.service-editorial',start:'top bottom',end:'bottom top',scrub:1}});
  gsap.fromTo('.palette-atmosphere img',{yPercent:-5},{yPercent:5,ease:'none',scrollTrigger:{trigger:'.palette-section',start:'top bottom',end:'bottom top',scrub:1.1}});
  gsap.fromTo('.booking-backdrop img',{yPercent:-5},{yPercent:5,ease:'none',scrollTrigger:{trigger:'.booking-section',start:'top bottom',end:'bottom top',scrub:1.2}});
  gsap.fromTo('.contact-photo > img',{scale:1.12,yPercent:-4},{yPercent:4,ease:'none',scrollTrigger:{trigger:'.contact-photo',start:'top bottom',end:'bottom top',scrub:1.2}});
  gsap.fromTo('.contact-photo',{clipPath:'inset(5% 5% 5% 5% round 18px)'},{clipPath:'inset(0% 0% 0% 0% round 0px)',duration:1.25,ease:'power3.out',scrollTrigger:{trigger:'.contact-photo',start:'top 82%',once:true}});
  gsap.utils.toArray<HTMLElement>('.section-heading h2,.palette-copy h2,.services-header h2,.booking-intro h2,.contact-heading h2,.faq-heading h2').forEach(title=>{
    gsap.fromTo(title,{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0% 0)',duration:1.1,ease:'power3.out',clearProps:'clipPath',scrollTrigger:{trigger:title,start:'top 94%',once:true}});
  });
  return ()=>{document.body.classList.remove('motion-ready');};
});
let resizeTimer:ReturnType<typeof setTimeout>;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{setUpCollection();fitHeadline();},180);});
motion.addEventListener('change',()=>{setUpCollection();ScrollTrigger.refresh();});
void document.fonts.ready.then(()=>{setUpCollection();fitHeadline();});
window.addEventListener('load',()=>{setUpCollection();ScrollTrigger.refresh();});

const palette=document.querySelector<HTMLElement>('.palette-section');
const polishHost=document.getElementById('polish-3d');
let polishViewer:PolishViewer|null=null;
let requestedColor='#782f3e';
async function loadPolish(){
  if(!polishHost||polishHost.dataset.state)return;
  polishHost.dataset.state='loading';
  try{
    const {createPolishViewer}=await import('./polish-viewer');
    polishViewer=await createPolishViewer(polishHost,requestedColor);
    if(polishHost.dataset.color!==requestedColor.slice(1))polishViewer.changeColor(requestedColor);
  }catch{
    polishHost.dataset.state='fallback';polishHost.replaceChildren();
    if(polishHost.parentElement)polishHost.parentElement.dataset.polishRenderer='fallback';
  }
}
if(polishHost){
  const viewerObserver=new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting)){viewerObserver.disconnect();void loadPolish();}
  },{rootMargin:'250px'});viewerObserver.observe(polishHost);
}
document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button=>button.addEventListener('click',()=>{
  if(!palette)return;
  document.querySelectorAll('[data-color]').forEach(other=>{other.classList.toggle('is-selected',other===button);other.setAttribute('aria-pressed',String(other===button));});
  requestedColor=button.dataset.color||'#782f3e';
  palette.style.setProperty('--polish',requestedColor);
  if(polishViewer?.available())polishViewer.changeColor(requestedColor);
  const label=document.querySelector('.palette-color-name');if(label)label.textContent=button.dataset.colorName||'';
  if(!motion.matches){gsap.fromTo('.palette-disc',{scale:.94},{scale:1.04,duration:1,ease:'power2.out'});if(!polishViewer?.available())gsap.fromTo('.polish-glass',{rotationY:-12},{rotationY:0,duration:.8,ease:'power2.out'});}
}));

document.querySelectorAll<HTMLDetailsElement>('.service-row').forEach(details=>{
  const summary=details.querySelector('summary');
  const body=details.querySelector<HTMLElement>('.service-body');
  if(!summary)return;
  let desired=details.open,transitioning=false;
  summary.addEventListener('click',event=>{
    event.preventDefault();
    const startHeight=details.getBoundingClientRect().height;
    desired=!desired;
    gsap.killTweensOf(details);
    transitioning=true;
    if(desired)details.open=true;
    details.style.height='auto';
    const targetHeight=desired?details.getBoundingClientRect().height:summary.offsetHeight;
    gsap.set(details,{height:startHeight,overflow:'hidden'});
    const opening=desired;
    gsap.to(details,{height:targetHeight,duration:motion.matches ? 0.28 : 0.72,ease:'power3.inOut',onComplete:()=>{
      details.open=opening;transitioning=false;gsap.set(details,{clearProps:'height,overflow'});ScrollTrigger.refresh();
    }});
  });
  details.addEventListener('toggle',()=>{
    if(!transitioning)desired=details.open;
    if(details.open && body && !motion.matches)gsap.fromTo(body,{opacity:0,y:-8},{opacity:1,y:0,duration:.5,clearProps:'opacity,transform',overwrite:'auto'});
  });
  motion.addEventListener('change',()=>{
    if(motion.matches&&transitioning){gsap.killTweensOf(details);details.open=desired;transitioning=false;gsap.set(details,{clearProps:'height,overflow'});}
  });
});

// Animate from the current scale, including when the pointer changes direction mid-zoom.
photoButtons.forEach(button=>{
  const image=button.querySelector('img');if(!image)return;
  button.addEventListener('pointerenter',event=>{
    if(motion.matches||event.pointerType==='touch')return;
    gsap.to(image,{scale:1.055,duration:1.05,ease:'power3.out',overwrite:'auto'});
  });
  button.addEventListener('pointerleave',()=>{
    gsap.to(image,{scale:1,duration:motion.matches?0:.85,ease:'power3.out',overwrite:'auto'});
  });
});
motion.addEventListener('change',()=>{if(motion.matches)gsap.set('.photo-button img',{scale:1});});

