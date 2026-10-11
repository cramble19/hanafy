import { useEffect, useRef } from 'react'
import './cramble-background.css'

/** Decorative only: no tracker state, network, or input handling. */
export function CrambleBackground() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const ctx: CanvasRenderingContext2D = context
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let seed=713;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
 const colors=['236,230,255','177,143,255','247,161,218','153,177,255'];
 const stars=Array.from({length:170},()=>({x:random(),y:random(),r:.3+random()*.75,phase:random()*6.28,speed:.22+random()*.3,color:colors[Math.floor(random()*4)]}));
 const dust=Array.from({length:10500},()=>{const r=Math.pow(random(),.65),arm=Math.floor(random()*3),angle=arm*2.094+r*7.8+(random()-.5)*(.65+r*.9);return{x:Math.cos(angle)*r,y:Math.sin(angle)*r,r:.18+random()*.62,alpha:.08+(1-r)*.21+random()*.13,color:colors[Math.floor(random()*4)]}});
 dust.push(...Array.from({length:2600},()=>{const r=Math.sqrt(random()),a=random()*Math.PI*2;return{x:Math.cos(a)*r,y:Math.sin(a)*r,r:.15+random()*.45,alpha:.06+random()*.12,color:colors[Math.floor(random()*4)]}}));
 const clouds=Array.from({length:130},(_,i)=>{const r=.18+random()*.78,angle=(i%3)*2.094+r*7.8+(random()-.5)*.38;return{x:Math.cos(angle)*r,y:Math.sin(angle)*r,size:.065+random()*.17,alpha:.026+random()*.044,color:['126,74,221','211,80,177','86,111,230'][i%3]}});
 const letters=document.createElement('canvas');letters.width=80;letters.height=32;
 const lc=letters.getContext('2d')!;lc.font='24px Georgia';lc.fillStyle='#fff';lc.fillText('hana',2,25);
 const pixels=lc.getImageData(0,0,80,32).data,nameStars: {x:number;y:number;r:number;phase:number}[]=[];
 for(let y=3;y<29;y+=2.1)for(let x=0;x<64;x+=2.1){if(pixels[(Math.floor(y)*80+Math.floor(x))*4+3]>90)nameStars.push({x,y,r:.3+random()*.35,phase:random()*6.28})}
 let cometPeriod=0;const comets=Array.from({length:120},()=>{const start=cometPeriod;cometPeriod+=.2+random()*.3;return{start,x:.15+random()*.95,y:random()*.85,duration:2.5+random()*1.2,dx:.1+random()*.19,dy:.12+random()*.18,tail:20+random()*23,color:colors[Math.floor(random()*4)]}});
 let w=448,h=720,frame=0,visible=true,disposed=false,lastDraw=0;
 const started=performance.now();
 const nebula=document.createElement('canvas');
 function glow(context: CanvasRenderingContext2D,x:number,y:number,r:number,color:string,alpha:number){const g=context.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(.4,`rgba(${color},${alpha*.4})`);g.addColorStop(1,`rgba(${color},0)`);context.fillStyle=g;context.fillRect(x-r,y-r,r*2,r*2)}
 function paintNebula(dpr:number){
  nebula.width=Math.round(w*1.2*dpr);nebula.height=Math.round(w*1.2*dpr);const c=nebula.getContext('2d')!;c.setTransform(dpr,0,0,dpr,0,0);
  c.save();c.translate(w*.6,w*.6);
  const radius=w*.43;
  glow(c,0,0,radius*1.2,'118,96,205',.15);
  c.globalCompositeOperation='screen';
  for(const p of clouds)glow(c,p.x*radius,p.y*radius,p.size*radius,p.color,p.alpha);
  for(const p of dust){c.fillStyle=`rgba(${p.color},${p.alpha})`;c.beginPath();c.arc(p.x*radius,p.y*radius,p.r,0,Math.PI*2);c.fill()}
  glow(c,0,0,36,'233,182,228',.42);glow(c,0,0,15,'246,221,238',.44);glow(c,0,0,5,'255,240,228',.56);c.restore();
 }
 function draw(ms:number){
  const t=reduce.matches?0:Math.max(0,ms-started)/1000;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#191a22';ctx.fillRect(0,0,w,h);
  glow(ctx,w*.98,70,w*.7,'102,67,164',.19);glow(ctx,w*.6,150,w*.48,'88,62,125',.08);
  ctx.save();ctx.translate(w*.86,70);ctx.rotate(-.42);ctx.scale(1,.65);ctx.rotate(t*Math.PI*2/180);ctx.drawImage(nebula,-w*.6,-w*.6,w*1.2,w*1.2);ctx.restore();
  glow(ctx,w*.05,h*.76,w*.6,'58,42,76',.065);
  for(const s of stars){const alpha=.16+.36*(.5+.5*Math.sin(t*s.speed+s.phase)),x=s.x*w,y=s.y*h;glow(ctx,x,y,s.r*4,s.color,alpha*.28);ctx.fillStyle=`rgba(${s.color},${alpha})`;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill()}
  for(const p of nameStars){const x=w*.11+p.x,y=218+p.y,alpha=.38+.13*Math.sin(t*.5+p.phase);glow(ctx,x,y,2,'229,210,243',alpha*.22);ctx.fillStyle=`rgba(229,210,243,${alpha})`;ctx.beginPath();ctx.arc(x,y,p.r,0,Math.PI*2);ctx.fill()}
  if(!reduce.matches)for(const c of comets){
   const age=((t-c.start)%cometPeriod+cometPeriod)%cometPeriod;if(age>c.duration)continue;
   const p=age/c.duration,x=(c.x-p*c.dx)*w,y=(c.y+p*c.dy)*h,fade=Math.sin(p*Math.PI)*.24;
   const vx=c.dx*w,vy=-c.dy*h,len=Math.hypot(vx,vy),tx=x+vx/len*c.tail,ty=y+vy/len*c.tail;
   const g=ctx.createLinearGradient(x,y,tx,ty);g.addColorStop(0,`rgba(${c.color},${fade})`);g.addColorStop(1,`rgba(${c.color},0)`);
   ctx.strokeStyle=g;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();glow(ctx,x,y,2.6,c.color,fade*.7);
  }
 }
    // Cache the dense galaxy once per resize; animate its bitmap at 30 fps.
    function loop(ms: number) {
      if (disposed || !visible || document.hidden || reduce.matches) return
      if (ms - lastDraw >= 1000 / 30) { draw(ms); lastDraw = ms }
      frame = requestAnimationFrame(loop)
    }
    function schedule() {
      cancelAnimationFrame(frame)
      if (disposed || !visible || document.hidden) return
      draw(performance.now())
      if (!reduce.matches) frame = requestAnimationFrame(loop)
    }
    function resize() {
      const box = canvas!.getBoundingClientRect()
      w = box.width; h = box.height
      if (!w || !h) return
      const dpr = Math.min(devicePixelRatio || 1, 2)
      canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintNebula(dpr)
      schedule()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting
      schedule()
    })
    intersection.observe(canvas)
    reduce.addEventListener('change', schedule)
    document.addEventListener('visibilitychange', schedule)
    resize()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      intersection.disconnect()
      reduce.removeEventListener('change', schedule)
      document.removeEventListener('visibilitychange', schedule)
    }
  }, [])
  return <canvas ref={ref} className="cramble-cosmic-background" aria-hidden="true" />
}
