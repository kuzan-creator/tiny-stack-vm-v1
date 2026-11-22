// Tiny Stack VM v1: full ISA.md interpreter; one run answers a whole set.
// Traps: 2 underflow 3 overflow 4 div0 5 bad-op 6 memory 7 call-depth
// 8 empty-RET 9 pc 10 steps 11 output; a trap keeps prior output.
import{mkdirSync,readdirSync,readFileSync,writeFileSync}from"node:fs";
// Opcode table, packed: op<<7|imm<<4|pops<<2|pushes (37 opcodes).
const S=[0,145,321,388,518,650,779,911,2057,2185,2313,2441,2569,2697,2825,2949,3081,3209,3337,3461,3593,3721,3849,4105,4233,4361,6176,6308,6436,6560,6656,8197,8328,10244,10372,10497,10628];
const T=new Uint16Array(256);
for(const v of S)T[v>>7]=128|(v&127);
function run(p,q){
 const n=p.length,D=new Int32Array(256),C=new Int32Array(64),M=new Int32Array(256),o=new Uint8Array(65536),g=new Uint8Array(12);
 let s=0,c=0,l=0,i=0,pc=0,t=0;
 const done=e=>({out:o.slice(0,l),code:e});
 for(;;){
  if(t==1e6)return done(10);
  if(pc<0||pc>=n)return done(9);
  const op=p[pc],m=T[op];
  if(m<128)return done(5);
  const im=(m>>4)&7;
  if(pc+im>=n)return done(9);
  t++;
  const nx=pc+1+im,po=(m>>2)&3,pu=m&3;
  if(s<po)return done(2);
  if(s-po+pu>256)return done(3);
  pc=nx;
  switch(op){
   case 0:return done(0);
   case 1:D[s++]=(p[pc-1]<<24)>>24;break;
   case 2:D[s++]=p[pc-4]|p[pc-3]<<8|p[pc-2]<<16|p[pc-1]<<24;break;
   case 3:s--;break;
   case 4:D[s]=D[s-1];s++;break;
   case 5:{const v=D[s-1];D[s-1]=D[s-2];D[s-2]=v;break;}
   case 6:D[s]=D[s-2];s++;break;
   case 7:{const a=D[s-3];D[s-3]=D[s-2];D[s-2]=D[s-1];D[s-1]=a;break;}
   case 23:D[s-1]=-D[s-1]|0;break;
   case 27:D[s-1]=~D[s-1];break;
   case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 24:case 25:case 26:case 28:case 29:case 30:case 32:case 33:case 34:{
    const b=D[s-1],a=D[s-2];
    let r;
    if(op>=19&&op<=22&&!b)return done(4);
    if(op==16)r=a+b|0;
    else if(op==17)r=a-b|0;
    else if(op==18)r=Math.imul(a,b);
    else if(op==19)r=a/b|0;
    else if(op==20)r=a%b|0;
    else if(op==21)r=(a>>>0)/(b>>>0)|0;
    else if(op==22)r=(a>>>0)%(b>>>0)|0;
    else if(op==24)r=a&b;
    else if(op==25)r=a|b;
    else if(op==26)r=a^b;
    else if(op==28)r=a<<(b&31);
    else if(op==29)r=a>>(b&31);
    else if(op==30)r=a>>>(b&31)|0;
    else if(op==32)r=a==b?1:0;
    else if(op==33)r=a<b?1:0;
    else r=(a>>>0)<(b>>>0)?1:0;
    s-=2;D[s++]=r;break;}
   case 48:case 49:case 50:{
    const rel=(p[pc-2]|p[pc-1]<<8)<<16>>16;
    let k=true;
    if(op!=48){const v=D[--s];k=op==49?v==0:v!=0;}
    if(k)pc=nx+rel;break;}
   case 51:
    if(c==64)return done(7);
    C[c++]=nx;pc=p[pc-2]|p[pc-1]<<8;break;
   case 52:
    if(!c)return done(8);
    pc=C[--c];break;
   case 64:{const a=D[s-1];if(a<0||a>255)return done(6);D[s-1]=M[a];break;}
   case 65:{const a=D[s-1],v=D[s-2];if(a<0||a>255)return done(6);s-=2;M[a]=v;break;}
   case 80:{
    const v=D[s-1];
    let u=v<0?-v:v,d=0;
    if(!u)g[d++]=48;else while(u>0){g[d++]=48+u%10;u=Math.floor(u/10);}
    if(v<0)g[d++]=45;
    if(l+d>65536)return done(11);
    s--;for(let j=d-1;j>=0;j--)o[l++]=g[j];break;}
   case 81:
    if(l+1>65536)return done(11);
    o[l++]=D[--s]&255;break;
   case 82:D[s++]=i<q.length?q[i++]:-1;break;
   case 83:return done(D[--s]&255);
   default:return done(5);
  }
 }
}
const I=process.env.MAKEFUN_INPUT_DIR??"/input",O=process.env.MAKEFUN_OUTPUT_DIR??"/output";
for(const id of readdirSync(I).sort()){
 const d=I+"/"+id+"/",e=O+"/"+id+"/";
 const r=run(new Uint8Array(readFileSync(d+"program.bin")),new Uint8Array(readFileSync(d+"input.bin")));
 mkdirSync(e,{recursive:true});
 writeFileSync(e+"stdout.bin",r.out);
 writeFileSync(e+"exit.txt",r.code+"\n");
}
