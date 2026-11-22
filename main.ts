// Tiny Stack VM v1: a complete interpreter for make.fun's tiny stack ISA v1.
// One run answers a whole set: /input/<id>/program.bin + input.bin ->
// /output/<id>/stdout.bin + exit.txt. Every hard rule is honoured: exact
// low-32 MUL, INT_MIN / -1, signed-remainder sign, unsigned DIVU / MODU /
// LTU, shifts masked to 5 bits, SHR vs SHRU, PUSH8 sign extension, EXIT's
// low byte, all ten traps with their own codes, step and output limits,
// falling off the end, and IN = -1 once the input is used up. A trap
// keeps whatever was printed before it.
// Traps: 2 underflow, 3 overflow, 4 div-by-zero, 5 bad opcode, 6 memory,
// 7 call depth, 8 empty RET, 9 pc, 10 steps, 11 output.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// [opcode, immediate bytes, pops, pushes]
const S = [[0,0,0,0],[1,1,0,1],[2,4,0,1],[3,0,1,0],[4,0,1,2],[5,0,2,2],[6,0,2,3],[7,0,3,3],[16,0,2,1],[17,0,2,1],[18,0,2,1],[19,0,2,1],[20,0,2,1],[21,0,2,1],[22,0,2,1],[23,0,1,1],[24,0,2,1],[25,0,2,1],[26,0,2,1],[27,0,1,1],[28,0,2,1],[29,0,2,1],[30,0,2,1],[32,0,2,1],[33,0,2,1],[34,0,2,1],[48,2,0,0],[49,2,1,0],[50,2,1,0],[51,2,0,0],[52,0,0,0],[64,0,1,1],[65,0,2,0],[80,0,1,0],[81,0,1,0],[82,0,0,1],[83,0,1,0]];
const IM = new Int8Array(256).fill(-1), PO = new Uint8Array(256), PU = new Uint8Array(256);
for (const [a, b, c, d] of S) { IM[a] = b; PO[a] = c; PU[a] = d; }
function run(p, q) {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256), o = new Uint8Array(65536), g = new Uint8Array(12);
  let s = 0, c = 0, l = 0, i = 0, pc = 0, t = 0;
  const done = (e) => ({ out: o.slice(0, l), code: e });
  for (;;) {
    if (t === 1000000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = p[pc], im = IM[op];
    if (im < 0) return done(5);
    if (pc + im >= n) return done(9);
    t++;
    const nx = pc + 1 + im, po = PO[op], pu = PU[op];
    if (s < po) return done(2);
    if (s - po + pu > 256) return done(3);
    pc = nx;
    switch (op) {
      case 0: return done(0);
      case 1: D[s++] = (p[pc - 1] << 24) >> 24; break;
      case 2: D[s++] = p[pc - 4] | (p[pc - 3] << 8) | (p[pc - 2] << 16) | (p[pc - 1] << 24); break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: { const v = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = v; break; }
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: { const a = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = a; break; }
      case 23: D[s - 1] = (-D[s - 1]) | 0; break;
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = D[s - 1], a = D[s - 2];
        let r;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (!b) return done(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (!b) return done(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 21) { if (!b) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (!b) return done(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        s -= 2; D[s++] = r; break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[pc - 2] | (p[pc - 1] << 8)) << 16) >> 16;
        let k = true;
        if (op !== 48) { const v = D[--s]; k = op === 49 ? v === 0 : v !== 0; }
        if (k) pc = nx + rel;
        break;
      }
      case 51:
        if (c === 64) return done(7);
        C[c++] = nx; pc = p[pc - 2] | (p[pc - 1] << 8); break;
      case 52:
        if (!c) return done(8);
        pc = C[--c]; break;
      case 64: { const a = D[s - 1]; if (a < 0 || a > 255) return done(6); D[s - 1] = M[a]; break; }
      case 65: { const a = D[s - 1], v = D[s - 2]; if (a < 0 || a > 255) return done(6); s -= 2; M[a] = v; break; }
      case 80: {
        const v = D[s - 1];
        let u = v < 0 ? -v : v, d = 0;
        if (!u) g[d++] = 48;
        else while (u > 0) { g[d++] = 48 + (u % 10); u = Math.floor(u / 10); }
        if (v < 0) g[d++] = 45;
        if (l + d > 65536) return done(11);
        s--;
        for (let j = d - 1; j >= 0; j--) o[l++] = g[j];
        break;
      }
      case 81:
        if (l + 1 > 65536) return done(11);
        o[l++] = D[--s] & 255; break;
      case 82: D[s++] = i < q.length ? q[i++] : -1; break;
      case 83: return done(D[--s] & 255);
      default: return done(5);
    }
  }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input', O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), r.code + '\n');
}
